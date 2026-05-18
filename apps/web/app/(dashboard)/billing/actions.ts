"use server";

import { redirect } from "next/navigation";

export async function startCheckoutAction(formData: FormData) {
  const planId = formData.get("planId");

  if (typeof planId !== "string" || planId.length === 0) {
    redirect("/billing?status=checkout_error");
  }

  redirect("/billing?status=checkout_unavailable");
}
