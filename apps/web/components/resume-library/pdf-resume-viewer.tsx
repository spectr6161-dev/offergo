"use client";

import { useEffect, useState } from "react";
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

type PdfViewerStatus = "loading" | "ready" | "error";

export function PdfResumeViewer({
  resumeId,
  title,
}: {
  resumeId: string;
  title: string;
}) {
  const [status, setStatus] = useState<PdfViewerStatus>("loading");
  const sourceUrl = `/api/resumes/${resumeId}/source-file?disposition=inline`;

  useEffect(() => {
    const controller = new AbortController();

    setStatus("loading");

    fetch(sourceUrl, {
      cache: "no-store",
      credentials: "include",
      method: "HEAD",
      signal: controller.signal,
    })
      .then((response) => {
        setStatus(response.ok ? "ready" : "error");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setStatus("error");
      });

    return () => controller.abort();
  }, [sourceUrl]);

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
            status === "error" && "text-destructive",
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
              : "PDF готов"}
        </div>
      </header>
      <main className="min-h-0 flex-1 bg-muted/30 p-3 sm:p-6">
        {status === "error" ? (
          <PdfViewerMessage text="PDF-файл недоступен в текущем окружении." />
        ) : (
          <div className="relative h-full overflow-hidden rounded-sm border bg-background shadow-sm">
            {status === "loading" ? <PdfViewerSkeleton /> : null}
            {status === "ready" ? (
              <iframe
                className="h-full w-full"
                src={sourceUrl}
                title={`PDF резюме: ${title}`}
              />
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function PdfViewerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/30 p-6">
      <Skeleton className="aspect-[210/297] h-full max-h-full max-w-[720px] rounded-sm" />
    </div>
  );
}

function PdfViewerMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-72 items-center justify-center rounded-sm border bg-background p-6 text-center text-sm text-muted-foreground shadow-sm">
      {text}
    </div>
  );
}
