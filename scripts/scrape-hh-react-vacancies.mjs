#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "node:fs/promises";

const DEFAULT_QUERY = "react разработчик";
const DEFAULT_AREA = "113";
const DEFAULT_OUTPUT = "hh-react-vacancies.csv";
const DEFAULT_DELAY_MS = 1_200;
const DEFAULT_ITEMS_ON_PAGE = 20;
const DEFAULT_MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIES = 2;
const FILE_WRITE_RETRIES = 12;
const USER_AGENT =
  "OfferGO hh.ru HTML scraper (+https://offergo.ru; contact: support@offergo.ru)";

const CSV_COLUMNS = ["Ссылка", "Текст вакансии"];

function parseArgs(argv) {
  const args = {
    area: DEFAULT_AREA,
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
    itemsOnPage: DEFAULT_ITEMS_ON_PAGE,
    maxPages: DEFAULT_MAX_PAGES,
    maxVacancies: Number.POSITIVE_INFINITY,
    output: DEFAULT_OUTPUT,
    query: DEFAULT_QUERY,
    resume: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--resume") {
      args.resume = true;
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    const [key, ...rest] = arg.split("=");
    const value = rest.join("=");

    if (key === "--area") {
      args.area = value;
    } else if (key === "--delay-ms" && value) {
      args.delayMs = Number(value);
    } else if (key === "--items-on-page" && value) {
      args.itemsOnPage = Number(value);
    } else if (key === "--max-pages" && value) {
      args.maxPages = Number(value);
    } else if (key === "--max-vacancies" && value) {
      args.maxVacancies = Number(value);
    } else if (key === "--output" && value) {
      args.output = value;
    } else if (key === "--query" && value) {
      args.query = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }

  if (!Number.isFinite(args.itemsOnPage) || args.itemsOnPage < 1) {
    throw new Error("--items-on-page must be a positive number");
  }

  if (!Number.isFinite(args.maxPages) || args.maxPages < 1) {
    throw new Error("--max-pages must be a positive number");
  }

  if (
    args.maxVacancies !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(args.maxVacancies) || args.maxVacancies < 1)
  ) {
    throw new Error("--max-vacancies must be a positive number");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/scrape-hh-react-vacancies.mjs [options]

Options:
  --query="react разработчик"      Search query
  --area=113                       HH area id. 113 = Russia. Use --area= to omit
  --output=hh-react-vacancies.csv  Output CSV path
  --resume                         Append only missing vacancy links
  --dry-run                        Collect links only, do not write CSV
  --max-pages=100                  Max search pages to scan
  --max-vacancies=50               Limit vacancy pages for testing
  --items-on-page=20               HH search page size
  --delay-ms=1200                  Delay between requests

CSV columns:
  Ссылка, Текст вакансии

Notes:
  The scraper uses public HTML pages only. It does not call HH API and does not bypass auth, captcha, or anti-bot pages.
  hh.ru robots.txt disallows query URLs for generic bots; run this only where you have permission to collect the data.
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    if (isBlockedPage(text)) {
      throw new Error("HH returned captcha or anti-bot page");
    }

    return text;
  } catch (error) {
    if (attempt < RETRIES) {
      const delayMs = 1_500 * (attempt + 1);
      console.warn(
        `Request failed, retrying in ${delayMs}ms: ${url} (${error.message})`,
      );
      await sleep(delayMs);
      return fetchText(url, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isBlockedPage(html) {
  const lowered = html.toLowerCase();
  return (
    lowered.includes("captcha") ||
    lowered.includes("account/captcha") ||
    lowered.includes("data-qa=\"captcha-page\"") ||
    lowered.includes("подтвердите, что вы не робот")
  );
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function htmlToText(html) {
  return normalizeText(
    decodeHtml(
      String(html ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|tr)>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "• ")
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " "),
    ),
  );
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(",");
}

function buildSearchUrl({ area, itemsOnPage, page, query }) {
  const params = new URLSearchParams({
    hhtmFrom: "vacancy_search_list",
    items_on_page: String(itemsOnPage),
    page: String(page),
    text: query,
  });

  if (area) {
    params.set("area", area);
  }

  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

function normalizeVacancyUrl(rawHref) {
  const decodedHref = decodeHtml(rawHref);
  const id = decodedHref.match(/\/vacancy\/(\d+)/)?.[1];

  return id ? `https://hh.ru/vacancy/${id}` : "";
}

function extractVacancyUrls(searchHtml) {
  const urls = [];
  const seen = new Set();

  for (const match of searchHtml.matchAll(/<a\b[^>]*href=["']([^"']*\/vacancy\/\d+[^"']*)["'][^>]*>/gi)) {
    const url = normalizeVacancyUrl(match[1]);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

function findElementInnerHtmlByDataQa(html, dataQa) {
  const openTagPattern = new RegExp(
    `<([a-z0-9-]+)\\b[^>]*data-qa=["']${escapeRegExp(dataQa)}["'][^>]*>`,
    "i",
  );
  const openMatch = html.match(openTagPattern);

  if (!openMatch || openMatch.index === undefined) {
    return "";
  }

  const tagName = openMatch[1].toLowerCase();
  const contentStart = openMatch.index + openMatch[0].length;
  const tagPattern = new RegExp(`</?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = contentStart;

  let depth = 1;
  let match;

  while ((match = tagPattern.exec(html))) {
    const token = match[0];

    if (token.startsWith("</")) {
      depth -= 1;
    } else if (!token.endsWith("/>")) {
      depth += 1;
    }

    if (depth === 0) {
      return html.slice(contentStart, match.index);
    }
  }

  return "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );

  return match?.[1] ? normalizeText(decodeHtml(match[1])) : "";
}

function extractVacancyText(vacancyHtml) {
  const descriptionHtml = findElementInnerHtmlByDataQa(
    vacancyHtml,
    "vacancy-description",
  );
  const text = htmlToText(descriptionHtml);

  if (text) {
    return text;
  }

  return extractMetaDescription(vacancyHtml);
}

async function loadExistingUrls(output) {
  try {
    const content = await readFile(output, "utf8");
    return new Set(
      [...content.matchAll(/https:\/\/hh\.ru\/vacancy\/\d+/g)].map(
        (match) => match[0],
      ),
    );
  } catch {
    return new Set();
  }
}

async function writeHeader(output, resume) {
  if (resume) {
    return;
  }

  await writeFileWithRetry(output, `\uFEFF${toCsvRow(CSV_COLUMNS)}\n`);
}

async function appendRow(output, link, text) {
  await appendFileWithRetry(output, `${toCsvRow([link, text])}\n`);
}

async function writeFileWithRetry(output, content, attempt = 0) {
  try {
    await writeFile(output, content, "utf8");
  } catch (error) {
    if (isRetryableFileError(error) && attempt < FILE_WRITE_RETRIES) {
      const delayMs = 500 * (attempt + 1);
      console.warn(
        `CSV is locked, retrying write in ${delayMs}ms: ${output} (${error.code})`,
      );
      await sleep(delayMs);
      return writeFileWithRetry(output, content, attempt + 1);
    }

    throw error;
  }
}

async function appendFileWithRetry(output, content, attempt = 0) {
  try {
    await appendFile(output, content, "utf8");
  } catch (error) {
    if (isRetryableFileError(error) && attempt < FILE_WRITE_RETRIES) {
      const delayMs = 500 * (attempt + 1);
      console.warn(
        `CSV is locked, retrying append in ${delayMs}ms: ${output} (${error.code})`,
      );
      await sleep(delayMs);
      return appendFileWithRetry(output, content, attempt + 1);
    }

    throw error;
  }
}

function isRetryableFileError(error) {
  return (
    error?.code === "EBUSY" ||
    error?.code === "EPERM" ||
    error?.code === "EACCES"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existingUrls = args.resume ? await loadExistingUrls(args.output) : new Set();
  const queuedUrls = new Set(existingUrls);
  let written = 0;
  let failed = 0;
  let scannedPages = 0;

  console.log(`Query: ${args.query}`);
  console.log(`Area: ${args.area || "not set"}`);
  console.log(`Output: ${args.output}`);
  console.log(`Delay: ${args.delayMs}ms`);
  console.warn(
    "Warning: hh.ru robots.txt disallows query URLs for generic bots. Run only where you have permission.",
  );

  if (!args.dryRun) {
    await writeHeader(args.output, args.resume);
  }

  for (let page = 0; page < args.maxPages; page += 1) {
    if (written >= args.maxVacancies) {
      break;
    }

    const searchUrl = buildSearchUrl({ ...args, page });
    console.log(`Search page ${page + 1}/${args.maxPages}: ${searchUrl}`);

    const searchHtml = await fetchText(searchUrl);
    const vacancyUrls = extractVacancyUrls(searchHtml).filter(
      (url) => !queuedUrls.has(url),
    );
    scannedPages += 1;

    if (!vacancyUrls.length) {
      console.log("No new vacancy links on page, stopping.");
      break;
    }

    console.log(`Found ${vacancyUrls.length} new vacancy links.`);

    for (const vacancyUrl of vacancyUrls) {
      if (written >= args.maxVacancies) {
        break;
      }

      queuedUrls.add(vacancyUrl);

      if (args.dryRun) {
        console.log(`DRY RUN ${vacancyUrl}`);
        written += 1;
        continue;
      }

      try {
        await sleep(args.delayMs);
        const vacancyHtml = await fetchText(vacancyUrl);
        const vacancyText = extractVacancyText(vacancyHtml);

        if (!vacancyText) {
          throw new Error("Vacancy text not found");
        }

        await appendRow(args.output, vacancyUrl, vacancyText);
        written += 1;
        console.log(`Written ${written}: ${vacancyUrl}`);
      } catch (error) {
        failed += 1;
        console.warn(`Failed ${vacancyUrl}: ${error.message}`);
      }
    }

    if (page + 1 < args.maxPages && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  console.log(
    `Done. Search pages scanned=${scannedPages}, rows written=${written}, failed=${failed}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
