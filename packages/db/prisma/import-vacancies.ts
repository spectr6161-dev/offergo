import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/client";

const defaultCsvPath = fileURLToPath(
  new URL("../imports/vacancies-import.csv", import.meta.url),
);
const importSource = "external_import";
const batchSize = 100;

type VacancyCsvRow = {
  job_id?: string;
  title?: string;
  company?: string;
  category?: string;
  category_slug?: string;
  level?: string;
  salary?: string;
  salary_value?: string;
  salary_currency?: string;
  format?: string;
  location?: string;
  date_posted?: string;
  employment_type?: string;
  direct_apply?: string;
  apply_button_label?: string;
  apply_direct_kind?: string;
  description?: string;
  skills?: string;
  qualifications?: string;
  benefits?: string;
  url?: string;
};

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((item) => item.length > 0)) {
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;

  return dataRows.map((dataRow) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), dataRow[index] ?? ""]),
    ),
  ) as VacancyCsvRow[];
}

function trimToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function trimToString(value: string | undefined) {
  return value?.trim() ?? "";
}

function parseInteger(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function parseDate(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  const csvPath = process.argv[2] ?? defaultCsvPath;
  const file = await readFile(csvPath, "utf8");
  const rows = parseCsv(file.replace(/^\uFEFF/, "")).filter((row) =>
    trimToString(row.job_id),
  );
  let imported = 0;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);

    await Promise.all(
      batch.map((row) =>
        prisma.vacancy.upsert({
          where: {
            source_externalId: {
              source: importSource,
              externalId: trimToString(row.job_id),
            },
          },
          update: {
            title: trimToString(row.title),
            companyName: trimToString(row.company) || "Компания не указана",
            categoryName: trimToString(row.category) || "Без категории",
            categorySlug: trimToString(row.category_slug) || "uncategorized",
            level: trimToString(row.level) || "грейда нет",
            salaryText: trimToNull(row.salary),
            salaryValue: parseInteger(row.salary_value),
            salaryCurrency: trimToNull(row.salary_currency),
            workFormat: trimToNull(row.format),
            location: trimToNull(row.location),
            datePosted: parseDate(row.date_posted),
            employmentType: trimToNull(row.employment_type),
            directApply: parseBoolean(row.direct_apply),
            applyButtonLabel: trimToNull(row.apply_button_label),
            applyDirectKind: trimToNull(row.apply_direct_kind),
            description: trimToString(row.description),
            skillsText: trimToNull(row.skills),
            qualificationsText: trimToNull(row.qualifications),
            benefitsText: trimToNull(row.benefits),
            url: trimToNull(row.url),
            status: "published",
          },
          create: {
            source: importSource,
            externalId: trimToString(row.job_id),
            title: trimToString(row.title),
            companyName: trimToString(row.company) || "Компания не указана",
            categoryName: trimToString(row.category) || "Без категории",
            categorySlug: trimToString(row.category_slug) || "uncategorized",
            level: trimToString(row.level) || "грейда нет",
            salaryText: trimToNull(row.salary),
            salaryValue: parseInteger(row.salary_value),
            salaryCurrency: trimToNull(row.salary_currency),
            workFormat: trimToNull(row.format),
            location: trimToNull(row.location),
            datePosted: parseDate(row.date_posted),
            employmentType: trimToNull(row.employment_type),
            directApply: parseBoolean(row.direct_apply),
            applyButtonLabel: trimToNull(row.apply_button_label),
            applyDirectKind: trimToNull(row.apply_direct_kind),
            description: trimToString(row.description),
            skillsText: trimToNull(row.skills),
            qualificationsText: trimToNull(row.qualifications),
            benefitsText: trimToNull(row.benefits),
            url: trimToNull(row.url),
            status: "published",
          },
        }),
      ),
    );

    imported += batch.length;
    console.info(`Imported ${imported}/${rows.length} vacancies`);
  }

  console.info(`Vacancy import finished: ${rows.length} rows`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
