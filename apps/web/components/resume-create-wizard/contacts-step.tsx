"use client";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type { ResumeBuilderContacts } from "@/components/resume-builder/builder-data";
import { formatRussianPhone } from "./formatters";
import { LargeInputField, WizardTitle, type WizardValidationErrors } from "./shared";
export function ContactsStep({
  contacts,
  setContacts,
  errors,
}: {
  contacts: ResumeBuilderContacts;
  setContacts: (next: ResumeBuilderContacts) => void;
  errors: WizardValidationErrors["contacts"];
}) {
  const update = (key: keyof ResumeBuilderContacts, value: string) =>
    setContacts({ ...contacts, [key]: value });

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Укажите контакты</WizardTitle>
      <FieldGroup>
        <LargeInputField
          label="Номер телефона"
          value={contacts.phone}
          onChange={(value) => update("phone", formatRussianPhone(value))}
          type="tel"
          inputMode="tel"
        />
        <LargeInputField
          label="Электронная почта"
          value={contacts.email}
          onChange={(value) => update("email", value)}
          type="email"
          inputMode="email"
          error={errors.email}
        />
        <div className="pt-2">
          <p className="text-sm font-semibold text-muted-foreground">
            Социальные сети
          </p>
        </div>
        <LargeInputField
          label="Telegram"
          value={contacts.telegram}
          onChange={(value) => update("telegram", value)}
        />
        <LargeInputField
          label="Max"
          value={contacts.max}
          onChange={(value) => update("max", value)}
        />
        <LargeInputField
          label="VK"
          value={contacts.vk}
          onChange={(value) => update("vk", value)}
        />
        <LargeInputField
          label="WhatsApp"
          value={contacts.whatsapp}
          onChange={(value) => update("whatsapp", value)}
        />
        <Separator />
        <LargeInputField
          label="Комментарий"
          value={contacts.comment}
          onChange={(value) => update("comment", value)}
        />
      </FieldGroup>
    </div>
  );
}
