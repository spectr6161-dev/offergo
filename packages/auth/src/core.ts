import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { prisma } from "@offergo/db";
import { env } from "@offergo/shared";
import { sendTransactionalEmail } from "./email";

const appOrigin = new URL(env.APP_URL).origin;
const apiOrigin = new URL(env.API_URL).origin;
const authCookieDomain = env.AUTH_COOKIE_DOMAIN.trim();

function buildTrustedOrigins() {
  const origins = new Set([appOrigin, apiOrigin]);

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:*");
    origins.add("http://127.0.0.1:*");
  }

  return Array.from(origins);
}

function buildClientAuthLink(
  sourceUrl: string,
  path: "/verify-email" | "/reset-password",
) {
  const source = new URL(sourceUrl);
  const token = source.searchParams.get("token");

  if (!token) {
    return sourceUrl;
  }

  const target = new URL(path, env.APP_URL);
  target.searchParams.set("token", token);

  return target.toString();
}

export const auth = betterAuth({
  appName: "offerGO",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: buildTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    cookiePrefix: "offergo",
    ...(authCookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: authCookieDomain,
          },
        }
      : {}),
  },
  plugins: [bearer(), jwt()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your offerGO password",
        text: `Open the following URL to reset your password: ${buildClientAuthLink(url, "/reset-password")}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your offerGO email",
        text: `Open the following URL to verify your email: ${buildClientAuthLink(url, "/verify-email")}`,
      });
    },
  },
});
