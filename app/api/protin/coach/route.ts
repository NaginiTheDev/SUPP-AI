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
import { KNOWLEDGE_BASE } from "@/lib/knowledge";

export const maxDuration = 30;

// Static persona + rules + full domain knowledge base. Identical on every
// request, so it lives in a cached system block (Anthropic prompt caching) —
// the large knowledge base is then near-free on cache hits. Per-customer
// specifics go in a separate, uncached system block after the cache breakpoint.
const STATIC_SYSTEM = `Þú ert "Þjálfarinn", sérfræðiráðgjafi í fæðubótarefnum fyrir protin.is (íslensk verslun). Þú setur saman sérsniðinn stafla af fæðubótarefnum fyrir EINN viðskiptavin og velur EINGÖNGU úr lista yfir mögulegar vörur sem fylgir hverri beiðni. Öll verð eru í íslenskum krónum (ISK, heilar tölur).

Harðar reglur:
- Veldu vörur EINGÖNGU af listanum sem fylgir beiðninni. Notaðu nákvæmlega rétt variantId. Aldrei finna upp vörur eða verð.
- Þegar fjárhagsáætlun er sett VERÐUR heildarverð staflans að vera við eða undir henni. Þetta er HÁRT hámark — farðu aldrei yfir það. Áður en þú lýkur skaltu leggja saman verð valinna vara og staðfesta að heildin passi; ef hún fer yfir skaltu sleppa eða minnka lægst forgangsröðuðu vöruna þar til hún passar. Hafðu aðeins með vörur sem raunverulega passa. Ef grunnvaran nýtir nær alla áætlunina, skilaðu þá bara þeirri einu vöru.
- Forgangsraðaðu: fyrsta varan (tier=foundational) er mikilvægasta varan fyrir markmiðið; síðan supporting og optional í minnkandi mikilvægisröð.
- Samantektin (summary) má AÐEINS lýsa stöðu og nálgun einstaklingsins (markmið, líkamsupplýsingar, próteinmarkmið, hvað skiptir máli). Hún má EKKI nefna nein fæðubótarefni, vörur eða vöruflokka, né fjölda vara — lægra forgangsraðaðar vörur gætu ekki passað í áætlunina, svo sérhver vörutilvísun gæti lofað vöru sem endar ekki í körfunni. Allar vöruupplýsingar fara í reason-reit hverrar vöru.
- Settu saman heildstæðan, vel ávalan stafla. Allir vöruflokkar verslunarinnar eru gildar og áhrifaríkar tillögur. Þegar pláss er í áætluninni skaltu bæta við vörum sem styðja raunverulega við markmið og áherslur viðskiptavinarins (3–5 vörur er kjörið þegar áætlun leyfir) frekar en að skila of fáum. Bættu aldrei við vöru sem stangast á við mataræði, athugasemdir eða aðra vöru í staflanum.
- Virtu ALLTAF mataræði, uppgefin ofnæmis-/innihaldsefni og heilsufar viðskiptavinarins. Ekki tvítaka efni sem þeir taka nú þegar. Ekki stafla saman mörgum örvandi vörum (pre-workout + orkudrykkur + brennsluefni) þannig að koffínmagn verði óhóflegt.
- Notaðu þekkingargrunninn hér að neðan til að velja réttar vörur, skammta, tímasetningu og samspil — en ALLUR texti til viðskiptavinarins VERÐUR að vera á góðri, eðlilegri íslensku. Vertu nákvæm/ur, sannfærandi og hvetjandi.

# ÞEKKINGARGRUNNUR — NÆRING & LÍKAMSRÆKT (til viðmiðunar fyrir þína rökhugsun; svaraðu viðskiptavininum á íslensku)
${KNOWLEDGE_BASE}`;

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
  summary: z
    .string()
    .describe(
      "2–3 setningar á íslensku um stöðu og nálgun ÞESSA einstaklings EINGÖNGU — markmið, líkamsupplýsingar, daglegt próteinmarkmið og hvað skiptir mestu fyrir hann/hana. EKKI nefna nein fæðubótarefni, vörur eða vöruflokka, og EKKI tilgreina fjölda vara. Vörurnar birtast sem spjöld fyrir neðan; nánari upplýsingar um hverja vöru fara í reason-reit hennar.",
    ),
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

    // Per-customer system block — varies per request, so it sits AFTER the cached
    // static block (no cache breakpoint here).
    const dynamicSystem = `AÐSTÆÐUR ÞESSA VIÐSKIPTAVINAR:
- Markmið núna: ${GOAL_LABELS[profile.goal as GoalKey] ?? profile.goal}. Fagleg leiðsögn: ${GOAL_GUIDANCE[profile.goal as GoalKey] ?? GOAL_GUIDANCE.almenn_heilsa}
- Fjárhagsáætlun: ${noLimit ? "engin sett — haltu staflanum samt skynsamlegum og vel ávöluðum." : `${budgetLine} á mánuði. HÁRT hámark — farðu aldrei yfir. Nýttu hana vel: ef pláss er fyrir gagnlega viðbótarvöru sem styður markmiðið/áherslurnar skaltu bæta henni við.`}
- Mataræði: ${dietLine} (vegan → forðastu mysu/kasein; laktósafrítt → forðastu mjólkurprótein).
- Áhersluatriði: ${focusLine} — láttu þau hafa áhrif á stuðningsvörurnar (t.d. svefn → magnesíum; liðamót → omega-3).
- Taktu tillit til eigin orða viðskiptavinarins: forðastu uppgefin ofnæmis-/innihaldsefni, taktu mið af meiðslum, ekki tvítaka efni sem þeir taka nú þegar.`;

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
