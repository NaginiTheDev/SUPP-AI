"use client";

/* eslint-disable @next/next/no-img-element */

import { t } from "@/lib/bestbody/profile";
import { GOAL_LABELS, type GoalKey } from "@/lib/bestbody/catalog";

export type ResultLine = {
  variantId: number;
  name: string;
  brand: string;
  category: string;
  priceCRC: number;
  compareAtCRC: number | null;
  formattedPrice: string;
  tier: "foundational" | "supporting" | "optional";
  reason: string;
  dosage: string;
  description: string;
  image: string | null;
  inStock: boolean;
  productUrl: string;
};

export type BestBodyResult = {
  stackName: string;
  summary: string;
  tips: string[];
  currency: string;
  lines: ResultLine[];
  total: number;
  formattedTotal: string;
  itemCount: number;
  budgetCRC: number;
  noLimit: boolean;
  overBudget: boolean;
  cartUrl: string;
};

const TIER_LABEL: Record<ResultLine["tier"], string> = {
  foundational: "result_foundational_label",
  supporting: "result_supporting_label",
  optional: "result_optional_label",
};

export function BestBodyHeader({ stackName, summary }: { stackName: string; summary: string }) {
  return (
    <div className="border-b border-zinc-200 bg-gradient-to-br from-[#FCE477] to-[#f5d63f] px-6 py-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-900/60">{t("appName")}</p>
      <h2 className="text-2xl font-black text-zinc-900">{stackName}</h2>
      <p className="mt-1 text-sm font-medium leading-snug text-zinc-900/80">{summary}</p>
    </div>
  );
}

function Initials({ brand }: { brand: string }) {
  const initials = (brand || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm font-black text-zinc-400">{initials}</div>;
}

export function BestBodyStackResult({ result, goal, onRestart }: { result: BestBodyResult; goal: GoalKey; onRestart: () => void }) {
  const remaining = result.budgetCRC - result.total;
  const remainAbs = `₡${Math.abs(remaining).toLocaleString("es-CR")}`;

  return (
    <div className="flex h-full flex-col">
      <BestBodyHeader stackName={result.stackName} summary={result.summary} />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-3 px-1 text-xs text-zinc-500">{t("result_subtitle", { goal: GOAL_LABELS[goal] ?? "" })}</p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {result.lines.map((l, idx) => {
            const onSale = l.compareAtCRC && l.compareAtCRC > l.priceCRC;
            const pct = onSale ? Math.round((1 - l.priceCRC / (l.compareAtCRC as number)) * 100) : 0;
            return (
              <li key={l.variantId} style={{ animationDelay: `${idx * 70}ms` }} className="rise-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex gap-3 p-3">
                  <a href={l.productUrl} target="_blank" rel="noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-100">
                    {l.image ? <img src={l.image} alt={l.name} className="h-full w-full object-contain p-1" loading="lazy" /> : <Initials brand={l.brand} />}
                    {onSale && <span className="absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">-{pct}%</span>}
                  </a>
                  <div className="min-w-0 flex-1">
                    <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FCE477]">{t(TIER_LABEL[l.tier])}</span>
                    <a href={l.productUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm font-bold text-zinc-900 hover:text-amber-600">{l.name}</a>
                    <p className="text-xs text-zinc-400">{l.category}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-zinc-900">{l.formattedPrice}</span>
                      {onSale && <span className="text-xs text-zinc-400 line-through">₡{(l.compareAtCRC as number).toLocaleString("es-CR")}</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 px-3 pb-3">
                  <p className="text-xs leading-snug text-zinc-600"><span className="font-bold text-amber-600">{t("result_why_label")} </span>{l.reason}</p>
                  <p className="text-xs leading-snug text-zinc-600"><span className="font-bold text-amber-600">{t("result_dosage_label")}: </span>{l.dosage}</p>
                  {l.description && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-[11px] font-semibold text-zinc-400 hover:text-zinc-600">
                        <span className="group-open:hidden">{t("result_more")}</span>
                        <span className="hidden group-open:inline">{t("result_less")}</span>
                      </summary>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{l.description}</p>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-start">
          {result.tips?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-amber-600">🎯 {t("tips_title")}</p>
              <ul className="space-y-1.5">
                {result.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug text-zinc-600"><span className="text-amber-500">•</span>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                {result.itemCount} {result.itemCount === 1 ? "producto" : "productos"}
                {!result.noLimit ? ` · ₡${result.budgetCRC.toLocaleString("es-CR")}` : ""}
              </span>
              <span className="text-2xl font-black text-zinc-900">{result.formattedTotal}</span>
            </div>
            <p className="mt-1 text-right text-[10px] text-zinc-400">{t("result_total_label")} · {t("result_per_month")}</p>
            {!result.noLimit && (
              <p className={`mt-1 text-right text-xs font-semibold ${result.overBudget ? "text-red-500" : "text-emerald-600"}`}>
                {result.overBudget ? t("result_over_budget", { amount: remainAbs }) : t("result_under_budget", { amount: remainAbs })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-200 bg-white p-4">
        <a href={result.cartUrl} target="_blank" rel="noreferrer" className="block w-full rounded-2xl bg-zinc-900 py-3.5 text-center text-sm font-black text-white transition hover:bg-zinc-800 active:scale-[0.99]">
          {t("cart_all")} →
        </a>
        <button onClick={onRestart} className="block w-full rounded-2xl border border-zinc-300 py-2.5 text-center text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50">
          {t("result_restart")}
        </button>
        <p className="text-center text-[11px] leading-snug text-zinc-400">{t("cart_all_note")}</p>
      </div>
    </div>
  );
}
