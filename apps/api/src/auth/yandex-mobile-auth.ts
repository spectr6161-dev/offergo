import {
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { env } from "@offergo/shared";

type YandexUserInfoResponse = {
  id?: string;
  login?: string;
  client_id?: string;
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  default_email?: string;
  emails?: string[];
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
};

export type ValidatedYandexMobileProfile = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

function getYandexName(profile: YandexUserInfoResponse) {
  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    profile.real_name ||
    profile.display_name ||
    fullName ||
    profile.login ||
    "Yandex user"
  );
}

function getYandexImage(profile: YandexUserInfoResponse) {
  if (!profile.default_avatar_id || profile.is_avatar_empty) {
    return null;
  }

  return `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`;
}

export async function validateYandexMobileAccessToken(
  providerAccessToken: string,
): Promise<ValidatedYandexMobileProfile> {
  const expectedClientId = env.YANDEX_OAUTH_CLIENT_ID.trim();

  if (!expectedClientId) {
    throw new InternalServerErrorException("Yandex OAuth is not configured.");
  }

  let response: Response;

  try {
    response = await fetch("https://login.yandex.ru/info?format=json", {
      headers: {
        Authorization: `OAuth ${providerAccessToken}`,
      },
    });
  } catch {
    throw new UnauthorizedException({
      code: "invalid_provider_token",
      message: "Yandex token could not be verified.",
    });
  }

  if (!response.ok) {
    throw new UnauthorizedException({
      code: "invalid_provider_token",
      message: "Yandex token is invalid or expired.",
    });
  }

  const profile = (await response.json()) as YandexUserInfoResponse;

  if (profile.client_id !== expectedClientId) {
    throw new UnauthorizedException({
      code: "invalid_provider_token",
      message: "Yandex token was issued for another client.",
    });
  }

  const email = profile.default_email ?? profile.emails?.[0] ?? null;

  if (!profile.id || !email) {
    throw new UnauthorizedException({
      code: "invalid_provider_token",
      message: "Yandex token does not include required profile data.",
    });
  }

  return {
    id: profile.id,
    email,
    name: getYandexName(profile),
    image: getYandexImage(profile),
  };
}
