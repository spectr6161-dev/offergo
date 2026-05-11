import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import type { OAuth2Tokens } from "better-auth/oauth2";
import type { SocialProviders } from "better-auth/social-providers";
import { prisma } from "@offergo/db";
import { env } from "@offergo/shared";
import { telegramLoginWidget } from "./telegram";

const appOrigin = new URL(env.APP_URL).origin;
const apiOrigin = new URL(env.API_URL).origin;
const authCookieDomain = env.AUTH_COOKIE_DOMAIN.trim();
const enableGoogleAuth = env.ENABLE_GOOGLE_AUTH;
const enableTelegramAuth = env.ENABLE_TELEGRAM_AUTH;
const googleClientId = env.GOOGLE_CLIENT_ID.trim();
const googleClientSecret = env.GOOGLE_CLIENT_SECRET.trim();
const yandexClientId = env.YANDEX_OAUTH_CLIENT_ID.trim();
const yandexClientSecret = env.YANDEX_OAUTH_CLIENT_SECRET.trim();
const vkClientId = env.VK_OAUTH_CLIENT_ID.trim();
const vkClientSecret = env.VK_OAUTH_CLIENT_SECRET.trim();
const vkClientKey = env.VK_OAUTH_CLIENT_KEY.trim();

type YandexProfile = {
  id?: string;
  login?: string;
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  default_email?: string;
  emails?: string[];
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
};

function hasCredentials(...values: string[]) {
  return values.every((value) => value.trim().length > 0);
}

async function getYandexUserInfo(tokens: OAuth2Tokens) {
  if (!tokens.accessToken) {
    return null;
  }

  const response = await fetch("https://login.yandex.ru/info?format=json", {
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const profile = (await response.json()) as YandexProfile;
  const email = profile.default_email ?? profile.emails?.[0] ?? null;
  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name =
    profile.real_name ||
    profile.display_name ||
    fullName ||
    profile.login ||
    "Yandex user";
  const image =
    profile.default_avatar_id && !profile.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : undefined;

  if (!profile.id || !email) {
    return null;
  }

  return {
    id: profile.id,
    name,
    email,
    image,
    emailVerified: true,
  };
}

const socialProviders: SocialProviders = {
  ...(enableGoogleAuth && hasCredentials(googleClientId, googleClientSecret)
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          disableImplicitSignUp: true,
        },
      }
    : {}),
  ...(hasCredentials(vkClientId, vkClientSecret)
    ? {
        vk: {
          clientId: vkClientId,
          clientSecret: vkClientSecret,
          ...(vkClientKey ? { clientKey: vkClientKey } : {}),
          disableImplicitSignUp: true,
        },
      }
    : {}),
};

const yandexOAuthConfig =
  hasCredentials(yandexClientId, yandexClientSecret)
    ? [
        genericOAuth({
          config: [
            {
              providerId: "yandex",
              clientId: yandexClientId,
              clientSecret: yandexClientSecret,
              authorizationUrl: "https://oauth.yandex.ru/authorize",
              tokenUrl: "https://oauth.yandex.ru/token",
              scopes: ["login:email", "login:info"],
              getUserInfo: getYandexUserInfo,
              disableImplicitSignUp: true,
            },
          ],
        }),
      ]
    : [];

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
  account: {
    skipStateCookieCheck: env.APP_ENV !== "production",
  },
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
  plugins: [
    bearer(),
    jwt(),
    ...yandexOAuthConfig,
    ...(enableTelegramAuth ? [telegramLoginWidget()] : []),
  ],
  socialProviders,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
});
