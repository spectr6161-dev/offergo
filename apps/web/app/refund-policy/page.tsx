import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Политика возвратов",
};

export default function RefundPolicyPage() {
  return <LegalDocumentPage slug="refund-policy" />;
}
