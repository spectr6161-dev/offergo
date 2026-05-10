import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage slug="privacy-policy" />;
}
