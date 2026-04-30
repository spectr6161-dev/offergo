import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const defaultCsvPath = path.resolve(
  process.cwd(),
  "workspace-contractors-with-sites.csv",
);

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value) {
  return normalizeText(value).toLocaleLowerCase("ru-RU");
}

function normalizeWebsite(value) {
  const raw = normalizeText(value).replace(/\s+/g, "");

  if (!raw || raw === "-" || raw === "—") {
    return {
      website: null,
      normalizedWebsite: null,
    };
  }

  try {
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const url = new URL(withProtocol);
    const hostname = url.hostname
      .toLocaleLowerCase("en-US")
      .replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    const normalizedPathname = pathname && pathname !== "/" ? pathname : "";

    return {
      website: `${url.protocol}//${hostname}${normalizedPathname}`,
      normalizedWebsite: `${hostname}${normalizedPathname}`.toLocaleLowerCase(
        "en-US",
      ),
    };
  } catch {
    return {
      website: raw,
      normalizedWebsite: null,
    };
  }
}

function createCategorySlug(name) {
  const normalized = normalizeText(name);
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const fileFlagIndex = process.argv.indexOf("--file");

  return {
    dryRun: args.has("--dry-run"),
    filePath:
      fileFlagIndex >= 0 && process.argv[fileFlagIndex + 1]
        ? path.resolve(process.cwd(), process.argv[fileFlagIndex + 1])
        : defaultCsvPath,
  };
}

async function main() {
  const { dryRun, filePath } = parseArgs();
  const csvText = await fs.readFile(filePath, "utf8");
  const [header, ...rows] = parseCsv(csvText);
  const headerKey = header.map((item) => normalizeText(item)).join(",");

  if (headerKey !== "company_name,category,website") {
    throw new Error(
      `Unexpected CSV header "${headerKey}". Expected company_name,category,website.`,
    );
  }

  const companies = new Map();
  let skipped = 0;

  for (const row of rows) {
    const [companyNameValue, categoryValue, websiteValue] = row;
    const name = normalizeText(companyNameValue);
    const category = normalizeText(categoryValue);

    if (!name || !category) {
      skipped += 1;
      continue;
    }

    const website = normalizeWebsite(websiteValue);
    const normalizedName = normalizeNameKey(name);
    const key = website.normalizedWebsite
      ? `site:${website.normalizedWebsite}`
      : `name:${normalizedName}`;
    const existing = companies.get(key) ?? {
      name,
      normalizedName,
      website: website.website,
      normalizedWebsite: website.normalizedWebsite,
      categories: new Set(),
    };

    existing.categories.add(category);

    if (!existing.website && website.website) {
      existing.website = website.website;
      existing.normalizedWebsite = website.normalizedWebsite;
    }

    companies.set(key, existing);
  }

  console.log(
    `Parsed ${rows.length} CSV rows, ${companies.size} unique employers, ${skipped} skipped rows.`,
  );

  if (dryRun) {
    const preview = Array.from(companies.values()).slice(0, 5);
    console.log(
      preview.map((company) => ({
        name: company.name,
        website: company.website,
        categories: Array.from(company.categories).slice(0, 5),
      })),
    );
    return;
  }

  let imported = 0;

  for (const company of companies.values()) {
    const employer = await prisma.$transaction(async (tx) => {
      if (company.normalizedWebsite) {
        return tx.employer.upsert({
          where: {
            normalizedWebsite: company.normalizedWebsite,
          },
          update: {
            name: company.name,
            normalizedName: company.normalizedName,
            website: company.website,
          },
          create: {
            name: company.name,
            normalizedName: company.normalizedName,
            website: company.website,
            normalizedWebsite: company.normalizedWebsite,
            source: "workspace",
            status: "published",
          },
        });
      }

      const existing = await tx.employer.findFirst({
        where: {
          normalizedName: company.normalizedName,
          normalizedWebsite: null,
        },
      });

      if (existing) {
        return tx.employer.update({
          where: {
            id: existing.id,
          },
          data: {
            name: company.name,
            website: company.website,
          },
        });
      }

      return tx.employer.create({
        data: {
          name: company.name,
          normalizedName: company.normalizedName,
          website: company.website,
          normalizedWebsite: null,
          source: "workspace",
          status: "published",
        },
      });
    });

    for (const categoryName of company.categories) {
      const category = await prisma.employerCategory.upsert({
        where: {
          slug: createCategorySlug(categoryName),
        },
        update: {
          name: categoryName,
        },
        create: {
          name: categoryName,
          slug: createCategorySlug(categoryName),
        },
      });

      await prisma.employerCategoryLink.upsert({
        where: {
          employerId_categoryId: {
            employerId: employer.id,
            categoryId: category.id,
          },
        },
        update: {},
        create: {
          employerId: employer.id,
          categoryId: category.id,
        },
      });
    }

    imported += 1;

    if (imported % 250 === 0) {
      console.log(`Imported ${imported}/${companies.size} employers...`);
    }
  }

  console.log(`Imported ${imported} employers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
