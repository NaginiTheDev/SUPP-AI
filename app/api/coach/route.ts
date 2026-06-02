import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { z } from "zod";
import {
  gatherCandidates,
  getVariants,
  buildCartPermalink,
  CURRENCY,
} from "@/lib/catalog";
import type { CustomerProfile } from "@/lib/profile";

export const maxDuration = 30;

// Estimate a daily protein target — gives the AI a concrete anchor for sizing
// the protein portion of the stack.
function proteinTarget(p: CustomerProfile): number {
  const perKg = p.goal === "muscle-gain" ? 2.0 : p.goal === "fat-loss" ? 2.2 : 1.6;
  return Math.round(p.weightKg * perKg);
}

function bmi(p: CustomerProfile): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}

const StackSchema = z.object({
  stackName: z.string().describe("A short, punchy name for this stack, e.g. 'Lean Muscle Builder'"),
  summary: z.string().describe("2–3 sentences explaining the strategy behind this stack for THIS person"),
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
  const profile = (await req.json()) as CustomerProfile;

  if (!profile?.goal || !profile?.budget) {
    return Response.json({ error: "Missing goal or budget" }, { status: 400 });
  }

  // Accept the conventional ANTHROPIC_API_KEY or a lowercase `anthropic` var.
  // Strip any whitespace/newlines that got pasted into the env value — a stray
  // newline makes it an invalid HTTP header value and throws inside the SDK.
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.anthropic || "").replace(/\s+/g, "");
  if (!apiKey) {
    console.error("[coach] No Anthropic API key set (ANTHROPIC_API_KEY or anthropic)");
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
      { error: `No products available under ${CURRENCY} ${profile.budget}. Try a higher budget.` },
      { status: 422 },
    );
  }

  const candidateList = candidates
    .map((c) => {
      const desc = c.description ? ` | ${c.description.slice(0, 120)}` : "";
      return `- variantId ${c.variantId} | ${c.title} | ${c.vendor} | ${c.category} | ${CURRENCY} ${c.price}${
        c.tags.length ? ` | tags: ${c.tags.join(", ")}` : ""
      }${desc}`;
    })
    .join("\n");

  const dietLine = profile.diet.filter((d) => d !== "none");
  const system = `You are "Coach", an expert supplement advisor for Protein House (Mauritius). You design a supplement stack tailored to ONE customer's profile, choosing ONLY from a provided candidate list. Prices are in ${CURRENCY} (Mauritian Rupees).

Hard rules:
- Choose items ONLY from the candidate list. Use the exact variantId. Never invent products or prices.
- The stack TOTAL must be at or under the customer's budget. This is a HARD limit — never exceed it. If the foundational item nearly uses up the budget, return just that one item rather than going over. If budget allows, you may pick a cheaper foundational option to fit a second complementary item.
- List items in priority order: the FIRST item must be the single most important supplement for their goal, then complementary items in descending importance. Keep it focused — 2–4 items is ideal.
- Respect dietary needs: ${dietLine.length ? dietLine.join(", ") : "none stated"} (e.g. vegan → avoid whey/casein; lactose-free → avoid milk-based protein).
- Honour anything the customer wrote in their own words: avoid stated allergens/ingredients, account for injuries, don't duplicate supplements they already take, and respect brand preferences when possible. If a note rules out a normally-ideal pick, choose the best alternative and reference it in that item's reason.
- Tailor reasons to the person (their goal, experience, training frequency, body stats, and their notes). Be specific and motivating, not generic.`;

  const prompt = `CUSTOMER PROFILE
- Goal: ${profile.goal}
- Gender: ${profile.gender}, Age: ${profile.age}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg (BMI ~${bmi(profile)})
- Estimated daily protein target: ~${proteinTarget(profile)} g
- Training experience: ${profile.experience}, ${profile.trainingDaysPerWeek} days/week
- Dietary: ${dietLine.length ? dietLine.join(", ") : "no restrictions"}
- Extra focus areas: ${profile.focus.length ? profile.focus.join(", ") : "none"}
- In their own words: ${profile.notes?.trim() ? `"${profile.notes.trim()}"` : "nothing added"}
- Monthly budget: ${CURRENCY} ${profile.budget}

CANDIDATE PRODUCTS (choose from these only):
${candidateList}

Design the best stack for this customer within budget.`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    prompt,
    output: Output.object({ schema: StackSchema }),
  });

  // Stream NDJSON: a `header` line the moment the summary is done (the model
  // writes stackName + summary before it starts the items array), then a
  // `result` line with the validated, enriched, budget-checked stack.
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
        console.error("[coach] failed to build stack:", err);
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
    console.error("[coach] failed to build stack:", err);
    return Response.json(
      { error: "Coach couldn't build your stack right now. Please try again." },
      { status: 500 },
    );
  }
}
