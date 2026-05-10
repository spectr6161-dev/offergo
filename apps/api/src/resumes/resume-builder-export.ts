import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import pdfMake from "pdfmake";
import sharp from "sharp";
import {
  plateValueToPlainText,
  type ResumeBuilderContent,
  type ResumeBuilderEducation,
  type ResumeBuilderExperience,
} from "@offergo/shared";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

export const resumeBuilderExportFormats = ["pdf", "docx", "txt"] as const;

export type ResumeBuilderExportFormat =
  (typeof resumeBuilderExportFormats)[number];

export type ResumeBuilderExportPhoto = {
  buffer: Buffer;
  mimeType: string;
  positionX: number;
  positionY: number;
  scale: number;
} | null;

type PreparedResumeBuilderExportPhoto = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
} | null;

type ExportModel = {
  about: string;
  additionalEducation: ExportEducation[];
  birthLine: string;
  citizenshipLine: string;
  cityLine: string;
  contactLine: string;
  contactRows: Array<[string, string]>;
  education: ExportEducation[];
  employmentLine: string;
  experience: ExportExperience[];
  fullName: string;
  position: string;
  salaryLine: string;
  skills: string[];
  title: string;
  workPermitLine: string;
};

type ExportEducation = {
  activities: string;
  institution: string;
  meta: string;
  specialization: string;
};

type ExportExperience = {
  company: string;
  description: string;
  period: string;
  position: string;
};

const require = createRequire(import.meta.url);
let pdfFontsReady = false;

const salaryCurrencyLabels: Record<string, string> = {
  EUR: "€",
  RUB: "₽",
  USD: "$",
};

const employmentTypeLabels: Record<string, string> = {
  internship: "стажировка",
  part_time: "подработка",
  permanent: "постоянная работа",
  unpaid_internship: "бесплатная стажировка",
};

const workFormatLabels: Record<string, string> = {
  hybrid: "гибрид",
  onsite: "на месте работодателя",
  remote: "удалённо",
};

const contractTypeLabels: Record<string, string> = {
  employment_contract: "трудовой договор",
  individual_entrepreneur: "ИП",
  self_employed: "самозанятый",
};

const monthNumbers: Record<string, number> = {
  Август: 8,
  Апрель: 4,
  Декабрь: 12,
  Июль: 7,
  Июнь: 6,
  Май: 5,
  Март: 3,
  Ноябрь: 11,
  Октябрь: 10,
  Сентябрь: 9,
  Февраль: 2,
  Январь: 1,
};

const monthGenitive: Record<string, string> = {
  Август: "августа",
  Апрель: "апреля",
  Декабрь: "декабря",
  Июль: "июля",
  Июнь: "июня",
  Май: "мая",
  Март: "марта",
  Ноябрь: "ноября",
  Октябрь: "октября",
  Сентябрь: "сентября",
  Февраль: "февраля",
  Январь: "января",
};

function compact(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

function mapLabels(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value).filter(Boolean);
}

function textOrFallback(value: string, fallback: string) {
  return value.trim() || fallback;
}

function getFullName(content: ResumeBuilderContent) {
  const { firstName, lastName, middleName } = content.wizard.basic;

  return compact([lastName, firstName, middleName]).join(" ");
}

function getAge(day: string, month: string, year: string) {
  const dayNumber = Number(day);
  const monthNumber = monthNumbers[month];
  const yearNumber = Number(year);

  if (!dayNumber || !monthNumber || !yearNumber) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - yearNumber;
  const birthdayThisYear = new Date(
    today.getFullYear(),
    monthNumber - 1,
    dayNumber,
  );

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age > 0 ? age : null;
}

function getBirthLine(content: ResumeBuilderContent) {
  const { birthDay, birthMonth, birthYear, gender } = content.wizard.basic;
  const date = compact([
    birthDay,
    birthMonth ? monthGenitive[birthMonth] ?? birthMonth.toLowerCase() : "",
    birthYear,
  ]).join(" ");
  const age = getAge(birthDay, birthMonth, birthYear);
  const genderLabel =
    gender === "Мужской" ? "Мужчина" : gender === "Женский" ? "Женщина" : "";
  const ageLine = age ? `${age} лет` : "";

  if (genderLabel && date) {
    return `${genderLabel}${ageLine ? `, ${ageLine}` : ""}, родился ${date}`;
  }

  return compact([genderLabel, date ? `родился ${date}` : ""]).join(", ");
}

function getPeriod(item: ResumeBuilderExperience) {
  const start = compact([item.startMonth, item.startYear]).join(" ");
  const end = item.current
    ? "по настоящее время"
    : compact([item.endMonth, item.endYear]).join(" ");

  return compact([start, end]).join(" — ");
}

function getEducationMeta(item: ResumeBuilderEducation) {
  return compact([item.graduationYear, item.level]).join(" · ");
}

function toExperience(item: ResumeBuilderExperience): ExportExperience {
  return {
    company: item.company,
    description: plateValueToPlainText(item.description),
    period: getPeriod(item),
    position: item.position,
  };
}

function toEducation(item: ResumeBuilderEducation): ExportEducation {
  return {
    activities: plateValueToPlainText(item.activities),
    institution: item.institution,
    meta: getEducationMeta(item),
    specialization: compact([item.faculty, item.specialization]).join(", "),
  };
}

function buildExportModel(content: ResumeBuilderContent): ExportModel {
  const {
    additionalEducation,
    about,
    basic,
    contacts,
    education,
    experience,
    profession,
    salary,
    skills,
    workConditions,
  } = content.wizard;
  const fullName = textOrFallback(getFullName(content), "Имя не указано");
  const phone = contacts.phone || basic.phone;
  const contactRows: Array<[string, string]> = [
    ["Мобильный телефон", phone],
    ["Электронная почта", contacts.email],
    ["Telegram", contacts.telegram],
    ["Max", contacts.max],
    ["VK", contacts.vk],
    ["WhatsApp", contacts.whatsapp],
    ["Комментарий", contacts.comment],
  ].filter(([, value]) => value.trim()) as Array<[string, string]>;
  const employment = mapLabels(
    workConditions.employmentTypes,
    employmentTypeLabels,
  );
  const formats = mapLabels(workConditions.workFormats, workFormatLabels);
  const contracts = mapLabels(workConditions.contractTypes, contractTypeLabels);

  return {
    about: plateValueToPlainText(about),
    additionalEducation: additionalEducation.map(toEducation),
    birthLine: getBirthLine(content),
    citizenshipLine: basic.citizenship
      ? `Гражданство: ${basic.citizenship}`
      : "",
    cityLine: basic.city ? `Проживает: ${basic.city}` : "",
    contactLine: compact([
      phone,
      contacts.telegram ? `Телеграм ${contacts.telegram}` : "",
      contacts.email,
    ]).join(" • "),
    contactRows,
    education: education.map(toEducation),
    employmentLine: compact([
      employment.length ? `Тип занятости: ${employment.join(", ")}` : "",
      formats.length ? `Формат работы: ${formats.join(", ")}` : "",
      contracts.length ? `Оформление: ${contracts.join(", ")}` : "",
    ]).join("\n"),
    experience: experience.map(toExperience),
    fullName,
    position: textOrFallback(profession, "Желаемая должность не указана"),
    salaryLine: salary.amount
      ? `${salary.amount} ${salaryCurrencyLabels[salary.currency] ?? salary.currency}`
      : "Уровень дохода не указан",
    skills,
    title: `${fullName} — резюме`,
    workPermitLine: basic.workPermit
      ? `Есть разрешение на работу: ${basic.workPermit}`
      : "",
  };
}

function ensurePdfFonts() {
  if (pdfFontsReady) {
    return;
  }

  const packageDir = dirname(require.resolve("pdfmake/package.json"));
  const fontDir = join(packageDir, "fonts", "Roboto");

  pdfMake.addFonts({
    Roboto: {
      bold: join(fontDir, "Roboto-Medium.ttf"),
      bolditalics: join(fontDir, "Roboto-MediumItalic.ttf"),
      italics: join(fontDir, "Roboto-Italic.ttf"),
      normal: join(fontDir, "Roboto-Regular.ttf"),
    },
  });
  (
    pdfMake as typeof pdfMake & {
      setUrlAccessPolicy?: (callback: () => boolean) => void;
    }
  ).setUrlAccessPolicy?.(() => false);
  pdfFontsReady = true;
}

function pdfParagraph(text: string, style?: string | string[]): Content | null {
  if (!text.trim()) {
    return null;
  }

  return {
    margin: [0, 0, 0, 5],
    style,
    text,
  };
}

function pdfSectionTitle(title: string): Content {
  return {
    margin: [0, 16, 0, 8],
    style: "sectionTitle",
    text: title,
  };
}

function pdfTextBlock(text: string): Content[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      margin: [0, 0, 0, 7],
      style: "bodyText",
      text: part,
    }));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function prepareExportPhoto(
  photo: ResumeBuilderExportPhoto,
): Promise<PreparedResumeBuilderExportPhoto> {
  if (!photo) {
    return null;
  }

  try {
    const image = sharp(photo.buffer).rotate();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
      return null;
    }

    const scale = clampNumber(photo.scale || 1, 1, 3);
    const cropSide = Math.max(1, Math.round(Math.min(width, height) / scale));
    const centerX = (clampNumber(photo.positionX, 0, 100) / 100) * width;
    const centerY = (clampNumber(photo.positionY, 0, 100) / 100) * height;
    const left = Math.round(
      clampNumber(centerX - cropSide / 2, 0, width - cropSide),
    );
    const top = Math.round(
      clampNumber(centerY - cropSide / 2, 0, height - cropSide),
    );

    return {
      buffer: await image
        .extract({
          height: cropSide,
          left,
          top,
          width: cropSide,
        })
        .resize(512, 512, {
          fit: "cover",
        })
        .png()
        .toBuffer(),
      mimeType: "image/png",
    };
  } catch {
    return null;
  }
}

function getPdfPhotoDataUrl(photo: PreparedResumeBuilderExportPhoto) {
  if (!photo) {
    return null;
  }

  if (photo.mimeType !== "image/jpeg" && photo.mimeType !== "image/png") {
    return null;
  }

  return `data:${photo.mimeType};base64,${photo.buffer.toString("base64")}`;
}

function buildPdfDefinition(
  model: ExportModel,
  photo: PreparedResumeBuilderExportPhoto,
): TDocumentDefinitions {
  const content: Content[] = [];
  const headerStack: Content[] = [
    { style: "name", text: model.fullName },
    ...[
      pdfParagraph(model.birthLine),
      pdfParagraph(model.contactLine),
      pdfParagraph(model.cityLine),
      pdfParagraph(
        compact([model.citizenshipLine, model.workPermitLine]).join(", "),
      ),
    ].filter(Boolean),
  ] as Content[];
  const photoDataUrl = getPdfPhotoDataUrl(photo);

  content.push({
    columns: photoDataUrl
      ? [
          { stack: headerStack, width: "*" },
          {
            image: photoDataUrl,
            margin: [20, 0, 0, 0],
            width: 72,
          },
        ]
      : [{ stack: headerStack, width: "*" }],
    columnGap: 16,
    margin: [0, 0, 0, 10],
  });

  content.push(pdfSectionTitle("Желаемая должность и зарплата"));
  content.push({ style: "position", text: model.position });
  content.push({ margin: [0, 0, 0, 5], text: model.salaryLine });
  for (const line of model.employmentLine.split("\n").filter(Boolean)) {
    content.push({ margin: [0, 0, 0, 3], style: "muted", text: line });
  }

  if (model.experience.length) {
    content.push(pdfSectionTitle("Опыт работы"));
    content.push({
      layout: "noBorders",
      table: {
        body: model.experience.flatMap((item) => [
          [
            { margin: [0, 0, 12, 8], style: "muted", text: item.period },
            {
              stack: [
                { bold: true, margin: [0, 0, 0, 3], text: item.company },
                { bold: true, margin: [0, 0, 0, 6], text: item.position },
                ...pdfTextBlock(item.description),
              ],
            },
          ],
        ]),
        widths: [110, "*"],
      },
    });
  }

  if (model.education.length) {
    content.push(pdfSectionTitle("Образование"));
    content.push(...model.education.flatMap(pdfEducationBlock));
  }

  if (model.additionalEducation.length) {
    content.push(pdfSectionTitle("Дополнительное образование"));
    content.push(...model.additionalEducation.flatMap(pdfEducationBlock));
  }

  if (model.skills.length) {
    content.push(pdfSectionTitle("Навыки"));
    content.push({
      margin: [0, 0, 0, 5],
      style: "bodyText",
      text: model.skills.join("   "),
    });
  }

  if (model.about) {
    content.push(pdfSectionTitle("Дополнительная информация"));
    content.push({ bold: true, margin: [0, 0, 0, 5], text: "Обо мне" });
    content.push(...pdfTextBlock(model.about));
  }

  return {
    content,
    defaultStyle: {
      color: "#111827",
      font: "Roboto",
      fontSize: 10.5,
      lineHeight: 1.18,
    },
    footer: (currentPage, pageCount) => ({
      alignment: "center",
      color: "#6b7280",
      fontSize: 8,
      margin: [0, 8, 0, 0],
      text: `${model.fullName} • ${currentPage} из ${pageCount}`,
    }),
    info: {
      title: model.title,
    },
    pageMargins: [54, 46, 54, 42],
    pageSize: "A4",
    styles: {
      bodyText: {
        lineHeight: 1.24,
      },
      muted: {
        color: "#667085",
      },
      name: {
        bold: true,
        fontSize: 22,
        lineHeight: 1.12,
        margin: [0, 0, 0, 8],
      },
      position: {
        bold: true,
        fontSize: 14,
        margin: [0, 0, 0, 5],
      },
      sectionTitle: {
        bold: true,
        fontSize: 14,
      },
    },
  };
}

function pdfEducationBlock(item: ExportEducation): Content[] {
  return [
    {
      bold: true,
      margin: [0, 0, 0, 3],
      text: item.institution || "Учебное заведение не указано",
    },
    item.specialization
      ? { margin: [0, 0, 0, 3], text: item.specialization }
      : null,
    item.meta
      ? { color: "#667085", margin: [0, 0, 0, 5], text: item.meta }
      : null,
    ...pdfTextBlock(item.activities),
  ].filter(Boolean) as Content[];
}

export async function generateResumeBuilderPdf(options: {
  content: ResumeBuilderContent;
  photo: ResumeBuilderExportPhoto;
}) {
  ensurePdfFonts();

  const model = buildExportModel(options.content);
  const photo = await prepareExportPhoto(options.photo);
  const definition = buildPdfDefinition(model, photo);

  return pdfMake.createPdf(definition).getBuffer();
}

function docxRun(text: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({
    bold: options.bold,
    font: "Arial",
    size: options.size ?? 22,
    text,
  });
}

function docxParagraph(
  text: string,
  options: {
    bold?: boolean;
    heading?: boolean;
    spacingAfter?: number;
    size?: number;
  } = {},
) {
  return new Paragraph({
    children: [docxRun(text, { bold: options.bold, size: options.size })],
    spacing: {
      after: options.spacingAfter ?? 120,
    },
    style: options.heading ? "SectionTitle" : undefined,
  });
}

function docxTextBlock(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => docxParagraph(line, { spacingAfter: 90 }));
}

function getDocxImageRun(photo: PreparedResumeBuilderExportPhoto) {
  if (!photo) {
    return null;
  }

  const type =
    photo.mimeType === "image/jpeg"
      ? "jpg"
      : photo.mimeType === "image/png"
        ? "png"
        : null;

  if (!type) {
    return null;
  }

  return new ImageRun({
    data: photo.buffer,
    transformation: {
      height: 86,
      width: 86,
    },
    type,
  });
}

function noBorders() {
  return {
    bottom: { color: "FFFFFF", style: BorderStyle.NONE, size: 0 },
    left: { color: "FFFFFF", style: BorderStyle.NONE, size: 0 },
    right: { color: "FFFFFF", style: BorderStyle.NONE, size: 0 },
    top: { color: "FFFFFF", style: BorderStyle.NONE, size: 0 },
  };
}

function docxExperienceTable(items: ExportExperience[]) {
  return new Table({
    borders: noBorders(),
    rows: items.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders(),
              children: [
                docxParagraph(item.period, {
                  spacingAfter: 80,
                  size: 20,
                }),
              ],
              width: { size: 2300, type: WidthType.DXA },
            }),
            new TableCell({
              borders: noBorders(),
              children: [
                docxParagraph(item.company, {
                  bold: true,
                  spacingAfter: 60,
                }),
                docxParagraph(item.position, {
                  bold: true,
                  spacingAfter: 100,
                }),
                ...docxTextBlock(item.description),
              ],
              width: { size: 6800, type: WidthType.DXA },
            }),
          ],
        }),
    ),
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function docxEducationBlock(item: ExportEducation) {
  return [
    docxParagraph(item.institution || "Учебное заведение не указано", {
      bold: true,
      spacingAfter: 60,
    }),
    item.specialization
      ? docxParagraph(item.specialization, { spacingAfter: 60 })
      : null,
    item.meta ? docxParagraph(item.meta, { spacingAfter: 90 }) : null,
    ...docxTextBlock(item.activities),
  ].filter(Boolean) as Paragraph[];
}

export async function generateResumeBuilderDocx(options: {
  content: ResumeBuilderContent;
  photo: ResumeBuilderExportPhoto;
}) {
  const model = buildExportModel(options.content);
  const photo = await prepareExportPhoto(options.photo);
  const image = getDocxImageRun(photo);
  const headerChildren = [
    docxParagraph(model.fullName, {
      bold: true,
      size: 42,
      spacingAfter: 160,
    }),
    ...compact([
      model.birthLine,
      model.contactLine,
      model.cityLine,
      compact([model.citizenshipLine, model.workPermitLine]).join(", "),
    ]).map((line) => docxParagraph(line, { spacingAfter: 80 })),
  ];
  const children: Array<Paragraph | Table> = [
    image
      ? new Table({
          borders: noBorders(),
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders(),
                  children: headerChildren,
                  width: { size: 7800, type: WidthType.DXA },
                }),
                new TableCell({
                  borders: noBorders(),
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [image],
                    }),
                  ],
                  width: { size: 1400, type: WidthType.DXA },
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      : new Table({
          borders: noBorders(),
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders(),
                  children: headerChildren,
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
    docxParagraph("Желаемая должность и зарплата", {
      bold: true,
      heading: true,
      spacingAfter: 120,
    }),
    docxParagraph(model.position, { bold: true, size: 28, spacingAfter: 90 }),
    docxParagraph(model.salaryLine, { spacingAfter: 80 }),
    ...model.employmentLine
      .split("\n")
      .filter(Boolean)
      .map((line) => docxParagraph(line, { spacingAfter: 70 })),
  ];

  if (model.experience.length) {
    children.push(
      docxParagraph("Опыт работы", {
        bold: true,
        heading: true,
        spacingAfter: 120,
      }),
      docxExperienceTable(model.experience),
    );
  }

  if (model.education.length) {
    children.push(
      docxParagraph("Образование", {
        bold: true,
        heading: true,
        spacingAfter: 120,
      }),
      ...model.education.flatMap(docxEducationBlock),
    );
  }

  if (model.additionalEducation.length) {
    children.push(
      docxParagraph("Дополнительное образование", {
        bold: true,
        heading: true,
        spacingAfter: 120,
      }),
      ...model.additionalEducation.flatMap(docxEducationBlock),
    );
  }

  if (model.skills.length) {
    children.push(
      docxParagraph("Навыки", {
        bold: true,
        heading: true,
        spacingAfter: 120,
      }),
      docxParagraph(model.skills.join("   "), { spacingAfter: 120 }),
    );
  }

  if (model.about) {
    children.push(
      docxParagraph("Дополнительная информация", {
        bold: true,
        heading: true,
        spacingAfter: 120,
      }),
      docxParagraph("Обо мне", { bold: true, spacingAfter: 90 }),
      ...docxTextBlock(model.about),
    );
  }

  const doc = new Document({
    sections: [
      {
        children,
        properties: {
          page: {
            margin: {
              bottom: 900,
              left: 900,
              right: 900,
              top: 900,
            },
          },
        },
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: "SectionTitle",
          name: "Section Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            bold: true,
            size: 28,
          },
          paragraph: {
            spacing: {
              after: 120,
              before: 260,
            },
          },
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}

export function generateResumeBuilderTxt(content: ResumeBuilderContent) {
  const model = buildExportModel(content);
  const lines: string[] = [
    model.fullName,
    model.birthLine,
    model.contactLine,
    model.cityLine,
    compact([model.citizenshipLine, model.workPermitLine]).join(", "),
    "",
    "Желаемая должность и зарплата",
    model.position,
    model.salaryLine,
    model.employmentLine,
  ];

  if (model.experience.length) {
    lines.push("", "Опыт работы");
    for (const item of model.experience) {
      lines.push(item.period, item.company, item.position, item.description);
    }
  }

  if (model.education.length) {
    lines.push("", "Образование");
    for (const item of model.education) {
      lines.push(item.institution, item.specialization, item.meta, item.activities);
    }
  }

  if (model.additionalEducation.length) {
    lines.push("", "Дополнительное образование");
    for (const item of model.additionalEducation) {
      lines.push(item.institution, item.specialization, item.meta, item.activities);
    }
  }

  if (model.skills.length) {
    lines.push("", "Навыки", model.skills.join(", "));
  }

  if (model.about) {
    lines.push("", "Дополнительная информация", "Обо мне", model.about);
  }

  return Buffer.from(
    lines
      .map((line) => line.trim())
      .filter((line, index, array) => line || array[index - 1])
      .join("\n"),
    "utf8",
  );
}

export function getResumeBuilderExportMeta(
  format: ResumeBuilderExportFormat,
) {
  if (format === "pdf") {
    return {
      extension: ".pdf",
      mimeType: "application/pdf",
    };
  }

  if (format === "docx") {
    return {
      extension: ".docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  return {
    extension: ".txt",
    mimeType: "text/plain; charset=utf-8",
  };
}
