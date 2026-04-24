import { redirect } from "next/navigation";
import { apiFetch, getApiErrorStatus } from "./api";

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
};

export type WebAppUser = MeResponse["user"];

export async function getCurrentUser() {
  try {
    const response = await apiFetch<MeResponse>("/api/v1/auth/me");
    return response.user;
  } catch (error) {
    if (getApiErrorStatus(error) === 401) {
      return null;
    }

    throw error;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdminUser() {
  const user = await requireUser();

  try {
    await apiFetch("/api/v1/auth/admin/ping");
    return user;
  } catch (error) {
    const status = getApiErrorStatus(error);

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/dashboard");
    }

    throw error;
  }
}
