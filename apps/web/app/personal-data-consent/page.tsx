import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
};

export default function PersonalDataConsentPage() {
  return <LegalDocumentPage slug="personal-data-consent" />;
}
