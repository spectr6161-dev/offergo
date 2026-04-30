"use client";

import type { Value } from "platejs";

import { Plate, usePlateEditor } from "platejs/react";

import { EditorKit } from "@/components/editor-kit";
import { SettingsDialog } from "@/components/settings-dialog";
import { Editor, EditorContainer } from "@/components/ui/editor";

type PlateEditorProps = {
  initialValue: Value;
  onValueChange?: (value: Value) => void;
};

export function PlateEditor({ initialValue, onValueChange }: PlateEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        onValueChange?.(value);
      }}
    >
      <EditorContainer className="h-full">
        <Editor
          className="min-h-full"
          placeholder="Начните редактировать резюме..."
          variant="demo"
        />
      </EditorContainer>

      <SettingsDialog />
    </Plate>
  );
}
