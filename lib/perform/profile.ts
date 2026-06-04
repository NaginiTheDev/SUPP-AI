import type { GoalKey } from "./catalog";

// Structured Icelandic intake collected by the Þjálfarinn ("Coach") panel.

export type Gender = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Diet = "none" | "vegetarian" | "vegan" | "lactosefree" | "glutenfree";
export type Focus =
  | "energy" | "recovery" | "sleep" | "joints" | "digestion" | "immunity" | "hydration";

export type PerformProfile = {
  goal: GoalKey;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  experience: Experience;
  trainingDaysPerWeek: number;
  diet: Diet[];
  focus: Focus[];
  notes?: string;
  budgetISK: number; // monthly, 0 = no limit
};

// --- Option lists rendered by the wizard ---------------------------------
export const GOAL_OPTIONS: { value: GoalKey; emoji: string; labelKey: string; descKey: string }[] = [
  { value: "vodvauppbygging", emoji: "🏋️", labelKey: "goal_muscle", descKey: "goal_muscle_desc" },
  { value: "fitubrennsla", emoji: "🔥", labelKey: "goal_fatloss", descKey: "goal_fatloss_desc" },
  { value: "styrkur_afl", emoji: "💥", labelKey: "goal_strength", descKey: "goal_strength_desc" },
  { value: "uthald", emoji: "🏃", labelKey: "goal_endurance", descKey: "goal_endurance_desc" },
  { value: "almenn_heilsa", emoji: "🌿", labelKey: "goal_wellness", descKey: "goal_wellness_desc" },
];

export const GENDER_OPTIONS: { value: Gender; labelKey: string }[] = [
  { value: "male", labelKey: "gender_male" },
  { value: "female", labelKey: "gender_female" },
  { value: "other", labelKey: "gender_other" },
];

export const EXPERIENCE_OPTIONS: { value: Experience; labelKey: string; descKey: string }[] = [
  { value: "beginner", labelKey: "exp_beginner", descKey: "exp_beginner_desc" },
  { value: "intermediate", labelKey: "exp_intermediate", descKey: "exp_intermediate_desc" },
  { value: "advanced", labelKey: "exp_advanced", descKey: "exp_advanced_desc" },
];

export const DIET_OPTIONS: { value: Diet; labelKey: string }[] = [
  { value: "vegetarian", labelKey: "diet_vegetarian" },
  { value: "vegan", labelKey: "diet_vegan" },
  { value: "lactosefree", labelKey: "diet_lactosefree" },
  { value: "glutenfree", labelKey: "diet_glutenfree" },
];

export const FOCUS_OPTIONS: { value: Focus; emoji: string; labelKey: string }[] = [
  { value: "energy", emoji: "⚡", labelKey: "focus_energy" },
  { value: "recovery", emoji: "🔄", labelKey: "focus_recovery" },
  { value: "sleep", emoji: "😴", labelKey: "focus_sleep" },
  { value: "joints", emoji: "🦴", labelKey: "focus_joints" },
  { value: "digestion", emoji: "🌱", labelKey: "focus_digestion" },
  { value: "immunity", emoji: "🛡️", labelKey: "focus_immunity" },
  { value: "hydration", emoji: "💧", labelKey: "focus_hydration" },
];

export const BUDGET_PRESETS = [
  { value: 6000, labelKey: "budget_low", descKey: "budget_low_desc" },
  { value: 12000, labelKey: "budget_mid", descKey: "budget_mid_desc" },
  { value: 20000, labelKey: "budget_high", descKey: "budget_high_desc" },
];

// Icelandic goal display labels (for result subtitle interpolation).
export const GOAL_LABELS: Record<GoalKey, string> = {
  vodvauppbygging: "Vöðvauppbygging",
  fitubrennsla: "Fitubrennsla / Þyngdartap",
  styrkur_afl: "Styrkur & afl",
  uthald: "Úthald",
  almenn_heilsa: "Almenn heilsa",
};

// --- Icelandic UI copy dictionary (single i18n source) -------------------
export const copy: Record<string, string> = {
  appName: "Þjálfarinn",
  appTagline: "Þinn persónulegi ráðgjafi í bætiefnum",
  intro_title: "Finndu réttu bætiefnin fyrir þig",
  intro_subtitle:
    "Svaraðu nokkrum spurningum og þjálfarinn setur saman sérsniðinn stafla af vörum sem henta markmiðum þínum.",
  intro_start: "Byrja",
  intro_b1: "Sérsniðið að markmiði, líkamsmálum og reynslu",
  intro_b2: "Raunverulegar vörur úr vöruúrvali perform.is, innan fjárhagsáætlunar",
  intro_b3: "Bein tengill á hverja vöru — tilbúið í körfu",
  intro_disclaimer:
    "Þessar ráðleggingar koma ekki í stað læknisráðgjafar. Ráðfærðu þig við lækni ef þú ert með undirliggjandi sjúkdóma, ert barnshafandi eða með barn á brjósti.",
  nav_back: "Til baka",
  nav_next: "Áfram",
  nav_skip: "Sleppa",
  nav_finish: "Sjá ráðleggingar",
  nav_restart: "Byrja upp á nýtt",
  step_progress: "Skref {current} af {total}",
  step1_title: "Hvað er markmið þitt?",
  step1_subtitle: "Veldu það sem á best við þig núna.",
  goal_muscle: "Vöðvauppbygging",
  goal_muscle_desc: "Byggja upp vöðva og styrk",
  goal_fatloss: "Fitubrennsla / Þyngdartap",
  goal_fatloss_desc: "Léttast og brenna fitu",
  goal_strength: "Styrkur & afl",
  goal_strength_desc: "Auka hámarksstyrk og sprengikraft",
  goal_endurance: "Úthald",
  goal_endurance_desc: "Bæta þol og endurheimt",
  goal_wellness: "Almenn heilsa",
  goal_wellness_desc: "Almenn vellíðan og heilbrigði",
  step2_title: "Um þig",
  step2_subtitle: "Þetta hjálpar okkur að sníða skammtastærðir og ráðleggingar að þér.",
  step_training_title: "Þjálfun",
  step_training_subtitle: "Hversu vön/vanur ertu og hve oft æfir þú?",
  field_gender: "Kyn",
  gender_male: "Karl",
  gender_female: "Kona",
  gender_other: "Annað",
  field_age: "Aldur",
  field_age_unit: "ár",
  field_height: "Hæð",
  field_height_unit: "cm",
  field_weight: "Þyngd",
  field_weight_unit: "kg",
  field_experience: "Reynsla af æfingum",
  exp_beginner: "Byrjandi",
  exp_beginner_desc: "Minna en 1 ár",
  exp_intermediate: "Miðlungs",
  exp_intermediate_desc: "1–3 ár",
  exp_advanced: "Vön/vanur",
  exp_advanced_desc: "Meira en 3 ár",
  field_training_days: "Æfingar á viku",
  training_days_unit: "skipti í viku",
  step3_title: "Lífsstíll",
  step3_subtitle: "Segðu okkur frá mataræði þínu og því sem þú vilt leggja áherslu á.",
  field_diet: "Mataræði",
  diet_none: "Engar takmarkanir",
  diet_vegetarian: "Grænmetisæta",
  diet_vegan: "Vegan",
  diet_lactosefree: "Laktósafrítt",
  diet_glutenfree: "Glútenfrítt",
  field_focus: "Áhersluatriði",
  focus_subtitle: "Veldu eitt eða fleiri",
  focus_energy: "Orka & einbeiting",
  focus_recovery: "Endurheimt",
  focus_sleep: "Svefn & slökun",
  focus_joints: "Liðamót & sinar",
  focus_digestion: "Melting",
  focus_immunity: "Ónæmiskerfi",
  focus_hydration: "Vökvajafnvægi",
  field_notes: "Eitthvað annað sem þjálfarinn ætti að vita?",
  field_notes_placeholder:
    "T.d. ofnæmi, óþol, lyf, fyrri reynsla af bætiefnum eða annað sem skiptir máli.",
  step4_title: "Fjárhagsáætlun",
  step4_subtitle: "Hve miklu vilt þú verja á mánuði í bætiefni?",
  budget_low: "Lágmark",
  budget_low_desc: "Grunnstafli, það nauðsynlegasta",
  budget_mid: "Miðlungs",
  budget_mid_desc: "Gott jafnvægi verðs og árangurs",
  budget_high: "Hámarksárangur",
  budget_high_desc: "Heildstæður stafli án takmarkana",
  budget_unit: "kr. á mánuði",
  budget_no_limit: "Engin takmörk",
  loading_title: "Þjálfarinn er að setja saman staflann þinn…",
  loading_subtitle: "Við förum yfir vöruúrvalið og veljum það sem hentar þér best.",
  result_title: "Þinn sérsniðni stafli",
  result_subtitle: "Hér eru vörurnar sem þjálfarinn mælir með fyrir markmið þitt: {goal}.",
  result_foundational_label: "Grunnur",
  result_supporting_label: "Til viðbótar",
  result_optional_label: "Valfrjálst",
  result_why_label: "Af hverju þessi vara?",
  result_dosage_label: "Notkun",
  result_view_product: "Skoða vöru",
  result_total_label: "Áætlað heildarverð",
  result_per_month: "á mánuði",
  result_from_price: "Frá {price}",
  result_under_budget: "{amount} undir áætlun 👌",
  result_over_budget: "{amount} yfir áætlun",
  result_sold_out: "Uppselt",
  result_few_left: "Fáar eftir",
  result_restart: "Gera nýja greiningu",
  result_empty: "Við fundum ekki vörur sem passa fullkomlega. Prófaðu að breyta markmiði eða fjárhagsáætlun.",
  result_items: "{count} vörur",
  tips_title: "Ráð frá þjálfaranum",
  cart_note: "Bæta-í-körfu sjálfvirkt kemur með innskráningu perform.is. Núna opnast hver vara hjá perform.is.",
  error_generic: "Eitthvað fór úrskeiðis. Reyndu aftur.",
  error_load_products: "Ekki tókst að sækja vörur. Athugaðu nettenginguna og reyndu aftur.",
  error_retry: "Reyna aftur",
  footer_powered: "Knúið af vöruúrvali perform.is",
};

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = copy[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
