import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@offergo/db";
import { type AppRole } from "@offergo/shared";
import { auth } from "./core";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const roles = await prisma.roleAssignment.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      role: true,
    },
  });

  return {
    ...session.user,
    roles: roles.length > 0 ? roles.map((entry) => entry.role) : (["user"] as AppRole[]),
  };
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
  const expected = Array.isArray(role) ? role : [role];

  if (!expected.some((entry) => user.roles.includes(entry))) {
    redirect("/dashboard");
  }

  return user;
}
