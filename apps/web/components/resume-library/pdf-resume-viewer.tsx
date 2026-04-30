"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { PdfViewerStatus } from "./pdf-resume-viewer-renderer";

const PdfResumeViewerRenderer = dynamic(
  () =>
    import("./pdf-resume-viewer-renderer").then(
      (module) => module.PdfResumeViewerRenderer
    ),
  {
    loading: () => <PdfViewerSkeleton />,
    ssr: false,
  }
);

export function PdfResumeViewer({
  resumeId,
  title,
}: {
  resumeId: string;
  title: string;
}) {
  const [status, setStatus] = useState<PdfViewerStatus>("loading");
  const [pageCount, setPageCount] = useState(0);

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
          <h1 className="truncate text-sm font-medium">{title}</h1>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground",
            status === "error" && "text-destructive"
          )}
        >
          {status === "loading" ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : status === "error" ? (
            <XCircleIcon data-icon="inline-start" />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" />
          )}
          {status === "loading"
            ? "Загрузка PDF..."
            : status === "error"
              ? "Ошибка PDF"
              : pageCount > 0
                ? `${pageCount} стр.`
                : "PDF готов"}
        </div>
      </header>
      <PdfResumeViewerRenderer
        resumeId={resumeId}
        onPageCountChange={setPageCount}
        onStatusChange={setStatus}
      />
    </div>
  );
}

function PdfViewerSkeleton() {
  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-muted/30 px-3 py-6 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[720px] rounded-sm" />
      </div>
    </main>
  );
}
