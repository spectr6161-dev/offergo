export const cookieConsentStorageKey = "offergo_cookie_consent_v2";
export const cookieConsentChangedEvent = "offergo:cookie-consent-changed";

export type CookieConsentChoice = "accepted" | "rejected";

export function getCookieConsentChoice(): CookieConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(cookieConsentStorageKey);

  return value === "accepted" || value === "rejected" ? value : null;
}

export function hasAcceptedOptionalCookies() {
  return getCookieConsentChoice() === "accepted";
}

export function setCookieConsentChoice(choice: CookieConsentChoice) {
  window.localStorage.setItem(cookieConsentStorageKey, choice);
  window.dispatchEvent(
    new CustomEvent(cookieConsentChangedEvent, {
      detail: { choice },
    }),
  );
}

export function deleteClientCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}
