"use client";
import { cn } from "@/lib/utils";
import { getProgressIndex, progressSteps, type WizardStep } from "./shared";
export function WizardProgress({ step }: { step: WizardStep }) {
  const progressIndex = getProgressIndex(step);

  return (
    <div
      className="grid gap-1 px-2"
      style={{ gridTemplateColumns: `repeat(${progressSteps.length}, minmax(0, 1fr))` }}
    >
      {progressSteps.map((progressStep, index) => (
        <div
          key={progressStep}
          className={cn(
            "h-1.5 rounded-full transition-colors",
            index <= progressIndex ? "bg-[var(--hh-blue)]" : "bg-[#dce5ef]",
          )}
        />
      ))}
    </div>
  );
}
