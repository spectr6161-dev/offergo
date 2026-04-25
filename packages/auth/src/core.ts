import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { prisma } from "@offergo/db";
import { env } from "@offergo/shared";
import { telegramLoginWidget } from "./telegram";

const appOrigin = new URL(env.APP_URL).origin;
const apiOrigin = new URL(env.API_URL).origin;
const authCookieDomain = env.AUTH_COOKIE_DOMAIN.trim();
const googleClientId = env.GOOGLE_CLIENT_ID.trim();
const googleClientSecret = env.GOOGLE_CLIENT_SECRET.trim();

const socialProviders =
  googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : {};

function buildTrustedOrigins() {
  const origins = new Set([appOrigin, apiOrigin]);

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:*");
    origins.add("http://127.0.0.1:*");
  }

  return Array.from(origins);
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
  plugins: [bearer(), jwt(), telegramLoginWidget()],
  socialProviders,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
});
