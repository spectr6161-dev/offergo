"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { Skeleton } from "@/components/ui/skeleton";

export type PdfViewerStatus = "loading" | "ready" | "error";

type PdfResumeViewerRendererProps = {
  resumeId: string;
  onPageCountChange: (pageCount: number) => void;
  onStatusChange: (status: PdfViewerStatus) => void;
};

type LoadedPdfDocument = {
  numPages: number;
};

type SourceFileStatus = "checking" | "ready" | "missing";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const pdfOptions = {
  disableRange: true,
  disableStream: true,
  withCredentials: true,
};

export function PdfResumeViewerRenderer({
  resumeId,
  onPageCountChange,
  onStatusChange,
}: PdfResumeViewerRendererProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [sourceStatus, setSourceStatus] =
    useState<SourceFileStatus>("checking");
  const sourceUrl = `/api/resumes/${resumeId}/source-file`;
  const file = useMemo(
    () => ({
      url: sourceUrl,
    }),
    [sourceUrl]
  );
  const pageWidth =
    width > 0 ? Math.max(280, Math.floor(Math.min(width - 24, 920))) : 0;

  useEffect(() => {
    const controller = new AbortController();

    onStatusChange("loading");
    onPageCountChange(0);
    setNumPages(0);
    setSourceStatus("checking");

    fetch(sourceUrl, {
      cache: "no-store",
      credentials: "include",
      method: "HEAD",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          setSourceStatus("ready");
          return;
        }

        setSourceStatus("missing");
        onStatusChange("error");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSourceStatus("missing");
        onStatusChange("error");
      });

    return () => controller.abort();
  }, [onPageCountChange, onStatusChange, sourceUrl]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  function handleLoadSuccess(document: LoadedPdfDocument) {
    setNumPages(document.numPages);
    onPageCountChange(document.numPages);
    onStatusChange("ready");
  }

  function handleLoadError() {
    setNumPages(0);
    onPageCountChange(0);
    onStatusChange("error");
  }

  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-muted/30 px-3 py-6 sm:px-6"
      ref={containerRef}
    >
      <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-6">
        {sourceStatus === "checking" ? (
          <PdfPagesSkeleton />
        ) : sourceStatus === "missing" ? (
          <PdfViewerMessage text="PDF-файл недоступен в текущем окружении." />
        ) : (
          <Document
            error={<PdfViewerMessage text="Не удалось отобразить PDF." />}
            file={file}
            loading={<PdfPagesSkeleton />}
            noData={<PdfViewerMessage text="PDF-файл недоступен." />}
            options={pdfOptions}
            onLoadError={handleLoadError}
            onLoadSuccess={handleLoadSuccess}
          >
            {pageWidth > 0
              ? Array.from({ length: numPages }, (_, index) => (
                  <Page
                    className="overflow-hidden rounded-sm bg-background shadow-md ring-1 ring-border"
                    key={index + 1}
                    pageNumber={index + 1}
                    renderAnnotationLayer
                    renderTextLayer
                    width={pageWidth}
                  />
                ))
              : null}
          </Document>
        )}
      </div>
    </main>
  );
}

function PdfPagesSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="aspect-[210/297] w-[min(78vw,720px)] rounded-sm" />
    </div>
  );
}

function PdfViewerMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-72 w-[min(78vw,720px)] items-center justify-center rounded-sm border bg-background p-6 text-center text-sm text-muted-foreground shadow-sm">
      {text}
    </div>
  );
}
