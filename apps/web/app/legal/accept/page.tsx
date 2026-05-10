import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LegalAcceptClient } from "./legal-accept-client";
import { requireUser, getConsentStatus } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Принять условия OfferGO",
};

type LegalAcceptPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/resumes";
  }

  if (value.startsWith("/legal/accept")) {
    return "/resumes";
  }

  return value;
}

export default async function LegalAcceptPage({
  searchParams,
}: LegalAcceptPageProps) {
  await requireUser();
  const [{ next }, status] = await Promise.all([
    searchParams,
    getConsentStatus(),
  ]);

  if (status.ok) {
    redirect(normalizeNextPath(next));
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            Юридические документы
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Примите актуальные условия
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Для продолжения работы нужно принять действующие редакции документов
            OfferGO. Мы сохраняем версию документа, дату, IP-адрес и user-agent
            принятия.
          </p>
        </section>

        <LegalAcceptClient
          documents={status.missingDocuments}
          nextPath={normalizeNextPath(next)}
        />
      </div>
    </main>
  );
}
