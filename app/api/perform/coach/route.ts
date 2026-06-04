import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { z } from "zod";
import {
  gatherCandidates,
  getBySlugs,
  fetchDescription,
  formatISK,
  CURRENCY,
  type GoalKey,
} from "@/lib/perform/catalog";
import { GOAL_LABELS, type PerformProfile } from "@/lib/perform/profile";

export const maxDuration = 30;

function bmi(p: PerformProfile): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}
function proteinTarget(p: PerformProfile): number {
  const perKg = p.goal === "vodvauppbygging" ? 2.0 : p.goal === "fitubrennsla" ? 2.2 : 1.6;
  return Math.round(p.weightKg * perKg);
}

// Goal-specific professional guidance on the typical foundational supplement(s),
// so the model leads with the right item (e.g. protein for muscle gain).
const GOAL_GUIDANCE: Record<string, string> = {
  vodvauppbygging:
    "Fyrir vöðvauppbyggingu er prótein nær alltaf undirstaðan (tier=foundational) — veldu prótein fyrst nema mataræði/athugasemdir útiloki það, bættu svo við kreatíni og loks stuðningsvöru.",
  fitubrennsla:
    "Fyrir fitubrennslu er prótein undirstaðan til að halda vöðvamassa í kaloríuhalla; bættu svo við brennsluefni og/eða amínósýrum eftir áætlun.",
  styrkur_afl:
    "Fyrir styrk og afl er kreatín undirstaðan; bættu svo við pre-workout og próteini eftir því sem áætlun leyfir.",
  uthald:
    "Fyrir úthald eru kolvetni/frammistöðuvörur og raflausnir (electrolytes) undirstaðan; bættu svo við amínósýrum og próteini til endurheimtar.",
  almenn_heilsa:
    "Fyrir almenna heilsu er gott fjölvítamín eða omega-3 undirstaðan; bættu svo við próteini og/eða raflausnum eftir þörfum.",
};

const GENDER_IS: Record<string, string> = { male: "karl", female: "kona", other: "annað" };
const EXP_IS: Record<string, string> = { beginner: "byrjandi", intermediate: "miðlungs", advanced: "vön/vanur" };
const DIET_IS: Record<string, string> = {
  vegetarian: "grænmetisæta", vegan: "vegan", lactosefree: "laktósafrítt", glutenfree: "glútenfrítt",
};
const FOCUS_IS: Record<string, string> = {
  energy: "orka & einbeiting", recovery: "endurheimt", sleep: "svefn & slökun",
  joints: "liðamót & sinar", digestion: "melting", immunity: "ónæmiskerfi", hydration: "vökvajafnvægi",
};

const StackSchema = z.object({
  stackName: z.string().describe("Stutt, hvetjandi nafn á staflanum á íslensku, t.d. 'Grunnstafli fyrir vöðvavöxt'"),
  summary: z.string().describe("2–3 setningar á íslensku um stefnuna á bak við þennan stafla fyrir ÞENNAN einstakling"),
  items: z
    .array(
      z.object({
        slug: z.string().describe("VERÐUR að vera slug úr listanum yfir mögulegar vörur"),
        tier: z.enum(["foundational", "supporting", "optional"]).describe("Grunnur / Til viðbótar / Valfrjálst"),
        reason: z.string().describe("Ein setning á íslensku: af hverju þessi vara fyrir þennan einstakling"),
        dosage: z.string().describe("Hagnýt skömmtun og tímasetning á íslensku, t.d. '1 skammtur (5 g) daglega, hvenær sem er'"),
      }),
    )
    .min(1)
    .max(5),
  tips: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2–4 stutt, hagnýt ráð á íslensku (þjálfun, næring, tímasetning, vökvi)"),
});

export async function POST(req: Request) {
  const profile = (await req.json()) as PerformProfile;

  if (!profile?.goal) {
    return Response.json({ error: "Markmið vantar" }, { status: 400 });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.anthropic || "").replace(/\s+/g, "");
  if (!apiKey) {
    console.error("[perform-coach] No Anthropic API key set");
    return Response.json({ error: "Þjálfarinn er ekki rétt stilltur (API lykil vantar)." }, { status: 503 });
  }
  const anthropic = createAnthropic({ apiKey });

  try {
    const noLimit = !profile.budgetISK || profile.budgetISK <= 0;
    const candidates = await gatherCandidates(profile.goal as GoalKey, profile.budgetISK);
    if (candidates.length === 0) {
      return Response.json({ error: "ENGIN_VARA" }, { status: 422 });
    }

    const candidateList = candidates
      .map((c) => `- slug ${c.slug} | ${c.name} | ${c.brand} | ${c.category} | ${formatISK(c.priceISK)}${c.fewLeft ? " | fáar eftir" : ""}`)
      .join("\n");

    const diet = profile.diet?.filter((d) => d !== "none") ?? [];
    const dietLine = diet.length ? diet.map((d) => DIET_IS[d] ?? d).join(", ") : "engar takmarkanir";
    const focusLine = profile.focus?.length ? profile.focus.map((f) => FOCUS_IS[f] ?? f).join(", ") : "engin";
    const budgetLine = noLimit ? "engin takmörk" : formatISK(profile.budgetISK);

    const system = `Þú ert "Þjálfarinn", sérfræðiráðgjafi í fæðubótarefnum fyrir perform.is (íslensk verslun). Þú setur saman sérsniðinn stafla af fæðubótarefnum fyrir EINN viðskiptavin og velur EINGÖNGU úr meðfylgjandi lista yfir mögulegar vörur. Öll verð eru í íslenskum krónum (ISK, heilar tölur).

Harðar reglur:
- Veldu vörur EINGÖNGU af listanum. Notaðu nákvæmlega rétt slug. Aldrei finna upp vörur eða verð.
- ${noLimit ? "Engin fjárhagsáætlun er sett, en haltu staflanum samt hnitmiðuðum og skynsamlegum." : "Heildarverð staflans VERÐUR að vera við eða undir mánaðarlegri fjárhagsáætlun viðskiptavinarins. Þetta er HÁRT hámark — farðu aldrei yfir það. Ef grunnvaran nýtir nær alla áætlunina, skilaðu þá bara þeirri einu vöru."}
- Forgangsraðaðu: fyrsta varan (tier=foundational) er mikilvægasta varan fyrir markmiðið; síðan supporting og optional í minnkandi mikilvægisröð. Haltu þessu hnitmiðuðu — 2–4 vörur er kjörið.
- FAGLEG LEIÐSÖGN fyrir þetta markmið: ${GOAL_GUIDANCE[profile.goal] ?? GOAL_GUIDANCE.almenn_heilsa}
- Nýttu fjárhagsáætlunina vel: ef pláss er í áætluninni fyrir augljóslega gagnlega viðbótarvöru skaltu bæta henni við frekar en að skila of fáum vörum. Ekki samt bæta við ónauðsynlegum vörum bara til að fylla upp í áætlunina.
- Virtu mataræði viðskiptavinarins: ${dietLine} (t.d. vegan → forðastu mysuprótein/kasein; laktósafrítt → forðastu mjólkurprótein).
- Taktu tillit til þess sem viðskiptavinurinn skrifar með eigin orðum: forðastu uppgefin ofnæmis-/innihaldsefni, taktu mið af meiðslum, ekki tvítaka efni sem þeir taka nú þegar.
- Sníddu rökstuðning að einstaklingnum (markmið, reynsla, æfingatíðni, líkamsmál og athugasemdir). Vertu nákvæm/ur og hvetjandi, ekki almenn/ur.
- ALLUR texti VERÐUR að vera á góðri, eðlilegri íslensku.`;

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
          // Header (stack name + summary) streams the moment the model writes it.
          let headerSent = false;
          for await (const partial of result.partialOutputStream) {
            if (!headerSent && partial?.stackName && partial?.summary && partial.items !== undefined) {
              send(controller, { type: "header", stackName: partial.stackName, summary: partial.summary });
              headerSent = true;
            }
          }
          const output = await result.output;
          if (!headerSent) send(controller, { type: "header", stackName: output.stackName, summary: output.summary });

          // Validate picks against the real candidate pool (drop hallucinated slugs).
          const allowed = await getBySlugs(output.items.map((i) => i.slug));
          const picks = output.items.filter((i) => allowed.has(i.slug));

          // Deterministic ISK budget guard: always keep the foundational item,
          // then add others in priority order only while they fit. Never /100.
          const kept: { i: (typeof picks)[number]; p: NonNullable<ReturnType<typeof allowed.get>> }[] = [];
          let running = 0;
          for (const i of picks) {
            const p = allowed.get(i.slug)!;
            if (kept.length === 0 || noLimit || running + p.priceISK <= profile.budgetISK) {
              kept.push({ i, p });
              running += p.priceISK;
            }
          }

          // Enrich the (≤5) chosen items with a short blurb from DETAIL.
          const descriptions = await Promise.all(kept.map(({ p }) => fetchDescription(p.slug)));

          const lines = kept.map(({ i, p }, idx) => ({
            slug: p.slug,
            name: p.name,
            brand: p.brand,
            category: p.category,
            priceISK: p.priceISK,
            formattedPrice: formatISK(p.priceISK),
            tier: i.tier,
            reason: i.reason,
            dosage: i.dosage,
            description: descriptions[idx] || "",
            image: p.imageUrl,
            inStock: p.inStock,
            fewLeft: p.fewLeft,
            productUrl: p.productUrl,
          }));

          const total = lines.reduce((s, l) => s + l.priceISK, 0);
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
          });
          controller.close();
        } catch (err) {
          console.error("[perform-coach] failed to build stack:", err);
          send(controller, { type: "error", error: "Þjálfarinn gat ekki sett saman staflann. Reyndu aftur." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[perform-coach] fatal:", err);
    return Response.json({ error: "Þjálfarinn gat ekki sett saman staflann. Reyndu aftur." }, { status: 500 });
  }
}
