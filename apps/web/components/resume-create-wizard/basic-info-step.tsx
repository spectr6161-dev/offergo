"use client";
import { Field, FieldGroup } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ResumeBuilderBasic } from "@/components/resume-builder/builder-data";
import { AutocompleteField } from "./autocomplete-field";
import { birthYearOptions, DropdownRadioField, LargeInputField, months, WizardTitle, type BasicValidationErrors } from "./shared";
export function BasicInfoStep({
  basic,
  setBasic,
  errors,
}: {
  basic: ResumeBuilderBasic;
  setBasic: (next: ResumeBuilderBasic) => void;
  errors: BasicValidationErrors;
}) {
  const update = (key: string, value: string) => setBasic({ ...basic, [key]: value });
  const countryOptions = ["Россия", "Беларусь", "Казахстан", "Армения", "Другое"];
  const updateBirthDay = (value: string) => {
    update("birthDay", value.replace(/\D/g, "").slice(0, 2));
  };

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Заполните основную информацию</WizardTitle>
      <FieldGroup>
        <LargeInputField
          label="Фамилия"
          value={basic.lastName ?? ""}
          onChange={(value) => update("lastName", value)}
          error={errors.lastName}
        />
        <LargeInputField
          label="Имя"
          value={basic.firstName ?? ""}
          onChange={(value) => update("firstName", value)}
          error={errors.firstName}
        />
        <LargeInputField
          label="Отчество"
          value={basic.middleName ?? ""}
          onChange={(value) => update("middleName", value)}
        />
        <Field>
          <ToggleGroup
            type="single"
            value={basic.gender ?? ""}
            onValueChange={(value) => value && update("gender", value)}
            className="grid w-full grid-cols-2 gap-3"
            spacing={3}
          >
            <ToggleGroupItem
              value="male"
              variant="outline"
              className="h-14 rounded-xl text-base data-[state=on]:border-[var(--hh-blue)] data-[state=on]:bg-background data-[state=on]:text-foreground md:text-base"
            >
              Мужской
            </ToggleGroupItem>
            <ToggleGroupItem
              value="female"
              variant="outline"
              className="h-14 rounded-xl text-base data-[state=on]:border-[var(--hh-blue)] data-[state=on]:bg-background data-[state=on]:text-foreground md:text-base"
            >
              Женский
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <div className="flex flex-col gap-3">
          <AutocompleteField
            endpoint="/api/suggestions/cities"
            label="Город проживания"
            value={basic.city ?? ""}
            onChange={(value) => update("city", value)}
          />
          <LargeInputField
            label="Номер телефона"
            value={basic.phone ?? ""}
            hidden
            onChange={(value) => update("phone", value)}
            type="tel"
            inputMode="tel"
          />
        </div>
        <Field>
          <div className="grid grid-cols-3 gap-3">
            <LargeInputField
              label="День"
              value={basic.birthDay ?? ""}
              placeholder="День"
              onChange={updateBirthDay}
              inputMode="numeric"
              maxLength={2}
              error={errors.birthDay}
            />
            <DropdownRadioField
              label="Месяц"
              value={basic.birthMonth ?? ""}
              placeholder="Месяц"
              options={months}
              onChange={(value) => update("birthMonth", value)}
              error={errors.birthMonth}
            />
            <DropdownRadioField
              label="Год"
              value={basic.birthYear ?? ""}
              placeholder="Год"
              options={birthYearOptions}
              onChange={(value) => update("birthYear", value)}
              error={errors.birthYear}
            />
          </div>
        </Field>
        <DropdownRadioField
          label="Гражданство"
          value={basic.citizenship ?? ""}
          placeholder="Выберите гражданство"
          options={countryOptions}
          onChange={(value) => update("citizenship", value)}
          error={errors.citizenship}
        />
        <DropdownRadioField
          label="Разрешение на работу"
          value={basic.workPermit ?? ""}
          placeholder="Выберите страну"
          options={countryOptions}
          onChange={(value) => update("workPermit", value)}
          error={errors.workPermit}
        />
      </FieldGroup>
    </div>
  );
}
