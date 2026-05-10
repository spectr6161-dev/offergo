"use client";
import { BriefcaseBusinessIcon, CircleHelpIcon, SearchIcon } from "lucide-react";
import { OptionCard, WizardTitle } from "./shared";
export function IntentStep({
  onSelectProfession,
  onSkipProfession,
}: {
  onSelectProfession: () => void;
  onSkipProfession: (choice: "any" | "unknown") => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Кем вы хотите работать?</WizardTitle>
      <div className="flex flex-col gap-3">
        <OptionCard
          icon={<SearchIcon />}
          title="Укажу профессию"
          onClick={onSelectProfession}
          className="min-h-28"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            icon={<BriefcaseBusinessIcon />}
            title="Ищу любую работу"
            onClick={() => onSkipProfession("any")}
          />
          <OptionCard
            icon={<CircleHelpIcon />}
            title="Не знаю, кем хочу работать"
            onClick={() => onSkipProfession("unknown")}
          />
        </div>
      </div>
    </div>
  );
}
