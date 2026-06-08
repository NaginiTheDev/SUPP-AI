import type { GoalKey } from "./catalog";

// Structured Spanish intake collected by the BestBody "Coach" panel, plus the
// single i18n copy source for the whole experience (Costa Rica / CRC).

export type Gender = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Diet = "none" | "vegetarian" | "vegan" | "lactosefree" | "glutenfree";
export type Focus =
  | "energy" | "recovery" | "sleep" | "joints" | "digestion" | "immunity" | "hydration";

export type BestBodyProfile = {
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
  budgetCRC: number; // monthly, 0 = no limit
};

// --- Option lists rendered by the wizard ---------------------------------
export const GOAL_OPTIONS: { value: GoalKey; emoji: string; labelKey: string; descKey: string }[] = [
  { value: "musculo", emoji: "🏋️", labelKey: "goal_muscle", descKey: "goal_muscle_desc" },
  { value: "perdida_grasa", emoji: "🔥", labelKey: "goal_fatloss", descKey: "goal_fatloss_desc" },
  { value: "fuerza", emoji: "💥", labelKey: "goal_strength", descKey: "goal_strength_desc" },
  { value: "resistencia", emoji: "🏃", labelKey: "goal_endurance", descKey: "goal_endurance_desc" },
  { value: "salud_general", emoji: "🌿", labelKey: "goal_wellness", descKey: "goal_wellness_desc" },
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

// CRC monthly budget presets (supplements here run ~₡10 000–29 000 each).
export const BUDGET_PRESETS = [
  { value: 25000, labelKey: "budget_low", descKey: "budget_low_desc" },
  { value: 45000, labelKey: "budget_mid", descKey: "budget_mid_desc" },
  { value: 80000, labelKey: "budget_high", descKey: "budget_high_desc" },
];
export const BUDGET_SLIDER_MAX = 120000;
export const BUDGET_SLIDER_STEP = 5000;

// --- Spanish UI copy dictionary (single i18n source) ---------------------
export const copy: Record<string, string> = {
  appName: "Coach",
  appTagline: "Tu asesor personal de suplementos",
  intro_title: "Encuentra los suplementos ideales para ti",
  intro_subtitle:
    "Responde unas preguntas y el Coach armará un stack personalizado de productos según tus objetivos.",
  intro_start: "Empezar",
  intro_b1: "Personalizado a tu objetivo, medidas y experiencia",
  intro_b2: "Productos reales del catálogo de BestBody, dentro de tu presupuesto",
  intro_b3: "Todo se agrega al carrito — listo para pagar",
  intro_disclaimer:
    "Estas recomendaciones no sustituyen el consejo médico. Consulta a un profesional si tienes alguna condición de salud, estás embarazada o en período de lactancia.",
  nav_back: "Atrás",
  nav_next: "Siguiente",
  nav_skip: "Omitir",
  nav_finish: "Ver recomendaciones",
  nav_restart: "Empezar de nuevo",
  step_progress: "Paso {current} de {total}",
  step1_title: "¿Cuál es tu objetivo?",
  step1_subtitle: "Elige el que mejor te describe ahora.",
  goal_muscle: "Aumento muscular",
  goal_muscle_desc: "Ganar músculo y fuerza",
  goal_fatloss: "Pérdida de grasa",
  goal_fatloss_desc: "Bajar de peso y definir",
  goal_strength: "Fuerza y potencia",
  goal_strength_desc: "Más fuerza máxima y explosividad",
  goal_endurance: "Resistencia",
  goal_endurance_desc: "Mejorar el aguante y la recuperación",
  goal_wellness: "Salud general",
  goal_wellness_desc: "Bienestar y energía diaria",
  step2_title: "Sobre ti",
  step2_subtitle: "Esto nos ayuda a ajustar las dosis y las recomendaciones a tu caso.",
  step_training_title: "Entrenamiento",
  step_training_subtitle: "¿Qué tan experimentado eres y con qué frecuencia entrenas?",
  field_gender: "Sexo",
  gender_male: "Hombre",
  gender_female: "Mujer",
  gender_other: "Otro",
  field_age: "Edad",
  field_age_unit: "años",
  field_height: "Altura",
  field_height_unit: "cm",
  field_weight: "Peso",
  field_weight_unit: "kg",
  field_experience: "Experiencia entrenando",
  exp_beginner: "Principiante",
  exp_beginner_desc: "Menos de 1 año",
  exp_intermediate: "Intermedio",
  exp_intermediate_desc: "1–3 años",
  exp_advanced: "Avanzado",
  exp_advanced_desc: "Más de 3 años",
  field_training_days: "Entrenos por semana",
  training_days_unit: "veces por semana",
  step3_title: "Estilo de vida",
  step3_subtitle: "Cuéntanos sobre tu dieta y lo que quieres priorizar.",
  field_diet: "Dieta",
  diet_none: "Sin restricciones",
  diet_vegetarian: "Vegetariano",
  diet_vegan: "Vegano",
  diet_lactosefree: "Sin lactosa",
  diet_glutenfree: "Sin gluten",
  field_focus: "Áreas de enfoque",
  focus_subtitle: "Elige una o varias",
  focus_energy: "Energía y enfoque",
  focus_recovery: "Recuperación",
  focus_sleep: "Sueño y descanso",
  focus_joints: "Articulaciones y tendones",
  focus_digestion: "Digestión",
  focus_immunity: "Sistema inmune",
  focus_hydration: "Hidratación",
  field_notes: "¿Algo más que el Coach deba saber?",
  field_notes_placeholder:
    "Ej.: alergias, intolerancias, medicamentos, lesiones o experiencia previa con suplementos.",
  step4_title: "Presupuesto",
  step4_subtitle: "¿Cuánto quieres invertir al mes en suplementos?",
  budget_low: "Básico",
  budget_low_desc: "Lo esencial para empezar",
  budget_mid: "Equilibrado",
  budget_mid_desc: "Buen balance de precio y resultados",
  budget_high: "Máximo resultado",
  budget_high_desc: "Stack completo sin límites",
  budget_unit: "₡ al mes",
  budget_no_limit: "Sin límite",
  loading_title: "El Coach está armando tu stack…",
  loading_subtitle: "Revisamos el catálogo y elegimos lo mejor para ti.",
  result_title: "Tu stack personalizado",
  result_subtitle: "Estos son los productos que el Coach recomienda para tu objetivo: {goal}.",
  result_foundational_label: "Base",
  result_supporting_label: "Complemento",
  result_optional_label: "Opcional",
  result_why_label: "¿Por qué?",
  result_dosage_label: "Cómo tomarlo",
  result_view_product: "Ver producto",
  result_total_label: "Total estimado",
  result_per_month: "al mes",
  result_under_budget: "{amount} bajo tu presupuesto 👌",
  result_over_budget: "{amount} sobre tu presupuesto",
  result_restart: "Hacer un nuevo análisis",
  result_empty:
    "No encontramos productos que encajen del todo. Prueba a cambiar el objetivo o el presupuesto.",
  result_more: "+ Más",
  result_less: "− Menos",
  tips_title: "Consejos del Coach",
  cart_all: "Agregar todo al carrito",
  cart_all_note: "Abre tu carrito en BestBody con todos los productos, listo para pagar.",
  error_generic: "Algo salió mal. Inténtalo de nuevo.",
  error_load_products: "No se pudieron cargar los productos. Revisa tu conexión e inténtalo de nuevo.",
  error_retry: "Reintentar",
  footer_powered: "Impulsado por el catálogo de bestbodycr.com",
};

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = copy[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
