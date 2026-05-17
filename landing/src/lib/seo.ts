import { brand } from "@/data/site";

export const SITE_ORIGIN = "https://offergo.ru";
export const PROMO_ROOT = `${SITE_ORIGIN}/promo`;

export type FaqItem = {
  question: string;
  answer: string;
};

export type SeoLink = {
  title: string;
  path: string;
};

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_ORIGIN).toString();
}

export function buildSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "offerGO",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows, Web, Android, iOS",
    inLanguage: "ru-RU",
    description:
      "AI-помощник для подготовки к IT-собеседованиям, проверки резюме, поиска вакансий и live-подсказок во время интервью.",
    url: PROMO_ROOT,
    downloadUrl: brand.windowsInstallerUrl,
    offers: {
      "@type": "Offer",
      priceCurrency: "RUB",
      price: "0",
      availability: "https://schema.org/InStock",
    },
  };
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildWebPageJsonLd({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: absoluteUrl(path),
    inLanguage: "ru-RU",
    keywords: keywords.join(", "),
    isPartOf: {
      "@id": `${PROMO_ROOT}#website`,
    },
  };
}

export function buildArticleJsonLd({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(path),
    inLanguage: "ru-RU",
    keywords: keywords.join(", "),
    publisher: {
      "@id": `${PROMO_ROOT}#organization`,
    },
  };
}

export function buildItemListJsonLd(items: SeoLink[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(item.path),
    })),
  };
}
