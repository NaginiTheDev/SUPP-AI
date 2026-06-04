"use client";

/* eslint-disable @next/next/no-img-element */

import { t } from "@/lib/protin/profile";
import { GOAL_LABELS, type GoalKey } from "@/lib/protin/catalog";

export type ResultLine = {
  variantId: number;
  name: string;
  brand: string;
  category: string;
  priceISK: number;
  compareAtISK: number | null;
  formattedPrice: string;
  tier: "foundational" | "supporting" | "optional";
  reason: string;
  dosage: string;
  description: string;
  image: string | null;
  inStock: boolean;
  productUrl: string;
};

export type ProtinResult = {
  stackName: string;
  summary: string;
  tips: string[];
  currency: string;
  lines: ResultLine[];
  total: number;
  formattedTotal: string;
  itemCount: number;
  budgetISK: number;
  noLimit: boolean;
  overBudget: boolean;
  cartUrl: string;
};

const TIER_LABEL: Record<ResultLine["tier"], string> = {
  foundational: "result_foundational_label",
  supporting: "result_supporting_label",
  optional: "result_optional_label",
};

export function ProtinHeader({ stackName, summary }: { stackName: string; summary: string }) {
  return (
    <div className="border-b border-zinc-800 bg-gradient-to-br from-sky-400 to-blue-500 px-6 py-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-blue-950/70">{t("appName")}</p>
      <h2 className="text-2xl font-black text-blue-950">{stackName}</h2>
      <p className="mt-1 text-sm font-medium leading-snug text-blue-950/80">{summary}</p>
    </div>
  );
}

function Initials({ brand }: { brand: string }) {
  const initials = (brand || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm font-black text-zinc-500">{initials}</div>;
}

export function ProtinStackResult({ result, goal, onRestart }: { result: ProtinResult; goal: GoalKey; onRestart: () => void }) {
  const remaining = result.budgetISK - result.total;
  const remainAbs = `${Math.abs(remaining).toLocaleString("is-IS")} kr.`;

  return (
    <div className="flex h-full flex-col">
      <ProtinHeader stackName={result.stackName} summary={result.summary} />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-3 px-1 text-xs text-zinc-400">{t("result_subtitle", { goal: GOAL_LABELS[goal] ?? "" })}</p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {result.lines.map((l, idx) => {
            const onSale = l.compareAtISK && l.compareAtISK > l.priceISK;
            const pct = onSale ? Math.round((1 - l.priceISK / (l.compareAtISK as number)) * 100) : 0;
            return (
              <li key={l.variantId} style={{ animationDelay: `${idx * 70}ms` }} className="rise-in overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
                <div className="flex gap-3 p-3">
                  <a href={l.productUrl} target="_blank" rel="noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                    {l.image ? <img src={l.image} alt={l.name} className="h-full w-full object-contain p-1" loading="lazy" /> : <Initials brand={l.brand} />}
                    {onSale && <span className="absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">-{pct}%</span>}
                  </a>
                  <div className="min-w-0 flex-1">
                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-400">{t(TIER_LABEL[l.tier])}</span>
                    <a href={l.productUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm font-bold text-white hover:text-sky-400">{l.name}</a>
                    <p className="text-xs text-zinc-500">{l.brand}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-white">{l.formattedPrice}</span>
                      {onSale && <span className="text-xs text-zinc-500 line-through">{(l.compareAtISK as number).toLocaleString("is-IS")} kr.</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 px-3 pb-3">
                  <p className="text-xs leading-snug text-zinc-300"><span className="font-bold text-sky-400">{t("result_why_label")} </span>{l.reason}</p>
                  <p className="text-xs leading-snug text-zinc-300"><span className="font-bold text-sky-400">{t("result_dosage_label")}: </span>{l.dosage}</p>
                  {l.description && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-[11px] font-semibold text-zinc-500 hover:text-zinc-300">
                        <span className="group-open:hidden">+ Nánar</span>
                        <span className="hidden group-open:inline">− Fela</span>
                      </summary>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{l.description}</p>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-start">
          {result.tips?.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-sky-400">🎯 {t("tips_title")}</p>
              <ul className="space-y-1.5">
                {result.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug text-zinc-300"><span className="text-sky-400">•</span>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">
                {result.itemCount} {result.itemCount % 10 === 1 && result.itemCount % 100 !== 11 ? "vara" : "vörur"}
                {!result.noLimit ? ` · ${result.budgetISK.toLocaleString("is-IS")} kr.` : ""}
              </span>
              <span className="text-2xl font-black text-white">{result.formattedTotal}</span>
            </div>
            <p className="mt-1 text-right text-[10px] text-zinc-500">{t("result_total_label")} · {t("result_per_month")}</p>
            {!result.noLimit && (
              <p className={`mt-1 text-right text-xs font-semibold ${result.overBudget ? "text-red-400" : "text-sky-400"}`}>
                {result.overBudget ? t("result_over_budget", { amount: remainAbs }) : t("result_under_budget", { amount: remainAbs })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-800 bg-zinc-950 p-4">
        <a href={result.cartUrl} target="_blank" rel="noreferrer" className="block w-full rounded-2xl bg-sky-400 py-3.5 text-center text-sm font-black text-blue-950 transition hover:bg-sky-300 active:scale-[0.99]">
          {t("cart_all")} →
        </a>
        <button onClick={onRestart} className="block w-full rounded-2xl border border-zinc-700 py-2.5 text-center text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">
          {t("result_restart")}
        </button>
        <p className="text-center text-[11px] leading-snug text-zinc-500">{t("cart_all_note")}</p>
      </div>
    </div>
  );
}
