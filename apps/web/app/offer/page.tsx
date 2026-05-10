import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Публичная оферта",
};

export default function OfferPage() {
  return <LegalDocumentPage slug="offer" />;
}
