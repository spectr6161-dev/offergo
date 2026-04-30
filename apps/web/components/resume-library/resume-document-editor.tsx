"use client";

import type { Value } from "platejs";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { normalizeStaticValue } from "platejs";
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { PlateEditor } from "@/components/plate-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ResumeLibraryResume } from "./types";

type SaveStatus = "saved" | "dirty" | "saving" | "error";

type ResumeDocumentEditorProps = {
  resume: ResumeLibraryResume;
};

type TextLikeNode = {
  children?: TextLikeNode[];
  text?: unknown;
};

const autosaveDelayMs = 1000;

function isPlateValue(value: unknown): value is Value {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        Array.isArray((item as { children?: unknown }).children)
    )
  );
}

function textToPlateValue(text: string | null | undefined): Value {
  const normalizedText = text?.replace(/\r\n/g, "\n").trimEnd() ?? "";
  const lines = normalizedText ? normalizedText.split("\n") : [""];

  return normalizeStaticValue(
    lines.map((line) => ({
      children: [{ text: line }],
      type: "p",
    }))
  );
}

function getNodeText(node: TextLikeNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  if (Array.isArray(node.children)) {
    return node.children.map(getNodeText).join("");
  }

  return "";
}

function plateValueToText(value: Value) {
  return value.map((node) => getNodeText(node as TextLikeNode)).join("\n");
}

function serializePayload(value: Value) {
  return {
    content: value,
    plainText: plateValueToText(value),
  };
}

function stringifyPayload(payload: ReturnType<typeof serializePayload>) {
  return JSON.stringify(payload);
}

function getSaveStatusLabel(status: SaveStatus) {
  if (status === "saving") return "Сохранение...";
  if (status === "dirty") return "Есть изменения";
  if (status === "error") return "Ошибка сохранения";

  return "Сохранено";
}

export function ResumeDocumentEditor({ resume }: ResumeDocumentEditorProps) {
  const initialValue = useMemo(() => {
    if (isPlateValue(resume.currentVersion?.content)) {
      return normalizeStaticValue(resume.currentVersion.content);
    }

    return textToPlateValue(resume.currentVersion?.plainText);
  }, [resume.currentVersion?.content, resume.currentVersion?.plainText]);
  const initialPayload = useMemo(
    () => stringifyPayload(serializePayload(initialValue)),
    [initialValue]
  );
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<ReturnType<typeof serializePayload>>(
    serializePayload(initialValue)
  );
  const lastSavedPayloadRef = useRef(initialPayload);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  async function saveLatestValue() {
    const payload = latestPayloadRef.current;
    const serialized = stringifyPayload(payload);

    if (serialized === lastSavedPayloadRef.current) {
      setStatus("saved");
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(`/api/resumes/${resume.id}/content`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: serialized,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Не удалось сохранить резюме.");
      }

      lastSavedPayloadRef.current = serialized;
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить резюме."
      );
    }
  }

  function scheduleSave(value: Value) {
    const payload = serializePayload(value);
    const serialized = stringifyPayload(payload);

    latestPayloadRef.current = payload;

    if (serialized === lastSavedPayloadRef.current) {
      setStatus("saved");
      return;
    }

    setStatus("dirty");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveLatestValue();
    }, autosaveDelayMs);
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
        <Button asChild size="sm" variant="ghost">
          <Link href="/resumes">
            <ArrowLeftIcon data-icon="inline-start" />
            Мои резюме
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{resume.title}</h1>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground",
            status === "error" && "text-destructive"
          )}
        >
          {status === "saving" ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" />
          )}
          {getSaveStatusLabel(status)}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden bg-muted/30">
        <PlateEditor
          key={resume.id}
          initialValue={initialValue}
          onValueChange={scheduleSave}
        />
      </main>
    </div>
  );
}
