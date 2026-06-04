"use client";

/* eslint-disable @next/next/no-img-element */

import { BRAND } from "@/lib/superstores/profile";

export type ResultLine = {
  variantId: number;
  title: string;
  vendor: string;
  category: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  reason: string;
  dosage: string;
  description: string;
  image: string | null;
  url: string;
};

export type CoachResult = {
  stackName: string;
  summary: string;
  tips: string[];
  currency: string;
  lines: ResultLine[];
  total: number;
  itemCount: number;
  budget: number;
  overBudget: boolean;
  cartUrl: string;
};

function usd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

// The gradient header — shared by the final result and the "building" state so
// the header can appear (streamed) before the item cards finish loading.
export function StackHeader({ stackName, summary }: { stackName: string; summary: string }) {
  return (
    <div className="border-b border-zinc-800 bg-gradient-to-br from-red-500 to-rose-600 px-6 py-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">
        Your AI-built stack
      </p>
      <h2 className="text-2xl font-black text-white">{stackName}</h2>
      <p className="mt-1 text-sm font-medium leading-snug text-white/90">{summary}</p>
    </div>
  );
}

export function StackResult({
  result,
  onRestart,
}: {
  result: CoachResult;
  onRestart: () => void;
}) {
  const remaining = result.budget - result.total;

  return (
    <div className="flex h-full flex-col">
      <StackHeader stackName={result.stackName} summary={result.summary} />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {result.lines.map((l, idx) => {
            const onSale = l.compareAtPrice && l.compareAtPrice > l.unitPrice;
            const pct = onSale
              ? Math.round((1 - l.unitPrice / (l.compareAtPrice as number)) * 100)
              : 0;
            return (
              <li
                key={l.variantId}
                style={{ animationDelay: `${idx * 70}ms` }}
                className="rise-in overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
              >
                <div className="flex gap-3 p-3">
                  {/* Thumbnail */}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white"
                  >
                    {l.image ? (
                      <img
                        src={l.image}
                        alt={l.title}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🧴</div>
                    )}
                    {onSale && (
                      <span className="absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                        -{pct}%
                      </span>
                    )}
                  </a>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                        {l.category.replace("-", " ")}
                      </span>
                      {l.quantity > 1 && (
                        <span className="text-[11px] font-bold text-zinc-400">×{l.quantity}</span>
                      )}
                    </div>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-bold text-white hover:text-red-400"
                    >
                      {l.title}
                    </a>
                    <p className="text-xs text-zinc-500">{l.vendor}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-white">{usd(l.lineTotal)}</span>
                      {onSale && (
                        <span className="text-xs text-zinc-500 line-through">
                          {usd((l.compareAtPrice as number) * l.quantity)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Why + dosage */}
                <div className="space-y-1.5 px-3 pb-3">
                  <p className="text-xs leading-snug text-zinc-300">
                    <span className="font-bold text-red-400">Why: </span>
                    {l.reason}
                  </p>
                  <p className="text-xs leading-snug text-zinc-300">
                    <span className="font-bold text-red-400">How to use: </span>
                    {l.dosage}
                  </p>
                  {l.description && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-[11px] font-semibold text-zinc-500 hover:text-zinc-300">
                        <span className="group-open:hidden">+ Product details</span>
                        <span className="hidden group-open:inline">− Hide details</span>
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
          {/* Coach's tips */}
          {result.tips?.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-red-400">
                🎯 Coach&apos;s tips
              </p>
              <ul className="space-y-1.5">
                {result.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug text-zinc-300">
                    <span className="text-red-400">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Total */}
          <div className="rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">
                {result.itemCount} items · Budget {usd(result.budget)}
              </span>
              <span className="text-2xl font-black text-white">{usd(result.total)}</span>
            </div>
            {!result.overBudget ? (
              <p className="mt-1 text-right text-xs font-semibold text-red-400">
                {usd(remaining)} under budget 👌
              </p>
            ) : (
              <p className="mt-1 text-right text-xs font-semibold text-amber-400">
                {usd(-remaining)} over budget
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-800 bg-zinc-950 p-4">
        <a
          href={result.cartUrl}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-2xl bg-red-500 py-3.5 text-center text-sm font-black text-white transition hover:bg-red-400 active:scale-[0.99]"
        >
          Add all to cart →
        </a>
        <button
          onClick={onRestart}
          className="block w-full rounded-2xl border border-zinc-700 py-2.5 text-center text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
        >
          Start over
        </button>
        <p className="text-center text-[11px] text-zinc-500">{BRAND.cartNote}</p>
      </div>
    </div>
  );
}
