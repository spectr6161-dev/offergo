"use client";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { recommendedSkills, WizardTitle } from "./shared";
export function SkillsStep({
  search,
  setSearch,
  selectedSkills,
  setSelectedSkills,
}: {
  search: string;
  setSearch: (value: string) => void;
  selectedSkills: string[];
  setSelectedSkills: (next: string[]) => void;
}) {
  function toggleSkill(skill: string) {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((item) => item !== skill));
      return;
    }

    setSelectedSkills([...selectedSkills, skill]);
  }

  function addSearchSkill() {
    const skill = search.trim();

    if (!skill || selectedSkills.includes(skill)) {
      return;
    }

    setSelectedSkills([...selectedSkills, skill]);
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Какими навыками владеете?</WizardTitle>
      <FieldGroup>
        <Field>
          <FieldLabel className="text-sm text-muted-foreground">Навыки</FieldLabel>
          <div className="relative">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSearchSkill();
                }
              }}
              placeholder="Поиск"
              className="h-14 rounded-xl border-input pr-12 text-base shadow-none md:text-base"
            />
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2" />
          </div>
        </Field>
        {selectedSkills.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedSkills.map((skill) => (
              <Badge
                key={skill}
                asChild
                variant="secondary"
                className="h-8 rounded-full px-3 text-sm"
              >
                <button type="button" onClick={() => toggleSkill(skill)}>
                  {skill}
                  <XIcon data-icon="inline-end" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <Field>
          <FieldLabel className="text-sm text-muted-foreground">
            Рекомендованные навыки
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {recommendedSkills.map((skill) => {
              const selected = selectedSkills.includes(skill);

              return (
                <button
                  type="button"
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-[var(--hh-blue)]/20 focus-visible:outline-none",
                    selected
                      ? "bg-[var(--hh-blue)] text-white"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </Field>
      </FieldGroup>
    </div>
  );
}
