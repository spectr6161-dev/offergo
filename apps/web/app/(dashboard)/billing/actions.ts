"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

type StartCheckoutResponse = {
  paymentUrl: string;
};

export async function startCheckoutAction(formData: FormData) {
  const planId = formData.get("planId");

  if (typeof planId !== "string" || planId.length === 0) {
    redirect("/billing?status=checkout_error");
  }

  try {
    const checkout = await apiFetch<StartCheckoutResponse>(
      "/api/v1/billing/checkout",
      {
        method: "POST",
        body: JSON.stringify({
          planId,
        }),
      },
    );

    redirect(checkout.paymentUrl);
  } catch {
    redirect("/billing?status=checkout_error");
  }
}
