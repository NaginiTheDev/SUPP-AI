import type { GoalKey } from "./catalog";
import {
  copy as baseCopy,
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  EXPERIENCE_OPTIONS,
  DIET_OPTIONS,
  FOCUS_OPTIONS,
  BUDGET_PRESETS,
  type Gender,
  type Experience,
  type Diet,
  type Focus,
} from "@/lib/perform/profile";

// protin.is reuses the Icelandic intake/copy from the perform.is build, with
// brand + cart strings overridden (protin.is is Shopify, so auto-add-to-cart
// works via cart permalink — unlike perform.is).

export type { Gender, Experience, Diet, Focus };
export { GOAL_OPTIONS, GENDER_OPTIONS, EXPERIENCE_OPTIONS, DIET_OPTIONS, FOCUS_OPTIONS, BUDGET_PRESETS };

export type ProtinProfile = {
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

export const copy: Record<string, string> = {
  ...baseCopy,
  appTagline: "Þinn persónulegi ráðgjafi í bætiefnum",
  intro_b2: "Raunverulegar vörur úr vöruúrvali protin.is, innan fjárhagsáætlunar",
  intro_b3: "Allt sett beint í körfuna — tilbúið í greiðslu",
  // Auto-cart copy (Shopify cart permalink).
  cart_all: "Bæta öllu í körfu",
  cart_all_note: "Opnar körfuna þína hjá protin.is með öllum vörunum, tilbúna í greiðslu.",
  result_view_product: "Skoða vöru",
  footer_powered: "Knúið af vöruúrvali protin.is",
};

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = copy[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
