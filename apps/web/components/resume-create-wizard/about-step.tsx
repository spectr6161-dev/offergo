"use client";
import { Field, FieldGroup } from "@/components/ui/field";
import type { ResumeBuilderContent } from "@/components/resume-builder/builder-data";
import { ResumeWizardPlateEditor, WizardTitle } from "./shared";
export function AboutStep({
  value,
  onChange,
}: {
  value: ResumeBuilderContent["wizard"]["about"];
  onChange: (value: ResumeBuilderContent["wizard"]["about"]) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Расскажите о себе</WizardTitle>
      <FieldGroup>
        <Field>
          <div className="mb-2 text-sm text-muted-foreground">
            Коротко опишите сильные стороны, подход к работе и важные детали.
          </div>
          <div className="h-[min(560px,60vh)] min-h-96 overflow-hidden rounded-xl border border-input bg-background">
            <ResumeWizardPlateEditor
              key="about"
              initialValue={value}
              onValueChange={onChange}
            />
          </div>
        </Field>
      </FieldGroup>
    </div>
  );
}
