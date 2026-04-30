#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "node:fs/promises";

const BASE_URL = "https://hirehi.ru";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const SOURCE_URL = `${BASE_URL}/?category=all&direct_contact=direct_contact`;
const DEFAULT_OUTPUT = "hirehi-vacancies.csv";
const DEFAULT_DELAY_MS = 700;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIES = 2;
const FILE_WRITE_RETRIES = 12;
const USER_AGENT =
  "OfferGO hirehi vacancies scraper (+https://offergo.ru; contact: support@offergo.ru)";

const CATEGORY_LABELS = {
  analytics: "Аналитика",
  design: "Дизайн",
  development: "Разработка",
  devops: "DevOps",
  management: "Менеджмент",
  marketing: "Маркетинг",
  qa: "QA",
};

const CSV_COLUMNS = [
  "job_id",
  "title",
  "company",
  "category",
  "category_slug",
  "level",
  "salary",
  "salary_value",
  "salary_currency",
  "format",
  "location",
  "date_posted",
  "employment_type",
  "direct_apply",
  "apply_button_label",
  "apply_direct_kind",
  "description",
  "skills",
  "qualifications",
  "benefits",
  "url",
];

function parseArgs(argv) {
  const args = {
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
    maxJobs: Number.POSITIVE_INFINITY,
    output: DEFAULT_OUTPUT,
    resume: false,
    sourceUrl: SOURCE_URL,
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
    } else if (key === "--max-jobs" && value) {
      args.maxJobs = Number(value);
    } else if (key === "--output" && value) {
      args.output = value;
    } else if (key === "--source-url" && value) {
      args.sourceUrl = value;
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

  if (
    args.maxJobs !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(args.maxJobs) || args.maxJobs < 1)
  ) {
    throw new Error("--max-jobs must be a positive number");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/scrape-hirehi-jobs.mjs [options]

Options:
  --output=hirehi-vacancies.csv  Output CSV path
  --dry-run                      Print progress and do not write CSV
  --resume                       Keep existing CSV rows and append missing URLs
  --max-jobs=50                  Limit vacancies for testing
  --delay-ms=700                 Delay between vacancy page requests
  --source-url=URL               Source page used for logging only

Notes:
  The public robots.txt disallows /api/, so this scraper uses sitemap + HTML pages.
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
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < RETRIES) {
      const retryDelayMs = 1_500 * (attempt + 1);
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

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ");
}

function normalizeText(value) {
  return decodeHtml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
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

function getAttribute(tag, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(pattern);
  return match?.[1] ? decodeHtml(match[1]).trim() : "";
}

function extractJobId(url) {
  return url.match(/-(\d+)$/)?.[1] ?? "";
}

function extractCategorySlug(url) {
  return url.match(/^https:\/\/hirehi\.ru\/([^/]+)\//)?.[1] ?? "";
}

function extractSitemapJobUrls(xml) {
  const urls = [];
  const seen = new Set();
  const allowedCategories = Object.keys(CATEGORY_LABELS).join("|");
  const jobUrlRegex = new RegExp(
    `^https:\\/\\/hirehi\\.ru\\/(${allowedCategories})\\/[^/?#]+-\\d+$`,
  );

  for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)) {
    const url = decodeHtml(match[1]).trim();

    if (!jobUrlRegex.test(url) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function walkJson(value, predicate, results = []) {
  if (!value || typeof value !== "object") {
    return results;
  }

  if (predicate(value)) {
    results.push(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(item, predicate, results);
    }
  } else {
    for (const item of Object.values(value)) {
      walkJson(item, predicate, results);
    }
  }

  return results;
}

function extractJobPostingJsonLd(html) {
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const script of scripts) {
    const parsed = tryParseJson(decodeHtml(script[1].trim()));
    const postings = walkJson(
      parsed,
      (item) =>
        item["@type"] === "JobPosting" ||
        (Array.isArray(item["@type"]) && item["@type"].includes("JobPosting")),
    );

    if (postings[0]) {
      return postings[0];
    }
  }

  return null;
}

function extractVacancyData(html) {
  const match = html.match(
    /<script\b[^>]*id=["']vacancy-data-json["'][^>]*>([\s\S]*?)<\/script>/i,
  );

  if (!match) {
    return {};
  }

  return tryParseJson(decodeHtml(match[1].trim())) ?? {};
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );

  return match?.[1] ? normalizeText(match[1]) : "";
}

function extractApplyButton(html) {
  const match = html.match(
    /<a\b([^>]*class=["'][^"']*sidebar-apply-btn[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i,
  );

  if (!match) {
    return {
      label: "",
      directKind: "",
      hasDirectFlag: false,
    };
  }

  return {
    label: normalizeText(match[2]),
    directKind: getAttribute(match[1], "data-direct-kind"),
    hasDirectFlag: /\bdata-direct=["']true["']/i.test(match[1]),
  };
}

function getNestedString(value, path) {
  let cursor = value;

  for (const key of path) {
    cursor = cursor?.[key];
  }

  return typeof cursor === "string" || typeof cursor === "number"
    ? String(cursor)
    : "";
}

function getBaseSalaryValue(jobPosting) {
  const value = jobPosting?.baseSalary?.value;

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return value.value ? String(value.value) : "";
  }

  return "";
}

function parseMetaParts(metaDescription, salary) {
  const parts = {
    format: "",
    level: "",
    location: "",
  };

  const levelMatch = metaDescription.match(/уровень\s+([^.;]+)/i);
  if (levelMatch) {
    parts.level = normalizeText(levelMatch[1]);
  }

  if (!salary || !metaDescription.includes(salary)) {
    return parts;
  }

  const afterSalary = metaDescription.split(salary).slice(1).join(salary);
  const beforeLevel = afterSalary.split(/,\s*уровень\s+/i)[0] ?? "";
  const chunks = beforeLevel
    .split(",")
    .map((chunk) => normalizeText(chunk))
    .filter(Boolean);

  parts.format = chunks[0] ?? "";
  parts.location = chunks[1] ?? "";

  return parts;
}

function normalizeMultilineField(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join("; ");
  }

  return normalizeText(value);
}

function buildRow(url, html) {
  const jobPosting = extractJobPostingJsonLd(html);
  const vacancyData = extractVacancyData(html);
  const metaDescription = extractMetaDescription(html);
  const applyButton = extractApplyButton(html);
  const categorySlug = extractCategorySlug(url);
  const salary =
    normalizeText(vacancyData.salary) ||
    normalizeText(jobPosting?.baseSalary?.value?.value);
  const metaParts = parseMetaParts(metaDescription, salary);
  const location =
    normalizeText(vacancyData.location) ||
    getNestedString(jobPosting, [
      "jobLocation",
      "address",
      "addressLocality",
    ]) ||
    metaParts.location;
  const directApply =
    typeof jobPosting?.directApply === "boolean"
      ? String(jobPosting.directApply)
      : "";

  return {
    job_id: normalizeText(vacancyData.id) || extractJobId(url),
    title: normalizeText(jobPosting?.title) || normalizeText(vacancyData.title),
    company:
      getNestedString(jobPosting, ["hiringOrganization", "name"]) ||
      normalizeText(vacancyData.company),
    category: CATEGORY_LABELS[categorySlug] ?? categorySlug,
    category_slug: categorySlug,
    level:
      normalizeText(vacancyData.level) ||
      normalizeText(jobPosting?.qualifications).replace(/\s*level position$/i, "") ||
      metaParts.level,
    salary,
    salary_value: getBaseSalaryValue(jobPosting),
    salary_currency: normalizeText(jobPosting?.baseSalary?.currency),
    format: metaParts.format,
    location,
    date_posted: normalizeText(jobPosting?.datePosted),
    employment_type: normalizeText(jobPosting?.employmentType),
    direct_apply: directApply,
    apply_button_label: applyButton.label,
    apply_direct_kind: applyButton.directKind || (applyButton.hasDirectFlag ? "direct" : ""),
    description: normalizeMultilineField(jobPosting?.description),
    skills: normalizeMultilineField(jobPosting?.skills),
    qualifications: normalizeMultilineField(jobPosting?.qualifications),
    benefits: normalizeMultilineField(jobPosting?.benefits),
    url,
  };
}

async function loadExistingUrls(output) {
  try {
    const content = await readFile(output, "utf8");
    return new Set(
      [...content.matchAll(/https:\/\/hirehi\.ru\/[a-z-]+\/[^",\r\n]+-\d+/g)].map(
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

async function appendRows(output, rows) {
  if (!rows.length) {
    return;
  }

  const csv = rows
    .map((row) => toCsvRow(CSV_COLUMNS.map((column) => row[column] ?? "")))
    .join("\n");

  await appendFileWithRetry(output, `${csv}\n`);
}

async function writeFileWithRetry(output, content, attempt = 0) {
  try {
    await writeFile(output, content, "utf8");
  } catch (error) {
    if (
      attempt < FILE_WRITE_RETRIES &&
      (error?.code === "EBUSY" ||
        error?.code === "EPERM" ||
        error?.code === "EACCES")
    ) {
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
    if (
      attempt < FILE_WRITE_RETRIES &&
      (error?.code === "EBUSY" ||
        error?.code === "EPERM" ||
        error?.code === "EACCES")
    ) {
      const delayMs = 500 * (attempt + 1);
      console.warn(
        `CSV is locked, retrying write in ${delayMs}ms: ${output} (${error.code})`,
      );
      await sleep(delayMs);
      return appendFileWithRetry(output, content, attempt + 1);
    }

    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Source page: ${args.sourceUrl}`);
  console.log(`Sitemap: ${SITEMAP_URL}`);
  console.log(`Output: ${args.output}`);
  console.log(`Delay: ${args.delayMs}ms`);
  console.log("API mode: disabled because https://hirehi.ru/robots.txt disallows /api/");

  const sitemapXml = await fetchText(SITEMAP_URL);
  const allUrls = extractSitemapJobUrls(sitemapXml);
  const existingUrls = args.resume ? await loadExistingUrls(args.output) : new Set();
  const urls = allUrls
    .filter((url) => !existingUrls.has(url))
    .slice(0, args.maxJobs);

  console.log(
    `Found ${allUrls.length} vacancy URLs in sitemap, ${existingUrls.size} already in CSV, ${urls.length} queued.`,
  );

  if (args.dryRun) {
    console.log("Dry run sample:");
    console.log(urls.slice(0, 10).join("\n"));
    return;
  }

  await writeHeader(args.output, args.resume);

  let written = 0;
  let failed = 0;
  const buffer = [];

  for (const [index, url] of urls.entries()) {
    try {
      const html = await fetchText(url);
      const row = buildRow(url, html);

      if (!row.title || !row.company) {
        throw new Error("Missing required title/company in parsed page");
      }

      buffer.push(row);

      if (buffer.length >= 25) {
        await appendRows(args.output, buffer);
        buffer.length = 0;
      }

      written += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Failed to parse ${url}: ${error.message}`);
    }

    if ((index + 1) % 25 === 0 || index + 1 === urls.length) {
      console.log(
        `Progress ${index + 1}/${urls.length}: written=${written}, failed=${failed}`,
      );
    }

    if (index + 1 < urls.length && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  await appendRows(args.output, buffer);
  console.log(`Done. Wrote ${written} rows, failed ${failed}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
