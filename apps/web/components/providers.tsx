"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OffergoProviders, ToastProvider } from "@offergo/ui";

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
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ToastProvider>
    </OffergoProviders>
  );
}
