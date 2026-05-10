import type { Value } from "platejs";

export type ResumeBuilderStep =
  | "intent"
  | "profession"
  | "basic"
  | "contacts"
  | "salary"
  | "workConditions"
  | "education"
  | "skills"
  | "experience"
  | "about";

export type ResumeSalaryCurrency = "RUB" | "EUR" | "USD";
export type ResumeEmploymentType =
  | "permanent"
  | "part_time"
  | "internship"
  | "unpaid_internship";
export type ResumeWorkFormat = "onsite" | "remote" | "hybrid";
export type ResumeContractType =
  | "employment_contract"
  | "self_employed"
  | "individual_entrepreneur";

export type ResumeBuilderBasic = {
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  city: string;
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  citizenship: string;
  workPermit: string;
};

export type ResumeBuilderContacts = {
  phone: string;
  email: string;
  telegram: string;
  max: string;
  vk: string;
  whatsapp: string;
  comment: string;
};

export type ResumeBuilderSalary = {
  amount: string;
  currency: ResumeSalaryCurrency;
};

export type ResumeBuilderWorkConditions = {
  employmentTypes: ResumeEmploymentType[];
  workFormats: ResumeWorkFormat[];
  contractTypes: ResumeContractType[];
};

export type ResumeBuilderEducation = {
  id: string;
  level: string;
  institution: string;
  faculty: string;
  specialization: string;
  graduationYear: string;
  activities: Value;
};

export type ResumeBuilderExperience = {
  id: string;
  company: string;
  position: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  current: boolean;
  endYear: string;
  description: Value;
};

export type ResumeBuilderAppearance = {
  templateId: string;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
};

export type ResumeBuilderContent = {
  kind: "builder_resume";
  schemaVersion: 1;
  wizard: {
    currentStep: ResumeBuilderStep;
    profession: string;
    basic: ResumeBuilderBasic;
    contacts: ResumeBuilderContacts;
    salary: ResumeBuilderSalary;
    workConditions: ResumeBuilderWorkConditions;
    education: ResumeBuilderEducation[];
    additionalEducation: ResumeBuilderEducation[];
    skills: string[];
    experience: ResumeBuilderExperience[];
    about: Value;
  };
  appearance: ResumeBuilderAppearance;
  export: {
    fileAssetId: string | null;
    generatedAt: string | null;
    templateVersion: string;
  };
};

type TextNode = {
  children?: TextNode[];
  text?: unknown;
};

export function createEmptyPlateValue(): Value {
  return [{ children: [{ text: "" }], type: "p" }] as Value;
}

export function createEmptyBuilderBasic(): ResumeBuilderBasic {
  return {
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
}

export function createEmptyBuilderContacts(): ResumeBuilderContacts {
  return {
    phone: "",
    email: "",
    telegram: "",
    max: "",
    vk: "",
    whatsapp: "",
    comment: "",
  };
}

export function createEmptyBuilderSalary(): ResumeBuilderSalary {
  return {
    amount: "",
    currency: "RUB",
  };
}

export function createEmptyBuilderWorkConditions(): ResumeBuilderWorkConditions {
  return {
    employmentTypes: [],
    workFormats: [],
    contractTypes: [],
  };
}

export function createEmptyResumeBuilderContent(): ResumeBuilderContent {
  return {
    kind: "builder_resume",
    schemaVersion: 1,
    wizard: {
      currentStep: "intent",
      profession: "",
      basic: createEmptyBuilderBasic(),
      contacts: createEmptyBuilderContacts(),
      salary: createEmptyBuilderSalary(),
      workConditions: createEmptyBuilderWorkConditions(),
      education: [],
      additionalEducation: [],
      skills: [],
      experience: [],
      about: createEmptyPlateValue(),
    },
    appearance: {
      templateId: "simple",
      accentColor: "#1d4ed8",
      fontFamily: "Noto Sans",
      fontSize: 11,
    },
    export: {
      fileAssetId: null,
      generatedAt: null,
      templateVersion: "html-view-v1",
    },
  };
}

export function normalizeResumeBuilderContent(
  value: ResumeBuilderContent,
): ResumeBuilderContent {
  const empty = createEmptyResumeBuilderContent();
  const legacyStep = value.wizard.currentStep as ResumeBuilderStep | "appearance";
  const basic = { ...empty.wizard.basic, ...value.wizard.basic };
  const contacts = {
    ...empty.wizard.contacts,
    ...value.wizard.contacts,
  };

  if (!contacts.phone && basic.phone) {
    contacts.phone = basic.phone;
  }

  return {
    ...empty,
    ...value,
    wizard: {
      ...empty.wizard,
      ...value.wizard,
      currentStep: legacyStep === "appearance" ? "about" : legacyStep,
      basic,
      contacts,
      salary: {
        ...empty.wizard.salary,
        ...value.wizard.salary,
      },
      workConditions: {
        ...empty.wizard.workConditions,
        ...value.wizard.workConditions,
      },
      education: value.wizard.education ?? [],
      additionalEducation: value.wizard.additionalEducation ?? [],
      skills: value.wizard.skills ?? [],
      experience: value.wizard.experience ?? [],
      about: value.wizard.about ?? createEmptyPlateValue(),
    },
    appearance: {
      ...empty.appearance,
      ...value.appearance,
    },
    export: {
      ...empty.export,
      ...value.export,
    },
  };
}

export function isResumeBuilderContent(value: unknown): value is ResumeBuilderContent {
  return (
    Boolean(value && typeof value === "object") &&
    (value as { kind?: unknown }).kind === "builder_resume" &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1
  );
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

  return value.map((node) => getNodeText(node as TextNode)).join("\n").trim();
}

export function getResumeBuilderTitle(content: ResumeBuilderContent) {
  const { firstName, lastName } = content.wizard.basic;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName && content.wizard.profession) {
    return `${fullName} — ${content.wizard.profession}`;
  }

  return fullName || content.wizard.profession || "Новое резюме";
}
