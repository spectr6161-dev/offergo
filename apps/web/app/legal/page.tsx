import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { apiFetch } from "@/lib/api";

export const metadata: Metadata = {
  title: "Правовая документация | OfferGO",
  description:
    "Актуальные правовые документы OfferGO: политика персональных данных, согласия, оферта, правила оплаты и возврата, cookie и реквизиты.",
};

type LegalDocumentSummary = {
  id: string;
  kind: string;
  slug: string;
  version: string;
  title: string;
  summary: string | null;
  publishedAt: string;
};

type LegalDocumentsResponse = {
  items: LegalDocumentSummary[];
  requiredConsentKinds: string[];
};

export default async function LegalIndexPage() {
  const { items, requiredConsentKinds } =
    await apiFetch<LegalDocumentsResponse>("/api/v1/legal-documents");
  const required = new Set(requiredConsentKinds);

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-9">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            OfferGO
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Правовая документация
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Здесь собраны актуальные документы сервиса. Каждый документ можно
            открыть для просмотра и скачать в форматах DOCX или TXT.
          </p>
        </section>

        <ItemGroup>
          {items.map((document, index) => (
            <div key={document.id} className="flex flex-col gap-0">
              <Item asChild className="px-0 py-3 hover:bg-muted/50">
                <Link href={`/legal/${document.slug}`}>
                  <ItemMedia className="size-10 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <FileTextIcon className="size-5" />
                  </ItemMedia>
                  <ItemContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemTitle className="line-clamp-none text-base">
                        {document.title}
                      </ItemTitle>
                      {required.has(document.kind) ? (
                        <Badge variant="secondary">Обязательный</Badge>
                      ) : null}
                    </div>
                    <ItemDescription>
                      {document.summary ?? `Версия ${document.version}`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="text-muted-foreground">
                    <span className="hidden text-xs sm:inline">
                      Версия {document.version}
                    </span>
                    <ChevronRightIcon className="size-4" />
                  </ItemActions>
                </Link>
              </Item>
              {index < items.length - 1 ? <ItemSeparator /> : null}
            </div>
          ))}
        </ItemGroup>
      </div>
    </main>
  );
}
