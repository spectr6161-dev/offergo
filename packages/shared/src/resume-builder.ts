import { z } from "zod";

export const resumeBuilderSteps = [
  "intent",
  "profession",
  "basic",
  "contacts",
  "salary",
  "workConditions",
  "education",
  "skills",
  "experience",
  "about",
] as const;

const resumeBuilderStoredSteps = [...resumeBuilderSteps, "appearance"] as const;

export type ResumeBuilderStep = (typeof resumeBuilderSteps)[number];

export const resumeSalaryCurrencies = ["RUB", "EUR", "USD"] as const;
export const resumeEmploymentTypes = [
  "permanent",
  "part_time",
  "internship",
  "unpaid_internship",
] as const;
export const resumeWorkFormats = ["onsite", "remote", "hybrid"] as const;
export const resumeContractTypes = [
  "employment_contract",
  "self_employed",
  "individual_entrepreneur",
] as const;

const emptyPlateValue = [{ children: [{ text: "" }], type: "p" }];
const plateValueSchema = z.array(z.unknown()).default(emptyPlateValue);
const optionalText = z
  .preprocess((value) => (value == null ? "" : String(value)), z.string())
  .default("");

const emptyResumeBuilderBasic = {
  lastName: "",
  firstName: "",
  middleName: "",
  gender: "",
  city: "",
  phone: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  citizenship: "",
  workPermit: "",
};

const emptyResumeBuilderContacts = {
  phone: "",
  email: "",
  telegram: "",
  max: "",
  vk: "",
  whatsapp: "",
  comment: "",
};

const emptyResumeBuilderSalary = {
  amount: "",
  currency: "RUB" as const,
};

const emptyResumeBuilderWorkConditions = {
  employmentTypes: [] as Array<(typeof resumeEmploymentTypes)[number]>,
  workFormats: [] as Array<(typeof resumeWorkFormats)[number]>,
  contractTypes: [] as Array<(typeof resumeContractTypes)[number]>,
};

const emptyResumeBuilderExport = {
  fileAssetId: null,
  generatedAt: null,
  templateVersion: "html-view-v1",
};

export const resumeBuilderBasicSchema = z
  .object({
    lastName: optionalText,
    firstName: optionalText,
    middleName: optionalText,
    gender: optionalText,
    city: optionalText,
    phone: optionalText,
    birthDay: optionalText,
    birthMonth: optionalText,
    birthYear: optionalText,
    citizenship: optionalText,
    workPermit: optionalText,
  })
  .default(emptyResumeBuilderBasic);

export const resumeBuilderContactsSchema = z
  .object({
    phone: optionalText,
    email: optionalText.refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Некорректная электронная почта.",
    ),
    telegram: optionalText,
    max: optionalText,
    vk: optionalText,
    whatsapp: optionalText,
    comment: optionalText,
  })
  .default(emptyResumeBuilderContacts);

export const resumeBuilderSalarySchema = z
  .object({
    amount: optionalText,
    currency: z.enum(resumeSalaryCurrencies).default("RUB"),
  })
  .refine(
    (value) =>
      value.amount === "" ||
      (/^\d+$/.test(value.amount) && Number(value.amount) > 0),
    {
      message: "Желаемая зарплата должна быть положительным целым числом.",
      path: ["amount"],
    },
  )
  .default(emptyResumeBuilderSalary);

export const resumeBuilderWorkConditionsSchema = z
  .object({
    employmentTypes: z.array(z.enum(resumeEmploymentTypes)).default([]),
    workFormats: z.array(z.enum(resumeWorkFormats)).default([]),
    contractTypes: z.array(z.enum(resumeContractTypes)).default([]),
  })
  .default(emptyResumeBuilderWorkConditions);

export const resumeBuilderEducationSchema = z.object({
  id: optionalText.default(""),
  level: optionalText,
  institution: optionalText,
  faculty: optionalText,
  specialization: optionalText,
  graduationYear: optionalText,
  activities: plateValueSchema,
});

export const resumeBuilderExperienceSchema = z.object({
  id: optionalText.default(""),
  company: optionalText,
  position: optionalText,
  startMonth: optionalText,
  startYear: optionalText,
  endMonth: optionalText,
  endYear: optionalText,
  current: z.boolean().default(false),
  description: plateValueSchema,
});

export const resumeBuilderWizardSchema = z
  .object({
    currentStep: z
      .enum(resumeBuilderStoredSteps)
      .default("intent")
      .transform((step): ResumeBuilderStep =>
        step === "appearance" ? "about" : step,
      ),
    profession: optionalText,
    basic: resumeBuilderBasicSchema,
    contacts: resumeBuilderContactsSchema,
    salary: resumeBuilderSalarySchema,
    workConditions: resumeBuilderWorkConditionsSchema,
    education: z.array(resumeBuilderEducationSchema).default([]),
    additionalEducation: z.array(resumeBuilderEducationSchema).default([]),
    skills: z.array(z.string()).default([]),
    experience: z.array(resumeBuilderExperienceSchema).default([]),
    about: plateValueSchema,
  })
  .default({
    currentStep: "intent",
    profession: "",
    basic: emptyResumeBuilderBasic,
    contacts: emptyResumeBuilderContacts,
    salary: emptyResumeBuilderSalary,
    workConditions: emptyResumeBuilderWorkConditions,
    education: [],
    additionalEducation: [],
    skills: [],
    experience: [],
    about: emptyPlateValue,
  });

export const resumeBuilderAppearanceSchema = z.object({
  templateId: z.string().default("simple"),
  accentColor: z.string().default("#1d4ed8"),
  fontFamily: z.string().default("Noto Sans"),
  fontSize: z.number().default(11),
});

export const resumeBuilderExportSchema = z
  .object({
    fileAssetId: z.string().nullable().default(null),
    generatedAt: z.string().nullable().default(null),
    templateVersion: z.string().default("html-view-v1"),
  })
  .default(emptyResumeBuilderExport);

export const resumeBuilderContentSchema = z
  .object({
    kind: z.literal("builder_resume"),
    schemaVersion: z.literal(1),
    wizard: resumeBuilderWizardSchema,
    appearance: resumeBuilderAppearanceSchema,
    export: resumeBuilderExportSchema,
  });

export type ResumeBuilderBasic = z.infer<typeof resumeBuilderBasicSchema>;
export type ResumeBuilderContacts = z.infer<typeof resumeBuilderContactsSchema>;
export type ResumeBuilderSalary = z.infer<typeof resumeBuilderSalarySchema>;
export type ResumeBuilderWorkConditions = z.infer<
  typeof resumeBuilderWorkConditionsSchema
>;
export type ResumeBuilderEducation = z.infer<
  typeof resumeBuilderEducationSchema
>;
export type ResumeBuilderExperience = z.infer<
  typeof resumeBuilderExperienceSchema
>;
export type ResumeBuilderWizard = z.infer<typeof resumeBuilderWizardSchema>;
export type ResumeBuilderAppearance = z.infer<
  typeof resumeBuilderAppearanceSchema
>;
export type ResumeBuilderContent = z.infer<typeof resumeBuilderContentSchema>;

type TextNode = {
  children?: TextNode[];
  text?: unknown;
};

export function createEmptyResumeBuilderContent(): ResumeBuilderContent {
  return normalizeResumeBuilderContent(resumeBuilderContentSchema.parse({
    kind: "builder_resume",
    schemaVersion: 1,
    wizard: {},
    appearance: {},
    export: {},
  }));
}

export function normalizeResumeBuilderContent(
  content: ResumeBuilderContent,
): ResumeBuilderContent {
  const basic = { ...emptyResumeBuilderBasic, ...content.wizard.basic };
  const contacts = {
    ...emptyResumeBuilderContacts,
    ...content.wizard.contacts,
  };

  if (!contacts.phone && basic.phone) {
    contacts.phone = basic.phone;
  }

  return {
    ...content,
    wizard: {
      ...content.wizard,
      currentStep: content.wizard.currentStep,
      basic,
      contacts,
      salary: {
        ...emptyResumeBuilderSalary,
        ...content.wizard.salary,
      },
      workConditions: {
        ...emptyResumeBuilderWorkConditions,
        ...content.wizard.workConditions,
      },
      education: content.wizard.education ?? [],
      additionalEducation: content.wizard.additionalEducation ?? [],
      skills: content.wizard.skills ?? [],
      experience: content.wizard.experience ?? [],
      about: content.wizard.about ?? emptyPlateValue,
    },
    export: {
      ...emptyResumeBuilderExport,
      ...content.export,
    },
  } as ResumeBuilderContent;
}

export function parseResumeBuilderContent(input: unknown): ResumeBuilderContent {
  const parsed = resumeBuilderContentSchema.safeParse(input);

  if (parsed.success) {
    return normalizeResumeBuilderContent(parsed.data);
  }

  return createEmptyResumeBuilderContent();
}

export function isResumeBuilderContent(input: unknown): input is ResumeBuilderContent {
  return resumeBuilderContentSchema.safeParse(input).success;
}

function getNodeText(node: TextNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  if (Array.isArray(node.children)) {
    return node.children.map(getNodeText).join("");
  }

  return "";
}

export function plateValueToPlainText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((node) => getNodeText(node as TextNode))
    .join("\n")
    .trim();
}

export function getResumeBuilderTitle(content: ResumeBuilderContent) {
  const { firstName, lastName } = content.wizard.basic;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName && content.wizard.profession) {
    return `${fullName} — ${content.wizard.profession}`;
  }

  return fullName || content.wizard.profession || "Новое резюме";
}

function currencyLabel(currency: ResumeBuilderSalary["currency"]) {
  if (currency === "EUR") return "EUR";
  if (currency === "USD") return "USD";
  return "RUB";
}

const employmentTypeLabels: Record<string, string> = {
  permanent: "Постоянная работа",
  part_time: "Подработка",
  internship: "Стажировка",
  unpaid_internship: "Бесплатная стажировка",
};

const workFormatLabels: Record<string, string> = {
  onsite: "На месте работодателя",
  remote: "Удаленно",
  hybrid: "Гибрид",
};

const contractTypeLabels: Record<string, string> = {
  employment_contract: "Трудовой договор",
  self_employed: "Самозанятый",
  individual_entrepreneur: "ИП",
};

function mapLabels(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value).join(", ");
}

export function resumeBuilderContentToPlainText(content: ResumeBuilderContent) {
  const lines: string[] = [];
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
  const fullName = [basic.lastName, basic.firstName, basic.middleName]
    .filter(Boolean)
    .join(" ");

  if (fullName) lines.push(fullName);
  if (profession) lines.push(profession);
  if (basic.city || contacts.phone) {
    lines.push([basic.city, contacts.phone].filter(Boolean).join(" • "));
  }
  if (contacts.email) lines.push(`Электронная почта: ${contacts.email}`);
  if (contacts.telegram) lines.push(`Telegram: ${contacts.telegram}`);
  if (contacts.max) lines.push(`Max: ${contacts.max}`);
  if (contacts.vk) lines.push(`VK: ${contacts.vk}`);
  if (contacts.whatsapp) lines.push(`WhatsApp: ${contacts.whatsapp}`);
  if (contacts.comment) lines.push(`Комментарий к контактам: ${contacts.comment}`);
  if (salary.amount) {
    lines.push(`Желаемая зарплата: ${salary.amount} ${currencyLabel(salary.currency)}`);
  }
  if (workConditions.employmentTypes.length) {
    lines.push(
      `Тип занятости: ${mapLabels(workConditions.employmentTypes, employmentTypeLabels)}`,
    );
  }
  if (workConditions.workFormats.length) {
    lines.push(
      `Формат работы: ${mapLabels(workConditions.workFormats, workFormatLabels)}`,
    );
  }
  if (workConditions.contractTypes.length) {
    lines.push(
      `Оформление: ${mapLabels(workConditions.contractTypes, contractTypeLabels)}`,
    );
  }
  if (basic.birthDay || basic.birthMonth || basic.birthYear) {
    lines.push(
      `Дата рождения: ${[basic.birthDay, basic.birthMonth, basic.birthYear]
        .filter(Boolean)
        .join(" ")}`,
    );
  }
  if (basic.citizenship) lines.push(`Гражданство: ${basic.citizenship}`);
  if (basic.workPermit) lines.push(`Разрешение на работу: ${basic.workPermit}`);

  if (skills.length) {
    lines.push("", "Навыки", skills.join(", "));
  }

  if (education.length) {
    lines.push("", "Образование");
    for (const item of education) {
      lines.push(
        [
          item.institution,
          item.faculty,
          item.specialization,
          item.graduationYear,
          item.level,
        ]
          .filter(Boolean)
          .join(" • "),
      );
      const activities = plateValueToPlainText(item.activities);
      if (activities) lines.push(activities);
    }
  }

  if (additionalEducation.length) {
    lines.push("", "Дополнительное образование");
    for (const item of additionalEducation) {
      lines.push(
        [
          item.institution,
          item.faculty,
          item.specialization,
          item.graduationYear,
          item.level,
        ]
          .filter(Boolean)
          .join(" • "),
      );
      const activities = plateValueToPlainText(item.activities);
      if (activities) lines.push(activities);
    }
  }

  if (experience.length) {
    lines.push("", "Опыт работы");
    for (const item of experience) {
      lines.push([item.company, item.position].filter(Boolean).join(" • "));
      const period = [
        [item.startMonth, item.startYear].filter(Boolean).join(" "),
        item.current
          ? "по настоящее время"
          : [item.endMonth, item.endYear].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" — ");
      if (period) lines.push(period);
      const description = plateValueToPlainText(item.description);
      if (description) lines.push(description);
    }
  }

  const aboutText = plateValueToPlainText(about);
  if (aboutText) {
    lines.push("", "О себе", aboutText);
  }

  return lines.filter((line) => line.trim().length > 0).join("\n");
}
