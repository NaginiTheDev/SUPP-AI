"use client";

import { useCallback, useState } from "react";
import { PerformCoachPanel, type CoachPhase } from "./CoachPanel";
import { t } from "@/lib/perform/profile";

// Two-column layout (Icelandic pitch + Coach panel). When the panel starts
// working and then delivers, the pitch collapses and the panel expands.
export function CoachExperience() {
  const [phase, setPhase] = useState<CoachPhase>("form");
  const onPhaseChange = useCallback((ph: CoachPhase) => setPhase(ph), []);
  const expanded = phase === "loading" || phase === "building" || phase === "result";

  return (
    <div
      className={`mx-auto grid min-h-screen max-w-6xl items-center px-6 py-12 transition-[grid-template-columns,gap] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        expanded ? "gap-0 lg:[grid-template-columns:0fr_1fr]" : "gap-10 lg:[grid-template-columns:1fr_1fr]"
      }`}
    >
      <div
        aria-hidden={expanded}
        className={`order-2 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:order-1 ${
          expanded ? "max-h-0 opacity-0 lg:-translate-x-10" : "opacity-100"
        }`}
      >
        <Pitch />
      </div>

      <div className="order-1 lg:order-2">
        <PerformCoachPanel onPhaseChange={onPhaseChange} />
      </div>
    </div>
  );
}

function Pitch() {
  return (
    <div>
      <span className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
        perform.is · {t("appName")}
      </span>
      <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
        {t("intro_title")}
      </h1>
      <p className="mt-5 max-w-md text-lg text-zinc-400">{t("intro_subtitle")}</p>
      <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
        {[t("intro_b1"), t("intro_b2"), t("intro_b3")].map((line) => (
          <li key={line} className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">✓</span>
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-md text-xs text-zinc-600">{t("intro_disclaimer")}</p>
    </div>
  );
}
