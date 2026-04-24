const AUTH_LOGIN_DOMAIN = "login.offergo.local";

export function normalizeLogin(login: string) {
  return login.trim().normalize("NFKC");
}

function encodeLogin(login: string) {
  return Array.from(new TextEncoder().encode(login))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function loginToAuthEmail(login: string) {
  const normalized = normalizeLogin(login);

  if (!normalized) {
    return `u@${AUTH_LOGIN_DOMAIN}`;
  }

  return `u-${encodeLogin(normalized)}@${AUTH_LOGIN_DOMAIN}`;
}

export function deriveNameFromLogin(login: string) {
  const normalized = normalizeLogin(login)
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "offerGO user";
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}
