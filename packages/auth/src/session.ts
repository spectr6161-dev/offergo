import { prisma } from "@offergo/db";
import { type AppRole } from "@offergo/shared";
import { auth } from "./core";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>>;
export type ResolvedSession = NonNullable<AppSession>;
export type SessionUser = ResolvedSession["user"];
export type AuthenticatedAppUser = SessionUser & {
  roles: AppRole[];
};

export async function getCurrentSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function getCurrentUserFromSession(
  session: ResolvedSession,
): Promise<AuthenticatedAppUser> {
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
    roles:
      roles.length > 0
        ? roles.map((entry) => entry.role)
        : (["user"] as AppRole[]),
  };
}

export async function getCurrentUserFromHeaders(headers: Headers) {
  const session = await getCurrentSessionFromHeaders(headers);

  if (!session) {
    return null;
  }

  return getCurrentUserFromSession(session);
}

export function hasAnyRole(
  user: Pick<AuthenticatedAppUser, "roles">,
  roles: AppRole | AppRole[],
) {
  const expected = Array.isArray(roles) ? roles : [roles];
  return expected.some((role) => user.roles.includes(role));
}
