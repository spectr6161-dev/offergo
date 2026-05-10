"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

import { cn } from "@/lib/utils";

type PdfJsModule = typeof import("pdfjs-dist");
type PreviewStatus = "loading" | "ready" | "error";

let pdfJsPromise: Promise<PdfJsModule> | null = null;

function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      return pdfjs;
    });
  }

  return pdfJsPromise;
}

export function PdfResumePreview({
  resumeId,
  className,
  fallback,
}: {
  resumeId: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const sourceUrl = `/api/resumes/${resumeId}/source-file?disposition=inline`;

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (width <= 0) {
      return;
    }

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let renderTask: RenderTask | null = null;

    setStatus("loading");

    async function renderFirstPage() {
      try {
        const pdfjs = await loadPdfJs();

        if (cancelled) {
          return;
        }

        loadingTask = pdfjs.getDocument({
          disableRange: true,
          disableStream: true,
          url: sourceUrl,
          withCredentials: true,
        });

        const document = await loadingTask.promise;
        const page = await document.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;

        if (cancelled || !canvas) {
          return;
        }

        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error("Canvas context is unavailable.");
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        if (
          cancelled ||
          (error instanceof Error &&
            (error.name === "AbortException" ||
              error.name === "RenderingCancelledException"))
        ) {
          return;
        }

        setStatus("error");
      }
    }

    void renderFirstPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [sourceUrl, width]);

  return (
    <div
      className={cn(
        "aspect-[210/297] w-full overflow-hidden rounded-sm border bg-background shadow-sm",
        className,
      )}
      ref={containerRef}
    >
      {status === "loading" ? (
        <PdfPreviewFallback text="Готовим PDF-превью..." />
      ) : null}
      {status === "error" ? (
        fallback ?? (
          <PdfPreviewFallback text="Не удалось отобразить PDF-превью." />
        )
      ) : null}
      <canvas
        aria-label="PDF-превью резюме"
        className={cn(
          "h-full w-full bg-white object-contain",
          status === "ready" ? "block" : "hidden",
        )}
        ref={canvasRef}
      />
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
