import type { Goal } from "./catalog";
import {
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  EXPERIENCE_OPTIONS,
  DIET_OPTIONS,
  FOCUS_OPTIONS,
  type Gender,
  type Experience,
  type Diet,
  type FocusArea,
} from "@/lib/profile";

// Supplement Superstores reuses the English intake options from the root
// Protein House build (same questions), with USD budgeting and its own brand
// copy. This store is Shopify, so the stack auto-loads into the cart via a
// cart permalink (like the root build).

export type { Gender, Experience, Diet, FocusArea };
export { GOAL_OPTIONS, GENDER_OPTIONS, EXPERIENCE_OPTIONS, DIET_OPTIONS, FOCUS_OPTIONS };

export type SuperstoresProfile = {
  goal: Goal;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  experience: Experience;
  trainingDaysPerWeek: number;
  diet: Diet[];
  focus: FocusArea[];
  notes?: string;
  budget: number; // monthly, in USD
};

export const BRAND = {
  name: "Supplement Superstores",
  store: "Supplement Superstores · USA 🇺🇸",
  tagline: "Discount supplements at the lowest prices.",
  poweredBy: "Powered by the live supplementsuperstores.com catalogue",
  cartNote: "Opens your Supplement Superstores cart, loaded and ready to checkout.",
} as const;

// USD budget presets for the wizard (monthly spend).
export const BUDGET_PRESETS = [50, 100, 200] as const;
export const BUDGET_MIN = 25;
export const BUDGET_MAX = 400;
export const BUDGET_DEFAULT = 100;
