import type { Goal } from "./catalog";

// The structured intake the Coach panel collects, shared by client + server.

export type Gender = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Diet = "none" | "vegetarian" | "vegan" | "lactose-free" | "gluten-free";
export type FocusArea = "energy" | "sleep" | "joints" | "immunity" | "recovery" | "focus";

export type CustomerProfile = {
  goal: Goal;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  experience: Experience;
  trainingDaysPerWeek: number;
  diet: Diet[];
  focus: FocusArea[];
  notes?: string; // free-text: allergies, injuries, current supplements, preferences…
  budget: number; // monthly, in MUR
};

// Option catalogs (label + value + helper copy) the wizard renders.
export const GOAL_OPTIONS: { value: Goal; label: string; emoji: string; blurb: string }[] = [
  { value: "muscle-gain", label: "Build Muscle", emoji: "🏋️", blurb: "Add size & lean mass" },
  { value: "fat-loss", label: "Lose Fat", emoji: "🔥", blurb: "Lean out & cut" },
  { value: "strength-power", label: "Get Stronger", emoji: "💥", blurb: "Power & performance" },
  { value: "endurance", label: "Endurance", emoji: "🏃", blurb: "Stamina & cardio" },
  { value: "general-wellness", label: "General Wellness", emoji: "🌿", blurb: "Health & energy" },
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; blurb: string }[] = [
  { value: "beginner", label: "Beginner", blurb: "< 1 year training" },
  { value: "intermediate", label: "Intermediate", blurb: "1–3 years" },
  { value: "advanced", label: "Advanced", blurb: "3+ years" },
];

export const DIET_OPTIONS: { value: Diet; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "lactose-free", label: "Lactose-free" },
  { value: "gluten-free", label: "Gluten-free" },
];

export const FOCUS_OPTIONS: { value: FocusArea; label: string; emoji: string }[] = [
  { value: "energy", label: "More energy", emoji: "⚡" },
  { value: "sleep", label: "Better sleep", emoji: "😴" },
  { value: "joints", label: "Joint health", emoji: "🦴" },
  { value: "immunity", label: "Immunity", emoji: "🛡️" },
  { value: "recovery", label: "Faster recovery", emoji: "🔄" },
  { value: "focus", label: "Focus", emoji: "🎯" },
];
