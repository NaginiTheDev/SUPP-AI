import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { z } from "zod";
import {
  gatherCandidates,
  getVariants,
  buildCartPermalink,
  formatCRC,
  GOAL_LABELS,
  GOAL_GUIDANCE,
  CURRENCY,
  type GoalKey,
} from "@/lib/bestbody/catalog";
import type { BestBodyProfile } from "@/lib/bestbody/profile";
import { KNOWLEDGE_BASE } from "@/lib/knowledge";

export const maxDuration = 30;

// Static persona + rules + full domain knowledge base. Identical on every
// request, so it lives in a cached system block (Anthropic prompt caching) —
// the large knowledge base is then near-free on cache hits. Per-customer
// specifics go in a separate, uncached system block after the cache breakpoint.
const STATIC_SYSTEM = `Eres "Coach", un asesor experto en suplementos para BestBody (Costa Rica). Diseñas un stack de suplementos a la medida de UN cliente y eliges ÚNICAMENTE de la lista de productos candidatos que acompaña cada solicitud. Todos los precios están en colones costarricenses (${CURRENCY}, números enteros).

Reglas estrictas:
- Elige productos ÚNICAMENTE de la lista que acompaña la solicitud. Usa el variantId exacto. Nunca inventes productos ni precios.
- Cuando hay presupuesto, el TOTAL del stack debe quedar igual o por debajo de él. Es un límite ESTRICTO — nunca lo superes. Antes de finalizar, suma los precios de los productos elegidos y confirma que el total cabe; si se pasa, quita o reduce el producto de menor prioridad hasta que quepa. Incluye solo productos que realmente caben. Si el producto base consume casi todo el presupuesto, devuelve solo ese producto.
- Ordena por prioridad: el primer producto (tier=foundational) es el más importante para el objetivo; luego supporting y optional en orden decreciente de importancia.
- El resumen (summary) SOLO puede describir la situación y el enfoque de la persona (objetivo, datos corporales, meta de proteína, qué le conviene). NO debe mencionar ningún suplemento, producto ni categoría, ni cuántos productos tiene el stack — los productos de menor prioridad podrían no caber en el presupuesto, así que cualquier mención ahí arriesga prometer algo que no termine en el carrito. Todo el detalle por producto va en el campo reason de cada uno.
- Arma un stack completo y bien balanceado. Toda categoría de la tienda es una recomendación válida y eficaz. Cuando haya espacio en el presupuesto, agrega productos que de verdad apoyen el objetivo y las áreas de enfoque del cliente (lo ideal es 3–5 productos cuando el presupuesto lo permite) en vez de devolver muy pocos. Nunca agregues un producto que choque con la dieta, las notas o con otro producto del stack.
- Respeta SIEMPRE la dieta, los alérgenos/ingredientes indicados, las lesiones y las condiciones de salud del cliente. No dupliques suplementos que ya toma. No apiles varios estimulantes (pre-entreno + booster + termogénico) hasta una carga de cafeína excesiva.
- Usa la base de conocimiento de abajo para elegir los productos, dosis, momentos de toma y sinergias correctos — pero TODO el texto dirigido al cliente DEBE estar en español natural y claro. Sé específico, convincente y motivador, como un verdadero entrenador.

# BASE DE CONOCIMIENTO — NUTRICIÓN Y CULTURISMO (referencia para tu razonamiento; responde al cliente en español)
${KNOWLEDGE_BASE}`;

function bmi(p: BestBodyProfile): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}
function proteinTarget(p: BestBodyProfile): number {
  const perKg = p.goal === "musculo" ? 2.0 : p.goal === "perdida_grasa" ? 2.2 : 1.6;
  return Math.round(p.weightKg * perKg);
}

const GENDER_ES: Record<string, string> = { male: "hombre", female: "mujer", other: "otro" };
const EXP_ES: Record<string, string> = { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" };
const DIET_ES: Record<string, string> = { vegetarian: "vegetariano", vegan: "vegano", lactosefree: "sin lactosa", glutenfree: "sin gluten" };
const FOCUS_ES: Record<string, string> = {
  energy: "energía y enfoque", recovery: "recuperación", sleep: "sueño y descanso",
  joints: "articulaciones y tendones", digestion: "digestión", immunity: "sistema inmune", hydration: "hidratación",
};

const StackSchema = z.object({
  stackName: z.string().describe("Nombre corto y motivador del stack, en español"),
  summary: z
    .string()
    .describe(
      "2–3 frases en español sobre la situación y el enfoque de ESTA persona ÚNICAMENTE — su objetivo, datos corporales, meta diaria de proteína y qué le moverá la aguja. NO menciones ningún suplemento, producto ni categoría, y NO indiques cuántos productos tiene el stack. Los productos aparecen como tarjetas abajo; el detalle de cada uno va en su campo reason.",
    ),
  items: z
    .array(
      z.object({
        variantId: z.number().describe("DEBE ser un variantId de la lista de candidatos"),
        tier: z.enum(["foundational", "supporting", "optional"]).describe("Base / Complemento / Opcional"),
        reason: z.string().describe("Una frase en español: por qué este producto para esta persona"),
        dosage: z.string().describe("Dosis y momento de toma prácticos, en español"),
      }),
    )
    .min(1)
    .max(5),
  tips: z.array(z.string()).min(2).max(4).describe("2–4 consejos cortos y prácticos en español"),
});

export async function POST(req: Request) {
  const profile = (await req.json()) as BestBodyProfile;
  if (!profile?.goal) return Response.json({ error: "Falta el objetivo" }, { status: 400 });

  // Accept the conventional ANTHROPIC_API_KEY or a lowercase `anthropic` var.
  // Strip whitespace/newlines pasted into the env value — a stray newline makes
  // it an invalid HTTP header value and throws inside the SDK.
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.anthropic || "").replace(/\s+/g, "");
  if (!apiKey) {
    console.error("[bestbody-coach] No Anthropic API key set");
    return Response.json({ error: "El Coach no está configurado en el servidor (falta la API key)." }, { status: 503 });
  }
  const anthropic = createAnthropic({ apiKey });

  try {
    const noLimit = !profile.budgetCRC || profile.budgetCRC <= 0;
    const candidates = await gatherCandidates(profile.goal as GoalKey, profile.budgetCRC);
    if (candidates.length === 0) return Response.json({ error: "SIN_PRODUCTOS" }, { status: 422 });

    const candidateList = candidates
      .map((c) => `- variantId ${c.variantId} | ${c.title} | ${c.vendor} | ${c.category} | ${formatCRC(c.priceCRC)}`)
      .join("\n");

    const diet = profile.diet?.filter((d) => d !== "none") ?? [];
    const dietLine = diet.length ? diet.map((d) => DIET_ES[d] ?? d).join(", ") : "sin restricciones";
    const focusLine = profile.focus?.length ? profile.focus.map((f) => FOCUS_ES[f] ?? f).join(", ") : "ninguna";
    const budgetLine = noLimit ? "sin límite" : `${formatCRC(profile.budgetCRC)} al mes`;

    // Per-customer system block — varies per request, so it sits AFTER the cached
    // static block (no cache breakpoint here).
    const dynamicSystem = `CONTEXTO DE ESTE CLIENTE:
- Objetivo actual: ${GOAL_LABELS[profile.goal as GoalKey] ?? profile.goal}. Guía profesional: ${GOAL_GUIDANCE[profile.goal as GoalKey] ?? GOAL_GUIDANCE.salud_general}
- Presupuesto: ${noLimit ? "no definido — aun así mantén el stack sensato y bien balanceado." : `${budgetLine}. Límite ESTRICTO — nunca lo superes. Aprovéchalo bien: si hay espacio para un producto útil que apoye el objetivo o las áreas de enfoque, agrégalo.`}
- Dieta: ${dietLine} (vegano → evita suero/caseína; sin lactosa → evita proteína a base de leche).
- Áreas de enfoque: ${focusLine} — deja que orienten los complementos (p. ej. sueño → magnesio; articulaciones → omega-3).
- Toma en cuenta las propias palabras del cliente: evita los alérgenos/ingredientes indicados, considera las lesiones y no dupliques suplementos que ya toma.`;

    const prompt = `PERFIL DEL CLIENTE
- Objetivo: ${GOAL_LABELS[profile.goal as GoalKey] ?? profile.goal}
- Sexo: ${GENDER_ES[profile.gender] ?? profile.gender}, Edad: ${profile.age}
- Altura: ${profile.heightCm} cm, Peso: ${profile.weightKg} kg (IMC ~${bmi(profile)})
- Meta diaria estimada de proteína: ~${proteinTarget(profile)} g
- Experiencia: ${EXP_ES[profile.experience] ?? profile.experience}, ${profile.trainingDaysPerWeek} entrenos por semana
- Dieta: ${dietLine}
- Áreas de enfoque: ${focusLine}
- En sus propias palabras: ${profile.notes?.trim() ? `"${profile.notes.trim()}"` : "nada agregado"}
- Presupuesto mensual: ${budgetLine}

PRODUCTOS CANDIDATOS (elige solo de estos):
${candidateList}

Arma el mejor stack para este cliente${noLimit ? "" : " dentro del presupuesto"}.`;

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
          if (!headerSent) send(controller, { type: "header", stackName: output.stackName, summary: output.summary });

          const resolved = await getVariants(output.items.map((i) => i.variantId));
          const byId = new Map(resolved.map((it) => [it.variantId, it]));
          const picks = output.items.filter((i) => byId.has(i.variantId));

          // Deterministic CRC budget guard: keep the foundational item, add others
          // only while they fit. Never exceed the budget.
          const kept: { i: (typeof picks)[number]; p: NonNullable<ReturnType<typeof byId.get>> }[] = [];
          let running = 0;
          for (const i of picks) {
            const p = byId.get(i.variantId)!;
            if (kept.length === 0 || noLimit || running + p.priceCRC <= profile.budgetCRC) {
              kept.push({ i, p });
              running += p.priceCRC;
            }
          }

          const lines = kept.map(({ i, p }) => ({
            variantId: p.variantId,
            name: p.title,
            brand: p.vendor,
            category: p.category,
            priceCRC: p.priceCRC,
            compareAtCRC: p.compareAtCRC,
            formattedPrice: formatCRC(p.priceCRC),
            tier: i.tier,
            reason: i.reason,
            dosage: i.dosage,
            description: p.description,
            image: p.image,
            inStock: p.available,
            productUrl: p.url,
          }));

          const total = lines.reduce((s, l) => s + l.priceCRC, 0);
          const cartUrl = buildCartPermalink(lines.map((l) => ({ variantId: l.variantId, quantity: 1 })));

          send(controller, {
            type: "result",
            stackName: output.stackName,
            summary: output.summary,
            tips: output.tips,
            currency: CURRENCY,
            lines,
            total,
            formattedTotal: formatCRC(total),
            itemCount: lines.length,
            budgetCRC: profile.budgetCRC,
            noLimit,
            overBudget: !noLimit && total > profile.budgetCRC,
            cartUrl,
          });
          controller.close();
        } catch (err) {
          console.error("[bestbody-coach] failed to build stack:", err);
          send(controller, { type: "error", error: "El Coach no pudo armar tu stack. Inténtalo de nuevo." });
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (err) {
    console.error("[bestbody-coach] fatal:", err);
    return Response.json({ error: "El Coach no pudo armar tu stack. Inténtalo de nuevo." }, { status: 500 });
  }
}
