"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OffergoProviders, ToastProvider } from "@offergo/ui";
import { ThemeProvider } from "next-themes";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <OffergoProviders>
        <ToastProvider>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              {children}
              <CookieConsentBanner />
              <Toaster richColors />
            </QueryClientProvider>
          </TooltipProvider>
        </ToastProvider>
      </OffergoProviders>
    </ThemeProvider>
  );
}
