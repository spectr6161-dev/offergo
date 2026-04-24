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

  let paymentUrl: string;

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
    paymentUrl = checkout.paymentUrl;
  } catch (error) {
    console.error("[billing] checkout failed", error);
    redirect("/billing?status=checkout_error");
  }

  redirect(paymentUrl);
}
