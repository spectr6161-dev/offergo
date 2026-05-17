import type { APIRoute } from "astro";

export const GET: APIRoute = () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /promo/",
      "Disallow: /promo/auth/",
      "Disallow: /promo/account",
      "Disallow: /promo/download",
      "Sitemap: https://offergo.ru/promo/sitemap.xml",
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
