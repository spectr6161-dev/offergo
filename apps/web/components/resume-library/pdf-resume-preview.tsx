"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const pdfOptions = {
  disableRange: true,
  disableStream: true,
  withCredentials: true,
};

type SourceFileStatus = "checking" | "ready" | "missing";

export function PdfResumePreview({
  resumeId,
  className,
  fallback,
}: {
  resumeId: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [sourceStatus, setSourceStatus] =
    useState<SourceFileStatus>("checking");
  const sourceUrl = `/api/resumes/${resumeId}/source-file`;
  const file = useMemo(
    () => ({
      url: sourceUrl,
    }),
    [sourceUrl]
  );

  useEffect(() => {
    const controller = new AbortController();

    setSourceStatus("checking");

    fetch(sourceUrl, {
      cache: "no-store",
      credentials: "include",
      method: "HEAD",
      signal: controller.signal,
    })
      .then((response) => {
        setSourceStatus(response.ok ? "ready" : "missing");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSourceStatus("missing");
      });

    return () => controller.abort();
  }, [sourceUrl]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "aspect-[210/297] w-full overflow-hidden rounded-sm border bg-background shadow-sm",
        className
      )}
      ref={containerRef}
    >
      {sourceStatus !== "ready" ? (
        sourceStatus === "checking" ? (
          <PdfPreviewFallback text="Готовим PDF-превью..." />
        ) : (
          fallback ?? (
            <PdfPreviewFallback text="PDF-файл недоступен в текущем окружении." />
          )
        )
      ) : (
      <Document
        error={
          fallback ?? (
            <PdfPreviewFallback text="Не удалось отобразить PDF-превью." />
          )
        }
        file={file}
        loading={<PdfPreviewFallback text="Готовим PDF-превью..." />}
        noData={fallback ?? <PdfPreviewFallback text="PDF-файл недоступен." />}
        options={pdfOptions}
      >
        {width > 0 ? (
          <Page
            className="flex justify-center"
            pageNumber={1}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            width={width}
          />
        ) : null}
      </Document>
      )}
    </div>
  );
}

function PdfPreviewFallback({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
