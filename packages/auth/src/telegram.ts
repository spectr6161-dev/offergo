import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { env } from "@offergo/shared";

const TELEGRAM_PROVIDER_ID = "telegram";
const TELEGRAM_EMAIL_DOMAIN = "telegram.offergo.local";
const TELEGRAM_SIGNED_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
] as const;

const telegramCallbackQuerySchema = z.object({
  id: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.string().regex(/^\d+$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
  callbackURL: z.string().optional(),
  errorCallbackURL: z.string().optional(),
});

type TelegramCallbackQuery = z.infer<typeof telegramCallbackQuerySchema>;

function normalizeTelegramUsername(username?: string) {
  return username?.replace(/^@/, "").trim();
}

function getTelegramBotToken() {
  return env.TELEGRAM_BOT_TOKEN.trim();
}

function getTelegramDisplayName(query: TelegramCallbackQuery) {
  const fullName = [query.first_name, query.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || normalizeTelegramUsername(query.username) || "Telegram user";
}

function getTelegramPlaceholderEmail(telegramId: string) {
  return `telegram-${telegramId}@${TELEGRAM_EMAIL_DOMAIN}`;
}

function buildTelegramDataCheckString(query: TelegramCallbackQuery) {
  return TELEGRAM_SIGNED_FIELDS.flatMap((field) => {
    const value = query[field];
    return value ? [`${field}=${value}`] : [];
  })
    .sort()
    .join("\n");
}

function isSafeRedirectTarget(url: string | undefined) {
  if (!url) {
    return false;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const targetOrigin = new URL(url).origin;
    return (
      targetOrigin === new URL(env.APP_URL).origin ||
      targetOrigin === new URL(env.API_URL).origin
    );
  } catch {
    return false;
  }
}

function getRedirectTarget(url: string | undefined, fallback: string) {
  return isSafeRedirectTarget(url) ? url! : fallback;
}

function validateTelegramPayload(query: TelegramCallbackQuery) {
  const botToken = getTelegramBotToken();

  if (!botToken) {
    return false;
  }

  const maxAgeSeconds = env.TELEGRAM_AUTH_MAX_AGE_SECONDS;
  const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(query.auth_date);

  if (authAgeSeconds < 0 || authAgeSeconds > maxAgeSeconds) {
    return false;
  }

  const secret = createHash("sha256").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret)
    .update(buildTelegramDataCheckString(query))
    .digest("hex");

  const received = Buffer.from(query.hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function telegramLoginWidget() {
  return {
    id: "telegram-login-widget",
    version: "1.0.0",
    endpoints: {
      telegramCallback: createAuthEndpoint(
        "/telegram/callback",
        {
          method: "GET",
          query: telegramCallbackQuerySchema,
        },
        async (ctx) => {
          const callbackURL = getRedirectTarget(ctx.query.callbackURL, "/dashboard");
          const errorCallbackURL = getRedirectTarget(
            ctx.query.errorCallbackURL,
            "/login?error=telegram",
          );

          if (!validateTelegramPayload(ctx.query)) {
            throw ctx.redirect(errorCallbackURL);
          }

          const telegramId = ctx.query.id;
          const email = getTelegramPlaceholderEmail(telegramId);
          const name = getTelegramDisplayName(ctx.query);
          const image = ctx.query.photo_url;

          const account = await ctx.context.internalAdapter.findAccountByProviderId(
            telegramId,
            TELEGRAM_PROVIDER_ID,
          );

          let user = account
            ? await ctx.context.internalAdapter.findUserById(account.userId)
            : null;

          if (!user) {
            const existingUser = await ctx.context.internalAdapter.findUserByEmail(
              email,
              { includeAccounts: true },
            );

            if (existingUser) {
              user = existingUser.user;
              await ctx.context.internalAdapter.linkAccount({
                providerId: TELEGRAM_PROVIDER_ID,
                accountId: telegramId,
                userId: user.id,
              });
            } else {
              const created = await ctx.context.internalAdapter.createOAuthUser(
                {
                  email,
                  emailVerified: true,
                  name,
                  image,
                },
                {
                  providerId: TELEGRAM_PROVIDER_ID,
                  accountId: telegramId,
                },
              );
              user = created.user;
            }
          }

          if (!user) {
            throw ctx.redirect(errorCallbackURL);
          }

          if (user.name !== name || (image && user.image !== image)) {
            user = await ctx.context.internalAdapter.updateUser(user.id, {
              name,
              ...(image ? { image } : {}),
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);

          await setSessionCookie(ctx, {
            session,
            user,
          });

          throw ctx.redirect(callbackURL);
        },
      ),
    },
  };
}
