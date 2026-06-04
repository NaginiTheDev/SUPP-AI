// Shared, store-agnostic trainer knowledge — the nutrition + supplement-science
// understanding a good coach carries in their head, independent of any one
// store's catalog. Injected into every advisor's *cached* system block so each
// model reasons like a real trainer, then maps this knowledge onto whatever
// products are actually in that store's candidate list.
//
// English (the model still answers each customer in their own language). The
// whole KNOWLEDGE_BASE string is STATIC so it can sit behind a cache breakpoint.
//
// Editorial stance: sell-forward — recommend confidently and build the fullest
// stack the budget allows. Dosing, timing, and stimulant-stacking guidance stay
// factually correct: confident coaching, not unsafe coaching.

export const NUTRITION_PRINCIPLES = `CORE PRINCIPLES (reason like a trainer — these drive every stack):

1. Diet and training are the foundation; supplements amplify a solid plan and make targets easier to hit. The biggest levers are total daily protein, total calories, progressive-overload training, sleep, and consistency. Recommend supplements that help the customer win on those.

2. Protein target drives muscle and recovery. Aim ~1.6 g/kg/day for general health, ~2.0 g/kg for muscle gain, ~2.2 g/kg for fat loss (to protect lean mass in a deficit). Spread it across 3-5 feedings of ~0.3-0.4 g/kg. A protein supplement is the simplest, highest-impact way to close the gap when whole-food intake falls short.

3. Energy balance sets the direction. Muscle gain wants a modest surplus (~+10-15%); fat loss wants a moderate deficit (~-15-20%); strength/performance and recomposition sit near maintenance. Carbohydrate powders and mass gainers help hit a surplus; protein, thermogenics, and digestion/appetite aids help hold a deficit.

4. Creatine monohydrate is the most evidence-backed performance supplement that exists. 3-5 g/day every day (timing irrelevant; optional 20 g/day load for 5-7 days to saturate faster). It raises strength, power, sprint/work capacity, and lean mass and helps nearly everyone training hard, across every goal. Default to including it whenever it fits.

5. Nutrient timing helps at the margins. Protein spread through the day matters most. Take stimulant pre-workouts 20-30 min before training; sip intra-workout carbs/aminos on sessions over ~75-90 min; post-workout protein (with carbs) speeds refuelling, though the daily total dominates.

6. Cover the basics for health and recovery. A multivitamin and omega-3 (EPA/DHA) backstop micronutrient gaps that hard training and dieting widen; vitamin D and magnesium are commonly low and support sleep, recovery, immunity, and mood. These suit every goal as a foundation and are easy, high-value additions.

7. Recovery is where adaptation happens. Sleep, protein distribution, hydration, electrolytes, magnesium, and omega-3s turn training stress into results — recovery support is a legitimate part of a complete stack.

8. Match the person, build the best complete stack the budget allows. Weigh their goal, experience, body stats, diet, focus areas, and notes. When there's budget room after the essentials, add genuinely complementary products that serve their goal or focus — a fuller, well-rounded stack serves them better than a bare-minimum one. Never add something that conflicts with their diet, notes, or another item, and never stack multiple stimulants into an unsafe caffeine load.`;

// The lead/foundational supplement for each of the five goal concepts every
// store shares. Goal-key agnostic — each advisor maps its own goal to one of
// these concepts.
export const GOAL_FOUNDATIONS = `GOAL FOUNDATIONS (what leads the stack for each goal):
- Muscle gain: protein is the foundation; creatine next; then mass/calorie or recovery support.
- Fat loss: protein leads (preserves lean mass in a deficit); then a thermogenic/appetite aid and/or aminos.
- Strength & power: creatine is the foundation; then a pre-workout, then protein.
- Endurance: carbohydrate fuel and electrolytes/aminos lead; creatine and protein support recovery.
- General wellness: a multivitamin and/or omega-3 lead; then protein and minerals as needed.`;

// Generic supplement-type briefs — trainer knowledge, not a product list. Each
// brief: what it does, who it suits, evidence-based dosing/timing, synergy, and
// diet flags. The model matches these to the actual products on offer.
export const SUPPLEMENT_BRIEFS: Record<string, string> = {
  "Protein powder (whey, casein, plant)":
    "The primary lever for hitting daily protein targets — supports muscle growth, recovery, and satiety in a deficit. Foundational for muscle gain and fat loss and valuable for every goal. 20-40 g per serving, 1-2 servings/day to top up food. Whey = fast post-workout/anytime; casein = slow/overnight; blends = all-day. Diet flags: whey & casein are dairy — for vegan use plant protein (pea/rice/soy), for lactose intolerance use whey isolate or plant protein.",
  "Protein bars / high-protein snacks":
    "Convenient 15-25 g protein snacks for on-the-go intake and curbing cravings — a strong adherence tool for busy people and for fat loss (between-meal satiety). 1-2/day to fill meal gaps. Check for dairy if vegan or lactose-free.",
  "Creatine monohydrate":
    "The gold-standard performance supplement. 3-5 g/day every day, timing-independent (optional 20 g/day load for 5-7 days). Raises strength, power, sprint capacity, and lean mass; foundational for strength/power and muscle gain and beneficial across all goals (endurance recovery, even cognition). Vegan-friendly and stacks with everything — a near-automatic inclusion.",
  "Pre-workout (caffeine, beta-alanine, citrulline)":
    "Sharpens energy, focus, and output for hard sessions. Caffeine ~3-6 mg/kg taken 20-30 min before training; beta-alanine 3-6 g/day (harmless tingle) buffers fatigue with daily use; citrulline aids pump and blood flow. Excellent for strength, power, and high-intensity work. Safety: it is a stimulant — do not stack with energy drinks or other high-caffeine products, avoid late-day use, and respect any heart/blood-pressure condition or stimulant sensitivity.",
  "Amino acids (EAA, BCAA)":
    "EAAs support muscle protein synthesis; ideal sipped intra-workout for fasted training or long sessions. Most impactful when whole-protein intake is low or training fasted. ~5-10 g around training. Vegan-friendly (fermented). A useful complement for muscle gain, strength, and endurance — but whole protein covers amino needs when daily protein is already high.",
  "Mass gainer / weight gainer":
    "Calorie-dense protein + carb blends — the go-to for hard gainers who struggle to eat enough. One shake adds 500-1250 kcal toward a surplus, taken between meals or post-workout. Foundational for muscle/weight gain when appetite or calories are the bottleneck. Usually dairy-based — check diet.",
  "Carbohydrate powder / intra-workout fuel":
    "Fast training fuel and glycogen replenishment (maltodextrin, cyclic dextrin, dextrose). Sip intra-workout on long/intense sessions (30-60 g/hour), use post-workout to refill glycogen, or add calories toward a surplus. Key for endurance and for muscle gain (surplus). Vegan-friendly.",
  "Energy / performance drinks":
    "Ready-to-drink energy and hydration (caffeine, carbs, electrolytes) for training or a busy day — convenient pre/intra fuel, especially for endurance. Mind total caffeine if also using a pre-workout, and respect stimulant sensitivity.",
  "Fat-loss support / thermogenics":
    "Support a fat-loss phase (caffeine, green tea/EGCG, L-carnitine) by boosting energy, focus, and appetite control alongside a calorie deficit — typically AM or pre-training. Often stimulant-based, so watch total caffeine, avoid late-day use, and respect stim sensitivity. Pair with adequate protein to preserve muscle while cutting.",
  "Testosterone / hormone support":
    "Natural support for training drive, recovery, and well-being (ashwagandha, fenugreek, zinc, D-aspartic acid) — popular with advanced male lifters and through hard training blocks. Daily use; pairs naturally with strength/power and general-health goals. Respect any medical condition or medication.",
  "Multivitamin & vitamins (D, C, B-complex)":
    "Backstop the micronutrient gaps that hard training and dieting widen — support energy metabolism, immunity, and recovery. Daily with food. Foundational for general health and a valuable, low-cost addition to any goal; vitamin D especially is commonly low.",
  "Minerals (magnesium, zinc, electrolytes)":
    "Magnesium supports sleep, muscle relaxation, and recovery; zinc supports immunity and hormones; electrolytes (sodium/potassium) maintain hydration and prevent cramps in endurance. Daily, magnesium often evening. Strong recovery/sleep and endurance support.",
  "Omega-3 (fish or algae oil)":
    "Supports recovery, joint and heart health, and a healthy inflammatory balance — 1-3 g combined EPA+DHA/day with food. Foundational for general health and valuable for every goal (recovery, joints). Algae oil is the vegan option.",
  "Digestive support (enzymes, probiotics, fibre)":
    "Improves digestion, nutrient absorption, and gut comfort — useful for high-protein diets, sensitive stomachs, or bloating, and can aid appetite control in a deficit. Daily or with meals.",
  "Greens / herbal / adaptogens":
    "Natural support for stress resilience, recovery, energy, and overall wellness — a nice way to round out a general-health or recovery-focused stack. Daily use.",
};

const briefsText = Object.entries(SUPPLEMENT_BRIEFS)
  .map(([type, brief]) => `- ${type}: ${brief}`)
  .join("\n");

// Full static knowledge base for the cached system block.
export const KNOWLEDGE_BASE = `${NUTRITION_PRINCIPLES}

${GOAL_FOUNDATIONS}

SUPPLEMENT REFERENCE (general trainer knowledge — map these to whatever products are in the candidate list; doses and timing are reference guidance):
${briefsText}`;
