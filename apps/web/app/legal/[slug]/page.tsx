import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

type LegalDocumentRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Правовой документ | OfferGO",
};

export default async function LegalDocumentRoute({
  params,
}: LegalDocumentRouteProps) {
  const { slug } = await params;

  return <LegalDocumentPage slug={slug} />;
}
