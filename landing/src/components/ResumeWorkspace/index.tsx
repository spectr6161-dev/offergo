import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { ResumeDocument, ResumeDocumentSection, ResumeIssue, ResumeRecord } from "./types";
import "./styles.css";

type ResumeScreen =
  | "overview"
  | "path-select"
  | "upload"
  | "loading-profile"
  | "confirm-profile"
  | "loading-review"
  | "review"
  | "unauthorized"
  | "error";

type ProblemFilter = "all" | ResumeIssue["severity"];

type ScreenError = {
  title: string;
  message: string;
  returnTo: ResumeScreen;
};

type HoverHint = {
  issueId: string;
  rect: DOMRect;
};

type IssueContextMenu = {
  issueId: string;
  top: number;
  left: number;
};

type TextSegment = {
  key: string;
  text: string;
  issue: ResumeIssue | null;
};

type ResolvedResumeIssue = ResumeIssue & {
  resolvedStart: number;
  resolvedEnd: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

const seniorityOptions = [
  "",
  "Intern",
  "Junior",
  "Junior+",
  "Middle",
  "Middle+",
  "Senior",
  "Lead",
  "Principal",
  "Manager",
];

const overviewResumeBoosts = [
  "Умные, автоматизированные заявки",
  "Быстрее получайте приглашения на собеседования",
];

const overviewResumeProblems = [
  "Бесконечные связи без результата",
  "Перегруженные сайты вакансий",
  "Ручное заполнение заявок",
];

const overviewInviteProof = [
  "jessi2***@gmail.com",
  "johnad***@yahoo.com",
  "pantov***@proton.me",
  "ol1matt***@gmail.com",
];

const overviewResumeProof = [
  "kristi***@gmail.com",
  "thomas***@gmail.com",
  "ulanar***@outlook.com",
  "xpatri***@protonmail.com",
];

const analysisPreviewCards = [
  {
    icon: "S",
    title: "Summary, Product Manager",
    subtitle: "Позиционирование и тон",
    tags: ["Summary", "Tone"],
    status: "Проверено",
    statusTone: "violet",
    meta: "3ч",
    accent: "violet",
  },
  {
    icon: "E",
    title: "Опыт работы, Analyst CV",
    subtitle: "Достижения и ATS-структура",
    tags: ["Опыт", "ATS"],
    status: "Исправить",
    statusTone: "orange",
    meta: "4ч",
    accent: "blue",
  },
];

const demoText = `Алексей Смирнов
Senior Product Manager
Москва • alexey.smirnov@email.com • Telegram: @alex_pm_best

О СЕБЕ
Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и увеличил выручку в 3 раза за 2 месяца. Сфокусирован на monetization, activation и развитии продуктовой аналитики.

ОПЫТ РАБОТЫ
ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время
Отвечал за growth-направление, подписки и монетизацию корпоративного продукта.
- Управлял командой из 5 человек, запускал эксперименты и синхронизировал roadmap с sales и support.
- Снизил churn на 11% за счёт пересборки paywall и тарифной логики.

ООО «DataPeak» — Product Manager | 2020 — 2022
- Вёл discovery по новому BI-модулю, проводил CustDev, формировал backlog и критерии приоритизации.

НАВЫКИ
SQL, A/B-тесты, продуктовая аналитика, JTBD, roadmap, discovery, стрессоустойчивость, коммуникабельность, обучаемость

ОБРАЗОВАНИЕ
НИУ ВШЭ — Менеджмент, бакалавриат`;

function buildDemoDocument() {
  const sections = [
    {
      id: "demo-header",
      type: "header",
      title: "Контакты",
      order: 0,
      content: `Алексей Смирнов
Senior Product Manager
Москва • alexey.smirnov@email.com • Telegram: @alex_pm_best`,
      blocks: [
        {
          id: "demo-header-block",
          text: `Алексей Смирнов
Senior Product Manager
Москва • alexey.smirnov@email.com • Telegram: @alex_pm_best`,
          startOffset: 0,
          endOffset: 87,
        },
      ],
    },
    {
      id: "demo-summary",
      type: "summary",
      title: "О себе",
      order: 1,
      content:
        "Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и увеличил выручку в 3 раза за 2 месяца. Сфокусирован на monetization, activation и развитии продуктовой аналитики.",
      blocks: [
        {
          id: "demo-summary-block",
          text: "Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и увеличил выручку в 3 раза за 2 месяца. Сфокусирован на monetization, activation и развитии продуктовой аналитики.",
          startOffset: demoText.indexOf("Product Manager с 6-летним опытом"),
          endOffset:
            demoText.indexOf("Product Manager с 6-летним опытом") +
            "Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и увеличил выручку в 3 раза за 2 месяца. Сфокусирован на monetization, activation и развитии продуктовой аналитики.".length,
        },
      ],
    },
    {
      id: "demo-experience",
      type: "experience",
      title: "Опыт работы",
      order: 2,
      content: `ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время
Отвечал за growth-направление, подписки и монетизацию корпоративного продукта.
- Управлял командой из 5 человек, запускал эксперименты и синхронизировал roadmap с sales и support.
- Снизил churn на 11% за счёт пересборки paywall и тарифной логики.

ООО «DataPeak» — Product Manager | 2020 — 2022
- Вёл discovery по новому BI-модулю, проводил CustDev, формировал backlog и критерии приоритизации.`,
      blocks: [
        {
          id: "demo-exp-1",
          text: `ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время
Отвечал за growth-направление, подписки и монетизацию корпоративного продукта.
- Управлял командой из 5 человек, запускал эксперименты и синхронизировал roadmap с sales и support.
- Снизил churn на 11% за счёт пересборки paywall и тарифной логики.`,
          startOffset: demoText.indexOf("ООО «SaaSFlow»"),
          endOffset:
            demoText.indexOf("ООО «SaaSFlow»") +
            `ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время
Отвечал за growth-направление, подписки и монетизацию корпоративного продукта.
- Управлял командой из 5 человек, запускал эксперименты и синхронизировал roadmap с sales и support.
- Снизил churn на 11% за счёт пересборки paywall и тарифной логики.`.length,
        },
        {
          id: "demo-exp-2",
          text: `ООО «DataPeak» — Product Manager | 2020 — 2022
- Вёл discovery по новому BI-модулю, проводил CustDev, формировал backlog и критерии приоритизации.`,
          startOffset: demoText.indexOf("ООО «DataPeak»"),
          endOffset:
            demoText.indexOf("ООО «DataPeak»") +
            `ООО «DataPeak» — Product Manager | 2020 — 2022
- Вёл discovery по новому BI-модулю, проводил CustDev, формировал backlog и критерии приоритизации.`.length,
        },
      ],
    },
    {
      id: "demo-skills",
      type: "skills",
      title: "Навыки",
      order: 3,
      content:
        "SQL, A/B-тесты, продуктовая аналитика, JTBD, roadmap, discovery, стрессоустойчивость, коммуникабельность, обучаемость",
      blocks: [
        {
          id: "demo-skills-block",
          text: "SQL, A/B-тесты, продуктовая аналитика, JTBD, roadmap, discovery, стрессоустойчивость, коммуникабельность, обучаемость",
          startOffset: demoText.indexOf("SQL, A/B-тесты"),
          endOffset:
            demoText.indexOf("SQL, A/B-тесты") +
            "SQL, A/B-тесты, продуктовая аналитика, JTBD, roadmap, discovery, стрессоустойчивость, коммуникабельность, обучаемость".length,
        },
      ],
    },
    {
      id: "demo-education",
      type: "education",
      title: "Образование",
      order: 4,
      content: "НИУ ВШЭ — Менеджмент, бакалавриат",
      blocks: [
        {
          id: "demo-education-block",
          text: "НИУ ВШЭ — Менеджмент, бакалавриат",
          startOffset: demoText.indexOf("НИУ ВШЭ — Менеджмент, бакалавриат"),
          endOffset:
            demoText.indexOf("НИУ ВШЭ — Менеджмент, бакалавриат") +
            "НИУ ВШЭ — Менеджмент, бакалавриат".length,
        },
      ],
    },
  ] satisfies ResumeDocumentSection[];

  return {
    id: "demo-resume",
    rawText: demoText,
    normalizedText: demoText,
    sections,
    metadata: {
      sourceFormat: "pdf",
      detectedLanguage: "ru",
      charCount: demoText.length,
      wordCount: demoText.split(/\s+/).filter(Boolean).length,
      detectedRole: "Product Manager",
      confirmedRole: "Product Manager",
      detectedSeniority: "Senior",
      title: "Алексей Смирнов — Product Manager",
    },
  };
}

function buildDemoIssues(text: string): ResumeIssue[] {
  const findRange = (needle: string) => {
    const start = text.indexOf(needle);
    return {
      start,
      end: start + needle.length,
    };
  };

  const summaryRange = findRange("увеличил выручку в 3 раза за 2 месяца");
  const managementRange = findRange("Управлял командой из 5 человек");
  const softSkillsRange = findRange("стрессоустойчивость, коммуникабельность, обучаемость");

  return [
    {
      id: "demo-issue-error",
      resumeId: "demo-resume",
      severity: "error",
      title: "Слишком сильное достижение без доказательства",
      description:
        "Фраза звучит как недоказанное или малореалистичное заявление. Такой тезис почти наверняка вызовет вопросы у рекрутера и hiring manager.",
      reason:
        "Формулировка не опирается на контекст: не указаны метрика, база сравнения и изменение продукта, которое привело к росту.",
      originalText: "увеличил выручку в 3 раза за 2 месяца",
      suggestedText:
        "Увеличил выручку продуктового направления на 38% за квартал за счёт пересборки onboarding-воронки и запуска paywall-экспериментов.",
      section: "summary",
      startOffset: summaryRange.start,
      endOffset: summaryRange.end,
      confidence: 0.93,
      tags: ["achievements", "credibility"],
      status: "open",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-issue-warning",
      resumeId: "demo-resume",
      severity: "warning",
      title: "Обязанность вместо результата",
      description:
        "Фраза описывает процесс, но не объясняет, что именно изменилось благодаря этой работе.",
      reason:
        "В опыте работы сильнее выглядят измеримые или хотя бы конкретные результаты, а не только перечисление роли в команде.",
      originalText: "Управлял командой из 5 человек",
      suggestedText:
        "Руководил кросс-функциональной командой из 5 человек и синхронизировал delivery roadmap с sales и support для запуска экспериментов без срыва релизов.",
      section: "experience",
      startOffset: managementRange.start,
      endOffset: managementRange.end,
      confidence: 0.82,
      tags: ["experience", "results"],
      status: "open",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-issue-suggestion",
      resumeId: "demo-resume",
      severity: "suggestion",
      title: "Общие soft skills без пользы",
      description:
        "Блок софт-скиллов выглядит слишком общим и не усиливает позиционирование кандидата.",
      reason:
        "Такие слова редко помогают пройти отбор, если не привязаны к рабочим кейсам или сильным компетенциям.",
      originalText: "стрессоустойчивость, коммуникабельность, обучаемость",
      suggestedText:
        "CustDev, JTBD, презентация продуктовых гипотез, stakeholder management, фасилитация discovery-сессий.",
      section: "skills",
      startOffset: softSkillsRange.start,
      endOffset: softSkillsRange.end,
      confidence: 0.68,
      tags: ["skills", "ats"],
      status: "open",
      createdAt: new Date().toISOString(),
    },
  ];
}

const demoResume: ResumeRecord = {
  id: "demo-resume",
  userId: "demo-user",
  title: "Алексей Смирнов — Product Manager",
  sourceKind: "uploaded",
  sourceFormat: "pdf",
  originalFilename: "demo-product-manager.pdf",
  mimeType: "application/pdf",
  fileHash: null,
  rawText: demoText,
  normalizedText: demoText,
  documentJson: buildDemoDocument(),
  detectedRole: "Product Manager",
  confirmedRole: "Product Manager",
  detectedSeniority: "Senior",
  status: "analyzed",
  latestScore: 72,
  latestSummary:
    "Хороший базовый опыт, но часть формулировок выглядит недоказанной или слишком общей. Нужна более жёсткая привязка к результатам.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const demoIssues = buildDemoIssues(demoText);

function clampOffset(value: number, length: number) {
  return Math.max(0, Math.min(value, length));
}

function severityLabel(severity: ResumeIssue["severity"]) {
  switch (severity) {
    case "error":
      return "Ошибка";
    case "warning":
      return "Предупреждение";
    case "suggestion":
      return "Совет";
    default:
      return severity;
  }
}

function issueStatusLabel(status: ResumeIssue["status"]) {
  switch (status) {
    case "applied":
      return "Исправлено";
    case "rejected":
      return "Отклонено";
    case "open":
    default:
      return "Открыто";
  }
}

function sectionLabel(section: string) {
  const map: Record<string, string> = {
    header: "Шапка резюме",
    summary: "О себе",
    skills: "Навыки",
    experience: "Опыт работы",
    projects: "Проекты",
    education: "Образование",
    certifications: "Курсы и сертификаты",
    languages: "Языки",
    other: "Резюме",
  };

  return map[section] ?? section;
}

function sectionTitle(section: ResumeDocumentSection) {
  const map: Record<string, string> = {
    header: "",
    summary: "О СЕБЕ",
    skills: "НАВЫКИ",
    experience: "ОПЫТ РАБОТЫ",
    projects: "ПРОЕКТЫ",
    education: "ОБРАЗОВАНИЕ",
    certifications: "КУРСЫ И СЕРТИФИКАТЫ",
    languages: "ЯЗЫКИ",
  };

  return map[section.type] ?? section.title.toUpperCase();
}

function excerpt(text: string, limit = 92) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Фрагмент не найден";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trimEnd()}…`;
}

function OverviewWordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={`resume-overview-wordmark resume-overview-wordmark--${size}`} aria-label="offerGO">
      <span className="resume-overview-wordmark__offer">offer</span>
      <span className="resume-overview-wordmark__go-shell" aria-hidden="true">
        <span className="resume-overview-wordmark__go">GO</span>
      </span>
    </span>
  );
}

function replaceTextRange(text: string, start: number, end: number, replacement: string) {
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function handleActionCardKeyDown(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractContentTokens(text: string) {
  return new Set((text.toLowerCase().match(/[a-zа-яё0-9+/.-]{3,}/gi) ?? []).map((token) => token.trim()));
}

function findLineLevelMatch(text: string, fragment: string) {
  const fragmentTokens = Array.from(extractContentTokens(fragment));
  if (!fragmentTokens.length) {
    return null;
  }

  const lines = text.split("\n");
  let cursor = 0;
  let best: { start: number; end: number; score: number } | null = null;

  for (const line of lines) {
    const lineTokens = extractContentTokens(line);
    const overlap = fragmentTokens.filter((token) => lineTokens.has(token)).length;
    const score = overlap / fragmentTokens.length;

    if (score >= 0.6 && (!best || score > best.score)) {
      const trimmed = line.trim();
      const offsetInsideLine = line.indexOf(trimmed);
      best = {
        start: cursor + Math.max(0, offsetInsideLine),
        end: cursor + Math.max(0, offsetInsideLine) + trimmed.length,
        score,
      };
    }

    cursor += line.length + 1;
  }

  return best
    ? {
        start: best.start,
        end: best.end,
      }
    : null;
}

function resolveIssueRange(text: string, issue: ResumeIssue) {
  if (issue.startOffset < issue.endOffset) {
    return {
      start: issue.startOffset,
      end: issue.endOffset,
    };
  }

  const fragment = issue.originalText.trim();
  if (!fragment) {
    return null;
  }

  const exactIndex = text.indexOf(fragment);
  if (exactIndex >= 0) {
    return {
      start: exactIndex,
      end: exactIndex + fragment.length,
    };
  }

  const parts = fragment
    .replace(/[–—−]/g, "-")
    .replace(/[«»“”„"]/g, "\"")
    .replace(/[’]/g, "'")
    .split(/[^\p{L}\p{N}%+/#.-]+/u)
    .filter(Boolean);
  if (!parts.length) {
    return findLineLevelMatch(text, fragment);
  }

  const pattern = parts.map((part) => escapeRegExp(part)).join(`[\\s\\u00A0,.;:!?()\\[\\]{}«»"'“”\`~…/\\\\|\\-–—]*`);
  const regex = new RegExp(pattern, "iu");
  const match = regex.exec(text);
  if (!match || match.index < 0) {
    return findLineLevelMatch(text, fragment);
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
  };
}

function replaceIssueInDocument(
  document: ResumeDocument,
  issue: ResumeIssue,
  replacement: string,
  startOffset = issue.startOffset,
  endOffset = issue.endOffset,
): ResumeDocument {
  const diff = replacement.length - (endOffset - startOffset);

  return {
    ...document,
    sections: document.sections.map((section) => {
      const blocks = section.blocks.map((block) => {
        if (endOffset <= block.startOffset) {
          return {
            ...block,
            startOffset: block.startOffset + diff,
            endOffset: block.endOffset + diff,
          };
        }

        if (startOffset >= block.endOffset) {
          return block;
        }

        const localStart = Math.max(0, startOffset - block.startOffset);
        const localEnd = Math.min(block.text.length, endOffset - block.startOffset);

        return {
          ...block,
          text: replaceTextRange(block.text, localStart, localEnd, replacement),
          endOffset: block.endOffset + diff,
        };
      });

      return {
        ...section,
        content: blocks.map((block) => block.text).join("\n"),
        blocks,
      };
    }),
  };
}

function applyIssueReplacementLocally(
  resume: ResumeRecord,
  issues: ResumeIssue[],
  issueId: string,
): { resume: ResumeRecord; issues: ResumeIssue[] } | null {
  const issue = issues.find((item) => item.id === issueId);
  if (!issue?.suggestedText?.trim()) {
    return null;
  }

  const range = resolveIssueRange(resume.normalizedText, issue);
  if (!range) {
    return null;
  }

  const replacement = issue.suggestedText.trim();
  const diff = replacement.length - (range.end - range.start);

  const nextResume: ResumeRecord = {
    ...resume,
    rawText: replaceTextRange(resume.rawText, range.start, range.end, replacement),
    normalizedText: replaceTextRange(
      resume.normalizedText,
      range.start,
      range.end,
      replacement,
    ),
    documentJson: replaceIssueInDocument(resume.documentJson, issue, replacement, range.start, range.end),
    updatedAt: new Date().toISOString(),
  };

  const nextIssues = issues.map((item) => {
    if (item.id === issue.id) {
      return {
        ...item,
        status: "applied" as const,
        originalText: replacement,
        startOffset: range.start,
        endOffset: range.start + replacement.length,
      };
    }

    if (item.startOffset >= range.end) {
      return {
        ...item,
        startOffset: item.startOffset + diff,
        endOffset: item.endOffset + diff,
      };
    }

    if (item.startOffset < range.end && item.endOffset > range.start) {
      return {
        ...item,
        status: item.status === "open" ? ("rejected" as const) : item.status,
        startOffset: 0,
        endOffset: 0,
      };
    }

    return item;
  });

  return {
    resume: nextResume,
    issues: nextIssues,
  };
}

function isBulletLine(line: string) {
  return /^[-•—]\s+/.test(line.trim());
}

function buildSegments(text: string, issues: ResolvedResumeIssue[], baseOffset = 0): TextSegment[] {
  if (!text) {
    return [];
  }

  const relevantIssues = issues
    .map((issue) => ({
      issue,
      start: clampOffset(issue.resolvedStart - baseOffset, text.length),
      end: clampOffset(issue.resolvedEnd - baseOffset, text.length),
    }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const item of relevantIssues) {
    if (item.end <= cursor) {
      continue;
    }

    if (item.start > cursor) {
      segments.push({
        key: `plain-${baseOffset}-${cursor}-${item.start}`,
        text: text.slice(cursor, item.start),
        issue: null,
      });
    }

    const safeStart = Math.max(cursor, item.start);
    segments.push({
      key: item.issue.id,
      text: text.slice(safeStart, item.end),
      issue: item.issue,
    });
    cursor = item.end;
  }

  if (cursor < text.length) {
    segments.push({
      key: `plain-${baseOffset}-${cursor}-${text.length}`,
      text: text.slice(cursor),
      issue: null,
    });
  }

  return segments.length
    ? segments
    : [
        {
          key: `plain-${baseOffset}-full`,
          text,
          issue: null,
        },
      ];
}

async function extractErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string | string[]; error?: string }
      | null;

    if (Array.isArray(data?.message)) {
      return data.message.join(". ");
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  }

  const text = await response.text().catch(() => "");
  const trimmed = text.trim();

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return "Сервис анализа временно недоступен или отвечает слишком долго. Попробуйте еще раз.";
  }

  if (/^\s*<!doctype html/i.test(trimmed) || /^\s*<html/i.test(trimmed)) {
    return "Сервис вернул некорректный ответ. Попробуйте еще раз.";
  }
  return trimmed || "Не удалось выполнить запрос.";
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new HttpError(response.status, await extractErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

function renderSegmentNodes(
  segments: TextSegment[],
  selectedIssueId: string | null,
  onOpenMenu: (issueId: string, target?: HTMLElement | null) => void,
  onHover: (event: MouseEvent<HTMLElement>, issueId: string) => void,
  onLeave: (issueId: string) => void,
) {
  return segments.map((segment) => {
    if (!segment.issue) {
      return <span key={segment.key}>{segment.text}</span>;
    }

    return (
      <mark
        key={segment.key}
        className={`resume-highlight resume-highlight--${segment.issue.severity} ${
          selectedIssueId === segment.issue.id ? "is-selected" : ""
        }`}
        data-issue-id={segment.issue.id}
        onMouseEnter={(event) => onHover(event, segment.issue!.id)}
        onMouseLeave={() => onLeave(segment.issue!.id)}
        onClick={(event) => onOpenMenu(segment.issue!.id, event.currentTarget)}
      >
        {segment.text}
      </mark>
    );
  });
}

function renderBlockContent(
  section: ResumeDocumentSection,
  block: ResumeDocumentSection["blocks"][number],
  issues: ResolvedResumeIssue[],
  selectedIssueId: string | null,
  onOpenMenu: (issueId: string, target?: HTMLElement | null) => void,
  onHover: (event: MouseEvent<HTMLElement>, issueId: string) => void,
  onLeave: (issueId: string) => void,
) {
  const lines = block.text.split("\n").filter((line) => line.trim());
  if (!lines.length) {
    return null;
  }

  if (section.type === "header") {
    const [name, role, ...contacts] = lines;

    return (
      <>
        {name ? (
          <h1 className="resume-doc__name">
            {renderSegmentNodes(
              buildSegments(name, issues, block.startOffset),
              selectedIssueId,
              onOpenMenu,
              onHover,
              onLeave,
            )}
          </h1>
        ) : null}
        {role ? (
          <p className="resume-doc__role">
            {renderSegmentNodes(
              buildSegments(role, issues, block.startOffset + name.length + 1),
              selectedIssueId,
              onOpenMenu,
              onHover,
              onLeave,
            )}
          </p>
        ) : null}
        {contacts.length ? (
          <div className="resume-doc__contacts">
            {contacts.map((line, index) => {
              const startOffset =
                block.startOffset +
                name.length +
                1 +
                (role ? role.length + 1 : 0) +
                contacts.slice(0, index).reduce((sum, current) => sum + current.length + 1, 0);
              return (
                <p key={`${block.id}-contact-${index}`}>
                  {renderSegmentNodes(
                    buildSegments(line, issues, startOffset),
                    selectedIssueId,
                    onOpenMenu,
                    onHover,
                    onLeave,
                  )}
                </p>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  if (lines.every(isBulletLine)) {
    return (
      <ul className="resume-doc__bullet-list">
        {lines.map((line, index) => {
          const cleaned = line.replace(/^[-•—]\s+/, "");
          const startOffset =
            block.startOffset + block.text.indexOf(line) + (line.length - cleaned.length);
          return (
            <li key={`${block.id}-bullet-${index}`}>
              {renderSegmentNodes(
                buildSegments(cleaned, issues, startOffset),
                selectedIssueId,
                onOpenMenu,
                onHover,
                onLeave,
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (section.type === "experience") {
    const [heading, ...rest] = lines;
    return (
      <div className="resume-doc__experience-block">
        <h3>
          {renderSegmentNodes(
            buildSegments(heading, issues, block.startOffset),
            selectedIssueId,
            onOpenMenu,
            onHover,
            onLeave,
          )}
        </h3>
        {rest.map((line, index) => {
          const bullet = isBulletLine(line);
          const cleaned = bullet ? line.replace(/^[-•—]\s+/, "") : line;
          const startOffset =
            block.startOffset + block.text.indexOf(line) + (bullet ? line.length - cleaned.length : 0);
          return bullet ? (
            <ul key={`${block.id}-experience-list-${index}`} className="resume-doc__bullet-list">
              <li>
                {renderSegmentNodes(
                  buildSegments(cleaned, issues, startOffset),
                  selectedIssueId,
                  onOpenMenu,
                  onHover,
                  onLeave,
                )}
              </li>
            </ul>
          ) : (
            <p key={`${block.id}-experience-line-${index}`}>
              {renderSegmentNodes(
                buildSegments(cleaned, issues, startOffset),
                selectedIssueId,
                onOpenMenu,
                onHover,
                onLeave,
              )}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="resume-doc__paragraph-block">
      {lines.map((line, index) => {
        const startOffset = block.startOffset + block.text.indexOf(line);
        return (
          <p key={`${block.id}-line-${index}`}>
            {renderSegmentNodes(
              buildSegments(line, issues, startOffset),
              selectedIssueId,
              onOpenMenu,
              onHover,
              onLeave,
            )}
          </p>
        );
      })}
    </div>
  );
}

interface ResumeWorkspaceProps {
  apiBase: string;
  initialMode?: string | null;
}

export function ResumeWorkspace({ apiBase, initialMode }: ResumeWorkspaceProps) {
  const initialScreen: ResumeScreen =
    initialMode === "path-select" ? "path-select" : initialMode === "workspace" ? "upload" : "overview";
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<ResumeScreen>(initialScreen);
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null);
  const [issues, setIssues] = useState<ResumeIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState("");
  const [seniorityDraft, setSeniorityDraft] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [errorState, setErrorState] = useState<ScreenError | null>(null);
  const [hoverHint, setHoverHint] = useState<HoverHint | null>(null);
  const [contextMenu, setContextMenu] = useState<IssueContextMenu | null>(null);
  const [applyingIssueId, setApplyingIssueId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [problemFilter, setProblemFilter] = useState<ProblemFilter>("all");
  const [problemQuery, setProblemQuery] = useState("");
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reviewRootRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const syncUser = async () => {
      try {
        const response = await fetch(`${apiBase}/auth/me`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setScreen(initialScreen);
          }
          return;
        }

        const payload = (await response.json().catch(() => null)) as { user?: { id: string } } | null;

        if (!cancelled) {
          setScreen(initialScreen);
        }
      } catch {
        if (!cancelled) {
          setScreen(initialScreen);
          setErrorState(null);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    };

    syncUser();

    return () => {
      cancelled = true;
    };
  }, [apiBase, initialScreen]);

  useEffect(() => {
    if (!selectedIssueId) {
      setMobileSheetOpen(false);
      return;
    }

    setMobileSheetOpen(true);
  }, [selectedIssueId]);

  useEffect(() => {
    if (!unavailableDialogOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUnavailableDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [unavailableDialogOpen]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | globalThis.MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    const handleScroll = () => {
      setContextMenu(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  const openIssues = useMemo(
    () => issues.filter((issue) => issue.status === "open"),
    [issues],
  );
  const resolvedOpenIssues = useMemo<ResolvedResumeIssue[]>(() => {
    if (!activeResume) {
      return [];
    }

    return openIssues
      .map((issue) => {
        const range = resolveIssueRange(activeResume.normalizedText, issue);
        if (!range) {
          return null;
        }

        return {
          ...issue,
          resolvedStart: range.start,
          resolvedEnd: range.end,
        };
      })
      .filter((issue): issue is ResolvedResumeIssue => Boolean(issue));
  }, [activeResume, openIssues]);

  const selectedIssue = useMemo(
    () => resolvedOpenIssues.find((issue) => issue.id === selectedIssueId) ?? null,
    [resolvedOpenIssues, selectedIssueId],
  );
  const contextMenuIssue = useMemo(
    () => resolvedOpenIssues.find((issue) => issue.id === contextMenu?.issueId) ?? null,
    [resolvedOpenIssues, contextMenu],
  );

  const sections = useMemo(() => activeResume?.documentJson.sections ?? [], [activeResume]);
  const headerSection = sections.find((section) => section.type === "header") ?? null;
  const contentSections = sections.filter((section) => section.type !== "header");
  const sectionOrder = useMemo(
    () => new Map(sections.map((section, index) => [section.type, index])),
    [sections],
  );
  const panelIssues = useMemo(() => {
    const query = problemQuery.trim().toLowerCase();
    const severityWeight: Record<ResumeIssue["severity"], number> = {
      error: 0,
      warning: 1,
      suggestion: 2,
    };

    return [...resolvedOpenIssues]
      .filter((issue) => problemFilter === "all" || issue.severity === problemFilter)
      .filter((issue) => {
        if (!query) {
          return true;
        }

        const haystack = [
          issue.title,
          issue.section,
          issue.description,
          issue.reason,
          issue.originalText,
          issue.suggestedText ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => {
        const sectionDelta = (sectionOrder.get(left.section) ?? 999) - (sectionOrder.get(right.section) ?? 999);
        if (sectionDelta) {
          return sectionDelta;
        }

        const severityDelta = severityWeight[left.severity] - severityWeight[right.severity];
        if (severityDelta) {
          return severityDelta;
        }

        return left.title.localeCompare(right.title, "ru");
      });
  }, [resolvedOpenIssues, problemFilter, problemQuery, sectionOrder]);
  const groupedPanelIssues = useMemo(() => {
    const groups = new Map<string, ResumeIssue[]>();

    for (const issue of panelIssues) {
      const key = issue.section || "other";
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(issue);
      } else {
        groups.set(key, [issue]);
      }
    }

    return Array.from(groups.entries());
  }, [panelIssues]);
  useEffect(() => {
    if (!resolvedOpenIssues.length) {
      setSelectedIssueId(null);
      return;
    }

    if (!selectedIssueId || !resolvedOpenIssues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(resolvedOpenIssues[0]?.id ?? null);
    }
  }, [resolvedOpenIssues, selectedIssueId]);

  useEffect(() => {
    if (!panelIssues.length) {
      return;
    }

    if (!selectedIssueId || !panelIssues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(panelIssues[0]?.id ?? null);
    }
  }, [panelIssues, selectedIssueId]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetWorkspace = (nextScreen: ResumeScreen) => {
    setScreen(nextScreen);
    setActiveResume(null);
    setIssues([]);
    setSelectedIssueId(null);
    setRoleDraft("");
    setSeniorityDraft("");
    setErrorState(null);
    setHoverHint(null);
    setContextMenu(null);
    setUnavailableDialogOpen(false);
  };

  const resetToOverview = () => {
    resetWorkspace(initialScreen);
  };

  const resetToUpload = () => {
    resetWorkspace("upload");
  };

  const openPathSelect = () => {
    setUnavailableDialogOpen(false);
    setScreen("path-select");
  };

  const openResumeBuilderUnavailable = () => {
    setUnavailableDialogOpen(true);
  };

  const startAiAnalysisFlow = () => {
    resetWorkspace("upload");
  };

  const handleRequestError = (error: unknown, fallback: string, returnTo: ResumeScreen) => {
    if (error instanceof HttpError && error.status === 401) {
      setScreen("unauthorized");
      return;
    }

    setScreen("error");
    setErrorState({
      title: "Сценарий остановлен",
      message: error instanceof Error ? error.message : fallback,
      returnTo,
    });
  };

  const startDemoFlow = () => {
    setActiveResume(demoResume);
    setIssues([]);
    setSelectedIssueId(null);
    setRoleDraft(demoResume.confirmedRole ?? demoResume.detectedRole ?? "");
    setSeniorityDraft(demoResume.detectedSeniority ?? "");
    setHoverHint(null);
    setContextMenu(null);
    setUnavailableDialogOpen(false);
    setScreen("confirm-profile");
  };

  const uploadFile = async (file: File) => {
    setDragActive(false);
    setHoverHint(null);
    setErrorState(null);
    setScreen("loading-profile");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBase}/resume/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const record = await parseJson<ResumeRecord>(response);
      setActiveResume(record);
      setIssues([]);
      setSelectedIssueId(null);
      setContextMenu(null);
      setRoleDraft(record.confirmedRole ?? record.detectedRole ?? "");
      setSeniorityDraft(record.detectedSeniority ?? "");
      setScreen("confirm-profile");
    } catch (error) {
      handleRequestError(error, "Не удалось загрузить резюме.", "upload");
    }
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleConfirmProfile = async () => {
    if (!activeResume) {
      return;
    }

    if (activeResume.id === demoResume.id) {
      setScreen("loading-review");
      window.setTimeout(() => {
        setActiveResume({
          ...demoResume,
          confirmedRole: roleDraft || demoResume.confirmedRole,
          detectedSeniority: seniorityDraft || demoResume.detectedSeniority,
        });
        setIssues(demoIssues);
        setSelectedIssueId(demoIssues[0]?.id ?? null);
        setContextMenu(null);
        setScreen("review");
      }, 700);
      return;
    }

    setHoverHint(null);
    setContextMenu(null);
    setErrorState(null);
    setScreen("loading-review");

    const reviewController = new AbortController();
    const reviewTimeoutId = window.setTimeout(() => {
      reviewController.abort();
    }, 60_000);

    try {
      const roleResponse = await fetch(`${apiBase}/resume/${activeResume.id}/role`, {
        method: "PATCH",
        credentials: "include",
        signal: reviewController.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmedRole: roleDraft.trim() || null,
          confirmedSeniority: seniorityDraft.trim() || null,
        }),
      });
      const updatedResume = await parseJson<ResumeRecord>(roleResponse);

      const analyzeResponse = await fetch(`${apiBase}/resume/${activeResume.id}/analyze`, {
        method: "POST",
        credentials: "include",
        signal: reviewController.signal,
      });
      const analysis = await parseJson<{ resume: ResumeRecord; issues: ResumeIssue[] }>(analyzeResponse);

      setActiveResume(analysis.resume ?? updatedResume);
      setIssues(analysis.issues ?? []);
      setSelectedIssueId((analysis.issues ?? [])[0]?.id ?? null);
      setContextMenu(null);
      setScreen("review");
    } catch (error) {
      if (reviewController.signal.aborted) {
        handleRequestError(
          new RequestTimeoutError("Формирование review-экрана заняло больше минуты. Попробуйте ещё раз."),
          "Не удалось завершить анализ резюме.",
          "confirm-profile",
        );
        return;
      }

      handleRequestError(error, "Не удалось завершить анализ резюме.", "confirm-profile");
    } finally {
      window.clearTimeout(reviewTimeoutId);
    }
  };

  const focusIssue = (issueId: string, target?: HTMLElement | null) => {
    setSelectedIssueId(issueId);
    setContextMenu(null);

    const node =
      target ??
      reviewRootRef.current?.querySelector<HTMLElement>(`[data-issue-id="${CSS.escape(issueId)}"]`) ??
      null;

    node?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  };

  const openIssueMenu = (issueId: string, target?: HTMLElement | null) => {
    setSelectedIssueId(issueId);

    if (!target) {
      setContextMenu(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const menuWidth = 360;
    const nextLeft = Math.min(
      window.innerWidth - menuWidth - 16,
      Math.max(16, rect.left),
    );
    const nextTop = Math.min(window.innerHeight - 16, rect.bottom + 8);

    setContextMenu({
      issueId,
      top: nextTop,
      left: nextLeft,
    });
  };

  const applyIssueReplacement = async (issueId: string) => {
    if (!activeResume) {
      return;
    }

    const targetIssue = issues.find((issue) => issue.id === issueId);
    if (!targetIssue?.suggestedText?.trim()) {
      return;
    }

    const previousResume = activeResume;
    const previousIssues = issues;
    const previousSelectedIssueId = selectedIssueId;
    const localResult = applyIssueReplacementLocally(activeResume, issues, issueId);
    if (!localResult) {
      return;
    }

    setApplyingIssueId(issueId);
    setActiveResume(localResult.resume);
    setIssues(localResult.issues);
    setSelectedIssueId(localResult.issues.find((issue) => issue.status === "open")?.id ?? null);
    setContextMenu(null);
    setHoverHint(null);

    try {
      if (activeResume.id !== demoResume.id) {
        const response = await fetch(`${apiBase}/resume/${activeResume.id}/issues/${issueId}/apply`, {
          method: "POST",
          credentials: "include",
        });
        const analysis = await parseJson<{ resume: ResumeRecord; issues: ResumeIssue[] }>(response);
        setActiveResume(analysis.resume);
        setIssues(analysis.issues ?? []);
        setSelectedIssueId((analysis.issues ?? []).find((issue) => issue.status === "open")?.id ?? null);
      }
    } catch (error) {
      setActiveResume(previousResume);
      setIssues(previousIssues);
      setSelectedIssueId(previousSelectedIssueId);
      handleRequestError(error, "Не удалось применить замену.", "review");
    } finally {
      setApplyingIssueId(null);
    }
  };

  const handleHoverIssue = (event: MouseEvent<HTMLElement>, issueId: string) => {
    setHoverHint({
      issueId,
      rect: event.currentTarget.getBoundingClientRect(),
    });
  };

  const handleLeaveIssue = (issueId: string) => {
    setHoverHint((current) => (current?.issueId === issueId ? null : current));
  };

  const renderReplacementList = (issue: ResumeIssue) =>
    issue.suggestedText?.trim() ? (
      <div className="resume-detail-panel__actions">
        <button
          type="button"
          className="resume-context-menu__option"
          onClick={() => applyIssueReplacement(issue.id)}
          disabled={applyingIssueId === issue.id}
        >
          <span>Заменить на</span>
          <code>{issue.suggestedText}</code>
        </button>
      </div>
    ) : (
      <p className="resume-detail-panel__note">
        Для этого замечания пока нет готовой замены.
      </p>
    );

  const renderIssueCard = (issue: ResumeIssue) => (
    <button
      key={issue.id}
      type="button"
      className={`resume-problem-item ${selectedIssueId === issue.id ? "is-selected" : ""}`}
      onClick={() => focusIssue(issue.id)}
    >
      <span className={`resume-problem-item__icon resume-problem-item__icon--${issue.severity}`} aria-hidden="true">
        {issue.severity === "error" ? "!" : issue.severity === "warning" ? "!" : "·"}
      </span>
      <div className="resume-problem-item__body">
        <div className="resume-problem-item__top">
          <strong>{issue.title}</strong>
          <span className={`resume-problem-item__status resume-problem-item__status--${issue.status}`}>
            {issueStatusLabel(issue.status)}
          </span>
        </div>
        <div className="resume-problem-item__meta">
          <span>{sectionLabel(issue.section)}</span>
        </div>
        <p>{excerpt(issue.originalText || issue.description, 74)}</p>
      </div>
    </button>
  );

  const renderProblemsPanel = () => (
    <div className="resume-problems-panel">
      <div className="resume-problems-panel__head">
        <strong>Проблемы ({panelIssues.length})</strong>
        <button
          type="button"
          className="resume-rail__toggle"
          onClick={() => setLeftRailCollapsed(true)}
          aria-label="Скрыть список проблем"
        >
          <span aria-hidden="true">-</span>
        </button>
      </div>

      <div className="resume-problems-panel__filters" role="tablist" aria-label="Фильтры по типу замечаний">
        {[
          ["all", "Все"],
          ["error", "Ошибки"],
          ["warning", "Предупреждения"],
          ["suggestion", "Советы"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`resume-problems-panel__filter ${problemFilter === value ? "is-active" : ""}`}
            onClick={() => setProblemFilter(value as ProblemFilter)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="resume-problems-panel__search">
        <input
          type="search"
          value={problemQuery}
          onChange={(event) => setProblemQuery(event.target.value)}
          placeholder="Поиск по замечаниям"
          aria-label="Поиск по замечаниям"
        />
      </label>

      <div className="resume-problems-panel__groups">
        {groupedPanelIssues.length ? (
          groupedPanelIssues.map(([section, sectionIssues]) => (
            <section key={section} className="resume-problems-group">
              <div className="resume-problems-group__head">
                <strong>{sectionLabel(section)}</strong>
                <span>{sectionIssues.length}</span>
              </div>
              <div className="resume-problems-group__list">
                {sectionIssues.map(renderIssueCard)}
              </div>
            </section>
          ))
        ) : (
          <p className="resume-problems-panel__empty">По выбранным условиям проблем не найдено.</p>
        )}
      </div>
    </div>
  );

  const renderSection = (section: ResumeDocumentSection) => {
    if (section.type === "header" && headerSection) {
      return (
        <section key={section.id} className="resume-doc__header">
          {section.blocks.map((block) => (
            <div key={block.id}>
                {renderBlockContent(
                  section,
                  block,
                  resolvedOpenIssues,
                  selectedIssueId,
                  openIssueMenu,
                  handleHoverIssue,
                handleLeaveIssue,
              )}
            </div>
          ))}
        </section>
      );
    }

    return (
      <section key={section.id} className={`resume-doc__section resume-doc__section--${section.type}`}>
        {sectionTitle(section) ? <h2>{sectionTitle(section)}</h2> : null}
        <div className="resume-doc__section-body">
          {section.blocks.map((block) => (
            <div key={block.id}>
                {renderBlockContent(
                  section,
                  block,
                  resolvedOpenIssues,
                  selectedIssueId,
                  openIssueMenu,
                  handleHoverIssue,
                handleLeaveIssue,
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

  if (booting) {
    return (
      <section className="resume-flow">
        <div className="resume-loader-screen">
          <div className="resume-loader" aria-hidden="true" />
          <strong>Проверяем доступ</strong>
          <p>Подготавливаем пространство для разбора резюме.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="resume-flow">
      {screen === "overview" && (
        <div className="resume-overview-screen">
          <div className="resume-overview-card">
            <div className="resume-overview-card__brand">
              <OverviewWordmark />
            </div>
            <div className="resume-overview-card__progress" aria-hidden="true">
              <span />
            </div>

            <div className="resume-overview-card__copy">
              <h1>Ускорьте карьеру с AI-подбором работы</h1>
              <p>
                Более 50 000 соискателей нашли работу мечты с нашей платформой. Мы совмещаем ИИ и
                персональную поддержку для быстрого успеха. <strong>Результаты говорят сами за себя!</strong>
              </p>
            </div>

            <div className="resume-overview-compare">
              <article className="resume-overview-panel resume-overview-panel--before">
                <span className="resume-overview-panel__badge">До</span>
                <div className="resume-overview-panel__person resume-overview-panel__person--before">
                  <img src="/promo/illustrations/resume-flow/before.png" alt="До анализа резюме" />
                </div>
                <div className="resume-overview-panel__floating-card">
                  <span className="resume-overview-panel__emoji resume-overview-panel__emoji--before" aria-hidden="true">
                    😔
                  </span>
                  <div className="resume-overview-panel__logos">
                    <span className="resume-overview-panel__logo-linkedin">LinkedIn</span>
                    <span className="resume-overview-panel__logo-indeed">indeed</span>
                  </div>
                  <ul>
                    {overviewResumeProblems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="resume-overview-panel resume-overview-panel--after">
                <span className="resume-overview-panel__badge resume-overview-panel__badge--after">После</span>
                <div className="resume-overview-panel__person resume-overview-panel__person--after">
                  <img src="/promo/illustrations/resume-flow/after.png" alt="После анализа резюме" />
                </div>
                <span className="resume-overview-panel__emoji resume-overview-panel__emoji--after" aria-hidden="true">
                  🤩
                </span>
                <div className="resume-overview-panel__floating-card">
                  <div className="resume-overview-panel__logos resume-overview-panel__logos--brand">
                    <OverviewWordmark size="sm" />
                  </div>
                  <ul>
                    {overviewResumeBoosts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            <p className="resume-overview-stats__label">За последние 24 часа:</p>
            <div className="resume-overview-stats">
              <article className="resume-overview-stat-card resume-overview-stat-card--warm">
                <strong>475 человек получили приглашения на собеседования</strong>
                <div className="resume-overview-stat-card__chips">
                  {overviewInviteProof.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>

              <article className="resume-overview-stat-card resume-overview-stat-card--cool">
                <strong>177 человек нашли работу</strong>
                <div className="resume-overview-stat-card__chips">
                  {overviewResumeProof.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            </div>

            <div className="resume-overview-card__actions">
              <button className="resume-overview-card__next" type="button" onClick={openPathSelect}>
                Далее
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "path-select" && (
        <div className="resume-path-screen">
          <div className="resume-path-grid">
            <div
              className="resume-path-card resume-path-card--builder resume-path-card--interactive"
              role="button"
              tabIndex={0}
              onClick={openResumeBuilderUnavailable}
              onKeyDown={(event) => handleActionCardKeyDown(event, openResumeBuilderUnavailable)}
              aria-haspopup="dialog"
              aria-label="Создатель резюме на основе ИИ"
            >
              <div className="resume-path-card__header">
                <span className="resume-path-card__eyebrow">Подготовьтесь</span>
                <span className="resume-path-card__trigger" aria-hidden="true">
                  →
                </span>
              </div>
              <h2>Создатель резюме на основе ИИ</h2>
              <p>
                Создавайте резюме и сопроводительные письма для каждой вакансии на основе ваших
                навыков и опыта.
              </p>

              <div className="resume-path-card__meta">
                <div className="resume-path-card__social-proof" aria-hidden="true">
                  <div className="resume-path-card__avatars">
                    {[1, 2, 3].map((item) => (
                      <span
                        key={item}
                        className={`resume-path-card__avatar resume-path-card__avatar--${item}`}
                      />
                    ))}
                  </div>
                  <span>Нравится 1,166,440 пользователям</span>
                </div>
              </div>

              <div className="resume-path-builder-preview">
                <div className="resume-path-builder-preview__glow" aria-hidden="true" />
                <div className="resume-path-builder-preview__sheet">
                  <div className="resume-path-builder-preview__toolbar">
                    <span>Los Altos, CA</span>
                    <span>steve@apple.com</span>
                    <span>linkedin.com/stevejobs</span>
                  </div>
                  <h3>Стив Джобс</h3>
                  <div className="resume-path-builder-preview__lines">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

                <div className="resume-path-builder-preview__prompt">
                  <span>Сделать менее многословным |</span>
                  <span className="resume-path-builder-preview__spark" aria-hidden="true">
                    ✣
                  </span>
                </div>
              </div>
            </div>

            <div
              className="resume-path-card resume-path-card--analysis resume-path-card--interactive"
              role="button"
              tabIndex={0}
              onClick={startAiAnalysisFlow}
              onKeyDown={(event) => handleActionCardKeyDown(event, startAiAnalysisFlow)}
              aria-label="Перейти к ИИ-анализу резюме"
            >
              <div className="resume-path-card__header">
                <span className="resume-path-card__eyebrow">Проанализируйте</span>
                <span className="resume-path-card__trigger" aria-hidden="true">
                  →
                </span>
              </div>
              <h2>ИИ-анализ резюме</h2>
              <p>
                Загрузите резюме и получите редакторский разбор с подсветкой проблемных мест,
                замечаниями по ATS и готовыми заменами.
              </p>

              <div className="resume-path-card__meta">
                <div className="resume-path-card__stat">372 241+ проверенных резюме</div>
              </div>

              <div className="resume-path-analysis-preview">
                <div className="resume-path-analysis-preview__glow" aria-hidden="true" />
                {analysisPreviewCards.map((card, index) => (
                  <article
                    key={`${card.title}-${index}`}
                    className={`resume-path-analysis-item resume-path-analysis-item--${card.accent}`}
                  >
                    <div className="resume-path-analysis-item__icon">{card.icon}</div>
                    <div className="resume-path-analysis-item__body">
                      <div className="resume-path-analysis-item__head">
                        <strong>{card.title}</strong>
                        <span>{card.meta}</span>
                      </div>
                      <p>{card.subtitle}</p>
                      <div className="resume-path-analysis-item__tags">
                        {card.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={`resume-path-analysis-item__status resume-path-analysis-item__status--${card.statusTone}`}
                    >
                      {card.status}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "upload" && (
        <div className="resume-upload-screen">
          <div className="resume-upload-screen__intro">
            <p className="resume-flow__eyebrow">Resume review</p>
            <h1>Загрузите резюме и получите жёсткий редакторский разбор</h1>
            <p>
              Сначала определяем профессию и грейд, затем показываем документ как чистый лист A4 и
              подсвечиваем сомнительные места прямо в тексте.
            </p>
          </div>

          <div className="resume-upload-screen__actions">
            <button className="btn btn-primary" type="button" onClick={openFilePicker}>
              Выбрать файл
            </button>
            <button className="btn btn-secondary" type="button" onClick={startDemoFlow}>
              Тестовое резюме
            </button>
          </div>

          <div
            className={`resume-dropzone ${dragActive ? "is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setDragActive(false);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="resume-dropzone__meta">
              <span>PDF / DOCX / TXT</span>
              <span>Gemini-анализ</span>
            </div>
            <strong>Перетащите резюме сюда</strong>
            <p>
              Документ будет разобран и превращён в читаемый review-layout. Исходный текст сохраняется,
              но визуал документа собирается заново для нормального чтения.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="resume-file-input"
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {screen === "loading-profile" && (
        <div className="resume-loader-screen">
          <div className="resume-loader" aria-hidden="true" />
          <strong>Подождите, идёт первичный анализ</strong>
          <p>Извлекаем текст и определяем профессию, грейд и структуру документа.</p>
        </div>
      )}

      {screen === "confirm-profile" && activeResume && (
        <div className="resume-confirm-screen">
          <div className="resume-confirm-screen__intro">
            <p className="resume-flow__eyebrow">Profile confirmation</p>
            <h2>Подтвердите профессию и уровень</h2>
            <p>Эти данные влияют на то, как система будет оценивать формулировки и достижения.</p>
          </div>

          <div className="resume-confirm-card">
            <div className="resume-confirm-card__grid">
              <label>
                <span>Профессия</span>
                <input
                  type="text"
                  value={roleDraft}
                  onChange={(event) => setRoleDraft(event.target.value)}
                  placeholder="Например: Product Manager"
                />
              </label>

              <label>
                <span>Грейд</span>
                <select
                  value={seniorityDraft}
                  onChange={(event) => setSeniorityDraft(event.target.value)}
                >
                  <option value="">Не указан</option>
                  {seniorityOptions
                    .filter(Boolean)
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="resume-confirm-card__meta">
              <span>{activeResume.originalFilename ?? activeResume.title}</span>
              <span>{String(activeResume.sourceFormat).toUpperCase()}</span>
            </div>

            <div className="resume-confirm-card__actions">
              <button className="btn btn-primary" type="button" onClick={handleConfirmProfile}>
                Подтвердить и продолжить
              </button>
              <button className="btn btn-secondary" type="button" onClick={resetToUpload}>
                Назад к загрузке
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "loading-review" && (
        <div className="resume-loader-screen">
          <div className="resume-loader" aria-hidden="true" />
          <strong>Формируем review-экран</strong>
          <p>Размечаем документ, подсвечиваем проблемные фрагменты и собираем правые/левые панели.</p>
        </div>
      )}

      {screen === "review" && activeResume && (
        <div className="resume-review-screen" ref={reviewRootRef}>
          <div
            className={`resume-review-layout${leftRailCollapsed ? " is-left-collapsed" : ""}${rightRailCollapsed ? " is-right-collapsed" : ""}`}
          >
            <aside className={`resume-rail resume-rail--left${leftRailCollapsed ? " is-collapsed" : ""}`}>
              {leftRailCollapsed ? (
                <button
                  type="button"
                  className="resume-rail__toggle resume-rail__toggle--collapsed"
                  onClick={() => setLeftRailCollapsed(false)}
                  aria-label="Показать список проблем"
                >
                  <span className="resume-rail__toggle-arrow" aria-hidden="true">
                    +
                  </span>
                  <span className="resume-rail__toggle-label">Проблемы</span>
                </button>
              ) : (
                renderProblemsPanel()
              )}
            </aside>

            <section className="resume-stage">
              <div className="resume-stage__canvas">
                <article className="resume-doc">
                  {headerSection ? renderSection(headerSection) : null}

                  <div className="resume-doc__stack">
                    {contentSections.map(renderSection)}
                  </div>
                </article>
              </div>
            </section>

            <aside className={`resume-rail resume-rail--right${rightRailCollapsed ? " is-collapsed" : ""}`}>
              {rightRailCollapsed ? (
                <button
                  type="button"
                  className="resume-rail__toggle resume-rail__toggle--collapsed"
                  onClick={() => setRightRailCollapsed(false)}
                  aria-label="Показать инспектор"
                >
                  <span className="resume-rail__toggle-arrow" aria-hidden="true">
                    +
                  </span>
                  <span className="resume-rail__toggle-label">Разбор</span>
                </button>
              ) : (
              <div className="resume-detail-panel">
                <div className="resume-detail-panel__head">
                  <strong>Разбор выделенного фрагмента</strong>
                  <div className="resume-detail-panel__controls">
                    {selectedIssue ? (
                      <span className={`resume-detail-panel__severity resume-detail-panel__severity--${selectedIssue.severity}`}>
                        {severityLabel(selectedIssue.severity)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="resume-rail__toggle"
                      onClick={() => setRightRailCollapsed(true)}
                      aria-label="Скрыть инспектор"
                    >
                      <span aria-hidden="true">-</span>
                    </button>
                  </div>
                </div>

                {selectedIssue ? (
                  <div className="resume-detail-panel__body">
                    <h3>{selectedIssue.title}</h3>
                    <div className="resume-detail-panel__block">
                      <span>Фрагмент из резюме</span>
                      <code>{selectedIssue.originalText || "Фрагмент не удалось выделить."}</code>
                    </div>
                    <div className="resume-detail-panel__block">
                      <span>Почему это отмечено</span>
                      <p>{selectedIssue.reason || selectedIssue.description}</p>
                    </div>
                    <div className="resume-detail-panel__block">
                      <span>На что можно заменить</span>
                      {renderReplacementList(selectedIssue)}
                    </div>
                  </div>
                ) : (
                  <p className="resume-detail-panel__empty">
                    Выберите подсвеченный фрагмент в документе или карточку замечания слева/справа.
                  </p>
                )}
              </div>
              )}
            </aside>
          </div>

          <div className="resume-mobile-issues">
            <section className="resume-mobile-issues__group">
              {renderProblemsPanel()}
            </section>
          </div>

          {hoverHint && selectedIssueId !== hoverHint.issueId ? (
            <div
              className="resume-hover-hint"
              style={{
                top: Math.max(12, hoverHint.rect.top - 40),
                left: Math.max(12, hoverHint.rect.left),
              }}
            >
              Нажмите для просмотра
            </div>
          ) : null}

          {contextMenu && contextMenuIssue ? (
            <div
              ref={contextMenuRef}
              className="resume-context-menu"
              style={{
                top: contextMenu.top,
                left: contextMenu.left,
              }}
            >
              <div className="resume-context-menu__head">
                <strong>Замена фрагмента</strong>
                <span className={`resume-context-menu__severity resume-context-menu__severity--${contextMenuIssue.severity}`}>
                  {severityLabel(contextMenuIssue.severity)}
                </span>
              </div>
              {contextMenuIssue.suggestedText?.trim() ? (
                <button
                  type="button"
                  className="resume-context-menu__option"
                  onClick={() => applyIssueReplacement(contextMenuIssue.id)}
                  disabled={applyingIssueId === contextMenuIssue.id}
                >
                  <span>Заменить на</span>
                  <code>{contextMenuIssue.suggestedText}</code>
                </button>
              ) : (
                <p className="resume-context-menu__empty">
                  Для этого замечания пока нет готовой замены.
                </p>
              )}
            </div>
          ) : null}

          {selectedIssue && mobileSheetOpen ? (
            <div className="resume-mobile-sheet" role="dialog" aria-modal="true">
              <button
                type="button"
                className="resume-mobile-sheet__backdrop"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Закрыть окно замечания"
              />
              <div className="resume-mobile-sheet__body">
                <div className="resume-detail-panel__head">
                  <strong>{selectedIssue.title}</strong>
                  <button type="button" onClick={() => setMobileSheetOpen(false)}>
                    Закрыть
                  </button>
                </div>
                <div className="resume-detail-panel__block">
                  <span>Фрагмент из резюме</span>
                  <code>{selectedIssue.originalText || "Фрагмент не удалось выделить."}</code>
                </div>
                <div className="resume-detail-panel__block">
                  <span>Почему это отмечено</span>
                  <p>{selectedIssue.reason || selectedIssue.description}</p>
                </div>
                <div className="resume-detail-panel__block">
                  <span>На что можно заменить</span>
                      {renderReplacementList(selectedIssue)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {screen === "unauthorized" && (
        <div className="resume-state-screen">
          <strong>Требуется вход в аккаунт</strong>
          <p>Сначала войдите через браузер, затем вернитесь в модуль разбора резюме.</p>
          <a className="btn btn-primary" href="/auth/login">
            Войти в аккаунт
          </a>
        </div>
      )}

      {screen === "error" && errorState && (
        <div className="resume-state-screen">
          <strong>{errorState.title}</strong>
          <p>{errorState.message}</p>
          <div className="resume-state-screen__actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                const nextScreen = errorState.returnTo;
                setErrorState(null);
                if (nextScreen === "upload") {
                  resetToUpload();
                  return;
                }
                setScreen(nextScreen);
              }}
            >
              Вернуться назад
            </button>
            <button className="btn btn-secondary" type="button" onClick={resetToOverview}>
              Начать заново
            </button>
          </div>
        </div>
      )}

      {unavailableDialogOpen && (
        <div
          className="resume-dialog-backdrop"
          role="presentation"
          onClick={() => setUnavailableDialogOpen(false)}
        >
          <div
            className="resume-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resume-dialog__icon" aria-hidden="true">
              !
            </div>
            <h2 id="resume-dialog-title">Сервис сейчас недоступен</h2>
            <p>
              Создание резюме на основе ИИ ещё не открыто. Пока можно перейти в сценарий
              ИИ-анализа и загрузить готовое резюме для разбора.
            </p>
            <div className="resume-dialog__actions">
              <button className="btn btn-primary" type="button" onClick={() => setUnavailableDialogOpen(false)}>
                Понятно
              </button>
              <button className="btn btn-secondary" type="button" onClick={startAiAnalysisFlow}>
                Перейти к анализу
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
