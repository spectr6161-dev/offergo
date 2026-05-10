"use client";
import dynamic from "next/dynamic";
import { type ComponentProps, type ReactNode } from "react";
import { ChevronDownIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createEmptyResumeBuilderContent,
  type ResumeBuilderBasic,
  type ResumeBuilderContacts,
  type ResumeBuilderContent,
  type ResumeBuilderEducation,
  type ResumeBuilderExperience,
  type ResumeBuilderSalary,
} from "@/components/resume-builder/builder-data";
export type WizardStep =
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

export type EducationDraft = ResumeBuilderEducation;
export type ExperienceDraft = ResumeBuilderExperience;
export type BasicValidationErrors = Partial<Record<keyof ResumeBuilderBasic, string>>;
export type WizardValidationErrors = {
  basic: BasicValidationErrors;
  contacts: Partial<Record<keyof ResumeBuilderContacts, string>>;
  salary?: string;
  profession?: string;
};

export type BuilderResponse = {
  item: {
    id: string;
  };
  content: unknown;
};

export const ResumeWizardPlateEditor = dynamic(
  () =>
    import("@/components/resume-wizard-plate-editor").then(
      (module) => module.ResumeWizardPlateEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
        Загружаем редактор...
      </div>
    ),
  },
);

export const professionSuggestions = [
  {
    title: "Frontend-разработчик",
    description: "React, TypeScript, UI-интерфейсы",
    keywords: ["frontend", "фронтенд", "react", "typescript", "javascript"],
  },
  {
    title: "React-разработчик",
    description: "React, SPA, компонентные интерфейсы",
    keywords: ["react", "frontend", "javascript", "typescript"],
  },
  {
    title: "Next.js-разработчик",
    description: "Next.js, SSR, App Router, fullstack UI",
    keywords: ["next", "nextjs", "react", "frontend", "fullstack"],
  },
  {
    title: "Backend-разработчик",
    description: "API, базы данных, серверная логика",
    keywords: ["backend", "бэкенд", "api", "node", "java", "python", "go"],
  },
  {
    title: "Node.js-разработчик",
    description: "Node.js, NestJS, Express, backend API",
    keywords: ["node", "nodejs", "nestjs", "express", "backend"],
  },
  {
    title: "Fullstack-разработчик",
    description: "Frontend + backend, продуктовая разработка",
    keywords: ["fullstack", "фулстек", "react", "node", "next"],
  },
  {
    title: "Flutter-разработчик",
    description: "Flutter, Dart, iOS и Android приложения",
    keywords: ["flutter", "dart", "mobile", "ios", "android"],
  },
  {
    title: "iOS-разработчик",
    description: "Swift, SwiftUI, UIKit, мобильные приложения",
    keywords: ["ios", "swift", "swiftui", "uikit", "mobile"],
  },
  {
    title: "Android-разработчик",
    description: "Kotlin, Android SDK, мобильные приложения",
    keywords: ["android", "kotlin", "java", "mobile"],
  },
  {
    title: "Mobile-разработчик",
    description: "iOS, Android, Flutter, React Native",
    keywords: ["mobile", "мобильный", "ios", "android", "flutter", "react native"],
  },
  {
    title: "React Native-разработчик",
    description: "React Native, TypeScript, мобильная разработка",
    keywords: ["react native", "mobile", "ios", "android", "typescript"],
  },
  {
    title: "Java-разработчик",
    description: "Java, Spring, backend-сервисы",
    keywords: ["java", "spring", "backend"],
  },
  {
    title: "Python-разработчик",
    description: "Python, Django, FastAPI, автоматизация",
    keywords: ["python", "django", "fastapi", "backend"],
  },
  {
    title: "Golang-разработчик",
    description: "Go, высоконагруженные backend-сервисы",
    keywords: ["go", "golang", "backend", "microservices"],
  },
  {
    title: "QA-инженер",
    description: "Тестирование, тест-кейсы, контроль качества",
    keywords: ["qa", "тестировщик", "testing", "quality"],
  },
  {
    title: "AQA-инженер",
    description: "Автоматизация тестирования, Playwright, Selenium",
    keywords: ["aqa", "automation", "qa", "playwright", "selenium"],
  },
  {
    title: "DevOps-инженер",
    description: "CI/CD, Docker, Kubernetes, инфраструктура",
    keywords: ["devops", "docker", "kubernetes", "ci", "cd"],
  },
  {
    title: "SRE-инженер",
    description: "Надёжность сервисов, мониторинг, incident response",
    keywords: ["sre", "reliability", "monitoring", "devops"],
  },
  {
    title: "Cloud Engineer",
    description: "AWS, GCP, Azure, облачная инфраструктура",
    keywords: ["cloud", "aws", "gcp", "azure", "облако"],
  },
  {
    title: "Data Analyst",
    description: "SQL, BI, продуктовая и бизнес-аналитика",
    keywords: ["data analyst", "аналитик", "sql", "bi"],
  },
  {
    title: "Data Engineer",
    description: "ETL, DWH, pipelines, обработка данных",
    keywords: ["data engineer", "etl", "dwh", "pipeline", "spark"],
  },
  {
    title: "Data Scientist",
    description: "ML, статистика, модели и эксперименты",
    keywords: ["data scientist", "ml", "machine learning", "python"],
  },
  {
    title: "ML Engineer",
    description: "Machine Learning, LLM, production ML",
    keywords: ["ml", "machine learning", "ai", "llm", "python"],
  },
  {
    title: "AI Engineer",
    description: "LLM, агенты, AI-интеграции, RAG",
    keywords: ["ai", "llm", "rag", "agents", "machine learning"],
  },
  {
    title: "Product Manager в IT",
    description: "Продуктовая стратегия, discovery, delivery",
    keywords: ["product", "pm", "product manager", "продукт"],
  },
  {
    title: "Project Manager в IT",
    description: "Планирование, команда, сроки и поставка",
    keywords: ["project", "project manager", "scrum", "agile"],
  },
  {
    title: "UI/UX-дизайнер",
    description: "Интерфейсы, UX-исследования, дизайн-системы",
    keywords: ["ui", "ux", "designer", "figma", "дизайнер"],
  },
  {
    title: "Системный аналитик",
    description: "Требования, интеграции, API, документация",
    keywords: ["system analyst", "системный аналитик", "api", "uml"],
  },
  {
    title: "Бизнес-аналитик в IT",
    description: "Бизнес-требования, процессы, постановки задач",
    keywords: ["business analyst", "бизнес аналитик", "requirements"],
  },
  {
    title: "Инженер по кибербезопасности",
    description: "AppSec, SOC, защита инфраструктуры",
    keywords: ["security", "cybersecurity", "appsec", "soc", "безопасность"],
  },
];

export const recommendedSkills = [
  "Git",
  "iOS",
  "Java",
  "Английский язык",
  "Android",
  "JavaScript",
  "PostgreSQL",
  "SQL",
  "Обучение и развитие",
  "HTML",
  "Swift",
  "REST",
  "Linux",
  "Docker",
  "MySQL",
  "Python",
  "Node.js",
  "Деловая коммуникация",
  "PHP",
  "REST API",
];

export const months = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const experienceYearOptions = Array.from({ length: 87 }, (_, index) =>
  String(new Date().getFullYear() - index),
);

export const birthYearOptions = Array.from({ length: 87 }, (_, index) =>
  String(new Date().getFullYear() - 14 - index),
);

export const educationYearOptions = Array.from({ length: 109 }, (_, index) =>
  String(new Date().getFullYear() + 8 - index),
);

export const dayOptions = Array.from({ length: 31 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
export const emptyValidationErrors: WizardValidationErrors = {
  basic: {},
  contacts: {},
};

export const stepOrder: WizardStep[] = [
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
];

export const progressSteps = stepOrder.filter((step) => step !== "intent");

function isBlank(value: string | null | undefined) {
  return !value?.trim();
}

export function validateProfession(value: string) {
  return isBlank(value) ? "Выберите профессию из списка или укажите свою." : undefined;
}

export function validateBasicInfo(value: ResumeBuilderBasic): BasicValidationErrors {
  const errors: BasicValidationErrors = {};
  const birthDay = Number(value.birthDay);

  if (isBlank(value.lastName)) errors.lastName = "Укажите фамилию.";
  if (isBlank(value.firstName)) errors.firstName = "Укажите имя.";
  if (isBlank(value.birthDay)) {
    errors.birthDay = "Укажите день рождения.";
  } else if (!Number.isInteger(birthDay) || birthDay < 1 || birthDay > 31) {
    errors.birthDay = "Введите день от 1 до 31.";
  }
  if (isBlank(value.birthMonth)) errors.birthMonth = "Выберите месяц рождения.";
  if (isBlank(value.birthYear)) errors.birthYear = "Выберите год рождения.";
  if (isBlank(value.citizenship)) errors.citizenship = "Выберите гражданство.";
  if (isBlank(value.workPermit)) errors.workPermit = "Выберите страну.";

  return errors;
}

export function validateContacts(value: ResumeBuilderContacts) {
  const errors: WizardValidationErrors["contacts"] = {};

  if (
    value.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())
  ) {
    errors.email = "Введите корректную электронную почту.";
  }

  return errors;
}

export function validateSalary(value: ResumeBuilderSalary) {
  const amount = value.amount.trim();

  if (!amount) {
    return undefined;
  }

  return /^\d+$/.test(amount) && Number(amount) > 0
    ? undefined
    : "Желаемая зарплата должна быть положительным целым числом.";
}

export function hasValidationErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

export function getProgressIndex(step: WizardStep) {
  return Math.max(
    0,
    progressSteps.findIndex((progressStep) => progressStep === step),
  );
}

export function LargeInputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  error,
  hidden,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: ComponentProps<typeof Input>["inputMode"];
  maxLength?: number;
  error?: string;
  hidden?: boolean;
}) {
  const invalid = Boolean(error);

  if (hidden) {
    return null;
  }

  return (
    <Field data-invalid={invalid}>
      <Input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder ?? label}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 rounded-xl border-input px-4 text-base shadow-none md:text-base"
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function DropdownRadioField({
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
}) {
  const invalid = Boolean(error);

  return (
    <Field data-invalid={invalid}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={label}
            aria-invalid={invalid}
            className="h-14 w-full justify-between rounded-xl border-input px-4 text-left text-base font-normal shadow-none hover:bg-background md:text-base"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72">
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                className="min-h-11 px-3 py-2 text-base md:text-base"
              >
                {option}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-foreground" />
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 rounded-xl border-input pr-12 pl-12 text-base shadow-none md:text-base"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          onClick={() => onChange("")}
          aria-label="Очистить"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}

export function OptionCard({
  icon,
  title,
  onClick,
  className,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-col items-start justify-between rounded-2xl border border-input bg-background p-5 text-left text-base font-medium transition hover:border-[var(--hh-blue)] hover:shadow-sm focus-visible:border-[var(--hh-blue)] focus-visible:ring-3 focus-visible:ring-[var(--hh-blue)]/20 focus-visible:outline-none",
        className,
      )}
    >
      <span className="text-foreground">{icon}</span>
      <span>{title}</span>
    </button>
  );
}

export function WizardTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-center text-2xl leading-tight font-semibold tracking-[-0.02em] text-foreground sm:text-[28px]">
      {children}
    </h1>
  );
}
