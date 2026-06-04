"use client";

import { useEffect, useState } from "react";
import {
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  EXPERIENCE_OPTIONS,
  DIET_OPTIONS,
  FOCUS_OPTIONS,
  BUDGET_PRESETS,
  BUDGET_MIN,
  BUDGET_MAX,
  BUDGET_DEFAULT,
  BRAND,
  type SuperstoresProfile,
  type Diet,
  type FocusArea,
} from "@/lib/superstores/profile";
import { StackResult, StackHeader, type CoachResult } from "./StackResult";

export type CoachPhase = "form" | "loading" | "building" | "result" | "error";
type Status = CoachPhase;

const STEPS = ["Goal", "About you", "Training", "Lifestyle", "Budget"] as const;

const DEFAULT: Omit<SuperstoresProfile, "goal"> = {
  gender: "male",
  age: 25,
  heightCm: 175,
  weightKg: 75,
  experience: "intermediate",
  trainingDaysPerWeek: 4,
  diet: [],
  focus: [],
  notes: "",
  budget: BUDGET_DEFAULT,
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CoachPanel({
  onPhaseChange,
}: {
  onPhaseChange?: (phase: CoachPhase) => void;
}) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("form");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [partialHeader, setPartialHeader] = useState<{ stackName: string; summary: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [p, setP] = useState<Partial<SuperstoresProfile>>({ ...DEFAULT });

  useEffect(() => {
    onPhaseChange?.(status);
  }, [status, onPhaseChange]);

  const set = (patch: Partial<SuperstoresProfile>) => setP((prev) => ({ ...prev, ...patch }));

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
      const res = await fetch("/api/superstores/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Something went wrong (${res.status})`);
      }
      if (!res.body) throw new Error("No response stream");

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
              setResult(msg as CoachResult);
              setStatus("result");
            } else if (msg.type === "error") {
              throw new Error(msg.error || "Failed to build your stack");
            }
          }
          idx = buf.indexOf("\n");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build your stack");
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
      <StackResult result={result} onRestart={restart} />
    ) : status === "building" && partialHeader ? (
      <div className="flex h-full flex-col">
        <StackHeader stackName={partialHeader.stackName} summary={partialHeader.summary} />
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500" />
            Assembling your stack…
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                style={{ animationDelay: `${i * 70}ms` }}
                className="rise-in rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
              >
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
          <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl">
            💪
          </div>
        </div>
        <div>
          <p className="text-lg font-black text-white">Coach is building your stack…</p>
          <p className="mt-1 text-sm text-zinc-400">
            Matching {GOAL_OPTIONS.find((g) => g.value === p.goal)?.label.toLowerCase()} picks to
            your {usd(p.budget ?? BUDGET_DEFAULT)} budget.
          </p>
        </div>
      </div>
    ) : status === "error" ? (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl">😕</div>
        <p className="text-sm text-zinc-300">{error}</p>
        <button
          onClick={() => setStatus("form")}
          className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    ) : (
      <div className="flex h-full flex-col">
        {/* Header + progress */}
        <div className="border-b border-zinc-800 px-6 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-lg">
              💪
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-white">AI COACH</p>
              <p className="text-[11px] text-zinc-400">{BRAND.name} · Stack Builder</p>
            </div>
            <span className="ml-auto text-[11px] font-semibold text-zinc-500">
              Step {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-red-500" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-red-400">
            {STEPS[step]}
          </p>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <Field label="What's your main goal?">
              <div className="grid grid-cols-1 gap-2.5">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => set({ goal: g.value })}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                      p.goal === g.value
                        ? "border-red-500 bg-red-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span>
                      <span className="block text-sm font-bold text-white">{g.label}</span>
                      <span className="block text-xs text-zinc-400">{g.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Field label="Gender">
                <Segmented
                  options={GENDER_OPTIONS}
                  value={p.gender}
                  onChange={(v) => set({ gender: v })}
                />
              </Field>
              <Field label="Age">
                <Stepper value={p.age!} min={14} max={90} step={1} onChange={(v) => set({ age: v })} suffix="yrs" />
              </Field>
              <Field label="Height">
                <Stepper value={p.heightCm!} min={130} max={220} step={1} onChange={(v) => set({ heightCm: v })} suffix="cm" />
              </Field>
              <Field label="Weight">
                <Stepper value={p.weightKg!} min={35} max={200} step={1} onChange={(v) => set({ weightKg: v })} suffix="kg" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Field label="Training experience">
                <div className="grid grid-cols-1 gap-2.5">
                  {EXPERIENCE_OPTIONS.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => set({ experience: e.value })}
                      className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                        p.experience === e.value
                          ? "border-red-500 bg-red-500/10"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-sm font-bold text-white">{e.label}</span>
                      <span className="text-xs text-zinc-400">{e.blurb}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={`Training days per week — ${p.trainingDaysPerWeek}`}>
                <input
                  type="range"
                  min={0}
                  max={7}
                  step={1}
                  value={p.trainingDaysPerWeek}
                  onChange={(e) => set({ trainingDaysPerWeek: Number(e.target.value) })}
                  className="w-full accent-red-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Field label="Any dietary needs?" hint="Select all that apply">
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((d) => (
                    <Chip
                      key={d.value}
                      active={(p.diet ?? []).includes(d.value)}
                      onClick={() => set({ diet: toggle<Diet>(p.diet, d.value) })}
                    >
                      {d.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Extra focus areas?" hint="Optional — we'll factor these in">
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map((f) => (
                    <Chip
                      key={f.value}
                      active={(p.focus ?? []).includes(f.value)}
                      onClick={() => set({ focus: toggle<FocusArea>(p.focus, f.value) })}
                    >
                      {f.emoji} {f.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Anything else Coach should know?" hint="Optional — allergies, injuries, supplements you already take, brands you like…">
                <textarea
                  value={p.notes ?? ""}
                  onChange={(e) => set({ notes: e.target.value.slice(0, 500) })}
                  rows={3}
                  placeholder="e.g. allergic to shellfish, dodgy knees, already take a multivitamin, prefer 1st Phorm…"
                  className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500"
                />
                <p className="mt-1 text-right text-[10px] text-zinc-600">
                  {(p.notes ?? "").length}/500
                </p>
              </Field>
            </div>
          )}

          {step === 4 && (
            <Field label="Monthly budget" hint="What you'd like to spend on supplements">
              <div className="mb-3 text-center">
                <span className="text-4xl font-black text-white">{usd(p.budget ?? BUDGET_DEFAULT)}</span>
              </div>
              <input
                type="range"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={5}
                value={p.budget}
                onChange={(e) => set({ budget: Number(e.target.value) })}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>{usd(BUDGET_MIN)}</span>
                <span>{usd(BUDGET_MAX)}</span>
              </div>
              <div className="mt-4 flex gap-2">
                {BUDGET_PRESETS.map((b) => (
                  <button
                    key={b}
                    onClick={() => set({ budget: b })}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      p.budget === b
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {usd(b)}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex gap-2 border-t border-zinc-800 p-4">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
            >
              Back
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-30"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={generate}
              className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-black text-white transition hover:bg-red-400"
            >
              Build my stack 💪
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

// ---- Shell + UI primitives ------------------------------------------------

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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{label}</p>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 rounded-2xl bg-zinc-900 p-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
            value === o.value ? "bg-red-500 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center justify-between rounded-2xl bg-zinc-900 p-2">
      <button
        onClick={() => onChange(clamp(value - step))}
        className="h-10 w-10 rounded-xl bg-zinc-800 text-xl font-bold text-white transition hover:bg-zinc-700"
      >
        −
      </button>
      <div className="text-center">
        <span className="text-2xl font-black text-white">{value}</span>
        {suffix && <span className="ml-1 text-sm text-zinc-400">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(clamp(value + step))}
        className="h-10 w-10 rounded-xl bg-zinc-800 text-xl font-bold text-white transition hover:bg-zinc-700"
      >
        +
      </button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? "border-red-500 bg-red-500/10 text-red-400"
          : "border-zinc-800 text-zinc-300 hover:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
