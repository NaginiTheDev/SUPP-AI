import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { z } from "zod";
import {
  gatherCandidates,
  getVariants,
  buildCartPermalink,
  formatISK,
  GOAL_LABELS,
  GOAL_GUIDANCE,
  CURRENCY,
  type GoalKey,
} from "@/lib/protin/catalog";
import type { ProtinProfile } from "@/lib/protin/profile";

export const maxDuration = 30;

function bmi(p: ProtinProfile): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}
function proteinTarget(p: ProtinProfile): number {
  const perKg = p.goal === "vodvauppbygging" ? 2.0 : p.goal === "fitubrennsla" ? 2.2 : 1.6;
  return Math.round(p.weightKg * perKg);
}

const GENDER_IS: Record<string, string> = { male: "karl", female: "kona", other: "annað" };
const EXP_IS: Record<string, string> = { beginner: "byrjandi", intermediate: "miðlungs", advanced: "vön/vanur" };
const DIET_IS: Record<string, string> = { vegetarian: "grænmetisæta", vegan: "vegan", lactosefree: "laktósafrítt", glutenfree: "glútenfrítt" };
const FOCUS_IS: Record<string, string> = {
  energy: "orka & einbeiting", recovery: "endurheimt", sleep: "svefn & slökun",
  joints: "liðamót & sinar", digestion: "melting", immunity: "ónæmiskerfi", hydration: "vökvajafnvægi",
};

const StackSchema = z.object({
  stackName: z.string().describe("Stutt, hvetjandi nafn á staflanum á íslensku"),
  summary: z.string().describe("2–3 setningar á íslensku um stefnuna á bak við þennan stafla fyrir ÞENNAN einstakling"),
  items: z
    .array(
      z.object({
        variantId: z.number().describe("VERÐUR að vera variantId úr listanum yfir mögulegar vörur"),
        tier: z.enum(["foundational", "supporting", "optional"]).describe("Grunnur / Til viðbótar / Valfrjálst"),
        reason: z.string().describe("Ein setning á íslensku: af hverju þessi vara fyrir þennan einstakling"),
        dosage: z.string().describe("Hagnýt skömmtun og tímasetning á íslensku"),
      }),
    )
    .min(1)
    .max(5),
  tips: z.array(z.string()).min(2).max(4).describe("2–4 stutt, hagnýt ráð á íslensku"),
});

export async function POST(req: Request) {
  const profile = (await req.json()) as ProtinProfile;
  if (!profile?.goal) return Response.json({ error: "Markmið vantar" }, { status: 400 });

  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.anthropic || "").replace(/\s+/g, "");
  if (!apiKey) {
    console.error("[protin-coach] No Anthropic API key set");
    return Response.json({ error: "Þjálfarinn er ekki rétt stilltur (API lykil vantar)." }, { status: 503 });
  }
  const anthropic = createAnthropic({ apiKey });

  try {
    const noLimit = !profile.budgetISK || profile.budgetISK <= 0;
    const candidates = await gatherCandidates(profile.goal as GoalKey, profile.budgetISK);
    if (candidates.length === 0) return Response.json({ error: "ENGIN_VARA" }, { status: 422 });

    const candidateList = candidates
      .map((c) => `- variantId ${c.variantId} | ${c.title} | ${c.vendor} | ${c.category} | ${formatISK(c.priceISK)}`)
      .join("\n");

    const diet = profile.diet?.filter((d) => d !== "none") ?? [];
    const dietLine = diet.length ? diet.map((d) => DIET_IS[d] ?? d).join(", ") : "engar takmarkanir";
    const focusLine = profile.focus?.length ? profile.focus.map((f) => FOCUS_IS[f] ?? f).join(", ") : "engin";
    const budgetLine = noLimit ? "engin takmörk" : formatISK(profile.budgetISK);

    const system = `Þú ert "Þjálfarinn", sérfræðiráðgjafi í fæðubótarefnum fyrir protin.is (íslensk verslun). Þú setur saman sérsniðinn stafla af fæðubótarefnum fyrir EINN viðskiptavin og velur EINGÖNGU úr meðfylgjandi lista yfir mögulegar vörur. Öll verð eru í íslenskum krónum (ISK, heilar tölur).

Harðar reglur:
- Veldu vörur EINGÖNGU af listanum. Notaðu nákvæmlega rétt variantId. Aldrei finna upp vörur eða verð.
- ${noLimit ? "Engin fjárhagsáætlun er sett, en haltu staflanum samt hnitmiðuðum og skynsamlegum." : "Heildarverð staflans VERÐUR að vera við eða undir mánaðarlegri fjárhagsáætlun viðskiptavinarins. Þetta er HÁRT hámark — farðu aldrei yfir það. Ef grunnvaran nýtir nær alla áætlunina, skilaðu þá bara þeirri einu vöru."}
- Forgangsraðaðu: fyrsta varan (tier=foundational) er mikilvægasta varan fyrir markmiðið; síðan supporting og optional í minnkandi mikilvægisröð. Haltu þessu hnitmiðuðu — 2–4 vörur er kjörið.
- FAGLEG LEIÐSÖGN fyrir þetta markmið: ${GOAL_GUIDANCE[profile.goal as GoalKey] ?? GOAL_GUIDANCE.almenn_heilsa}
- Nýttu fjárhagsáætlunina vel: ef pláss er í áætluninni fyrir augljóslega gagnlega viðbótarvöru skaltu bæta henni við frekar en að skila of fáum vörum. Ekki samt bæta við ónauðsynlegum vörum bara til að fylla upp í áætlunina.
- Virtu mataræði viðskiptavinarins: ${dietLine} (t.d. vegan → forðastu mysuprótein/kasein; laktósafrítt → forðastu mjólkurprótein).
- Taktu tillit til þess sem viðskiptavinurinn skrifar með eigin orðum: forðastu uppgefin ofnæmis-/innihaldsefni, taktu mið af meiðslum, ekki tvítaka efni sem þeir taka nú þegar.
- Sníddu rökstuðning að einstaklingnum. Vertu nákvæm/ur og hvetjandi. ALLUR texti VERÐUR að vera á góðri, eðlilegri íslensku.`;

    const prompt = `SNIÐ VIÐSKIPTAVINAR
- Markmið: ${GOAL_LABELS[profile.goal as GoalKey] ?? profile.goal}
- Kyn: ${GENDER_IS[profile.gender] ?? profile.gender}, Aldur: ${profile.age}
- Hæð: ${profile.heightCm} cm, Þyngd: ${profile.weightKg} kg (BMI ~${bmi(profile)})
- Áætluð dagleg próteinþörf: ~${proteinTarget(profile)} g
- Reynsla: ${EXP_IS[profile.experience] ?? profile.experience}, ${profile.trainingDaysPerWeek} æfingar á viku
- Mataræði: ${dietLine}
- Áhersluatriði: ${focusLine}
- Með eigin orðum: ${profile.notes?.trim() ? `"${profile.notes.trim()}"` : "ekkert bætt við"}
- Mánaðarleg fjárhagsáætlun: ${budgetLine}

MÖGULEGAR VÖRUR (veldu aðeins úr þessum):
${candidateList}

Settu saman besta staflann fyrir þennan viðskiptavin${noLimit ? "" : " innan fjárhagsáætlunar"}.`;

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system,
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

          // Deterministic ISK budget guard: keep the foundational item, add others
          // only while they fit. Never exceed the budget.
          const kept: { i: (typeof picks)[number]; p: NonNullable<ReturnType<typeof byId.get>> }[] = [];
          let running = 0;
          for (const i of picks) {
            const p = byId.get(i.variantId)!;
            if (kept.length === 0 || noLimit || running + p.priceISK <= profile.budgetISK) {
              kept.push({ i, p });
              running += p.priceISK;
            }
          }

          const lines = kept.map(({ i, p }) => ({
            variantId: p.variantId,
            name: p.title,
            brand: p.vendor,
            category: p.category,
            priceISK: p.priceISK,
            compareAtISK: p.compareAtISK,
            formattedPrice: formatISK(p.priceISK),
            tier: i.tier,
            reason: i.reason,
            dosage: i.dosage,
            description: p.description,
            image: p.image,
            inStock: p.available,
            productUrl: p.url,
          }));

          const total = lines.reduce((s, l) => s + l.priceISK, 0);
          const cartUrl = buildCartPermalink(lines.map((l) => ({ variantId: l.variantId, quantity: 1 })));

          send(controller, {
            type: "result",
            stackName: output.stackName,
            summary: output.summary,
            tips: output.tips,
            currency: CURRENCY,
            lines,
            total,
            formattedTotal: formatISK(total),
            itemCount: lines.length,
            budgetISK: profile.budgetISK,
            noLimit,
            overBudget: !noLimit && total > profile.budgetISK,
            cartUrl,
          });
          controller.close();
        } catch (err) {
          console.error("[protin-coach] failed to build stack:", err);
          send(controller, { type: "error", error: "Þjálfarinn gat ekki sett saman staflann. Reyndu aftur." });
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (err) {
    console.error("[protin-coach] fatal:", err);
    return Response.json({ error: "Þjálfarinn gat ekki sett saman staflann. Reyndu aftur." }, { status: 500 });
  }
}
