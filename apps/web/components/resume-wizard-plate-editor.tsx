"use client";

import type { Value } from "platejs";

import { Plate, usePlateEditor } from "platejs/react";

import { WizardEditorKit } from "@/components/editor-kit";
import { SettingsDialog } from "@/components/settings-dialog";
import { Editor, EditorContainer } from "@/components/ui/editor";

type ResumeWizardPlateEditorProps = {
  initialValue: Value;
  onValueChange?: (value: Value) => void;
};

export function ResumeWizardPlateEditor({
  initialValue,
  onValueChange,
}: ResumeWizardPlateEditorProps) {
  const editor = usePlateEditor({
    plugins: WizardEditorKit,
    value: initialValue,
  });

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        onValueChange?.(value);
      }}
    >
      <EditorContainer className="h-full min-h-0 overflow-y-auto bg-background">
        <Editor
          className="min-h-full w-full px-4 pt-4 pb-24 text-base sm:px-6 md:px-8"
          placeholder="Опишите проекты, практику, курсовые, диплом, достижения..."
          variant="none"
        />
      </EditorContainer>

      <SettingsDialog />
    </Plate>
  );
}
