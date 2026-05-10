import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Политика cookie",
};

export default function CookiePolicyPage() {
  return <LegalDocumentPage slug="cookie-policy" />;
}
