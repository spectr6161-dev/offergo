"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OffergoProviders, ToastProvider } from "@offergo/ui";
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
    <OffergoProviders>
      <ToastProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster richColors />
          </QueryClientProvider>
        </TooltipProvider>
      </ToastProvider>
    </OffergoProviders>
  );
}
