"use client";

import { useCallback, useState } from "react";
import { CoachPanel, type CoachPhase } from "./CoachPanel";

// Hosts the marketing pitch + the Coach panel in the original two-column layout.
// Only as a layered animation: when Coach starts working and then delivers, the
// left pitch column collapses away and the panel expands into the freed space.
export function CoachExperience() {
  const [phase, setPhase] = useState<CoachPhase>("form");
  const onPhaseChange = useCallback((ph: CoachPhase) => setPhase(ph), []);
  const expanded = phase === "loading" || phase === "building" || phase === "result";

  return (
    <div
      className={`mx-auto grid min-h-screen max-w-6xl items-center px-6 py-12 transition-[grid-template-columns,gap] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        expanded
          ? "gap-0 lg:[grid-template-columns:0fr_1fr]"
          : "gap-10 lg:[grid-template-columns:1fr_1fr]"
      }`}
    >
      {/* Pitch — collapses + fades out when the panel expands. overflow-hidden
          clips the horizontal reflow as the column shrinks; max-h-0 (expanded
          only) stops that reflow from inflating the grid row and pushing the
          panel down. The starting (non-expanded) state is unconstrained. */}
      <div
        aria-hidden={expanded}
        className={`order-2 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:order-1 ${
          expanded ? "max-h-0 opacity-0 lg:-translate-x-10" : "opacity-100"
        }`}
      >
        <Pitch />
      </div>

      {/* Coach panel — its Shell widens on result */}
      <div className="order-1 lg:order-2">
        <CoachPanel onPhaseChange={onPhaseChange} />
      </div>
    </div>
  );
}

function Pitch() {
  return (
    <div>
      <span className="inline-block rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-zinc-950">
        PROTEIN HOUSE · No.1 in Mauritius 🇲🇺
      </span>
      <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
        Your personal
        <br />
        <span className="text-lime-400">AI supplement coach.</span>
      </h1>
      <p className="mt-5 max-w-md text-lg text-zinc-400">
        Answer a few quick questions about your body, training and budget. Coach designs a
        supplement stack built for <em>you</em> — and loads it straight into your cart.
      </p>
      <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
        {[
          "Tailored to your goal, stats & experience",
          "Real products from the live catalogue, in your budget",
          "One tap to a ready-to-checkout cart",
        ].map((t) => (
          <li key={t} className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-xs font-black text-zinc-950">
              ✓
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
