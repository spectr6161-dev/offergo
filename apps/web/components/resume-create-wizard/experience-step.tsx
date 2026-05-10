"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createEmptyPlateValue, plateValueToPlainText } from "@/components/resume-builder/builder-data";
import { DropdownRadioField, experienceYearOptions, LargeInputField, months, ResumeWizardPlateEditor, WizardTitle, type ExperienceDraft } from "./shared";

function hasExperienceDraft(value: ExperienceDraft) {
  return Boolean(
    value.company.trim() ||
      value.position.trim() ||
      value.startMonth.trim() ||
      value.startYear.trim() ||
      value.endMonth.trim() ||
      value.endYear.trim() ||
      value.current ||
      plateValueToPlainText(value.description),
  );
}
export function ExperienceStep({
  experiences,
  setExperiences,
}: {
  experiences: ExperienceDraft[];
  setExperiences: Dispatch<SetStateAction<ExperienceDraft[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExperienceDraft>({
    id: "draft",
    company: "",
    position: "",
    startMonth: "",
    startYear: "",
    endMonth: "",
    endYear: "",
    current: false,
    description: createEmptyPlateValue(),
  });

  function syncDraft(nextDraft: ExperienceDraft) {
    setExperiences((current) => {
      const withoutDraft = current.filter((entry) => entry.id !== nextDraft.id);

      return hasExperienceDraft(nextDraft)
        ? [...withoutDraft, nextDraft]
        : withoutDraft;
    });
  }

  function update<K extends keyof ExperienceDraft>(key: K, value: ExperienceDraft[K]) {
    const nextDraft = { ...draft, [key]: value };

    setDraft(nextDraft);

    if (open) {
      syncDraft(nextDraft);
    }
  }

  function resetDraft() {
    setDraft({
      id: "draft",
      company: "",
      position: "",
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
      current: false,
      description: createEmptyPlateValue(),
    });
  }

  function addExperience() {
    if (!hasExperienceDraft(draft)) {
      return;
    }

    setExperiences((current) => [
      ...current.filter((entry) => entry.id !== draft.id),
      { ...draft, id: crypto.randomUUID() },
    ]);
    resetDraft();
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Какой опыт добавить в резюме из профиля?</WizardTitle>

      <div className="flex flex-col gap-4">
        {experiences.filter((item) => item.id !== draft.id).map((item) => (
          <Card key={item.id} className="rounded-2xl border-input bg-background py-0">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium">{item.company || "Компания"}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.position || "Должность"}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setExperiences(experiences.filter((entry) => entry.id !== item.id))
                }
                aria-label="Удалить опыт"
              >
                <Trash2Icon />
              </Button>
            </CardContent>
          </Card>
        ))}

        <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-4">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 px-4 text-base font-medium [&_svg:not([class*='size-'])]:size-5"
            >
              <PlusIcon data-icon="inline-start" />
              Добавить опыт работы
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <Card className="rounded-xl border-input bg-background py-0">
              <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
                <div className="flex flex-col gap-1">
                  <div className="text-base font-medium">Добавить опыт работы</div>
                  <div className="text-sm text-muted-foreground">
                    Укажите компанию, должность, период и основные обязанности.
                  </div>
                </div>

                <FieldGroup>
                  <LargeInputField
                    label="Компания"
                    value={draft.company}
                    onChange={(value) => update("company", value)}
                  />
                  <LargeInputField
                    label="Должность"
                    value={draft.position}
                    onChange={(value) => update("position", value)}
                  />
                  <Field>
                    <FieldLabel className="text-sm text-muted-foreground">
                      Период работы
                    </FieldLabel>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DropdownRadioField
                        label="Месяц начала"
                        value={draft.startMonth}
                        placeholder="Месяц начала"
                        options={months}
                        onChange={(value) => update("startMonth", value)}
                      />
                      <DropdownRadioField
                        label="Год начала"
                        value={draft.startYear}
                        placeholder="Год начала"
                        options={experienceYearOptions}
                        onChange={(value) => update("startYear", value)}
                      />
                      <DropdownRadioField
                        label="Месяц окончания"
                        value={draft.endMonth}
                        placeholder="Месяц окончания"
                        options={months}
                        onChange={(value) => update("endMonth", value)}
                      />
                      <DropdownRadioField
                        label="Год окончания"
                        value={draft.endYear}
                        placeholder="Год окончания"
                        options={experienceYearOptions}
                        onChange={(value) => update("endYear", value)}
                      />
                    </div>
                    <label className="mt-1 flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.current}
                        onCheckedChange={(checked) => update("current", checked === true)}
                      />
                      По настоящее время
                    </label>
                  </Field>
                  <Field>
                    <div className="mb-2 text-sm text-muted-foreground">
                      Обязанности и достижения
                    </div>
                    <div className="h-[min(520px,55vh)] min-h-80 overflow-hidden rounded-xl border border-input bg-background">
                      <ResumeWizardPlateEditor
                        key={draft.id}
                        initialValue={draft.description}
                        onValueChange={(value) => update("description", value)}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setExperiences((current) =>
                        current.filter((entry) => entry.id !== draft.id),
                      );
                      resetDraft();
                      setOpen(false);
                    }}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={addExperience}>
                    Добавить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
