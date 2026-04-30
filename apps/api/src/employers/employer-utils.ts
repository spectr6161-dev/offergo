import { createHash } from "node:crypto";

export function normalizeEmployerName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeEmployerNameKey(name: string) {
  return normalizeEmployerName(name).toLocaleLowerCase("ru-RU");
}

export function normalizeEmployerWebsite(value?: string | null) {
  const raw = value?.replace(/\s+/g, "").trim();

  if (!raw) {
    return {
      website: null,
      normalizedWebsite: null,
    };
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  const url = new URL(withProtocol);
  const hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/+$/, "");
  const normalizedPathname = pathname && pathname !== "/" ? pathname : "";

  return {
    website: `${url.protocol}//${hostname}${normalizedPathname}`,
    normalizedWebsite: `${hostname}${normalizedPathname}`.toLocaleLowerCase("en-US"),
  };
}

export function createCategorySlug(name: string) {
  const normalized = normalizeEmployerName(name);
  const base =
    normalized
      .toLocaleLowerCase("ru-RU")
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "category";
  const hash = createHash("sha1").update(normalized).digest("hex").slice(0, 8);

  return `${base}-${hash}`;
}
