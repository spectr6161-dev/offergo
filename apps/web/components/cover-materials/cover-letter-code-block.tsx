"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CoverLetterCodeBlock({
  text,
  onCopy,
}: {
  text: string;
  onCopy: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-zinc-950 text-zinc-50 shadow-sm dark:border-zinc-800">
      <Button
        aria-label="Скопировать отклик"
        className="absolute top-3 right-3 z-10 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
        onClick={onCopy}
        size="icon"
        type="button"
        variant="ghost"
      >
        <CopyIcon />
      </Button>
      <pre className="max-h-[min(70vh,720px)] overflow-auto p-5 pr-14 text-sm leading-7 whitespace-pre-wrap">
        <code className="font-mono">{text}</code>
      </pre>
    </div>
  );
}
