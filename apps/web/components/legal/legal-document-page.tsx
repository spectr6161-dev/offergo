import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type LegalDocument = {
  id: string;
  kind: string;
  slug: string;
  version: string;
  title: string;
  summary: string | null;
  content: string;
  publishedAt: string;
  downloads: {
    docx: string;
    txt: string;
  } | null;
};

type LegalDocumentResponse = {
  document: LegalDocument;
};

function renderLine(line: string, index: number) {
  if (line.startsWith("## ")) {
    return (
      <h2
        key={index}
        className="pt-5 text-2xl font-semibold tracking-tight text-foreground"
      >
        {line.slice(3)}
      </h2>
    );
  }

  if (line.startsWith("### ")) {
    return (
      <h3 key={index} className="pt-3 text-xl font-semibold text-foreground">
        {line.slice(4)}
      </h3>
    );
  }

  if (line.startsWith("- ")) {
    return (
      <p key={index} className="pl-4 text-base leading-7 text-foreground/85">
        {line}
      </p>
    );
  }

  if (!line.trim()) {
    return <div key={index} className="h-2" />;
  }

  return (
    <p key={index} className="text-base leading-7 text-foreground/85">
      {line}
    </p>
  );
}

export async function LegalDocumentPage({ slug }: { slug: string }) {
  const { document } = await apiFetch<LegalDocumentResponse>(
    `/api/v1/legal-documents/${slug}`,
  );

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Link
          href="/legal"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Назад к правовой документации
        </Link>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Версия {document.version}</span>
            <span aria-hidden="true">·</span>
            <span>
              Опубликовано{" "}
              {new Intl.DateTimeFormat("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(document.publishedAt))}
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {document.title}
          </h1>
          {document.summary ? (
            <p className="text-base leading-7 text-muted-foreground">
              {document.summary}
            </p>
          ) : null}
          {document.downloads ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <a href={document.downloads.docx} download>
                  <DownloadIcon />
                  Скачать DOCX
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={document.downloads.txt} download>
                  <DownloadIcon />
                  Скачать TXT
                </a>
              </Button>
            </div>
          ) : null}
        </section>

        <Separator />

        <article className="flex flex-col gap-2">
          {document.content.split("\n").map(renderLine)}
        </article>
      </div>
    </main>
  );
}
