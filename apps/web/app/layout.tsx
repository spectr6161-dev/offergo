import type { Metadata } from "next";
import { LegalFooter } from "@/components/legal-footer";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferGO App",
  description:
    "Greenfield B2C app for resume analysis, interview training, and billing workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="font-sans" suppressHydrationWarning>
      <body>
        <AppProviders>
          {children}
          <LegalFooter />
        </AppProviders>
      </body>
    </html>
  );
}
