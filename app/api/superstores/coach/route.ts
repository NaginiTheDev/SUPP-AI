import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { z } from "zod";
import {
  gatherCandidates,
  getVariants,
  buildCartPermalink,
  formatUSD,
  CURRENCY,
} from "@/lib/superstores/catalog";
import type { SuperstoresProfile } from "@/lib/superstores/profile";
import { KNOWLEDGE_BASE } from "@/lib/knowledge";

export const maxDuration = 30;

// Static persona + rules + general trainer knowledge. Identical on every
// request, so it lives in a cached system block (Anthropic prompt caching) —
// the large knowledge base is then near-free on cache hits. Per-customer
// specifics go in a separate, uncached system block after the cache breakpoint.
const STATIC_SYSTEM = `You are "Coach", an expert supplement advisor for Supplement Superstores (USA). You design a supplement stack tailored to ONE customer's profile, choosing ONLY from a candidate list provided with each request. Prices are in US dollars (${CURRENCY}).

Hard rules:
- Choose items ONLY from the candidate list provided with the request. Use the exact variantId. Never invent products or prices.
- The stack TOTAL must be at or under the customer's budget. This is a HARD limit — never exceed it. Before finalising, add up your chosen items' prices and confirm the total fits; if it overshoots, drop or downsize the lowest-priority item until it fits. Only include items that actually fit. If the foundational item nearly uses up the budget, return just that one item. If budget allows, you may pick a cheaper foundational option to fit complementary items.
- List items in priority order: the FIRST item must be the single most important supplement for their goal, then complementary items in descending importance.
- The summary must describe ONLY the person's situation and training approach (goal, body stats, protein target, what matters for them). It must NOT mention any supplement, product, or category, nor state how many items are in the stack — lower-priority items may not fit the budget, so any product reference there risks promising something not in the final cart. All per-product detail belongs in each item's own reason.
- Build a complete, well-rounded stack. Every supplement category is a valid, effective recommendation. When there's budget room, add items that genuinely support the customer's goal and focus areas (3-5 items is ideal when budget allows) rather than returning too few. Never add an item that conflicts with their diet, notes, or another item in the stack.
- ALWAYS respect dietary needs, stated allergens/ingredients, injuries, and health conditions. Don't duplicate supplements they already take. Never stack multiple stimulants (pre-workout + energy drink + thermogenic) into an unsafe caffeine load.
- Use the knowledge base below to choose the right products, doses, timing, and synergies, and to coach like a real trainer. Tailor every reason to the person — specific and motivating, never generic.

# TRAINER KNOWLEDGE BASE — NUTRITION & BODYBUILDING (reference for your reasoning)
${KNOWLEDGE_BASE}`;

// Estimate a daily protein target — gives the AI a concrete anchor for sizing
// the protein portion of the stack.
function proteinTarget(p: SuperstoresProfile): number {
  const perKg = p.goal === "muscle-gain" ? 2.0 : p.goal === "fat-loss" ? 2.2 : 1.6;
  return Math.round(p.weightKg * perKg);
}

function bmi(p: SuperstoresProfile): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}

const StackSchema = z.object({
  stackName: z.string().describe("A short, punchy name for this stack, e.g. 'Lean Muscle Builder'"),
  summary: z
    .string()
    .describe(
      "2–3 sentences on THIS person's situation and training approach ONLY — their goal, body stats, daily protein target, and what will move the needle for them. Do NOT mention any supplement, product, or category, and do NOT state how many items are in the stack. The products appear as cards below; per-product detail goes in each item's reason.",
    ),
  items: z
    .array(
      z.object({
        variantId: z.number().describe("MUST be a variantId from the candidate list"),
        quantity: z.number().int().min(1).max(3).default(1),
        reason: z.string().describe("One sentence: why this item, tailored to their profile"),
        dosage: z
          .string()
          .describe("Practical how-and-when to take it, e.g. '1 scoop (30g) in water within 30 min post-workout'"),
      }),
    )
    .min(1)
    .max(5),
  tips: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2–4 short, actionable coaching tips for this person (training, nutrition, timing, hydration)"),
});

export async function POST(req: Request) {
  const profile = (await req.json()) as SuperstoresProfile;

  if (!profile?.goal || !profile?.budget) {
    return Response.json({ error: "Missing goal or budget" }, { status: 400 });
  }

  // Accept the conventional ANTHROPIC_API_KEY or a lowercase `anthropic` var.
  // Strip whitespace/newlines pasted into the env value — a stray newline makes
  // it an invalid HTTP header value and throws inside the SDK.
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.anthropic || "").replace(/\s+/g, "");
  if (!apiKey) {
    console.error("[superstores-coach] No Anthropic API key set (ANTHROPIC_API_KEY or anthropic)");
    return Response.json(
      { error: "The AI coach isn't configured on the server yet (missing API key)." },
      { status: 503 },
    );
  }
  const anthropic = createAnthropic({ apiKey });

  try {
    const candidates = await gatherCandidates(profile.goal, profile.budget);
    if (candidates.length === 0) {
      return Response.json(
        { error: `No products available under ${formatUSD(profile.budget)}. Try a higher budget.` },
        { status: 422 },
      );
    }

    const candidateList = candidates
      .map((c) => {
        const desc = c.description ? ` | ${c.description.slice(0, 120)}` : "";
        return `- variantId ${c.variantId} | ${c.title} | ${c.vendor} | ${c.category} | ${formatUSD(c.price)}${
          c.tags.length ? ` | tags: ${c.tags.join(", ")}` : ""
        }${desc}`;
      })
      .join("\n");

    const dietLine = profile.diet.filter((d) => d !== "none");
    // Per-customer system block — varies per request, so it sits AFTER the cached
    // static block (no cache breakpoint here).
    const dynamicSystem = `THIS CUSTOMER'S CONTEXT:
- Goal: ${profile.goal}. Lead the stack with the foundational supplement for this goal (see GOAL FOUNDATIONS).
- Monthly budget: ${formatUSD(profile.budget)}. HARD cap — never exceed. Use it well: if there's room for a useful addition that supports their goal/focus, include it.
- Dietary needs: ${dietLine.length ? dietLine.join(", ") : "none stated"} (vegan → avoid whey/casein; lactose-free → avoid milk-based protein).
- Extra focus areas: ${profile.focus.length ? profile.focus.join(", ") : "none"} — let these shape the support picks (e.g. sleep → magnesium; joints → omega-3).
- Honour their own words: avoid stated allergens/ingredients, account for injuries, don't duplicate supplements they already take, and respect brand preferences when possible. If a note rules out a normally-ideal pick, choose the best alternative and say so in that item's reason.`;

    const prompt = `CUSTOMER PROFILE
- Goal: ${profile.goal}
- Gender: ${profile.gender}, Age: ${profile.age}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg (BMI ~${bmi(profile)})
- Estimated daily protein target: ~${proteinTarget(profile)} g
- Training experience: ${profile.experience}, ${profile.trainingDaysPerWeek} days/week
- Dietary: ${dietLine.length ? dietLine.join(", ") : "no restrictions"}
- Extra focus areas: ${profile.focus.length ? profile.focus.join(", ") : "none"}
- In their own words: ${profile.notes?.trim() ? `"${profile.notes.trim()}"` : "nothing added"}
- Monthly budget: ${formatUSD(profile.budget)}

CANDIDATE PRODUCTS (choose from these only):
${candidateList}

Design the best stack for this customer within budget.`;

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      // Cache breakpoint on the static block: the large knowledge base + rules
      // are cached across requests; the per-customer block follows uncached.
      system: [
        {
          role: "system",
          content: STATIC_SYSTEM,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
        },
        { role: "system", content: dynamicSystem },
      ],
      prompt,
      output: Output.object({ schema: StackSchema }),
    });

    // Stream NDJSON: a `header` line the moment the summary is done (the model
    // writes stackName + summary before the items array), then a `result` line
    // with the validated, enriched, budget-checked stack.
    const encoder = new TextEncoder();
    const send = (c: ReadableStreamDefaultController, obj: unknown) =>
      c.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let headerSent = false;
          for await (const partial of result.partialOutputStream) {
            if (!headerSent && partial?.stackName && partial?.summary && partial.items !== undefined) {
              send(controller, { type: "header", stackName: partial.stackName, summary: partial.summary });
              headerSent = true;
            }
          }

          const output = await result.output;
          if (!headerSent) {
            send(controller, { type: "header", stackName: output.stackName, summary: output.summary });
          }

          // Validate the AI's picks against the real candidate set + recompute totals.
          const allowed = new Map(candidates.map((c) => [c.variantId, c]));
          const chosen = output.items.filter((i) => allowed.has(i.variantId));
          const resolved = await getVariants(chosen.map((i) => i.variantId));
          const byId = new Map(resolved.map((it) => [it.variantId, it]));

          const allLines = chosen
            .map((i) => {
              const it = byId.get(i.variantId);
              if (!it) return null;
              const quantity = Math.max(1, Math.min(3, Math.floor(i.quantity || 1)));
              return {
                variantId: it.variantId,
                title: it.title,
                vendor: it.vendor,
                category: it.category,
                unitPrice: it.price,
                compareAtPrice: it.compareAtPrice,
                quantity,
                lineTotal: it.price * quantity,
                reason: i.reason,
                dosage: i.dosage,
                description: it.description,
                image: it.image,
                url: it.url,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

          // Hard budget guard (deterministic): always keep the lead/foundational
          // item, then add subsequent items in priority order only while they fit.
          const lines: typeof allLines = [];
          let running = 0;
          for (const l of allLines) {
            if (lines.length === 0 || running + l.lineTotal <= profile.budget) {
              lines.push(l);
              running += l.lineTotal;
            }
          }

          const total = lines.reduce((s, l) => s + l.lineTotal, 0);
          const cartUrl = buildCartPermalink(
            lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          );

          send(controller, {
            type: "result",
            stackName: output.stackName,
            summary: output.summary,
            tips: output.tips,
            currency: CURRENCY,
            lines,
            total,
            itemCount: lines.length,
            budget: profile.budget,
            overBudget: total > profile.budget,
            cartUrl,
          });
          controller.close();
        } catch (err) {
          console.error("[superstores-coach] failed to build stack:", err);
          send(controller, {
            type: "error",
            error: "Coach couldn't build your stack right now. Please try again.",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[superstores-coach] failed to build stack:", err);
    return Response.json(
      { error: "Coach couldn't build your stack right now. Please try again." },
      { status: 500 },
    );
  }
}
