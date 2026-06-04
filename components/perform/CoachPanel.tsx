"use client";

import { useEffect, useState } from "react";
import {
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  EXPERIENCE_OPTIONS,
  DIET_OPTIONS,
  FOCUS_OPTIONS,
  BUDGET_PRESETS,
  t,
  type PerformProfile,
  type Diet,
  type Focus,
} from "@/lib/perform/profile";
import type { GoalKey } from "@/lib/perform/catalog";
import { PerformStackResult, PerformHeader, type PerformResult } from "./StackResult";

export type CoachPhase = "form" | "loading" | "building" | "result" | "error";

const STEPS = ["step1_title", "step2_title", "step_training_title", "step3_title", "step4_title"] as const;

const DEFAULT: Omit<PerformProfile, "goal"> = {
  gender: "male",
  age: 25,
  heightCm: 178,
  weightKg: 80,
  experience: "intermediate",
  trainingDaysPerWeek: 4,
  diet: [],
  focus: [],
  notes: "",
  budgetISK: 12000,
};

export function PerformCoachPanel({ onPhaseChange }: { onPhaseChange?: (p: CoachPhase) => void }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<CoachPhase>("form");
  const [result, setResult] = useState<PerformResult | null>(null);
  const [partialHeader, setPartialHeader] = useState<{ stackName: string; summary: string } | null>(null);
  const [error, setError] = useState("");
  const [p, setP] = useState<Partial<PerformProfile>>({ ...DEFAULT });

  useEffect(() => {
    onPhaseChange?.(status);
  }, [status, onPhaseChange]);

  const set = (patch: Partial<PerformProfile>) => setP((prev) => ({ ...prev, ...patch }));
  const toggle = <T,>(arr: T[] | undefined, v: T): T[] => {
    const a = arr ?? [];
    return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  };

  const canNext = step === 0 ? Boolean(p.goal) : true;
  const isLast = step === STEPS.length - 1;

  async function generate() {
    setStatus("loading");
    setError("");
    setPartialHeader(null);
    setResult(null);
    try {
      const res = await fetch("/api/perform/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error === "ENGIN_VARA" ? t("result_empty") : j.error || t("error_generic"));
      }
      if (!res.body) throw new Error(t("error_generic"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf("\n");
        while (idx >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (line) {
            const msg = JSON.parse(line);
            if (msg.type === "header") {
              setPartialHeader({ stackName: msg.stackName, summary: msg.summary });
              setStatus("building");
            } else if (msg.type === "result") {
              setResult(msg as PerformResult);
              setStatus("result");
            } else if (msg.type === "error") {
              throw new Error(msg.error || t("error_generic"));
            }
          }
          idx = buf.indexOf("\n");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
      setStatus("error");
    }
  }

  function restart() {
    setP({ ...DEFAULT });
    setStep(0);
    setResult(null);
    setPartialHeader(null);
    setStatus("form");
  }

  const inner =
    status === "result" && result ? (
      <PerformStackResult result={result} goal={p.goal as GoalKey} onRestart={restart} />
    ) : status === "building" && partialHeader ? (
      <div className="flex h-full flex-col">
        <PerformHeader stackName={partialHeader.stackName} summary={partialHeader.summary} />
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
            {t("loading_subtitle")}
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} style={{ animationDelay: `${i * 70}ms` }} className="rise-in rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-zinc-800" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : status === "loading" ? (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/30" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-3xl">💪</div>
        </div>
        <div>
          <p className="text-lg font-black text-white">{t("loading_title")}</p>
          <p className="mt-1 text-sm text-zinc-400">{t("loading_subtitle")}</p>
        </div>
      </div>
    ) : status === "error" ? (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl">😕</div>
        <p className="text-sm text-zinc-300">{error}</p>
        <button onClick={() => setStatus("form")} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950">
          {t("error_retry")}
        </button>
      </div>
    ) : (
      <div className="flex h-full flex-col">
        {/* Header + progress */}
        <div className="border-b border-zinc-800 px-6 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-lg">💪</div>
            <div className="leading-tight">
              <p className="text-sm font-black text-white">{t("appName")}</p>
              <p className="text-[11px] text-zinc-400">perform.is · {t("appTagline")}</p>
            </div>
            <span className="ml-auto text-[11px] font-semibold text-zinc-500">
              {t("step_progress", { current: step + 1, total: STEPS.length })}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-amber-400" : "bg-zinc-800"}`} />
            ))}
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <Field label={t("step1_title")} hint={t("step1_subtitle")}>
              <div className="grid grid-cols-1 gap-2.5">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => set({ goal: g.value })}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                      p.goal === g.value ? "border-amber-400 bg-amber-400/10" : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span>
                      <span className="block text-sm font-bold text-white">{t(g.labelKey)}</span>
                      <span className="block text-xs text-zinc-400">{t(g.descKey)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Field label={t("field_gender")}>
                <Segmented options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} value={p.gender} onChange={(v) => set({ gender: v })} />
              </Field>
              <Field label={t("field_age")}>
                <Stepper value={p.age!} min={15} max={99} onChange={(v) => set({ age: v })} suffix={t("field_age_unit")} />
              </Field>
              <Field label={t("field_height")}>
                <Stepper value={p.heightCm!} min={130} max={220} onChange={(v) => set({ heightCm: v })} suffix={t("field_height_unit")} />
              </Field>
              <Field label={t("field_weight")}>
                <Stepper value={p.weightKg!} min={35} max={200} onChange={(v) => set({ weightKg: v })} suffix={t("field_weight_unit")} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-xs text-zinc-500">{t("step_training_subtitle")}</p>
              <Field label={t("field_experience")}>
                <div className="grid grid-cols-1 gap-2.5">
                  {EXPERIENCE_OPTIONS.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => set({ experience: e.value })}
                      className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                        p.experience === e.value ? "border-amber-400 bg-amber-400/10" : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-sm font-bold text-white">{t(e.labelKey)}</span>
                      <span className="text-xs text-zinc-400">{t(e.descKey)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={`${t("field_training_days")} — ${p.trainingDaysPerWeek}`}>
                <input
                  type="range"
                  min={0}
                  max={7}
                  step={1}
                  value={p.trainingDaysPerWeek}
                  onChange={(e) => set({ trainingDaysPerWeek: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n}>{n}</span>)}
                </div>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Field label={t("field_diet")}>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((d) => (
                    <Chip key={d.value} active={(p.diet ?? []).includes(d.value)} onClick={() => set({ diet: toggle<Diet>(p.diet, d.value) })}>
                      {t(d.labelKey)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={t("field_focus")} hint={t("focus_subtitle")}>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map((f) => (
                    <Chip key={f.value} active={(p.focus ?? []).includes(f.value)} onClick={() => set({ focus: toggle<Focus>(p.focus, f.value) })}>
                      {f.emoji} {t(f.labelKey)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={t("field_notes")}>
                <textarea
                  value={p.notes ?? ""}
                  onChange={(e) => set({ notes: e.target.value.slice(0, 500) })}
                  rows={3}
                  placeholder={t("field_notes_placeholder")}
                  className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
                />
              </Field>
            </div>
          )}

          {step === 4 && (
            <Field label={t("step4_title")} hint={t("step4_subtitle")}>
              <div className="grid grid-cols-1 gap-2.5">
                {BUDGET_PRESETS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => set({ budgetISK: b.value })}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                      p.budgetISK === b.value ? "border-amber-400 bg-amber-400/10" : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-white">{t(b.labelKey)}</span>
                      <span className="block text-xs text-zinc-400">{t(b.descKey)}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-black text-amber-400">
                      {b.value.toLocaleString("is-IS")} kr.
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => set({ budgetISK: 0 })}
                  className={`rounded-2xl border p-3.5 text-center text-sm font-bold transition ${
                    p.budgetISK === 0 ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-800 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {t("budget_no_limit")}
                </button>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-center text-xs text-zinc-500">
                  {p.budgetISK ? `${p.budgetISK.toLocaleString("is-IS")} ${t("budget_unit")}` : t("budget_no_limit")}
                </p>
                <input
                  type="range"
                  min={0}
                  max={30000}
                  step={1000}
                  value={p.budgetISK}
                  onChange={(e) => set({ budgetISK: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>{t("budget_no_limit")}</span>
                  <span>30.000 kr.</span>
                </div>
              </div>
            </Field>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex gap-2 border-t border-zinc-800 p-4">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">
              {t("nav_back")}
            </button>
          )}
          {!isLast ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-30">
              {t("nav_next")}
            </button>
          ) : (
            <button onClick={generate} className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300">
              {t("nav_finish")} 💪
            </button>
          )}
        </div>
      </div>
    );

  const wide = status === "loading" || status === "building" || status === "result";
  const phaseKey = status === "building" || status === "result" ? "stack" : status;
  return (
    <Shell wide={wide}>
      <div key={phaseKey} className="phase-enter h-full">
        {inner}
      </div>
    </Shell>
  );
}

// ---- Shell + primitives ---------------------------------------------------
function Shell({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`mx-auto h-[680px] max-h-[88vh] w-full overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800 transition-[max-width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        wide ? "max-w-3xl" : "max-w-md"
      }`}
    >
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{label}</p>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 rounded-2xl bg-zinc-900 p-1.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${value === o.value ? "bg-amber-400 text-amber-950" : "text-zinc-400 hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center justify-between rounded-2xl bg-zinc-900 p-2">
      <button onClick={() => onChange(clamp(value - 1))} className="h-10 w-10 rounded-xl bg-zinc-800 text-xl font-bold text-white transition hover:bg-zinc-700">−</button>
      <div className="text-center">
        <span className="text-2xl font-black text-white">{value}</span>
        {suffix && <span className="ml-1 text-sm text-zinc-400">{suffix}</span>}
      </div>
      <button onClick={() => onChange(clamp(value + 1))} className="h-10 w-10 rounded-xl bg-zinc-800 text-xl font-bold text-white transition hover:bg-zinc-700">+</button>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${active ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-800 text-zinc-300 hover:border-zinc-700"}`}>
      {children}
    </button>
  );
}
