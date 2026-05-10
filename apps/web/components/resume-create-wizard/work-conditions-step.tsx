"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ResumeBuilderWorkConditions } from "@/components/resume-builder/builder-data";
import { WizardTitle } from "./shared";
const employmentTypeOptions: Array<{
  value: ResumeBuilderWorkConditions["employmentTypes"][number];
  label: string;
}> = [
  { value: "permanent", label: "Постоянная работа" },
  { value: "part_time", label: "Подработка" },
  { value: "internship", label: "Стажировка" },
  { value: "unpaid_internship", label: "Бесплатная стажировка" },
];

const workFormatOptions: Array<{
  value: ResumeBuilderWorkConditions["workFormats"][number];
  label: string;
}> = [
  { value: "onsite", label: "На месте работодателя" },
  { value: "remote", label: "Удаленно" },
  { value: "hybrid", label: "Гибрид" },
];

const contractTypeOptions: Array<{
  value: ResumeBuilderWorkConditions["contractTypes"][number];
  label: string;
}> = [
  { value: "employment_contract", label: "Трудовой договор" },
  { value: "self_employed", label: "Самозанятый" },
  { value: "individual_entrepreneur", label: "ИП" },
];

function WorkConditionToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <Field>
      <FieldLabel className="text-sm text-muted-foreground">{label}</FieldLabel>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={(next) => onChange(next as T[])}
        className="flex w-full flex-wrap gap-3"
        spacing={3}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            variant="outline"
            className="min-h-12 rounded-xl px-4 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground md:text-base"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export function WorkConditionsStep({
  value,
  onChange,
}: {
  value: ResumeBuilderWorkConditions;
  onChange: (next: ResumeBuilderWorkConditions) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Укажите условия работы</WizardTitle>
      <FieldGroup>
        <WorkConditionToggleGroup
          label="Тип занятости"
          options={employmentTypeOptions}
          value={value.employmentTypes}
          onChange={(next) => onChange({ ...value, employmentTypes: next })}
        />
        <WorkConditionToggleGroup
          label="Формат работы"
          options={workFormatOptions}
          value={value.workFormats}
          onChange={(next) => onChange({ ...value, workFormats: next })}
        />
        <WorkConditionToggleGroup
          label="Оформление"
          options={contractTypeOptions}
          value={value.contractTypes}
          onChange={(next) => onChange({ ...value, contractTypes: next })}
        />
      </FieldGroup>
    </div>
  );
}
