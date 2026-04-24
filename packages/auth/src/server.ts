import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AppRole } from "@offergo/shared";
import {
  getCurrentSessionFromHeaders,
  getCurrentUserFromHeaders,
  hasAnyRole,
} from "./session";

export async function getCurrentSession() {
  return getCurrentSessionFromHeaders(await headers());
}

export async function getCurrentUser() {
  return getCurrentUserFromHeaders(await headers());
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(role: AppRole | AppRole[]) {
  const user = await requireUser();

  if (!hasAnyRole(user, role)) {
    redirect("/dashboard");
  }

  return user;
}
