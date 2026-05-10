"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup } from "@/components/ui/field";
import { createEmptyPlateValue, plateValueToPlainText } from "@/components/resume-builder/builder-data";
import { AutocompleteField } from "./autocomplete-field";
import { DropdownRadioField, educationYearOptions, LargeInputField, ResumeWizardPlateEditor, WizardTitle, type EducationDraft } from "./shared";

function hasEducationDraft(value: EducationDraft) {
  return Boolean(
    value.level.trim() ||
      value.institution.trim() ||
      value.faculty.trim() ||
      value.specialization.trim() ||
      value.graduationYear.trim() ||
      plateValueToPlainText(value.activities),
  );
}
export function EducationStep({
  education,
  setEducation,
  additionalEducation,
  setAdditionalEducation,
}: {
  education: EducationDraft[];
  setEducation: Dispatch<SetStateAction<EducationDraft[]>>;
  additionalEducation: EducationDraft[];
  setAdditionalEducation: Dispatch<SetStateAction<EducationDraft[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EducationDraft>({
    id: "draft",
    level: "",
    institution: "",
    faculty: "",
    specialization: "",
    graduationYear: "",
    activities: createEmptyPlateValue(),
  });

  function syncDraft(nextDraft: EducationDraft) {
    setEducation((current) => {
      const withoutDraft = current.filter((entry) => entry.id !== nextDraft.id);

      return hasEducationDraft(nextDraft)
        ? [...withoutDraft, nextDraft]
        : withoutDraft;
    });
  }

  function update<K extends keyof EducationDraft>(key: K, value: EducationDraft[K]) {
    const nextDraft = { ...draft, [key]: value };

    setDraft(nextDraft);

    if (open) {
      syncDraft(nextDraft);
    }
  }

  function resetDraft() {
    setDraft({
      id: "draft",
      level: "",
      institution: "",
      faculty: "",
      specialization: "",
      graduationYear: "",
      activities: createEmptyPlateValue(),
    });
  }

  function addEducation() {
    if (!hasEducationDraft(draft)) {
      return;
    }

    setEducation((current) => [
      ...current.filter((entry) => entry.id !== draft.id),
      { ...draft, id: crypto.randomUUID() },
    ]);
    resetDraft();
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Какое учебное заведение включить в резюме?</WizardTitle>
      <div className="flex flex-col gap-4">
        {education.filter((item) => item.id !== draft.id).map((item) => (
          <Card
            key={item.id}
            className="rounded-xl border-[var(--hh-blue)] bg-background py-0 ring-[var(--hh-blue)]"
          >
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium">{item.institution}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[item.faculty, item.specialization].filter(Boolean).join(", ")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[item.graduationYear, item.level].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Checkbox checked aria-label="Выбрано" />
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
              Добавить учебное заведение
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <Card className="rounded-xl border-input bg-background py-0">
              <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
                <div className="flex flex-col gap-1">
                  <div className="text-base font-medium">
                    Добавить учебное заведение
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Заполните образование и опишите, чем занимались во время обучения.
                  </div>
                </div>

                <FieldGroup>
                  <DropdownRadioField
                    label="Уровень образования"
                    value={draft.level}
                    placeholder="Уровень образования"
                    options={[
                      "Среднее",
                      "Среднее специальное",
                      "Неоконченное высшее",
                      "Высшее",
                      "Бакалавр",
                      "Магистр",
                    ]}
                    onChange={(value) => update("level", value)}
                  />
                  <AutocompleteField
                    endpoint="/api/suggestions/education"
                    label="Учебное заведение"
                    value={draft.institution}
                    onChange={(value) => update("institution", value)}
                  />
                  <LargeInputField
                    label="Факультет"
                    value={draft.faculty}
                    onChange={(value) => update("faculty", value)}
                  />
                  <LargeInputField
                    label="Специализация"
                    value={draft.specialization}
                    onChange={(value) => update("specialization", value)}
                  />
                  <Field>
                    <div className="mb-2 text-sm text-muted-foreground">
                      Чем вы занимались
                    </div>
                    <div className="h-[min(520px,55vh)] min-h-80 overflow-hidden rounded-xl border border-input bg-background">
                      <ResumeWizardPlateEditor
                        key={draft.id}
                        initialValue={draft.activities}
                        onValueChange={(value) => update("activities", value)}
                      />
                    </div>
                  </Field>
                  <DropdownRadioField
                    label="Год окончания"
                    value={draft.graduationYear}
                    placeholder="Год окончания"
                    options={educationYearOptions}
                    onChange={(value) => update("graduationYear", value)}
                  />
                </FieldGroup>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEducation((current) =>
                        current.filter((entry) => entry.id !== draft.id),
                      );
                      resetDraft();
                      setOpen(false);
                    }}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={addEducation}>
                    Добавить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
        <AdditionalEducationSection
          entries={additionalEducation}
          setEntries={setAdditionalEducation}
        />
      </div>
    </div>
  );
}

function AdditionalEducationSection({
  entries,
  setEntries,
}: {
  entries: EducationDraft[];
  setEntries: Dispatch<SetStateAction<EducationDraft[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EducationDraft>({
    id: "additional-draft",
    level: "",
    institution: "",
    faculty: "",
    specialization: "",
    graduationYear: "",
    activities: createEmptyPlateValue(),
  });

  function syncDraft(nextDraft: EducationDraft) {
    setEntries((current) => {
      const withoutDraft = current.filter((entry) => entry.id !== nextDraft.id);

      return hasEducationDraft(nextDraft)
        ? [...withoutDraft, nextDraft]
        : withoutDraft;
    });
  }

  function update<K extends keyof EducationDraft>(key: K, value: EducationDraft[K]) {
    const nextDraft = { ...draft, [key]: value };

    setDraft(nextDraft);

    if (open) {
      syncDraft(nextDraft);
    }
  }

  function resetDraft() {
    setDraft({
      id: "additional-draft",
      level: "",
      institution: "",
      faculty: "",
      specialization: "",
      graduationYear: "",
      activities: createEmptyPlateValue(),
    });
  }

  function addEntry() {
    if (!hasEducationDraft(draft)) {
      return;
    }

    setEntries((current) => [
      ...current.filter((entry) => entry.id !== draft.id),
      { ...draft, id: crypto.randomUUID() },
    ]);
    resetDraft();
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium">Дополнительное образование</div>

      {entries.filter((item) => item.id !== draft.id).map((item) => (
        <Card key={item.id} className="rounded-xl border-input bg-background py-0">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-medium">{item.institution || item.specialization}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[item.faculty, item.specialization].filter(Boolean).join(", ")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[item.graduationYear, item.level].filter(Boolean).join(" · ")}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEntries(entries.filter((entry) => entry.id !== item.id))}
              aria-label="Удалить дополнительное образование"
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
            Добавить дополнительное образование
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="rounded-xl border-input bg-background py-0">
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              <FieldGroup>
                <DropdownRadioField
                  label="Уровень образования"
                  value={draft.level}
                  placeholder="Уровень образования"
                  options={[
                    "Курс",
                    "Сертификат",
                    "Повышение квалификации",
                    "Профессиональная переподготовка",
                    "Другое",
                  ]}
                  onChange={(value) => update("level", value)}
                />
                <AutocompleteField
                  endpoint="/api/suggestions/education"
                  label="Учебное заведение"
                  value={draft.institution}
                  onChange={(value) => update("institution", value)}
                />
                <LargeInputField
                  label="Факультет или программа"
                  value={draft.faculty}
                  onChange={(value) => update("faculty", value)}
                />
                <LargeInputField
                  label="Специализация"
                  value={draft.specialization}
                  onChange={(value) => update("specialization", value)}
                />
                <Field>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Чем вы занимались
                  </div>
                  <div className="h-[min(520px,55vh)] min-h-80 overflow-hidden rounded-xl border border-input bg-background">
                    <ResumeWizardPlateEditor
                      key={draft.id}
                      initialValue={draft.activities}
                      onValueChange={(value) => update("activities", value)}
                    />
                  </div>
                </Field>
                <DropdownRadioField
                  label="Год окончания"
                  value={draft.graduationYear}
                  placeholder="Год окончания"
                  options={educationYearOptions}
                  onChange={(value) => update("graduationYear", value)}
                />
              </FieldGroup>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEntries((current) =>
                      current.filter((entry) => entry.id !== draft.id),
                    );
                    resetDraft();
                    setOpen(false);
                  }}
                >
                  Отмена
                </Button>
                <Button type="button" onClick={addEntry}>
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
