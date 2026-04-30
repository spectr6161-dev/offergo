#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "node:fs/promises";

const BASE_URL = "https://workspace.ru";
const CONTRACTORS_URL = `${BASE_URL}/contractors/`;
const DEFAULT_OUTPUT = "workspace-contractors.csv";
const DEFAULT_DELAY_MS = 900;
const DEFAULT_PROFILE_DELAY_MS = 200;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIES = 2;
const USER_AGENT =
  "OfferGO workspace.ru contractors scraper (+https://offergo.ru; contact: support@offergo.ru)";

function parseArgs(argv) {
  const args = {
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
    maxCategories: Number.POSITIVE_INFINITY,
    maxPages: Number.POSITIVE_INFINITY,
    output: DEFAULT_OUTPUT,
    profileDelayMs: DEFAULT_PROFILE_DELAY_MS,
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

    const [key, value] = arg.split("=");

    if (key === "--delay-ms" && value) {
      args.delayMs = Number(value);
    } else if (key === "--max-categories" && value) {
      args.maxCategories = Number(value);
    } else if (key === "--max-pages" && value) {
      args.maxPages = Number(value);
    } else if (key === "--output" && value) {
      args.output = value;
    } else if (key === "--profile-delay-ms" && value) {
      args.profileDelayMs = Number(value);
    } else if (key === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }

  if (!Number.isFinite(args.profileDelayMs) || args.profileDelayMs < 0) {
    throw new Error("--profile-delay-ms must be a non-negative number");
  }

  if (!Number.isFinite(args.maxPages) || args.maxPages < 1) {
    if (args.maxPages !== Number.POSITIVE_INFINITY) {
      throw new Error("--max-pages must be a positive number");
    }
  }

  if (
    args.maxCategories !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(args.maxCategories) || args.maxCategories < 1)
  ) {
    throw new Error("--max-categories must be a positive number");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/scrape-workspace-contractors.mjs [options]

Options:
  --output=workspace-contractors.csv  Output CSV path
  --dry-run                          Print progress and do not write CSV
  --resume                           Keep existing CSV rows and append missing pairs
  --max-categories=2                 Limit categories for testing
  --max-pages=3                      Limit pages per category
  --delay-ms=900                     Delay between requests
  --profile-delay-ms=200             Delay between company profile requests
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
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < RETRIES) {
      const retryDelayMs = 1_000 * (attempt + 1);
      console.warn(
        `Request failed, retrying in ${retryDelayMs}ms: ${url} (${error.message})`,
      );
      await sleep(retryDelayMs);
      return fetchText(url, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value) {
  return value
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

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function normalizeText(value) {
  return decodeHtml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

function getAttribute(tag, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(pattern);
  return match?.[1] ? decodeHtml(match[1]).trim() : "";
}

function toAbsoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, BASE_URL).toString();
}

function isAllowedCatalogPath(path) {
  return (
    path.startsWith("/") &&
    path.endsWith("/") &&
    !path.startsWith("/ajax/") &&
    !path.startsWith("/api/") &&
    !path.startsWith("/api-v/") &&
    !path.includes("?")
  );
}

function extractCategories(html) {
  const categories = [];
  const seen = new Set();
  const linkRegex =
    /<a\b([^>]*class=["'][^"']*c-link\s+_blue-d-type2\s+_underline[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const tag = match[1];
    const href = getAttribute(tag, "href");
    const label = normalizeText(match[2]);

    if (!href || !label || !isAllowedCatalogPath(href)) {
      continue;
    }

    const key = `${href}|${label}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    categories.push({
      label,
      path: href,
      url: toAbsoluteUrl(href),
    });
  }

  return categories;
}

function extractCompanies(html) {
  const companies = [];
  const seen = new Set();
  const titleRegex =
    /<a\b([^>]*class=["'][^"']*catalog2023-list-item__title[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(titleRegex)) {
    const tag = match[1];
    const href = getAttribute(tag, "href");
    const title = getAttribute(tag, "title");
    const text = normalizeText(match[2]);
    const name = title || text;

    if (!name || !href || !href.startsWith("/contractors/")) {
      continue;
    }

    const key = href;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    companies.push({
      key,
      name,
      profileUrl: toAbsoluteUrl(href),
    });
  }

  return companies;
}

function normalizeWebsiteUrl(value) {
  const decoded = decodeHtml(value).trim();

  try {
    const url = new URL(decoded);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    if (url.hostname === "workspace.ru" || url.hostname.endsWith(".workspace.ru")) {
      return "";
    }

    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function decodeWorkspaceRedirect(href) {
  try {
    const url = new URL(href, BASE_URL);

    if (url.pathname !== "/redirect/") {
      return "";
    }

    const encodedUrl = url.searchParams.get("url");
    if (!encodedUrl) {
      return "";
    }

    return normalizeWebsiteUrl(Buffer.from(encodedUrl, "base64").toString("utf8"));
  } catch {
    return "";
  }
}

function extractCompanyWebsite(html) {
  const siteLinkRegex =
    /<a\b([^>]*class=["'][^"']*card-info__contact[^"']*_site[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i;
  const siteLinkMatch = html.match(siteLinkRegex);

  if (!siteLinkMatch) {
    return "";
  }

  const visibleWebsite = normalizeWebsiteUrl(normalizeText(siteLinkMatch[2]));
  if (visibleWebsite) {
    return visibleWebsite;
  }

  const analyticsWebsite = normalizeWebsiteUrl(
    getAttribute(siteLinkMatch[1], "data-analytics-id"),
  );
  if (analyticsWebsite) {
    return analyticsWebsite;
  }

  return decodeWorkspaceRedirect(getAttribute(siteLinkMatch[1], "href"));
}

async function getCompanyWebsite(company, args, websiteCache) {
  if (websiteCache.has(company.key)) {
    return websiteCache.get(company.key);
  }

  let website = "";

  try {
    const html = await fetchText(company.profileUrl);
    website = extractCompanyWebsite(html);
  } catch (error) {
    console.warn(
      `Failed to fetch website for ${company.name} (${company.profileUrl}): ${error.message}`,
    );
  }

  websiteCache.set(company.key, website);

  if (args.profileDelayMs > 0) {
    await sleep(args.profileDelayMs);
  }

  return website;
}

function getNextPageUrl(html) {
  const nextLinkRegex = /<link\b([^>]*\brel=["']next["'][^>]*)>/i;
  const match = html.match(nextLinkRegex);
  if (!match) {
    return null;
  }

  const href = getAttribute(match[1], "href");
  if (!href || href.startsWith("/ajax/") || href.startsWith("/api/")) {
    return null;
  }

  return toAbsoluteUrl(href);
}

function escapeCsv(value) {
  const normalized = String(value).replace(/\r?\n/g, "\n");

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function formatCsvRow(row) {
  return [row.companyName, row.category, row.website ?? ""].map(escapeCsv).join(",");
}

function buildCsv(rows) {
  const lines = [["company_name", "category", "website"].map(escapeCsv).join(",")];

  for (const row of rows) {
    lines.push(formatCsvRow(row));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (insideQuotes && char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (!insideQuotes && char === ",") {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

async function readExistingRows(outputPath) {
  try {
    const content = await readFile(outputPath, "utf8");
    const normalizedContent = content.replace(/^\uFEFF/, "");
    const lines = normalizedContent
      .split(/\r?\n/g)
      .filter((line) => line.trim().length > 0);
    const header = lines[0]?.trim();

    if (header !== "company_name,category,website") {
      throw new Error(
        `Existing CSV has old schema "${header}". Rerun without --resume to regenerate with website column.`,
      );
    }

    return lines.slice(1).map((line) => {
      const [companyName = "", category = "", website = ""] = parseCsvLine(line);
      return {
        category: category.trim(),
        companyName: companyName.trim(),
        website: website.trim(),
      };
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function getRowKey(row) {
  return `${row.companyName}\u0000${row.category}`;
}

async function createCsvSink(args) {
  if (args.dryRun) {
    return {
      existingRows: [],
      pairKeys: new Set(),
      async appendRows() {},
    };
  }

  const existingRows = args.resume ? await readExistingRows(args.output) : [];
  const pairKeys = new Set(existingRows.map(getRowKey));

  if (args.resume && existingRows.length > 0) {
    console.log(`Resume mode: loaded ${existingRows.length} existing rows`);
  } else {
    await writeFile(args.output, "\uFEFFcompany_name,category,website\r\n", "utf8");
  }

  return {
    existingRows,
    pairKeys,
    async appendRows(rows) {
      if (rows.length === 0) {
        return;
      }

      await appendFile(
        args.output,
        `${rows.map(formatCsvRow).join("\r\n")}\r\n`,
        "utf8",
      );
    },
  };
}

function validateRows(rows) {
  const pairSet = new Set();
  let emptyRows = 0;
  let htmlRows = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    if (!row.companyName || !row.category) {
      emptyRows += 1;
    }

    if (
      /<[^>]+>/.test(row.companyName) ||
      /<[^>]+>/.test(row.category) ||
      /<[^>]+>/.test(row.website ?? "")
    ) {
      htmlRows += 1;
    }

    const key = getRowKey(row);
    if (pairSet.has(key)) {
      duplicateRows += 1;
    } else {
      pairSet.add(key);
    }
  }

  return {
    duplicateRows,
    emptyRows,
    htmlRows,
    uniquePairs: pairSet.size,
  };
}

async function scrapeCategory(category, args, csvSink, websiteCache) {
  const rows = [];
  const seenCompanyKeys = new Set();
  const seenPageUrls = new Set();
  let pageNumber = 1;
  let nextUrl = category.url;

  while (nextUrl && pageNumber <= args.maxPages) {
    if (seenPageUrls.has(nextUrl)) {
      console.warn(`Repeated next page URL, stopping category: ${nextUrl}`);
      break;
    }

    seenPageUrls.add(nextUrl);

    const html = await fetchText(nextUrl);
    const companies = extractCompanies(html);
    const pageNextUrl = getNextPageUrl(html);
    const newCompanies = companies.filter((company) => {
      if (seenCompanyKeys.has(company.key)) {
        return false;
      }

      seenCompanyKeys.add(company.key);
      return true;
    });

    console.log(
      `[${category.label}] page ${pageNumber}: ${companies.length} cards, ${newCompanies.length} new`,
    );

    const pageRows = [];

    for (const company of newCompanies) {
      const website = await getCompanyWebsite(company, args, websiteCache);
      const row = {
        category: category.label,
        companyName: company.name,
        website,
      };
      const rowKey = getRowKey(row);

      if (csvSink.pairKeys.has(rowKey)) {
        continue;
      }

      csvSink.pairKeys.add(rowKey);
      pageRows.push(row);
    }

    await csvSink.appendRows(pageRows);
    rows.push(...pageRows);

    if (companies.length === 0 || newCompanies.length === 0) {
      break;
    }

    nextUrl = pageNextUrl;
    pageNumber += 1;

    if (!nextUrl) {
      break;
    }

    await sleep(args.delayMs);
  }

  if (rows.length === 0) {
    console.warn(`No companies found for category: ${category.label}`);
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("Fetching categories from", CONTRACTORS_URL);

  const contractorsHtml = await fetchText(CONTRACTORS_URL);
  const allCategories = extractCategories(contractorsHtml);
  const categories = allCategories.slice(0, args.maxCategories);
  const csvSink = await createCsvSink(args);
  const websiteCache = new Map();

  console.log(
    `Found ${allCategories.length} categories; scraping ${categories.length}`,
  );

  const allRows = [...csvSink.existingRows];

  for (const [index, category] of categories.entries()) {
    console.log(
      `\nCategory ${index + 1}/${categories.length}: ${category.label} (${category.path})`,
    );

    try {
      const rows = await scrapeCategory(category, args, csvSink, websiteCache);
      allRows.push(...rows);
      console.log(`Category rows: ${rows.length}; total rows: ${allRows.length}`);
    } catch (error) {
      console.warn(
        `Failed to scrape category ${category.label} (${category.path}): ${error.message}`,
      );
    }

    if (index < categories.length - 1) {
      await sleep(args.delayMs);
    }
  }

  const validation = validateRows(allRows);
  console.log("\nValidation:", validation);

  if (args.dryRun) {
    console.log("Dry run enabled; CSV was not written.");
    console.log("Sample rows:", allRows.slice(0, 10));
    return;
  }

  const csv = buildCsv(allRows);
  await writeFile(args.output, csv, "utf8");
  console.log(`Wrote ${allRows.length} rows to ${args.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
