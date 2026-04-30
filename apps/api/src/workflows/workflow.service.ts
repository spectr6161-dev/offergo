import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import {
  AI_PLAYGROUND_DEFAULT_TEXT_MODEL,
  generateAiObject,
  generateAiTextResult,
  normalizeAiError,
} from "@offergo/ai";
import { Prisma, prisma } from "@offergo/db";
import { env } from "@offergo/shared";
import { Observable } from "rxjs";
import { z } from "zod";

import {
  RESUME_ANALYSIS_WORKFLOW_TYPE,
  type WorkflowNodeDebug,
  type WorkflowNodeDefinition,
  type WorkflowNodeKey,
  type WorkflowRunSnapshot,
  type WorkflowSseEvent,
  workflowNodeDefinitions,
} from "./workflow.types";

type WorkflowRunWithNodes = Prisma.WorkflowRunGetPayload<{
  include: {
    nodes: true;
  };
}>;

type WorkflowListener = (event: WorkflowSseEvent) => void;

type ResumeAnalysisWorkflowInput = {
  text?: string;
  modelId?: string;
  resumeId?: string;
  persistResults?: boolean;
};

type ResumeChunkType =
  | "raw_block"
  | "header_field"
  | "target_role"
  | "job"
  | "job_header"
  | "work_entry_header"
  | "job_description"
  | "job_stack"
  | "responsibility_bullet"
  | "achievement_bullet"
  | "skill_item"
  | "education_item"
  | "about_paragraph"
  | "project_item"
  | "language_item"
  | "certificate_item"
  | "other_section_item"
  | "section_heading"
  | "other";

type ResumeChunk = {
  id: string;
  type: ResumeChunkType;
  section: string;
  text: string;
  charStart: number;
  charEnd: number;
  parentId?: string;
  meta?: Record<string, unknown>;
};

type DisplayBlock = {
  id: string;
  type:
    | "heading"
    | "paragraph"
    | "list_item"
    | "contact"
    | "section_heading"
    | "empty";
  section: string;
  text: string;
  charStart: number;
  charEnd: number;
  pageIndex?: number;
  source: "cleanText";
};

type AnalysisTask = {
  id: string;
  category: string;
  sectionHint: string;
  charStart: number;
  charEnd: number;
  text: string;
  expectedFindingTypes: string[];
};

type RawResumeBlock = {
  id: string;
  text: string;
  charStart: number;
  charEnd: number;
};

type DocumentOutlineKind =
  | "header"
  | "target_role"
  | "experience"
  | "work_entry"
  | "responsibilities"
  | "achievements"
  | "stack"
  | "education"
  | "skills"
  | "about"
  | "projects"
  | "languages"
  | "certificates"
  | "unknown";

type DocumentOutlineRange = {
  id: string;
  kind: DocumentOutlineKind;
  label: string;
  rawBlockStartId: string;
  rawBlockEndId: string;
  rawBlockIds: string[];
  confidence: number;
};

type MergedSemanticItem = {
  text: string;
  sourceBlockIds: string[];
  charStart: number;
  charEnd: number;
  mergeReason: string;
};

type StructureCoverage = {
  rawBlocksTotal: number;
  referencedRawBlocks: number;
  referencedRatio: number;
  unprocessedRawBlockIds: string[];
};

type StructureRepairResult = {
  structure: ResumeStructure;
  repaired: boolean;
  repairs: Array<{
    type: string;
    jobId?: string;
    sourceBlockIds: string[];
    message: string;
  }>;
  coverageBefore: StructureCoverage;
  coverageAfter: StructureCoverage;
  warnings: string[];
};

type FindingSeverity = "red" | "warning" | "green";

type TypedFinding = {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  sourceBlockId: string | null;
  originalFragment: string | null;
  exactQuote: string | null;
  title: string;
  problem: string;
  whyItMatters: string;
  replacementStrategy: string;
  confidence: number;
};

type FindingCategory =
  | "ats"
  | "structure"
  | "positioning"
  | "summary"
  | "experience"
  | "bullet_quality"
  | "metrics_evidence"
  | "skills"
  | "keywords"
  | "seniority"
  | "market_fit"
  | "language"
  | "readability"
  | "formatting"
  | "consistency"
  | "credibility";

type ReplacementOption = {
  text: string;
  type:
    | "safe_rewrite"
    | "metric_template"
    | "safe"
    | "template"
    | "remove"
    | "move"
    | "add_context";
  usesPlaceholders: boolean;
  isSafe: boolean;
  explanation: string;
};

type ValidatedFinding = TypedFinding & {
  charStart: number | null;
  charEnd: number | null;
  anchorChunkIds?: string[];
  anchorSegments?: Array<{
    blockId: string;
    charStart: number;
    charEnd: number;
  }>;
  sourceBlockIds?: string[];
  anchorStatus: "exact" | "chunk" | "fuzzy" | "section_level" | "missing";
  replacementOptions: ReplacementOption[];
  scoreImpact: number;
  priority: "high" | "medium" | "low";
};

type WorkflowState = Record<string, unknown> & {
  runId: string;
  analysisDate: string;
  plainText?: string;
  cleanText?: string;
  modelId: string;
};

const workflowNodeTimeoutMs = 5 * 60 * 1000;

async function withWorkflowNodeTimeout<T>(
  promise: Promise<T>,
  nodeKey: WorkflowNodeKey,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          `Workflow node "${nodeKey}" timed out after ${workflowNodeTimeoutMs}ms.`,
        ),
      );
    }, workflowNodeTimeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

const demoResumeText = [
  "Иван Петров",
  "Frontend Developer",
  "Опыт: 3 года React, Next.js, TypeScript.",
  "Проекты: CRM, личный кабинет, интеграции с API.",
  "Навыки: React, Tailwind, REST, PostgreSQL.",
].join("\n");

const findingSeverityValues = ["red", "warning", "green"] as const;
const findingCategoryValues = [
  "ats",
  "structure",
  "positioning",
  "summary",
  "experience",
  "bullet_quality",
  "metrics_evidence",
  "skills",
  "keywords",
  "seniority",
  "market_fit",
  "language",
  "readability",
  "formatting",
  "consistency",
  "credibility",
  ] as const;
const replacementTypeValues = [
  "safe_rewrite",
  "metric_template",
  "safe",
  "template",
  "remove",
  "move",
  "add_context",
] as const;

const findingSeveritySchema = z.preprocess(
  normalizeSeverityValue,
  z.enum(findingSeverityValues),
);
const findingCategorySchema = z.preprocess(
  normalizeCategoryValue,
  z.enum(findingCategoryValues),
);

const typedFindingSchema = z.object({
  id: z.string().min(1).nullable().optional(),
  severity: findingSeveritySchema,
  category: findingCategorySchema,
  sourceBlockId: z.string().min(1).nullable(),
  originalFragment: z.string().min(1).nullable(),
  exactQuote: z.string().min(1).nullable().optional(),
  title: z.string().min(3),
  problem: z.string().min(5),
  whyItMatters: z.string().min(5),
  replacementStrategy: z.string().min(3),
  confidence: z.number().min(0).max(1),
});

const analysisFindingsSchema = z.object({
  findings: z.array(typedFindingSchema).max(18),
});

const sourceBlockIdsSchema = z.array(z.string().min(1)).default([]);

const structureTextItemSchema = z.object({
  text: z.string().min(1),
  sourceBlockIds: sourceBlockIdsSchema,
  confidence: z.number().min(0).max(1).optional(),
});

const resumeStructureSchema = z.object({
  header: z.object({
    fields: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
          sourceBlockIds: sourceBlockIdsSchema,
        }),
      )
      .default([]),
  }),
  targetRole: z
    .object({
      text: z.string().min(1),
      normalizedTitle: z.string().nullable(),
      seniority: z.string().nullable(),
      sourceBlockIds: sourceBlockIdsSchema,
      confidence: z.number().min(0).max(1).optional(),
    })
    .nullable(),
  experience: z.object({
    jobs: z
      .array(
        z.object({
          id: z.string().min(1),
          company: z.string().nullable(),
          title: z.string().nullable(),
          period: z.string().nullable(),
          location: z.string().nullable().optional(),
          description: z.string().nullable(),
          responsibilities: z.array(structureTextItemSchema).default([]),
          achievements: z.array(structureTextItemSchema).default([]),
          stack: z.array(structureTextItemSchema).default([]),
          sourceBlockIds: sourceBlockIdsSchema,
          confidence: z.number().min(0).max(1).default(0.5),
          warnings: z.array(z.string()).default([]),
        }),
      )
      .default([]),
  }),
  skills: z.array(structureTextItemSchema).default([]),
  education: z.array(structureTextItemSchema).default([]),
  about: z.array(structureTextItemSchema).default([]),
  otherSections: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        sourceBlockIds: sourceBlockIdsSchema,
      }),
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

type ResumeStructure = z.infer<typeof resumeStructureSchema>;

const normalizedResumeSchema = z.object({
  candidateName: z.string().nullable(),
  candidateTitle: z.string().nullable(),
  totalYearsExperience: z.number().nullable(),
  summary: z.string().nullable(),
  experience: z.array(z.record(z.string(), z.unknown())).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(z.record(z.string(), z.unknown())).default([]),
  projects: z.array(z.record(z.string(), z.unknown())).default([]),
  warnings: z.array(z.string()).default([]),
});

const targetProfileSchema = z.object({
  targetRole: z.string().nullable(),
  seniority: z.string().nullable(),
  marketDomain: z.string().nullable(),
  expectedSkills: z.array(z.string()).default([]),
  importantKeywords: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  missingContext: z.array(z.string()).default([]),
});

const benchmarkContextSchema = z.object({
  requiredElements: z.array(z.string()).default([]),
  strongSignals: z.array(z.string()).default([]),
  weakSignals: z.array(z.string()).default([]),
  expectedEvidence: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  scoringNotes: z.array(z.string()).default([]),
});

const profileContextSchema = z.object({
  normalizedResume: normalizedResumeSchema,
  targetProfile: targetProfileSchema,
  benchmark: benchmarkContextSchema,
});

const replacementOptionSchema = z.object({
  text: z.string().min(1),
  type: z.preprocess(normalizeReplacementTypeValue, z.enum(replacementTypeValues)),
  usesPlaceholders: z.boolean(),
  isSafe: z.boolean(),
  explanation: z.string().min(1),
});

const replacementValidationSchema = z.object({
  replacements: z
    .array(
      z.object({
        findingId: z.string().min(1),
        replacementOptions: z.array(replacementOptionSchema).min(1).max(3),
      }),
    )
    .max(50),
});

function normalizeEnumText(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-zа-яё0-9_]+/gi, "")
    : value;
}

function normalizeSeverityValue(value: unknown) {
  const normalized = normalizeEnumText(value);

  if (typeof normalized !== "string") {
    return value;
  }

  if (
    ["error", "critical", "crit", "high", "major", "blocker", "red"].includes(
      normalized,
    ) ||
    normalized.includes("ошиб") ||
    normalized.includes("крит")
  ) {
    return "red";
  }

  if (
    ["green", "recommend", "recommendation", "advice", "tip", "info", "low", "strength"].includes(
      normalized,
    ) ||
    normalized.includes("совет") ||
    normalized.includes("рекоменд") ||
    normalized.includes("сильн")
  ) {
    return "green";
  }

  return "warning";
}

function normalizeCategoryValue(value: unknown) {
  const normalized = normalizeEnumText(value);

  if (typeof normalized !== "string") {
    return value;
  }

  if ((findingCategoryValues as readonly string[]).includes(normalized)) {
    return normalized;
  }

  const categoryMap: Array<[RegExp, FindingCategory]> = [
    [/ats|parser|machine|parse|screen|tracking/, "ats"],
    [/contact|link|github|linkedin|portfolio|header/, "structure"],
    [/section|layout|order|completeness|complete|education/, "structure"],
    [/position|profile|role|title|target/, "positioning"],
    [/summary|about|intro/, "summary"],
    [/experience|work|job|employment/, "experience"],
    [/bullet|verb|responsib|achievement|result/, "bullet_quality"],
    [/metric|evidence|impact|measure|proof|claim|overclaim/, "metrics_evidence"],
    [/skill|tool|technology|stack|soft/, "skills"],
    [/keyword|key_word|search/, "keywords"],
    [/senior|seniority|lead|mentor|leadership|ownership/, "seniority"],
    [/market|fit|domain/, "market_fit"],
    [/language|english|grammar|spelling/, "language"],
    [/readability|clarity|style|wording|sentence/, "readability"],
    [/format|formatting|visual|list/, "formatting"],
    [/consisten|contradict|date/, "consistency"],
    [/credib|trust|reliable|risk/, "credibility"],
  ];
  const match = categoryMap.find(([pattern]) => pattern.test(normalized));

  return match?.[1] ?? "structure";
}

function normalizeReplacementTypeValue(value: unknown) {
  const normalized = normalizeEnumText(value);

  if (typeof normalized !== "string") {
    return value;
  }

  if ((replacementTypeValues as readonly string[]).includes(normalized)) {
    return normalized;
  }

  if (/metric|placeholder|template/.test(normalized)) {
    return "metric_template";
  }

  if (/remove|delete|удал/.test(normalized)) {
    return "remove";
  }

  if (/move|reorder|перен/.test(normalized)) {
    return "move";
  }

  if (/context|add|добав/.test(normalized)) {
    return "add_context";
  }

  return "safe_rewrite";
}

const analyticalFindingNodeKeys = new Set<string>([
  "ats_format_analysis",
  "structure_completeness_analysis",
  "positioning_summary_analysis",
  "experience_bullet_analysis",
  "metrics_evidence_analysis",
  "skills_keywords_analysis",
  "credibility_consistency_analysis",
  "ats_analysis",
  "structure_positioning_analysis",
  "experience_evidence_analysis",
  "skills_market_analysis",
  "language_readability_analysis",
]);

const reusedAnalysisNodeSources: Record<string, string> = {
  structure_completeness_analysis: "ats_format_analysis",
  positioning_summary_analysis: "ats_format_analysis",
  language_readability_analysis: "ats_format_analysis",
  metrics_evidence_analysis: "experience_bullet_analysis",
  credibility_consistency_analysis: "experience_bullet_analysis",
};

const MAX_EAGER_REPLACEMENT_FINDINGS = 10;

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function toOptionalJson(value: unknown) {
  return value as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getDurationMs(startedAt: Date | null, finishedAt: Date | null) {
  if (!startedAt || !finishedAt) {
    return null;
  }

  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}

function getNextNodeKey(nodeKey: WorkflowNodeKey) {
  const index = workflowNodeDefinitions.findIndex(
    (node) => node.key === nodeKey,
  );
  return workflowNodeDefinitions[index + 1]?.key ?? null;
}

function getNodeDefinition(
  nodeKey: WorkflowNodeKey,
): WorkflowNodeDefinition | undefined {
  return workflowNodeDefinitions.find((node) => node.key === nodeKey) as
    | WorkflowNodeDefinition
    | undefined;
}

function renderPromptTemplate(
  template: string,
  variables: Record<string, string | number>,
) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

function createNodeDebug(
  node: WorkflowNodeDefinition,
  options: {
    modelId?: string;
    promptUser?: string;
  } = {},
): WorkflowNodeDebug {
  const debug: WorkflowNodeDebug = {
    kind: node.kind,
    description: node.description,
    goal: node.goal,
    reads: [...node.reads],
    writes: [...node.writes],
    expectedOutput: node.expectedOutput,
    debugHints: [...node.debugHints],
  };

  if (node.prompt) {
    debug.prompt = {
      system: node.prompt.system,
      user: options.promptUser ?? node.prompt.userTemplate,
      userTemplate: node.prompt.userTemplate,
      modelId: options.modelId ?? "selected_model",
      outputSchemaName: node.prompt.outputSchemaName,
      modelPolicy: node.prompt.modelPolicy,
    };

    if (typeof node.prompt.temperature === "number") {
      debug.prompt.temperature = node.prompt.temperature;
    }
  }

  return debug;
}

function getNodeDebug(
  nodeKey: WorkflowNodeKey,
  options?: {
    modelId?: string;
    promptUser?: string;
  },
) {
  const definition = getNodeDefinition(nodeKey);

  if (!definition) {
    throw new Error(`Unknown workflow node: ${nodeKey}`);
  }

  return createNodeDebug(definition, options);
}

function serializeWorkflowError(error: unknown) {
  const normalized = normalizeAiError(error);

  if (normalized.message !== "Unknown AI error.") {
    return normalized.message;
  }

  if (error instanceof Error && error.message) {
    return error.message.slice(0, 2_000);
  }

  return "Workflow failed.";
}

function getInputText(input: unknown) {
  if (input && typeof input === "object" && "text" in input) {
    const text = (input as { text?: unknown }).text;

    if (typeof text === "string" && text.trim()) {
      return text;
    }
  }

  return demoResumeText;
}

function getInputString(input: unknown, key: string) {
  if (input && typeof input === "object" && key in input) {
    const value = (input as Record<string, unknown>)[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getFinalCleanText(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const cleanText = (output as { cleanText?: unknown }).cleanText;

  if (typeof cleanText === "string" && cleanText.trim()) {
    return cleanText.trim();
  }

  return null;
}

function shouldPersistResumeAnalysis(input: unknown) {
  if (!input || typeof input !== "object" || !("persistResults" in input)) {
    return false;
  }

  return Boolean((input as { persistResults?: unknown }).persistResults);
}

function getResumeAnalysisModelId() {
  return env.RESUME_ANALYSIS_MODEL_ID?.trim() || AI_PLAYGROUND_DEFAULT_TEXT_MODEL;
}

function getLlmModelId(input: unknown) {
  if (input && typeof input === "object" && "modelId" in input) {
    const modelId = (input as { modelId?: unknown }).modelId;

    if (typeof modelId === "string" && modelId.trim()) {
      return modelId.trim();
    }
  }

  return getResumeAnalysisModelId();
}

function getAnalysisDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${byType.year}-${byType.month}-${byType.day}`;
}

function normalizeResumeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function detectLanguage(text: string) {
  const cyrillic = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;

  if (cyrillic === 0 && latin === 0) {
    return "unknown";
  }

  if (cyrillic > latin * 0.4 && latin > cyrillic * 0.4) {
    return "mixed";
  }

  return cyrillic >= latin ? "ru" : "en";
}

function compactState(value: unknown, maxLength = 8_000) {
  const serialized = JSON.stringify(value, null, 2);

  if (serialized.length <= maxLength) {
    return serialized;
  }

  return `${serialized.slice(0, maxLength)}\n...[truncated]`;
}

function compactChunks(chunks: ResumeChunk[], max = 80) {
  return compactState(
    chunks.slice(0, max).map((chunk) => ({
      id: chunk.id,
      type: chunk.type,
      section: chunk.section,
      parentId: chunk.parentId,
      text: chunk.text.slice(0, 500),
    })),
    14_000,
  );
}

function compactRawBlocks(blocks: RawResumeBlock[], max = 120) {
  return compactState(
    blocks.slice(0, max).map((block) => ({
      id: block.id,
      charStart: block.charStart,
      charEnd: block.charEnd,
      text: block.text.slice(0, 500),
    })),
    16_000,
  );
}

function rawBlocksForStructurePrompt(blocks: RawResumeBlock[]) {
  return compactState(
    blocks.map((block) => ({
      id: block.id,
      charStart: block.charStart,
      charEnd: block.charEnd,
      text: block.text,
    })),
    90_000,
  );
}

function buildStructureExtractionPrompt(input: {
  analysisDate: string;
  cleanText: string;
  rawBlocks: RawResumeBlock[];
  documentOutline: DocumentOutlineRange[];
}) {
  return [
    "Extract a complete resume structure from cleanText and rawBlocks.",
    "Return only JSON matching ResumeStructure schema.",
    "",
    "Hard rules:",
    "- The number of work entries is arbitrary. Extract every work entry you can identify.",
    "- Do not assume there are exactly 1, 2, or 3 jobs.",
    "- Every structured item must reference existing sourceBlockIds from rawBlocks.",
    "- Do not drop tail sections. If a section exists in documentOutline or cleanText, include it.",
    "- Stack is only technologies/tools. Do not put responsibilities or achievements into stack.",
    "- If responsibilities/duties exist, fill experience.jobs[].responsibilities.",
    "- If achievements/key results exist, fill experience.jobs[].achievements.",
    "- If skills, education, about, projects, languages, or certificates exist, fill their arrays or otherSections.",
    "- Use otherSections for meaningful sections that do not fit the main schema.",
    "- Do not use age, gender, birth date, or citizenship as evaluation signals.",
    "- If uncertain, add warnings and confidence, but still preserve the section and its sourceBlockIds.",
    "",
    `analysisDate: ${input.analysisDate}`,
    "",
    "documentOutline:",
    compactState(input.documentOutline, 20_000),
    "",
    "rawBlocks:",
    rawBlocksForStructurePrompt(input.rawBlocks),
    "",
    "cleanText:",
    input.cleanText,
  ].join("\n");
}

function buildProfileContextPrompt(input: {
  analysisDate: string;
  cleanText: string;
  resumeStructure: unknown;
  chunks: ResumeChunk[];
}) {
  return [
    "Build resume profile context in one pass.",
    "Return only JSON matching { normalizedResume, targetProfile, benchmark }.",
    "",
    "Hard rules:",
    "- normalizedResume must summarize the candidate without inventing facts.",
    "- targetProfile must infer target role, seniority, market domain, expected skills and important keywords.",
    "- benchmark must describe required elements, strong signals, weak signals, expected evidence, keywords and scoring notes for that target profile.",
    "- Do not use age, gender, birth date, or citizenship as seniority or score signals.",
    "- Do not invent metrics, companies, tools, dates, roles, or achievements.",
    "- Write Russian text in all user-facing strings.",
    "",
    `analysisDate: ${input.analysisDate}`,
    "",
    "Resume structure:",
    compactState(input.resumeStructure ?? {}, 18_000),
    "",
    "Semantic chunks:",
    compactChunks(input.chunks),
    "",
    "cleanText:",
    input.cleanText,
  ].join("\n");
}

function buildAnalysisNodePrompt(input: {
  nodeKey: string;
  analysisDate: string;
  cleanText: string;
  displayBlocks: DisplayBlock[];
  analysisTasks: AnalysisTask[];
  resumeStructure: unknown;
  targetProfile: unknown;
  benchmark: unknown;
}) {
  const focus = getAnalysisFocus(input.nodeKey);
  const relevantTasks = filterAnalysisTasks(input.analysisTasks, input.nodeKey);

  return [
    `Run resume audit for: ${focus.title}.`,
    "Return only JSON matching { findings: TypedFinding[] }.",
    "",
    "Hard rules:",
    "- Each finding must include exactQuote copied verbatim from one of the provided task texts.",
    "- exactQuote must be a real substring of cleanText. Do not paraphrase it.",
    "- If you cannot quote the exact text, do not create an anchored finding.",
    "- Find concrete issues, not only top issues. Prefer 8-14 findings for broad audit passes and 3-8 findings for narrow passes when evidence exists.",
    "- Use red for critical problems: missing contact/experience, broken parsing, severe ATS blocker, unsupported high-impact claim, or major credibility risk.",
    "- Use warning for important but fixable issues.",
    "- Use green for concrete strengths worth preserving or non-blocking recommendations with no penalty.",
    "- Protected attributes such as age, gender, birth date, and citizenship must not be negative findings.",
    "- Do not invent metrics, tools, companies, architecture, dates, or achievements.",
    "- Write Russian text.",
    "",
    `analysisDate: ${input.analysisDate}`,
    "",
    "Focus checklist:",
    focus.checklist.map((item) => `- ${item}`).join("\n"),
    "",
    "Relevant analysis tasks:",
    compactState(relevantTasks, 22_000),
    "",
    "Display blocks source map:",
    compactState(
      input.displayBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        section: block.section,
        charStart: block.charStart,
        charEnd: block.charEnd,
        text: block.text,
      })),
      24_000,
    ),
    "",
    "Resume structure semantic view:",
    compactState(input.resumeStructure ?? {}, 8_000),
    "",
    "Target profile:",
    compactState(input.targetProfile ?? {}, 4_000),
    "",
    "Benchmark:",
    compactState(input.benchmark ?? {}, 4_000),
  ].join("\n");
}

function getAnalysisFocus(nodeKey: string) {
  const focusByNode: Record<string, { title: string; checklist: string[] }> = {
    ats_format_analysis: {
      title: "document, ATS, structure, positioning and readability",
      checklist: [
        "machine readability",
        "overlong skill lines",
        "missing links/contact structure",
        "section heading clarity",
        "keyword formatting issues",
        "missing or misplaced sections",
        "weak header/title",
        "summary location and duplicated intro content",
        "unclear target role or seniority mismatch",
        "long sentences, repetitions, clumsy wording",
      ],
    },
    structure_completeness_analysis: {
      title: "structure and completeness",
      checklist: [
        "missing or misplaced sections",
        "weak header/title",
        "summary location",
        "education/skills/about completeness",
      ],
    },
    positioning_summary_analysis: {
      title: "positioning and summary",
      checklist: [
        "unclear target role",
        "seniority mismatch",
        "summary claims without support",
        "duplicated about text",
      ],
    },
    experience_bullet_analysis: {
      title: "experience, metrics, evidence and credibility",
      checklist: [
        "responsibility vs result",
        "weak verbs",
        "too generic bullets",
        "unclear business value",
        "missing measurable evidence",
        "overclaiming",
        "unverified impact",
        "placeholders needed for metrics",
        "claims vs evidence",
        "role/experience consistency",
        "risky claims",
      ],
    },
    metrics_evidence_analysis: {
      title: "metrics and evidence",
      checklist: [
        "missing measurable evidence",
        "overclaiming",
        "unverified impact",
        "placeholders needed for metrics",
      ],
    },
    skills_keywords_analysis: {
      title: "skills and market keywords",
      checklist: [
        "skill formatting",
        "skills not backed by experience",
        "missing expected keywords",
        "tool specificity",
      ],
    },
    language_readability_analysis: {
      title: "language and readability",
      checklist: [
        "long sentences",
        "repetitions",
        "clumsy wording",
        "unclear phrases",
      ],
    },
    credibility_consistency_analysis: {
      title: "credibility and consistency",
      checklist: [
        "dates consistency",
        "claims vs evidence",
        "role/experience consistency",
        "risky claims",
      ],
    },
  };

  return (
    focusByNode[nodeKey] ?? {
      title: nodeKey,
      checklist: ["resume quality", "exact quote evidence"],
    }
  );
}

function filterAnalysisTasks(tasks: AnalysisTask[], nodeKey: string) {
  if (nodeKey.includes("ats")) {
    return tasks;
  }

  if (nodeKey.includes("experience") || nodeKey.includes("metrics")) {
    return tasks.filter((task) =>
      [
        "experience",
        "work_entry",
        "responsibilities",
        "achievements",
        "stack",
        "full_document",
      ].includes(task.sectionHint),
    );
  }

  if (nodeKey.includes("skills")) {
    return tasks.filter((task) =>
      ["skills", "experience", "work_entry", "full_document"].includes(
        task.sectionHint,
      ),
    );
  }

  if (nodeKey.includes("positioning")) {
    return tasks.filter((task) =>
      ["header", "target_role", "about", "experience", "full_document"].includes(
        task.sectionHint,
      ),
    );
  }

  if (nodeKey.includes("readability") || nodeKey.includes("credibility")) {
    return tasks;
  }

  return tasks;
}

function safePromptState(outputs: Record<string, unknown>, state: WorkflowState) {
  return {
    analysisDate: state.analysisDate,
    modelId: state.modelId,
    documentQuality: outputs.document_quality_check,
    structureValidation:
      outputs.structure_validation &&
      typeof outputs.structure_validation === "object" &&
      "validation" in outputs.structure_validation
        ? (outputs.structure_validation as { validation?: unknown }).validation
        : undefined,
  };
}

function cleanExportArtifacts(text: string) {
  const lines = normalizeResumeText(text).split("\n");
  const kept: string[] = [];
  const removedArtifacts: Array<{ text: string; reason: string }> = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      kept.push("");
      continue;
    }

    const reason = getArtifactReason(trimmed);

    if (reason) {
      removedArtifacts.push({
        text: trimmed,
        reason,
      });
      continue;
    }

    const normalized = trimmed.toLowerCase();
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);

    if (count >= 2 && isLikelyHeaderFooter(trimmed)) {
      removedArtifacts.push({
        text: trimmed,
        reason: "duplicate_header_footer",
      });
      continue;
    }

    kept.push(trimmed);
  }

  const cleanText = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    cleanText,
    removedArtifacts,
    charsBefore: text.length,
    charsAfter: cleanText.length,
    warnings:
      removedArtifacts.length > 0
        ? [`Удалено служебных строк: ${removedArtifacts.length}.`]
        : [],
  };
}

function getArtifactReason(line: string) {
  if (/^Резюме обновлено\s+/i.test(line)) {
    return "hh_resume_updated_line";
  }

  if (/^.+\s+•\s+Резюме обновлено\s+/i.test(line)) {
    return "hh_repeated_resume_header";
  }

  if (/^HeadHunter|^hh\.ru/i.test(line)) {
    return "hh_service_line";
  }

  if (/^Страница\s+\d+/i.test(line)) {
    return "page_footer";
  }

  return null;
}

function isLikelyHeaderFooter(line: string) {
  return (
    /резюме|headhunter|hh\.ru|страница|обновлено/i.test(line) ||
    (line.length < 80 && /[•|]/.test(line))
  );
}

function getLineRecords(text: string) {
  const rawLines = text.split("\n");
  let cursor = 0;

  return rawLines.map((raw) => {
    const trimmed = raw.trim();
    const leadingOffset = trimmed ? raw.indexOf(trimmed) : 0;
    const charStart = cursor + Math.max(leadingOffset, 0);
    const charEnd = charStart + trimmed.length;
    cursor += raw.length + 1;

    return {
      raw,
      text: trimmed,
      charStart,
      charEnd,
    };
  });
}

function normalizeHeading(line: string) {
  return line.toLowerCase().replace(/[:：]/g, "").replace(/\s+/g, " ").trim();
}

function getSectionFromHeading(line: string) {
  const value = normalizeHeading(line);

  if (/^(опыт работы|опыт|employment|experience)$/.test(value)) {
    return "experience";
  }

  if (/^(навыки|ключевые навыки|skills|технологии|стек)$/.test(value)) {
    return "skills";
  }

  if (/^(образование|education)$/.test(value)) {
    return "education";
  }

  if (/^(обо мне|о себе|summary|профиль)$/.test(value)) {
    return "about";
  }

  if (/^(проекты|projects)$/.test(value)) {
    return "projects";
  }

  if (/^(желаемая должность|целевая должность|position|role)$/.test(value)) {
    return "target_role";
  }

  return null;
}

function isBulletStart(line: string) {
  return /^[-–—•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function stripBullet(line: string) {
  return line
    .replace(/^[-–—•*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function hasDateRange(line: string) {
  return /((январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*\s+)?\d{4}\s*[—-]\s*((настоящее|текущее|по настоящее)|((январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*\s+)?\d{4})/i.test(
    line,
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function looksLikeMetric(line: string) {
  return /(\d+[\d\s.,]*\s*(%|процент|млн|тыс|руб|₽|x|раз|пользовател|установ|язык|месяц|год))|([A-ZА-Я]{2,})/.test(
    line,
  );
}

function createChunk(
  chunks: ResumeChunk[],
  input: {
    type: ResumeChunkType;
    section: string;
    text: string;
    charStart: number;
    charEnd: number;
    parentId?: string;
    meta?: Record<string, unknown>;
  },
) {
  const id =
    input.type === "job"
      ? `job_${chunks.filter((chunk) => chunk.type === "job").length + 1}`
      : `chunk_${String(chunks.length + 1).padStart(3, "0")}`;
  const chunk: ResumeChunk = {
    id,
    type: input.type,
    section: input.section,
    text: input.text.trim(),
    charStart: input.charStart,
    charEnd: input.charEnd,
  };

  if (input.parentId) {
    chunk.parentId = input.parentId;
  }

  if (input.meta) {
    chunk.meta = input.meta;
  }

  chunks.push(chunk);

  return chunk;
}

function buildRawBlocks(text: string): RawResumeBlock[] {
  return getLineRecords(text)
    .filter((record) => record.text)
    .map((record, index) => ({
      id: `raw_${String(index + 1).padStart(3, "0")}`,
      text: record.text,
      charStart: record.charStart,
      charEnd: record.charEnd,
    }));
}

function buildDisplayBlocks(
  cleanText: string,
  rawBlocks: RawResumeBlock[] = buildRawBlocks(cleanText),
): DisplayBlock[] {
  let currentSection = "header";

  return rawBlocks.map((block, index) => {
    const marker = getOutlineMarker(block, rawBlocks[index - 1]);

    if (marker) {
      currentSection = marker.kind;
    }

    const type = inferDisplayBlockType(block.text, marker);

    return {
      id: `display_${String(index + 1).padStart(3, "0")}`,
      type,
      section: currentSection,
      text: block.text,
      charStart: block.charStart,
      charEnd: block.charEnd,
      pageIndex: undefined,
      source: "cleanText" as const,
    };
  });
}

function inferDisplayBlockType(
  text: string,
  marker: ReturnType<typeof getOutlineMarker>,
): DisplayBlock["type"] {
  if (marker) {
    return "section_heading";
  }

  if (/^\+?\d[\d\s().-]{7,}|@|telegram|linkedin|github/i.test(text)) {
    return "contact";
  }

  if (isBulletStart(text) || /^[-—•*]\s+/.test(text.trim())) {
    return "list_item";
  }

  if (text.length <= 90 && /[:：]$/.test(text.trim())) {
    return "heading";
  }

  return "paragraph";
}

function getDisplayCoverage(cleanText: string, displayBlocks: DisplayBlock[]) {
  if (!cleanText.trim()) {
    return 1;
  }

  if (displayBlocks.length === 0) {
    return 0;
  }

  const first = displayBlocks[0];
  const last = displayBlocks[displayBlocks.length - 1];

  return first.charStart === 0 && last.charEnd === cleanText.length ? 1 : 0;
}

function buildAnalysisTasks(
  cleanText: string,
  displayBlocks: DisplayBlock[],
): AnalysisTask[] {
  const groups = new Map<string, DisplayBlock[]>();

  for (const block of displayBlocks) {
    const current = groups.get(block.section) ?? [];
    current.push(block);
    groups.set(block.section, current);
  }

  const sectionTasks = [...groups.entries()].map(
    ([sectionHint, blocks], index): AnalysisTask => ({
      id: `task_${String(index + 1).padStart(3, "0")}`,
      category: getAnalysisCategoryForSection(sectionHint),
      sectionHint,
      charStart: blocks[0]?.charStart ?? 0,
      charEnd: blocks[blocks.length - 1]?.charEnd ?? 0,
      text: blocks.map((block) => block.text).join("\n"),
      expectedFindingTypes: getExpectedFindingTypes(sectionHint),
    }),
  );

  const maxTaskLength = 2_800;
  const longTextTasks: AnalysisTask[] = [];

  for (const task of sectionTasks) {
    if (task.text.length <= maxTaskLength) {
      longTextTasks.push(task);
      continue;
    }

    const relatedBlocks = displayBlocks.filter(
      (block) =>
        block.charStart >= task.charStart && block.charEnd <= task.charEnd,
    );
    let batch: DisplayBlock[] = [];

    for (const block of relatedBlocks) {
      const nextText = [...batch, block].map((item) => item.text).join("\n");

      if (nextText.length > maxTaskLength && batch.length > 0) {
        longTextTasks.push(createTaskFromBlocks(task, batch, longTextTasks.length));
        batch = [];
      }

      batch.push(block);
    }

    if (batch.length > 0) {
      longTextTasks.push(createTaskFromBlocks(task, batch, longTextTasks.length));
    }
  }

  if (longTextTasks.length === 0 && cleanText.trim()) {
    return [
      {
        id: "task_001",
        category: "full_document",
        sectionHint: "full_document",
        charStart: 0,
        charEnd: cleanText.length,
        text: cleanText,
        expectedFindingTypes: [
          "structure",
          "ats",
          "metrics",
          "readability",
          "credibility",
        ],
      },
    ];
  }

  return longTextTasks;
}

function createTaskFromBlocks(
  sourceTask: AnalysisTask,
  blocks: DisplayBlock[],
  index: number,
): AnalysisTask {
  return {
    ...sourceTask,
    id: `task_${String(index + 1).padStart(3, "0")}`,
    charStart: blocks[0]?.charStart ?? sourceTask.charStart,
    charEnd: blocks[blocks.length - 1]?.charEnd ?? sourceTask.charEnd,
    text: blocks.map((block) => block.text).join("\n"),
  };
}

function getAnalysisCategoryForSection(section: string) {
  if (
    [
      "experience",
      "work_entry",
      "responsibilities",
      "achievements",
      "stack",
    ].includes(section)
  ) {
    return "experience";
  }
  if (section === "skills") return "skills";
  if (section === "education") return "structure";
  if (section === "about") return "summary";
  if (section === "target_role") return "positioning";

  return "structure";
}

function getExpectedFindingTypes(section: string) {
  if (
    [
      "experience",
      "work_entry",
      "responsibilities",
      "achievements",
      "stack",
    ].includes(section)
  ) {
    return [
      "weak verbs",
      "missing metrics",
      "unclear impact",
      "overclaiming",
      "seniority evidence",
    ];
  }

  if (section === "skills") {
    return ["keyword gaps", "formatting", "unsupported skills"];
  }

  if (section === "about") {
    return ["positioning", "duplicated content", "readability", "claims"];
  }

  return ["ats", "structure", "completeness", "readability"];
}

function buildDocumentOutline(rawBlocks: RawResumeBlock[]) {
  if (rawBlocks.length === 0) {
    return [] satisfies DocumentOutlineRange[];
  }

  const ranges: DocumentOutlineRange[] = [];
  let currentKind: DocumentOutlineKind = "header";
  let currentLabel = "Header";
  let currentStart = 0;

  const closeRange = (endExclusive: number) => {
    if (endExclusive <= currentStart) {
      return;
    }

    const blocks = rawBlocks.slice(currentStart, endExclusive);

    if (blocks.length === 0) {
      return;
    }

    ranges.push({
      id: `outline_${String(ranges.length + 1).padStart(3, "0")}`,
      kind: currentKind,
      label: currentLabel,
      rawBlockStartId: blocks[0].id,
      rawBlockEndId: blocks[blocks.length - 1].id,
      rawBlockIds: blocks.map((block) => block.id),
      confidence: currentKind === "unknown" ? 0.45 : 0.75,
    });
  };

  for (let index = 0; index < rawBlocks.length; index += 1) {
    const block = rawBlocks[index];
    const marker = getOutlineMarker(block, rawBlocks[index - 1]);

    if (!marker) {
      continue;
    }

    closeRange(index);
    currentKind = marker.kind;
    currentLabel = marker.label;
    currentStart = index;
  }

  closeRange(rawBlocks.length);

  return mergeTinyUnknownOutlineRanges(ranges);
}

function getOutlineMarker(
  block: RawResumeBlock,
  previous?: RawResumeBlock,
): { kind: DocumentOutlineKind; label: string } | null {
  const text = block.text.trim();
  const normalized = normalizeForCompare(text);

  if (!normalized) {
    return null;
  }

  if (
    /^(desired position|target role|position|role)$/i.test(text) ||
    /желаемая должность|целевая должность|специализации/.test(normalized)
  ) {
    return { kind: "target_role", label: text };
  }

  if (/^(experience|employment)$/i.test(text) || /опыт работы/.test(normalized)) {
    return { kind: "experience", label: text };
  }

  if (
    /^(responsibilities|duties|what i did)$/i.test(text) ||
    /что делал|обязанности|зона ответственности/.test(normalized)
  ) {
    return { kind: "responsibilities", label: text };
  }

  if (
    /^(key results|achievements|results)$/i.test(text) ||
    /ключевые результаты|достижения|результаты/.test(normalized)
  ) {
    return { kind: "achievements", label: text };
  }

  if (/^(stack|tech stack|technologies)$/i.test(text) || /^стек$|технологии/.test(normalized)) {
    return { kind: "stack", label: text };
  }

  if (/^(education)$/i.test(text) || /^образование$/.test(normalized)) {
    return { kind: "education", label: text };
  }

  if (/^(skills|key skills)$/i.test(text) || /^навыки|ключевые навыки|знание языков/.test(normalized)) {
    return { kind: "skills", label: text };
  }

  if (
    /^(about|summary|profile)$/i.test(text) ||
    /^обо мне|^о себе|дополнительная информация/.test(normalized)
  ) {
    return { kind: "about", label: text };
  }

  if (/^(projects)$/i.test(text) || /^проекты$/.test(normalized)) {
    return { kind: "projects", label: text };
  }

  if (/^(languages)$/i.test(text) || /^языки$|знание языков/.test(normalized)) {
    return { kind: "languages", label: text };
  }

  if (/^(certificates|certifications)$/i.test(text) || /сертификат/.test(normalized)) {
    return { kind: "certificates", label: text };
  }

  const previousText = previous?.text ? normalizeForCompare(previous.text) : "";

  if (
    hasLikelyWorkEntryStart(text) &&
    (/опыт работы|experience|employment/.test(previousText) ||
      previousText === "" ||
      isLikelyResumeDateLine(text))
  ) {
    return { kind: "work_entry", label: text };
  }

  return null;
}

function mergeTinyUnknownOutlineRanges(ranges: DocumentOutlineRange[]) {
  return ranges.filter((range) => range.rawBlockIds.length > 0);
}

function hasLikelyWorkEntryStart(text: string) {
  return isLikelyResumeDateLine(text) || hasDateRange(text);
}

function isLikelyResumeDateLine(text: string) {
  return /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i.test(
    text,
  );
}

function repairResumeStructure(
  structure: ResumeStructure,
  rawBlocks: RawResumeBlock[],
  documentOutline: DocumentOutlineRange[],
  cleanText: string,
): StructureRepairResult {
  const baseStructure = cloneResumeStructure(structure);
  const validationBefore = validateResumeStructure(
    baseStructure,
    rawBlocks,
    cleanText,
  );
  const repaired = cloneResumeStructure(baseStructure);
  const repairs: StructureRepairResult["repairs"] = [];
  const warnings = new Set<string>();
  const jobContexts = buildJobContexts(
    repaired,
    rawBlocks,
    documentOutline,
  );

  for (const context of jobContexts) {
    const job = repaired.experience.jobs[context.jobIndex];

    if (!job) {
      continue;
    }

    if (context.rawBlockIds.length > 0) {
      const previousCount = job.sourceBlockIds.length;
      job.sourceBlockIds = uniqueStrings([
        ...job.sourceBlockIds,
        ...context.rawBlockIds,
      ]);

      if (job.sourceBlockIds.length > previousCount) {
        repairs.push({
          type: "job_source_blocks_repaired",
          jobId: job.id,
          sourceBlockIds: context.rawBlockIds,
          message: "Filled work-entry sourceBlockIds from document outline span.",
        });
      }
    }

    const responsibilityItems = mergeItemsFromRanges(
      rawBlocks,
      context.ranges.filter((range) => range.kind === "responsibilities"),
      "responsibility",
    );
    const achievementItems = mergeItemsFromRanges(
      rawBlocks,
      context.ranges.filter((range) => range.kind === "achievements"),
      "achievement",
    );
    const stackItems = mergeItemsFromRanges(
      rawBlocks,
      context.ranges.filter(isExplicitStackRange),
      "stack",
    );

    if (shouldReplaceStructureItems(job.responsibilities, responsibilityItems)) {
      job.responsibilities = responsibilityItems.map(toStructureTextItem);
      repairs.push({
        type: "job_responsibilities_repaired",
        jobId: job.id,
        sourceBlockIds: uniqueStrings(
          responsibilityItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Attached merged responsibility bullets to work entry.",
      });
    }

    if (shouldReplaceStructureItems(job.achievements, achievementItems)) {
      job.achievements = achievementItems.map(toStructureTextItem);
      repairs.push({
        type: "job_achievements_repaired",
        jobId: job.id,
        sourceBlockIds: uniqueStrings(
          achievementItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Attached merged achievement bullets to work entry.",
      });
    }

    if (job.stack.length === 0 && stackItems.length > 0) {
      job.stack = stackItems.map(toStructureTextItem);
      repairs.push({
        type: "job_stack_repaired",
        jobId: job.id,
        sourceBlockIds: uniqueStrings(
          stackItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Attached stack range to work entry.",
      });
    }
  }

  if (repaired.skills.length === 0) {
    const skillItems = mergeItemsFromRanges(
      rawBlocks,
      documentOutline.filter((range) => range.kind === "skills"),
      "skills",
    );

    if (skillItems.length > 0) {
      repaired.skills = skillItems.map(toStructureTextItem);
      repairs.push({
        type: "skills_repaired",
        sourceBlockIds: uniqueStrings(
          skillItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Filled skills from outline ranges.",
      });
    }
  }

  if (repaired.education.length === 0) {
    const educationItems = mergeItemsFromRanges(
      rawBlocks,
      documentOutline.filter((range) => range.kind === "education"),
      "education",
    );

    if (educationItems.length > 0) {
      repaired.education = educationItems.map(toStructureTextItem);
      repairs.push({
        type: "education_repaired",
        sourceBlockIds: uniqueStrings(
          educationItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Filled education from outline ranges.",
      });
    }
  }

  if (repaired.about.length === 0) {
    const aboutItems = mergeItemsFromRanges(
      rawBlocks,
      documentOutline.filter((range) => range.kind === "about"),
      "about",
    );

    if (aboutItems.length > 0) {
      repaired.about = aboutItems.map(toStructureTextItem);
      repairs.push({
        type: "about_repaired",
        sourceBlockIds: uniqueStrings(
          aboutItems.flatMap((item) => item.sourceBlockIds),
        ),
        message: "Filled about section from outline ranges.",
      });
    }
  }

  for (const job of repaired.experience.jobs) {
    if (job.achievements.length === 0 && hasJobAchievementRange(jobContexts, job)) {
      warnings.add(
        `Work entry ${job.id} still has empty achievements after structure repair.`,
      );
    }
  }

  const validationAfter = validateResumeStructure(repaired, rawBlocks, cleanText);

  return {
    structure: repaired,
    repaired: repairs.length > 0,
    repairs,
    coverageBefore: validationBefore.coverage,
    coverageAfter: validationAfter.coverage,
    warnings: [...warnings],
  };
}

function cloneResumeStructure(structure: ResumeStructure): ResumeStructure {
  return resumeStructureSchema.parse(JSON.parse(JSON.stringify(structure)));
}

function buildJobContexts(
  structure: ResumeStructure,
  rawBlocks: RawResumeBlock[],
  documentOutline: DocumentOutlineRange[],
) {
  const startCandidates = getWorkEntryStartCandidates(
    structure,
    rawBlocks,
    documentOutline,
  );
  const assignedStarts = new Set<number>();

  return structure.experience.jobs.map((job, jobIndex) => {
    const scored = startCandidates
      .filter((candidate) => !assignedStarts.has(candidate.rangeIndex))
      .map((candidate) => ({
        ...candidate,
        score: scoreJobRangeMatch(job, rawBlocks, candidate.range),
      }))
      .sort((a, b) => b.score - a.score);
    const fallback = startCandidates.find(
      (candidate) => !assignedStarts.has(candidate.rangeIndex),
    );
    const selected =
      scored.find((candidate) => candidate.score > 0) ?? fallback ?? null;

    if (!selected) {
      return {
        jobIndex,
        job,
        ranges: [] as DocumentOutlineRange[],
        rawBlockIds: [] as string[],
      };
    }

    assignedStarts.add(selected.rangeIndex);
    const nextStart = startCandidates
      .filter((candidate) => candidate.rangeIndex > selected.rangeIndex)
      .sort((a, b) => a.rangeIndex - b.rangeIndex)[0];
    const nextMajor = documentOutline.findIndex(
      (range, rangeIndex) =>
        rangeIndex > selected.rangeIndex &&
        isPostExperienceMajorRange(range),
    );
    const endIndex = Math.min(
      nextStart?.rangeIndex ?? documentOutline.length,
      nextMajor >= 0 ? nextMajor : documentOutline.length,
    );
    const ranges = documentOutline.slice(selected.rangeIndex, endIndex);

    return {
      jobIndex,
      job,
      ranges,
      rawBlockIds: uniqueStrings(ranges.flatMap((range) => range.rawBlockIds)),
    };
  });
}

function getWorkEntryStartCandidates(
  structure: ResumeStructure,
  rawBlocks: RawResumeBlock[],
  documentOutline: DocumentOutlineRange[],
) {
  const candidates = documentOutline
    .map((range, rangeIndex) => ({ range, rangeIndex }))
    .filter(
      ({ range }) =>
        range.kind === "work_entry" ||
        (range.kind === "experience" && rangeContainsJobEvidence(range, rawBlocks)),
    );

  if (structure.experience.jobs.length > candidates.length) {
    const firstExperience = documentOutline
      .map((range, rangeIndex) => ({ range, rangeIndex }))
      .find(({ range }) => range.kind === "experience");

    if (
      firstExperience &&
      !candidates.some(
        (candidate) => candidate.rangeIndex === firstExperience.rangeIndex,
      )
    ) {
      candidates.unshift(firstExperience);
    }
  }

  return candidates.sort((a, b) => a.rangeIndex - b.rangeIndex);
}

function rangeContainsJobEvidence(
  range: DocumentOutlineRange,
  rawBlocks: RawResumeBlock[],
) {
  const text = textForRawBlockIds(rawBlocks, range.rawBlockIds);

  return (
    hasDateRange(text) ||
    /developer|engineer|manager|разработчик|менеджер|аналитик|designer/i.test(
      text,
    )
  );
}

function isPostExperienceMajorRange(range: DocumentOutlineRange) {
  return [
    "education",
    "skills",
    "about",
    "projects",
    "languages",
    "certificates",
  ].includes(range.kind);
}

function scoreJobRangeMatch(
  job: ResumeStructure["experience"]["jobs"][number],
  rawBlocks: RawResumeBlock[],
  range: DocumentOutlineRange,
) {
  const rangeText = normalizeForCompare(
    textForRawBlockIds(rawBlocks, range.rawBlockIds),
  );
  const parts = [job.company, job.title, job.period]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map(normalizeForCompare)
    .filter(Boolean);

  return parts.reduce((score, part) => {
    if (rangeText.includes(part)) {
      return score + 3;
    }

    const words = part.split(" ").filter((word) => word.length >= 3);
    const matchedWords = words.filter((word) => rangeText.includes(word)).length;

    return score + (words.length > 0 ? matchedWords / words.length : 0);
  }, 0);
}

function mergeItemsFromRanges(
  rawBlocks: RawResumeBlock[],
  ranges: DocumentOutlineRange[],
  kind:
    | "responsibility"
    | "achievement"
    | "stack"
    | "skills"
    | "education"
    | "about",
): MergedSemanticItem[] {
  return ranges.flatMap((range) => mergeItemsFromRange(rawBlocks, range, kind));
}

function mergeItemsFromRange(
  rawBlocks: RawResumeBlock[],
  range: DocumentOutlineRange,
  kind:
    | "responsibility"
    | "achievement"
    | "stack"
    | "skills"
    | "education"
    | "about",
): MergedSemanticItem[] {
  const blocks = getContentBlocksForRange(rawBlocks, range);

  if (blocks.length === 0) {
    return [];
  }

  if (kind === "skills" || kind === "stack") {
    const text = blocks.map((block) => block.text).join(" ").trim();
    const parts = text
      .split(/[,;]| {2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);

    if (parts.length > 1) {
      return [
        {
          text: parts.join(", "),
          sourceBlockIds: blocks.map((block) => block.id),
          charStart: blocks[0].charStart,
          charEnd: blocks[blocks.length - 1].charEnd,
          mergeReason: `${kind}_list`,
        },
      ];
    }
  }

  return mergeWrappedBlocks(blocks, `${kind}_wrapped_lines`);
}

function getContentBlocksForRange(
  rawBlocks: RawResumeBlock[],
  range: DocumentOutlineRange,
) {
  const blocks = getRawBlockRefs(rawBlocks, range.rawBlockIds);

  return blocks.filter((block, index) => {
    if (
      index === 0 &&
      normalizeForCompare(block.text) === normalizeForCompare(range.label)
    ) {
      return false;
    }

    return Boolean(block.text.trim());
  });
}

function mergeWrappedBlocks(
  blocks: RawResumeBlock[],
  mergeReason: string,
): MergedSemanticItem[] {
  const merged: MergedSemanticItem[] = [];

  for (const block of blocks) {
    const text = stripBullet(block.text).trim();

    if (!text) {
      continue;
    }

    const previous = merged[merged.length - 1];

    if (!previous || startsNewSemanticLine(text, previous.text)) {
      merged.push({
        text,
        sourceBlockIds: [block.id],
        charStart: block.charStart,
        charEnd: block.charEnd,
        mergeReason,
      });
      continue;
    }

    previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
    previous.sourceBlockIds = uniqueStrings([
      ...previous.sourceBlockIds,
      block.id,
    ]);
    previous.charEnd = block.charEnd;
  }

  return merged;
}

function startsNewSemanticLine(line: string, previousText: string) {
  if (isBulletStart(line)) {
    return true;
  }

  const trimmed = line.trim();
  const previous = previousText.trim();

  if (!previous) {
    return true;
  }

  if (/^[a-zа-яё,;:)\]]/u.test(trimmed)) {
    return false;
  }

  if (!/[.!?]$/.test(previous)) {
    return false;
  }

  return /^[A-ZА-ЯЁ0-9]/u.test(trimmed);
}

function toStructureTextItem(item: MergedSemanticItem) {
  return {
    text: item.text,
    sourceBlockIds: item.sourceBlockIds,
    confidence: 0.9,
  };
}

function shouldReplaceStructureItems(
  current: Array<{ text: string; sourceBlockIds: string[] }>,
  repaired: MergedSemanticItem[],
) {
  if (repaired.length === 0) {
    return false;
  }

  if (current.length === 0) {
    return true;
  }

  const missingSources = current.filter(
    (item) => item.sourceBlockIds.length === 0,
  ).length;

  return missingSources > current.length / 2;
}

function isExplicitStackRange(range: DocumentOutlineRange) {
  if (range.kind !== "stack") {
    return false;
  }

  const label = normalizeForCompare(range.label);

  return (
    label === "stack" ||
    label === "tech stack" ||
    label === "стек" ||
    (range.label.length <= 40 && !range.label.includes(","))
  );
}

function hasJobAchievementRange(
  contexts: ReturnType<typeof buildJobContexts>,
  job: ResumeStructure["experience"]["jobs"][number],
) {
  return contexts.some(
    (context) =>
      context.job.id === job.id &&
      context.ranges.some((range) => range.kind === "achievements"),
  );
}

function buildResumeChunksFromStructure(
  structure: ResumeStructure,
  rawBlocks: RawResumeBlock[],
  documentOutline: DocumentOutlineRange[] = [],
) {
  const chunks: ResumeChunk[] = [];

  for (const field of structure.header.fields) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "header_field",
      section: "header",
      text: `${field.label}: ${field.value}`,
      sourceBlockIds: field.sourceBlockIds,
    });
  }

  if (structure.targetRole) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "target_role",
      section: "target_role",
      text: structure.targetRole.text,
      sourceBlockIds: structure.targetRole.sourceBlockIds,
      meta: {
        normalizedTitle: structure.targetRole.normalizedTitle,
        seniority: structure.targetRole.seniority,
      },
    });
  }

  for (const [jobIndex, job] of structure.experience.jobs.entries()) {
    const jobHeaderText =
      [job.company, job.title, job.period].filter(Boolean).join(" | ") ||
      `Job ${jobIndex + 1}`;
    const jobHeaderSourceBlockIds = getJobHeaderSourceBlockIds(job, rawBlocks);
    const parent = addStructuredChunk(chunks, rawBlocks, {
      type: "work_entry_header",
      section: "experience",
      text: jobHeaderText,
      sourceBlockIds: jobHeaderSourceBlockIds,
      meta: {
        jobId: job.id || `job_${jobIndex + 1}`,
        company: job.company,
        title: job.title,
        period: job.period,
      },
    });

    if (job.description) {
      const descriptionSourceBlockIds = findSourceBlockIdsByText(
        rawBlocks,
        job.description,
        job.sourceBlockIds,
      );

      addStructuredChunk(chunks, rawBlocks, {
        type: "job_description",
        section: "experience",
        text: job.description,
        sourceBlockIds:
          descriptionSourceBlockIds.length > 0
            ? descriptionSourceBlockIds
            : jobHeaderSourceBlockIds,
        parentId: parent.id,
      });
    }

    for (const responsibility of job.responsibilities) {
      addStructuredChunk(chunks, rawBlocks, {
        type: "responsibility_bullet",
        section: "experience",
        text: responsibility.text,
        sourceBlockIds: responsibility.sourceBlockIds,
        parentId: parent.id,
      });
    }

    for (const achievement of job.achievements) {
      addStructuredChunk(chunks, rawBlocks, {
        type: "achievement_bullet",
        section: "experience",
        text: achievement.text,
        sourceBlockIds: achievement.sourceBlockIds,
        parentId: parent.id,
      });
    }

    if (job.stack.length > 0) {
      addStructuredChunk(chunks, rawBlocks, {
        type: "job_stack",
        section: "experience",
        text: job.stack.map((item) => item.text).join(", "),
        sourceBlockIds: uniqueStrings(
          job.stack.flatMap((item) => item.sourceBlockIds),
        ),
        parentId: parent.id,
      });
    }
  }

  for (const skill of structure.skills) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "skill_item",
      section: "skills",
      text: skill.text,
      sourceBlockIds: skill.sourceBlockIds,
    });
  }

  for (const education of structure.education) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "education_item",
      section: "education",
      text: education.text,
      sourceBlockIds: education.sourceBlockIds,
    });
  }

  for (const about of structure.about) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "about_paragraph",
      section: "about",
      text: about.text,
      sourceBlockIds: about.sourceBlockIds,
    });
  }

  for (const section of structure.otherSections ?? []) {
    addStructuredChunk(chunks, rawBlocks, {
      type: "other_section_item",
      section: normalizeForCompare(section.title) || "other",
      text: section.text,
      sourceBlockIds: section.sourceBlockIds,
      meta: {
        title: section.title,
      },
    });
  }

  addOutlineFallbackChunks(chunks, rawBlocks, documentOutline);

  return chunks;
}

function getJobHeaderSourceBlockIds(
  job: ResumeStructure["experience"]["jobs"][number],
  rawBlocks: RawResumeBlock[],
) {
  const refs = getRawBlockRefs(rawBlocks, job.sourceBlockIds);
  const headerParts = [job.company, job.title, job.period]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map(normalizeForCompare)
    .filter(Boolean);
  const selected = refs.filter((block) => {
    const blockText = normalizeForCompare(block.text);

    return headerParts.some(
      (part) => part.includes(blockText) || blockText.includes(part),
    );
  });

  if (selected.length > 0) {
    return selected.map((block) => block.id);
  }

  return refs.slice(0, 6).map((block) => block.id);
}

function findSourceBlockIdsByText(
  rawBlocks: RawResumeBlock[],
  text: string,
  candidateIds: string[] = [],
) {
  const candidates =
    candidateIds.length > 0 ? getRawBlockRefs(rawBlocks, candidateIds) : rawBlocks;
  const needle = normalizeForCompare(text);

  if (!needle) {
    return [];
  }

  const single = candidates.find((block) => {
    const haystack = normalizeForCompare(block.text);

    return (
      haystack.includes(needle) ||
      (haystack.length >= 20 &&
        needle.includes(haystack) &&
        haystack.length >= needle.length * 0.25)
    );
  });

  if (single) {
    return [single.id];
  }

  const maxWindow = Math.min(20, candidates.length);

  for (let size = 2; size <= maxWindow; size += 1) {
    for (let start = 0; start + size <= candidates.length; start += 1) {
      const window = candidates.slice(start, start + size);
      const haystack = normalizeForCompare(
        window.map((block) => block.text).join(" "),
      );

      if (haystack.includes(needle) || needle.includes(haystack)) {
        return window.map((block) => block.id);
      }
    }
  }

  return [];
}

function addStructuredChunk(
  chunks: ResumeChunk[],
  rawBlocks: RawResumeBlock[],
  input: {
    type: ResumeChunkType;
    section: string;
    text: string;
    sourceBlockIds: string[];
    parentId?: string;
    meta?: Record<string, unknown>;
  },
) {
  const refs = getRawBlockRefs(rawBlocks, input.sourceBlockIds);
  const fallback =
    refs.length === 0 ? findRawBlockByText(rawBlocks, input.text) : null;
  const selectedRefs = refs.length > 0 ? refs : fallback ? [fallback] : [];
  const charStart =
    selectedRefs.length > 0
      ? Math.min(...selectedRefs.map((block) => block.charStart))
      : 0;
  const charEnd =
    selectedRefs.length > 0
      ? Math.max(...selectedRefs.map((block) => block.charEnd))
      : 0;

  return createChunk(chunks, {
    type: input.type,
    section: input.section,
    text: input.text,
    charStart,
    charEnd,
    parentId: input.parentId,
    meta: {
      ...input.meta,
      rawBlockIds: selectedRefs.map((block) => block.id),
    },
  });
}

function addOutlineFallbackChunks(
  chunks: ResumeChunk[],
  rawBlocks: RawResumeBlock[],
  documentOutline: DocumentOutlineRange[],
) {
  for (const range of documentOutline) {
    if (
      rangeAlreadyCovered(chunks, range) ||
      range.kind === "header" ||
      range.kind === "target_role" ||
      range.kind === "experience" ||
      range.kind === "work_entry" ||
      range.kind === "unknown"
    ) {
      continue;
    }

    if (range.kind === "stack") {
      const text = textForRawBlockIds(rawBlocks, range.rawBlockIds);

      if (text) {
        addStructuredChunk(chunks, rawBlocks, {
          type: "job_stack",
          section: "experience",
          text,
          sourceBlockIds: range.rawBlockIds,
          meta: { fallbackFromOutline: true, label: range.label },
        });
      }

      continue;
    }

    const chunkType = outlineKindToChunkType(range.kind);
    const section = outlineKindToSection(range.kind);

    if (!chunkType) {
      continue;
    }

    for (const item of splitOutlineRangeItems(rawBlocks, range)) {
      addStructuredChunk(chunks, rawBlocks, {
        type: chunkType,
        section,
        text: item.text,
        sourceBlockIds: item.rawBlockIds,
        meta: { fallbackFromOutline: true, label: range.label },
      });
    }
  }
}

function rangeAlreadyCovered(chunks: ResumeChunk[], range: DocumentOutlineRange) {
  const rangeIds = new Set(range.rawBlockIds);

  return chunks.some((chunk) => {
    const chunkRawIds = Array.isArray(chunk.meta?.rawBlockIds)
      ? (chunk.meta.rawBlockIds as unknown[]).filter(
          (id): id is string => typeof id === "string",
        )
      : [];

    return chunkRawIds.some((id) => rangeIds.has(id));
  });
}

function outlineKindToChunkType(
  kind: DocumentOutlineKind,
): ResumeChunkType | null {
  const map: Partial<Record<DocumentOutlineKind, ResumeChunkType>> = {
    responsibilities: "responsibility_bullet",
    achievements: "achievement_bullet",
    skills: "skill_item",
    education: "education_item",
    about: "about_paragraph",
    projects: "project_item",
    languages: "language_item",
    certificates: "certificate_item",
  };

  return map[kind] ?? null;
}

function outlineKindToSection(kind: DocumentOutlineKind) {
  if (kind === "responsibilities" || kind === "achievements" || kind === "stack") {
    return "experience";
  }

  return kind;
}

function splitOutlineRangeItems(
  rawBlocks: RawResumeBlock[],
  range: DocumentOutlineRange,
) {
  const blocks = getRawBlockRefs(rawBlocks, range.rawBlockIds);
  const contentBlocks = blocks.filter((block, index) => {
    if (index === 0 && normalizeForCompare(block.text) === normalizeForCompare(range.label)) {
      return false;
    }

    return Boolean(block.text.trim());
  });

  if (range.kind === "responsibilities" || range.kind === "achievements") {
    return mergeWrappedBlocks(
      contentBlocks,
      `${range.kind}_fallback_merge`,
    ).map((item) => ({
      text: item.text,
      rawBlockIds: item.sourceBlockIds,
    }));
  }

  if (range.kind === "skills" || range.kind === "stack") {
    const text = contentBlocks.map((block) => block.text).join(" ");
    const parts = text
      .split(/[,;]| {2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);

    if (parts.length > 1) {
      return parts.map((part) => ({
        text: part,
        rawBlockIds: contentBlocks.map((block) => block.id),
      }));
    }
  }

  return contentBlocks.map((block) => ({
    text: block.text,
    rawBlockIds: [block.id],
  }));
}

function textForRawBlockIds(rawBlocks: RawResumeBlock[], ids: string[]) {
  return getRawBlockRefs(rawBlocks, ids)
    .map((block) => block.text)
    .join(" ")
    .trim();
}

function getRawBlockRefs(rawBlocks: RawResumeBlock[], ids: string[]) {
  const idSet = new Set(ids);
  return rawBlocks.filter((block) => idSet.has(block.id));
}

function findRawBlockByText(rawBlocks: RawResumeBlock[], text: string) {
  const needle = normalizeForCompare(text);

  if (!needle) {
    return null;
  }

  return (
    rawBlocks.find((block) => {
      const haystack = normalizeForCompare(block.text);

      return haystack.includes(needle);
    }) ??
    rawBlocks.find((block) => {
      const haystack = normalizeForCompare(block.text);

      return (
        haystack.length >= 24 &&
        needle.includes(haystack) &&
        haystack.length >= needle.length * 0.35
      );
    }) ??
    null
  );
}

function buildResumeChunks(text: string) {
  const records = getLineRecords(text).filter((record) => record.text);
  const chunks: ResumeChunk[] = [];
  let section = "header";
  let mode: "default" | "responsibility" | "achievement" = "default";
  let currentJobId: string | undefined;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const line = record.text;
    const headingSection = getSectionFromHeading(line);

    if (headingSection) {
      section =
        headingSection === "target_role" ? "target_role" : headingSection;
      mode = "default";
      createChunk(chunks, {
        type: "section_heading",
        section,
        text: line,
        charStart: record.charStart,
        charEnd: record.charEnd,
      });
      continue;
    }

    if (/^(что делал|обязанности|ответственность)[:：]?$/i.test(line)) {
      mode = "responsibility";
      continue;
    }

    if (/^(ключевые результаты|достижения|результаты)[:：]?$/i.test(line)) {
      mode = "achievement";
      continue;
    }

    if (
      section === "header" &&
      index > 10 &&
      /опыт|навыки|образование/i.test(line)
    ) {
      section = "experience";
    }

    if (section === "experience" && hasDateRange(line)) {
      const jobChunk = createChunk(chunks, {
        type: "job",
        section: "experience",
        text: line,
        charStart: record.charStart,
        charEnd: record.charEnd,
        meta: {
          dateRange: line,
        },
      });
      currentJobId = jobChunk.id;
      mode = "default";
      continue;
    }

    const grouped = collectGroupedLine(records, index);

    if (grouped.nextIndex > index) {
      index = grouped.nextIndex;
    }

    const textValue = stripBullet(grouped.text);
    const type = classifyChunkType({
      line: textValue,
      section,
      mode,
      index,
    });

    const chunk = createChunk(chunks, {
      type,
      section: type === "target_role" ? "target_role" : section,
      text: textValue,
      charStart: grouped.charStart,
      charEnd: grouped.charEnd,
      parentId:
        section === "experience" && type !== "job" ? currentJobId : undefined,
    });

    if (chunk.type === "job") {
      currentJobId = chunk.id;
    }
  }

  return chunks.filter(
    (chunk) => chunk.type !== "section_heading" || chunk.text.length > 2,
  );
}

function collectGroupedLine(
  records: Array<{ text: string; charStart: number; charEnd: number }>,
  index: number,
) {
  const first = records[index];
  const parts = [first.text];
  let charEnd = first.charEnd;
  let nextIndex = index;

  for (let cursor = index + 1; cursor < records.length; cursor += 1) {
    const next = records[cursor];

    if (
      getSectionFromHeading(next.text) ||
      isBulletStart(next.text) ||
      hasDateRange(next.text) ||
      /^(что делал|обязанности|ключевые результаты|достижения|результаты)[:：]?$/i.test(
        next.text,
      )
    ) {
      break;
    }

    const previous = parts.join(" ");

    if (previous.length < 240 && next.text.length < 180) {
      parts.push(next.text);
      charEnd = next.charEnd;
      nextIndex = cursor;
      continue;
    }

    break;
  }

  return {
    text: parts.join(" "),
    charStart: first.charStart,
    charEnd,
    nextIndex,
  };
}

function classifyChunkType(input: {
  line: string;
  section: string;
  mode: "default" | "responsibility" | "achievement";
  index: number;
}): ResumeChunkType {
  const { line, section, mode, index } = input;

  if (section === "target_role") {
    return "target_role";
  }

  if (section === "header") {
    return index < 8 ||
      /@|\+?\d|telegram|github|linkedin|hh\.ru|город|email/i.test(line)
      ? "header_field"
      : "about_paragraph";
  }

  if (section === "skills") {
    return "skill_item";
  }

  if (section === "education") {
    return "education_item";
  }

  if (section === "about" || section === "summary") {
    return "about_paragraph";
  }

  if (section === "experience") {
    if (hasDateRange(line)) {
      return "job";
    }

    if (mode === "achievement" || looksLikeMetric(line)) {
      return "achievement_bullet";
    }

    return "responsibility_bullet";
  }

  return "other";
}

function buildHierarchicalSections(chunks: ResumeChunk[]) {
  const headerChunks = chunks.filter((chunk) => chunk.section === "header");
  const targetRoleChunks = chunks.filter(
    (chunk) => chunk.section === "target_role" || chunk.type === "target_role",
  );
  const jobChunks = chunks.filter((chunk) => chunk.type === "job");
  const experienceChunks = chunks.filter(
    (chunk) => chunk.section === "experience",
  );
  const jobs: Array<{
    id: string;
    order: number;
    title: string | null;
    company: string | null;
    dates: string | null;
    responsibilities: ReturnType<typeof toSectionBlock>[];
    achievements: ReturnType<typeof toSectionBlock>[];
    stack: string[];
  }> = (jobChunks.length > 0 ? jobChunks : []).map((job, index) => {
    const children = experienceChunks.filter(
      (chunk) => chunk.parentId === job.id,
    );
    const dateRange =
      job.meta && typeof job.meta.dateRange === "string"
        ? job.meta.dateRange
        : job.text;

    return {
      id: job.id,
      order: index + 1,
      title: inferJobTitle(job.text, children),
      company: inferCompany(job.text, children),
      dates: dateRange,
      responsibilities: children
        .filter((chunk) => chunk.type === "responsibility_bullet")
        .map(toSectionBlock),
      achievements: children
        .filter((chunk) => chunk.type === "achievement_bullet")
        .map(toSectionBlock),
      stack: inferStack(children),
    };
  });

  if (jobs.length === 0 && experienceChunks.length > 0) {
    jobs.push({
      id: "job_unknown_1",
      order: 1,
      title: null,
      company: null,
      dates: null,
      responsibilities: experienceChunks
        .filter((chunk) => chunk.type === "responsibility_bullet")
        .map(toSectionBlock),
      achievements: experienceChunks
        .filter((chunk) => chunk.type === "achievement_bullet")
        .map(toSectionBlock),
      stack: inferStack(experienceChunks),
    });
  }

  return {
    header: {
      fields: headerChunks.map(toSectionBlock),
    },
    targetRole: {
      blocks: targetRoleChunks.map(toSectionBlock),
      text: targetRoleChunks.map((chunk) => chunk.text).join("\n") || null,
    },
    experience: {
      jobs,
      blocksWithoutJob: experienceChunks
        .filter((chunk) => !chunk.parentId && chunk.type !== "job")
        .map(toSectionBlock),
    },
    skills: chunks
      .filter((chunk) => chunk.section === "skills")
      .flatMap(splitSkillChunk),
    education: chunks
      .filter((chunk) => chunk.section === "education")
      .map(toSectionBlock),
    about: chunks
      .filter((chunk) => chunk.type === "about_paragraph")
      .map(toSectionBlock),
    missing: {
      targetRole: targetRoleChunks.length === 0,
      experience: experienceChunks.length === 0,
      skills: chunks.filter((chunk) => chunk.section === "skills").length === 0,
      education:
        chunks.filter((chunk) => chunk.section === "education").length === 0,
      about:
        chunks.filter((chunk) => chunk.type === "about_paragraph").length === 0,
    },
  };
}

function toSectionBlock(chunk: ResumeChunk) {
  return {
    sourceBlockId: chunk.id,
    type: chunk.type,
    text: chunk.text,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  };
}

function splitSkillChunk(
  chunk: ResumeChunk,
): Array<ReturnType<typeof toSectionBlock> & { parentBlockId?: string }> {
  const parts = chunk.text
    .split(/[,;•]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  if (parts.length <= 1) {
    return [toSectionBlock(chunk)];
  }

  return parts.map((part, index) => ({
    sourceBlockId: `${chunk.id}_skill_${index + 1}`,
    parentBlockId: chunk.id,
    type: "skill_item" as ResumeChunkType,
    text: part,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  }));
}

function inferJobTitle(text: string, children: ResumeChunk[]) {
  const all = [text, ...children.map((chunk) => chunk.text)].join("\n");
  const title = all
    .split("\n")
    .find((line) =>
      /developer|разработчик|manager|менеджер|engineer|аналитик|designer|дизайнер/i.test(
        line,
      ),
    );

  return title ?? null;
}

function inferCompany(text: string, children: ResumeChunk[]) {
  const candidates = [text, ...children.map((chunk) => chunk.text)]
    .flatMap((line) => line.split(/[|]/))
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && line.length < 80);
  const company = candidates.find(
    (line) =>
      !hasDateRange(line) &&
      !/developer|разработчик|manager|менеджер|engineer|аналитик/i.test(line),
  );

  return company ?? null;
}

function inferStack(chunks: ResumeChunk[]) {
  const text = chunks.map((chunk) => chunk.text).join(" ");
  const matches = text.match(
    /\b(Flutter|Dart|React|Next\.js|TypeScript|JavaScript|Kotlin|Swift|Firebase|PostgreSQL|Redis|Docker|CI\/CD|REST|GraphQL|SQL|Python|Node\.js)\b/g,
  );

  return [...new Set(matches ?? [])];
}

function buildScoringRubric() {
  return {
    categories: {
      ats: 15,
      structure: 12,
      experience: 22,
      skills: 14,
      keywords: 12,
      marketFit: 10,
      readability: 8,
      credibility: 7,
    },
    severityImpact: {
      red: [-8, -15],
      warning: [-3, -7],
      green: [0, 2],
    },
  };
}

function validateResumeStructure(
  structure: ResumeStructure,
  rawBlocks: RawResumeBlock[],
  cleanText: string,
) {
  const warnings: string[] = [...structure.warnings];
  const errors: string[] = [];
  const rawBlockIds = new Set(rawBlocks.map((block) => block.id));
  const referencedIds = collectStructureSourceBlockIds(structure);
  const referencedIdSet = new Set(referencedIds);

  for (const id of referencedIds) {
    if (!rawBlockIds.has(id)) {
      errors.push(`Unknown rawBlockId reference: ${id}`);
    }
  }

  if (
    hasExperienceSignals(cleanText) &&
    structure.experience.jobs.length === 0
  ) {
    errors.push(
      "Experience signals found in text, but experience.jobs is empty.",
    );
  }

  if (hasTargetRoleSignals(cleanText) && !structure.targetRole) {
    errors.push("Target role signals found in text, but targetRole is null.");
  }

  const sectionCompleteness = {
    targetRole: !hasTargetRoleSignals(cleanText) || Boolean(structure.targetRole),
    experience:
      !hasExperienceSignals(cleanText) || structure.experience.jobs.length > 0,
    responsibilities:
      !hasResponsibilitiesSignals(cleanText) ||
      structure.experience.jobs.some((job) => job.responsibilities.length > 0),
    achievements:
      !hasAchievementsSignals(cleanText) ||
      structure.experience.jobs.some((job) => job.achievements.length > 0),
    skills: !hasSkillsSignals(cleanText) || structure.skills.length > 0,
    education:
      !hasEducationSignals(cleanText) || structure.education.length > 0,
    about: !hasAboutSignals(cleanText) || structure.about.length > 0,
  };

  if (!sectionCompleteness.responsibilities) {
    errors.push(
      "Responsibilities markers found in text, but all jobs have empty responsibilities.",
    );
  }

  if (!sectionCompleteness.achievements) {
    errors.push(
      "Achievement markers found in text, but all jobs have empty achievements.",
    );
  }

  if (!sectionCompleteness.skills) {
    errors.push("Skills section found in text, but skills is empty.");
  }

  if (!sectionCompleteness.education) {
    errors.push("Education section found in text, but education is empty.");
  }

  if (!sectionCompleteness.about) {
    errors.push("About/Summary section found in text, but about is empty.");
  }

  for (const job of structure.experience.jobs) {
    if (
      job.stack.length > 10 &&
      job.responsibilities.length === 0 &&
      job.achievements.length === 0
    ) {
      errors.push(
        `Job ${job.id} has stack.length > 10 while responsibilities and achievements are empty; responsibilities/results were likely collapsed into stack.`,
      );
    }
  }

  const unprocessedRawBlockIds = rawBlocks
    .map((block) => block.id)
    .filter((id) => !referencedIdSet.has(id));
  const referencedRatio =
    rawBlocks.length > 0 ? referencedIdSet.size / rawBlocks.length : 1;

  if (
    rawBlocks.length >= 30 &&
    referencedRatio < 0.8 &&
    hasMajorSectionSignals(cleanText)
  ) {
    errors.push(
      `ResumeStructure references only ${referencedIdSet.size}/${rawBlocks.length} raw blocks (${Math.round(
        referencedRatio * 100,
      )}%). Tail sections were likely dropped.`,
    );
  }

  if (structure.skills.some((skill) => looksLikeExperienceText(skill.text))) {
    warnings.push(
      "Skills contain text that looks like experience; structure may be polluted.",
    );
  }

  return {
    isUsable: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
    coverage: {
      rawBlocksTotal: rawBlocks.length,
      referencedRawBlocks: referencedIdSet.size,
      referencedRatio,
      unprocessedRawBlockIds,
    },
    sectionCompleteness,
    referencedBlocks: referencedIdSet.size,
    rawBlocks: rawBlocks.length,
  };
}

function collectStructureSourceBlockIds(structure: ResumeStructure) {
  const ids: string[] = [];
  ids.push(...structure.header.fields.flatMap((field) => field.sourceBlockIds));

  if (structure.targetRole) {
    ids.push(...structure.targetRole.sourceBlockIds);
  }

  for (const job of structure.experience.jobs) {
    ids.push(...job.sourceBlockIds);
    ids.push(
      ...job.responsibilities.flatMap((item) => item.sourceBlockIds),
      ...job.achievements.flatMap((item) => item.sourceBlockIds),
      ...job.stack.flatMap((item) => item.sourceBlockIds),
    );
  }

  ids.push(
    ...structure.skills.flatMap((item) => item.sourceBlockIds),
    ...structure.education.flatMap((item) => item.sourceBlockIds),
    ...structure.about.flatMap((item) => item.sourceBlockIds),
    ...(structure.otherSections ?? []).flatMap((item) => item.sourceBlockIds),
  );

  return [...new Set(ids)];
}

function hasExperienceSignals(text: string) {
  return /опыт работы|experience|senior\s+flutter|flutter-разработчик|разработчик|developer|\d{4}\s*[—-]\s*(настоящее|present|\d{4})/i.test(
    text,
  );
}

function hasTargetRoleSignals(text: string) {
  return /желаемая должность|целевая должность|desired position|target role|специализации/i.test(
    text,
  );
}

function hasResponsibilitiesSignals(text: string) {
  return /что делал|обязанности|responsibilities|duties|what i did/i.test(
    text,
  );
}

function hasAchievementsSignals(text: string) {
  return /ключевые результаты|достижения|achievements|key results|results/i.test(
    text,
  );
}

function hasSkillsSignals(text: string) {
  return /(^|\n)\s*(навыки|skills|key skills|знание языков)/i.test(
    text,
  );
}

function hasEducationSignals(text: string) {
  return /(^|\n)\s*(образование|education)/i.test(text);
}

function hasAboutSignals(text: string) {
  return /(^|\n)\s*(обо мне|о себе|summary|about|profile|дополнительная информация)/i.test(
    text,
  );
}

function hasMajorSectionSignals(text: string) {
  return (
    hasExperienceSignals(text) ||
    hasTargetRoleSignals(text) ||
    hasResponsibilitiesSignals(text) ||
    hasAchievementsSignals(text) ||
    hasSkillsSignals(text) ||
    hasEducationSignals(text) ||
    hasAboutSignals(text)
  );
}

function looksLikeExperienceText(text: string) {
  return /разрабатывал|реализовал|поддерживал|участвовал|внедрил|компания|senior|developer|разработчик|публикаци|production/i.test(
    text,
  );
}

function buildStructureRetryPrompt(input: {
  basePrompt: string;
  validation: ReturnType<typeof validateResumeStructure>;
}) {
  return [
    input.basePrompt,
    "",
    "Предыдущий JSON не прошёл deterministic validation.",
    "Исправь только структуру, не выдумывай данные.",
    `Ошибки: ${input.validation.errors.join("; ") || "нет"}`,
    `Warnings: ${input.validation.warnings.join("; ") || "нет"}`,
    "Особенно проверь targetRole и experience.jobs[].",
  ].join("\n");
}

function normalizeTypedFindings(
  values: Array<z.infer<typeof typedFindingSchema>>,
  sourceNode: string,
) {
  return values
    .map(
      (finding, index): TypedFinding => ({
        id:
          finding.id && finding.id.trim()
            ? finding.id.trim()
            : `${sourceNode}_finding_${String(index + 1).padStart(3, "0")}`,
        severity: normalizeFindingSeverity(finding),
        category: finding.category,
        sourceBlockId: finding.sourceBlockId,
        originalFragment: finding.exactQuote ?? finding.originalFragment,
        exactQuote: finding.exactQuote ?? finding.originalFragment,
        title: finding.title.trim(),
        problem: finding.problem.trim(),
        whyItMatters: finding.whyItMatters.trim(),
        replacementStrategy: finding.replacementStrategy.trim(),
        confidence: Math.max(0, Math.min(1, finding.confidence)),
      }),
    )
    .filter((finding) => !isProtectedAttributePenalty(finding));
}

function collectAnalysisFindings(outputs: Record<string, unknown>) {
  const findings: TypedFinding[] = [];

  for (const key of analyticalFindingNodeKeys) {
    const output = outputs[key];

    if (!output || typeof output !== "object" || !("findings" in output)) {
      continue;
    }

    const nodeFindings = (output as { findings?: unknown }).findings;

    if (Array.isArray(nodeFindings)) {
      findings.push(...(nodeFindings as TypedFinding[]));
    }
  }

  return findings;
}

function dedupeFindings(findings: TypedFinding[]) {
  const severityRank: Record<FindingSeverity, number> = {
    red: 3,
    warning: 2,
    green: 1,
  };
  const byKey = new Map<string, TypedFinding>();

  for (const finding of findings) {
    const key = getFindingDedupeKey(finding);
    const existing = byKey.get(key);

    if (
      !existing ||
      severityRank[finding.severity] > severityRank[existing.severity] ||
      finding.confidence > existing.confidence
    ) {
      byKey.set(key, finding);
    }
  }

  return [...byKey.values()].map((finding, index) => ({
    ...finding,
    id: `finding_${String(index + 1).padStart(3, "0")}`,
  }));
}

function filterFindingsForCleanText(
  findings: TypedFinding[],
  cleanText: string,
  removedArtifacts: Array<{ text?: unknown }> = [],
) {
  const normalizedCleanText = normalizeForCompare(cleanText);
  const removedArtifactText = removedArtifacts
    .map((artifact) =>
      typeof artifact.text === "string" ? normalizeForCompare(artifact.text) : "",
    )
    .filter(Boolean);

  return findings.filter((finding) => {
    const normalizedFinding = normalizeForCompare(
      [
        finding.title,
        finding.problem,
        finding.originalFragment ?? "",
        finding.replacementStrategy,
      ].join(" "),
    );

    if (
      removedArtifactText.some(
        (artifact) =>
          artifact && (normalizedFinding.includes(artifact) || artifact.includes(normalizedFinding)),
      ) ||
      /resume updated|headhunter|hh ru|колонтитул|артефакт|резюме обновлено/.test(
        normalizedFinding,
      )
    ) {
      return false;
    }

    if (finding.originalFragment) {
      const normalizedFragment = normalizeForCompare(finding.originalFragment);

      if (
        normalizedFragment &&
        !normalizedCleanText.includes(normalizedFragment)
      ) {
        return false;
      }
    }

    return true;
  });
}

function normalizeForCompare(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeFindingSeverity(
  finding: z.infer<typeof typedFindingSchema>,
): FindingSeverity {
  const text = normalizeForCompare(
    [
      finding.title,
      finding.problem,
      finding.whyItMatters,
      finding.originalFragment ?? "",
      finding.replacementStrategy,
    ].join(" "),
  );

  if (
    finding.severity === "red" &&
    (finding.category === "language" ||
      text.includes("англий") ||
      text.includes("english"))
  ) {
    return "warning";
  }

  if (finding.severity === "red" && finding.category === "skills") {
    return "warning";
  }

  return finding.severity;
}

function isProtectedAttributePenalty(finding: TypedFinding) {
  const text = normalizeForCompare(
    [
      finding.title,
      finding.problem,
      finding.whyItMatters,
      finding.originalFragment ?? "",
      finding.replacementStrategy,
    ].join(" "),
  );

  return [
    "возраст",
    "дата рождения",
    "родился",
    "родилась",
    "пол",
    "мужчина",
    "женщина",
    "гражданство",
    "национальность",
    "семейное положение",
  ].some((marker) => text.includes(marker));
}

function getFindingDedupeKey(finding: TypedFinding) {
  const text = normalizeForCompare(
    [
      finding.category,
      finding.title,
      finding.problem,
      finding.originalFragment ?? "",
      finding.replacementStrategy,
    ].join(" "),
  );

  if (text.includes("англий") || text.includes("english")) {
    return "language|english_level";
  }

  if (text.includes("ci cd") || text.includes("cicd")) {
    return "skills|ci_cd_tools";
  }

  if (
    text.includes("senior") ||
    text.includes("сеньор") ||
    text.includes("ментор") ||
    text.includes("лидер") ||
    text.includes("ownership") ||
    text.includes("команд")
  ) {
    return "seniority|leadership_evidence";
  }

  if (
    text.includes("метрик") ||
    text.includes("цифр") ||
    text.includes("стабильност") ||
    text.includes("доказательств")
  ) {
    return [
      "metrics",
      finding.sourceBlockId ?? "section",
      normalizeForCompare(finding.originalFragment ?? finding.title).slice(
        0,
        80,
      ),
    ].join("|");
  }

  if (
    text.includes("навык") &&
    (text.includes("формат") ||
      text.includes("перечислен") ||
      text.includes("групп"))
  ) {
    return "skills|formatting";
  }

  return [
    finding.category,
    finding.sourceBlockId ?? "section",
    normalizeForCompare(finding.originalFragment ?? finding.title).slice(0, 80),
    normalizeForCompare(finding.replacementStrategy).slice(0, 60),
  ].join("|");
}

function anchorFindings(findings: TypedFinding[], chunks: ResumeChunk[]) {
  return findings.map(
    (finding): Omit<ValidatedFinding, "replacementOptions"> => {
      const byId = finding.sourceBlockId
        ? chunks.find((chunk) => chunk.id === finding.sourceBlockId)
        : undefined;
      const byIdAnchor = byId
        ? locateFragmentInChunk(byId, finding.originalFragment)
        : null;
      const byFragment =
        !byId || !byIdAnchor?.exact
          ? findChunkByFragment(chunks, finding.originalFragment)
          : undefined;
      const windowAnchor =
        !byFragment && (!byId || !byIdAnchor?.exact)
          ? findChunkWindowByFragment(chunks, finding.originalFragment)
          : undefined;
      const chunk =
        byId && byIdAnchor?.exact
          ? byId
          : byFragment ?? windowAnchor?.chunks[0] ?? byId;
      const anchor = windowAnchor
        ? {
            charStart: windowAnchor.charStart,
            charEnd: windowAnchor.charEnd,
            exact: true,
          }
        : chunk
          ? chunk === byId && byIdAnchor
            ? byIdAnchor
            : locateFragmentInChunk(chunk, finding.originalFragment)
          : null;
      const scoreImpact = getScoreImpact(finding);
      const hasValidAnchor = Boolean(
        chunk && (!finding.originalFragment || anchor?.exact),
      );
      const anchorChunks = windowAnchor?.chunks ?? (chunk ? [chunk] : []);

      return {
        ...finding,
        sourceBlockId: hasValidAnchor ? chunk?.id ?? null : null,
        anchorChunkIds: hasValidAnchor
          ? anchorChunks.map((anchorChunk) => anchorChunk.id)
          : [],
        sourceBlockIds: hasValidAnchor
          ? uniqueStrings(
              anchorChunks.flatMap((anchorChunk) =>
                getChunkRawBlockIds(anchorChunk),
              ),
            )
          : [],
        originalFragment: finding.originalFragment ?? chunk?.text ?? null,
        charStart: hasValidAnchor ? anchor?.charStart ?? null : null,
        charEnd: hasValidAnchor ? anchor?.charEnd ?? null : null,
        anchorStatus:
          hasValidAnchor && windowAnchor
            ? "fuzzy"
            : hasValidAnchor && chunk === byId && anchor?.exact
              ? "exact"
              : hasValidAnchor && chunk === byId
                ? "chunk"
                : hasValidAnchor && byFragment
                  ? "fuzzy"
                  : finding.sourceBlockId || finding.originalFragment
                    ? "section_level"
                    : "missing",
        scoreImpact,
        priority:
          scoreImpact <= -10 || finding.severity === "red"
            ? "high"
            : finding.severity === "warning"
              ? "medium"
              : "low",
      };
    },
  );
}

function enforceIssueCoverage(input: {
  findings: TypedFinding[];
  cleanText: string;
  displayBlocks: DisplayBlock[];
  targetMin: number;
  targetMax: number;
}) {
  const heuristicFindings =
    input.findings.length < input.targetMin
      ? buildHeuristicAuditFindings(input.cleanText, input.displayBlocks)
      : [];
  const findings = rankFindings(
    dedupeFindings([...input.findings, ...heuristicFindings]),
  ).slice(0, input.targetMax);

  return {
    findings,
    count: findings.length,
    addedHeuristicFindings: Math.max(
      0,
      findings.length - input.findings.length,
    ),
    targetMin: input.targetMin,
    targetMax: input.targetMax,
    bySeverity: {
      red: findings.filter((finding) => finding.severity === "red").length,
      warning: findings.filter((finding) => finding.severity === "warning")
        .length,
      green: findings.filter((finding) => finding.severity === "green").length,
    },
    warnings:
      findings.length < input.targetMin
        ? [
            `Only ${findings.length} findings after coverage gate; targeted second-pass heuristics could not reach ${input.targetMin}.`,
          ]
        : [],
  };
}

function buildHeuristicAuditFindings(
  cleanText: string,
  displayBlocks: DisplayBlock[],
) {
  const findings: TypedFinding[] = [];
  const pushFinding = (input: {
    severity?: FindingSeverity;
    category: FindingCategory;
    block: DisplayBlock;
    quote?: string;
    title: string;
    problem: string;
    whyItMatters: string;
    replacementStrategy: string;
    confidence?: number;
  }) => {
    const quote = getSafeQuote(input.quote ?? input.block.text, cleanText);

    if (!quote || isProtectedQuote(quote)) {
      return;
    }

    findings.push({
      id: `coverage_finding_${String(findings.length + 1).padStart(3, "0")}`,
      severity: input.severity ?? "warning",
      category: input.category,
      sourceBlockId: input.block.id,
      originalFragment: quote,
      exactQuote: quote,
      title: input.title,
      problem: input.problem,
      whyItMatters: input.whyItMatters,
      replacementStrategy: input.replacementStrategy,
      confidence: input.confidence ?? 0.72,
    });
  };

  const firstContact = displayBlocks.find((block) => block.type === "contact");
  const firstAbout = displayBlocks.find((block) => block.section === "about");
  const firstSkills = displayBlocks.find((block) => block.section === "skills");
  const hasLinks = /https?:\/\/|github|linkedin|gitlab|portfolio/i.test(
    cleanText,
  );
  const hasEnglishLevel = /english|английский|b1|b2|c1|c2|ielts|toefl/i.test(
    cleanText,
  );
  const hasSeniorSignal = /senior|lead|ведущ|старш|руковод|ментор/i.test(
    cleanText,
  );
  const hasLeadershipEvidence =
    /команд|ментор|ревью|code review|лидер|руковод|онбординг/i.test(cleanText);

  if (!hasLinks && firstContact) {
    pushFinding({
      category: "structure",
      block: firstContact,
      quote: firstContact.text,
      title: "Нет ссылок на профессиональные профили",
      problem:
        "В контактном блоке нет GitHub, LinkedIn, портфолио или ссылок на опубликованные приложения.",
      whyItMatters:
        "Для технической роли ссылки ускоряют проверку опыта и повышают доверие к резюме.",
      replacementStrategy:
        "Добавить ссылки на GitHub/LinkedIn/портфолио или приложения, если они есть.",
      confidence: 0.82,
    });
  }

  if (!hasEnglishLevel && firstSkills) {
    pushFinding({
      category: "language",
      block: firstSkills,
      quote: firstSkills.text,
      title: "Не указан уровень английского языка",
      problem:
        "В резюме не видно уровня английского, хотя для IT-вакансий это часто важный фильтр.",
      whyItMatters:
        "Рекрутер не понимает, можно ли рассматривать кандидата для команд с документацией, коммуникацией или интервью на английском.",
      replacementStrategy:
        "Добавить строку с уровнем английского только если кандидат готов его подтвердить.",
      confidence: 0.74,
    });
  }

  if (hasSeniorSignal && !hasLeadershipEvidence) {
    const seniorBlock =
      displayBlocks.find((block) => /senior|старш|ведущ/i.test(block.text)) ??
      displayBlocks.find((block) => block.section === "target_role") ??
      displayBlocks[0];

    if (seniorBlock) {
      pushFinding({
        category: "seniority",
        block: seniorBlock,
        quote: seniorBlock.text,
        title: "Senior-позиционирование слабо подтверждено",
        problem:
          "В резюме есть senior-сигнал, но мало явных доказательств ownership, влияния на команду, code review или принятия архитектурных решений.",
        whyItMatters:
          "Для senior-уровня работодатель ожидает не только выполнение задач, но и влияние на качество продукта, команду и инженерные решения.",
        replacementStrategy:
          "Добавить подтвержденные факты про ownership, review, менторство, архитектурные решения или самостоятельное ведение направлений.",
        confidence: 0.72,
      });
    }
  }

  if (firstAbout && firstAbout.charStart > cleanText.length * 0.72) {
    pushFinding({
      category: "summary",
      block: firstAbout,
      quote: firstAbout.text,
      title: "Summary находится слишком поздно",
      problem:
        "Блок о кандидате расположен ближе к концу документа, поэтому сильное позиционирование видно поздно.",
      whyItMatters:
        "Рекрутер сначала сканирует верхнюю часть резюме; поздний summary хуже продает профиль.",
      replacementStrategy:
        "Перенести краткое позиционирование ближе к началу резюме или усилить верхний блок.",
      confidence: 0.78,
    });
  }

  for (const block of displayBlocks) {
    const text = block.text.trim();

    if (text.length < 35 || isProtectedQuote(text)) {
      continue;
    }

    if (
      /участвовал|получил опыт|работал над|занимался|помогал/i.test(text)
    ) {
      pushFinding({
        category: "bullet_quality",
        block,
        quote: text,
        title: "Слабая формулировка вклада",
        problem:
          "Фраза описывает участие или полученный опыт, но не показывает конкретный вклад кандидата.",
        whyItMatters:
          "Для сильного резюме важнее результат и зона ответственности, чем факт участия.",
        replacementStrategy:
          "Переписать через действие, объект работы и проверяемый результат без выдуманных метрик.",
        confidence: 0.76,
      });
    }

    if (
      /повысил|улучшил|ускорил|снизил|увеличил|стабильност|оптимиз|автоматиз|выстроил|реализовал/i.test(
        text,
      ) &&
      !/\d|%|млн|тыс|x\b|раз\b/i.test(text)
    ) {
      pushFinding({
        category: "metrics_evidence",
        block,
        quote: text,
        title: "Результат без измеримого доказательства",
        problem:
          "Фрагмент заявляет улучшение или результат, но не показывает масштаб, базу сравнения или измеримый эффект.",
        whyItMatters:
          "Без доказательства сильное утверждение может выглядеть как субъективная оценка.",
        replacementStrategy:
          "Добавить подтвержденную метрику или уточнить механизм результата без придумывания цифр.",
        confidence: 0.8,
      });
    }

    if (/существенно|значительно|критично|сложн|массов/i.test(text)) {
      pushFinding({
        category: "credibility",
        block,
        quote: text,
        title: "Сильное утверждение требует контекста",
        problem:
          "Фрагмент использует усилители, но не всегда объясняет, за счет чего достигнут эффект.",
        whyItMatters:
          "Hiring manager будет проверять не громкость формулировки, а механизм и доказуемость результата.",
        replacementStrategy:
          "Добавить контекст: ограничение, действие, механизм и подтвержденный результат.",
        confidence: 0.7,
      });
    }

    if (
      /ci\/cd|cicd/i.test(text) &&
      !/github actions|gitlab|fastlane|bitrise|codemagic|jenkins/i.test(text)
    ) {
      pushFinding({
        category: "skills",
        block,
        quote: text,
        title: "CI/CD указан без инструментов",
        problem:
          "CI/CD упомянут как навык или процесс, но конкретные инструменты и зона ответственности не названы.",
        whyItMatters:
          "Без инструментов непонятно, кандидат настраивал пайплайны сам или только пользовался готовым процессом.",
        replacementStrategy:
          "Уточнить инструменты и конкретный вклад, если это можно подтвердить.",
        confidence: 0.77,
      });
    }

    if (block.section === "skills" && text.length > 140) {
      pushFinding({
        category: "formatting",
        block,
        quote: text,
        title: "Навыки выглядят как плотный список",
        problem:
          "Список навыков перегружен и слабо сгруппирован по категориям.",
        whyItMatters:
          "Рекрутеру и ATS проще считывать навыки, когда они разбиты на технологии, процессы, инструменты и языки.",
        replacementStrategy:
          "Сгруппировать навыки по категориям, не удаляя важные ключевые слова.",
        confidence: 0.83,
      });
    }

    if (text.length > 420) {
      pushFinding({
        category: "readability",
        block,
        quote: text.slice(0, 260),
        title: "Слишком длинный текстовый блок",
        problem:
          "Фрагмент занимает много строк и смешивает несколько мыслей в одном блоке.",
        whyItMatters:
          "Длинные блоки хуже сканируются и могут скрывать сильные достижения.",
        replacementStrategy:
          "Разбить блок на 2-4 коротких пункта с отдельными акцентами.",
        confidence: 0.73,
      });
    }
  }

  return findings;
}

function getSafeQuote(value: string, cleanText: string) {
  const quote = value.trim();

  if (!quote) {
    return null;
  }

  if (cleanText.includes(quote)) {
    return quote;
  }

  const compactQuote = quote.replace(/\s+/g, " ");
  const compactText = cleanText.replace(/\s+/g, " ");

  return compactText.includes(compactQuote) ? quote : null;
}

function isProtectedQuote(value: string) {
  return /возраст|родил|мужчина|женщина|гражданство|национальност|семейн|birth|citizenship|gender/i.test(
    value,
  );
}

function rankFindings(findings: TypedFinding[]) {
  const severityRank: Record<FindingSeverity, number> = {
    red: 3,
    warning: 2,
    green: 1,
  };

  return findings.slice().sort((a, b) => {
    const severityDiff = severityRank[b.severity] - severityRank[a.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return b.confidence - a.confidence;
  });
}

function anchorFindingsInCleanText(
  findings: TypedFinding[],
  cleanText: string,
  displayBlocks: DisplayBlock[],
) {
  return findings.map(
    (finding): Omit<ValidatedFinding, "replacementOptions"> => {
      const quote = finding.exactQuote ?? finding.originalFragment;
      const exactRange = quote
        ? findQuoteRangeInCleanText(cleanText, quote)
        : null;
      const blockSegments = exactRange
        ? getDisplayBlockSegments(displayBlocks, exactRange)
        : [];
      const scoreImpact = getScoreImpact(finding);
      const hasValidAnchor = Boolean(exactRange && blockSegments.length > 0);

      return {
        ...finding,
        sourceBlockId: hasValidAnchor
          ? blockSegments[0]?.blockId ?? null
          : finding.sourceBlockId,
        anchorChunkIds: hasValidAnchor
          ? blockSegments.map((segment) => segment.blockId)
          : [],
        anchorSegments: hasValidAnchor ? blockSegments : [],
        sourceBlockIds: hasValidAnchor
          ? blockSegments.map((segment) => segment.blockId)
          : [],
        originalFragment: quote ?? finding.originalFragment ?? null,
        exactQuote: quote ?? null,
        charStart: exactRange?.charStart ?? null,
        charEnd: exactRange?.charEnd ?? null,
        anchorStatus: hasValidAnchor
          ? exactRange?.exact
            ? "exact"
            : "fuzzy"
          : quote
            ? "section_level"
            : "missing",
        scoreImpact,
        priority:
          scoreImpact <= -10 || finding.severity === "red"
            ? "high"
            : finding.severity === "warning"
              ? "medium"
              : "low",
      };
    },
  );
}

function findQuoteRangeInCleanText(cleanText: string, quote: string) {
  const trimmedQuote = quote.trim();

  if (!trimmedQuote) {
    return null;
  }

  const exactIndex = cleanText.indexOf(trimmedQuote);

  if (exactIndex >= 0) {
    return {
      charStart: exactIndex,
      charEnd: exactIndex + trimmedQuote.length,
      exact: true,
    };
  }

  const loosePattern = trimmedQuote
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");

  if (!loosePattern) {
    return null;
  }

  const looseMatch = new RegExp(loosePattern, "i").exec(cleanText);

  if (!looseMatch || looseMatch.index < 0) {
    return null;
  }

  return {
    charStart: looseMatch.index,
    charEnd: looseMatch.index + looseMatch[0].length,
    exact: false,
  };
}

function getDisplayBlockSegments(
  displayBlocks: DisplayBlock[],
  range: { charStart: number; charEnd: number },
) {
  return displayBlocks
    .filter(
      (block) => block.charStart < range.charEnd && block.charEnd > range.charStart,
    )
    .map((block) => ({
      blockId: block.id,
      charStart: Math.max(block.charStart, range.charStart),
      charEnd: Math.min(block.charEnd, range.charEnd),
    }))
    .filter((segment) => segment.charEnd > segment.charStart);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getChunkRawBlockIds(chunk: ResumeChunk) {
  return Array.isArray(chunk.meta?.rawBlockIds)
    ? (chunk.meta.rawBlockIds as unknown[]).filter(
        (id): id is string => typeof id === "string",
      )
    : [];
}

function findChunkByFragment(chunks: ResumeChunk[], fragment: string | null) {
  if (!fragment) {
    return undefined;
  }

  const needle = normalizeForCompare(fragment);

  if (!needle) {
    return undefined;
  }

  return chunks.find((chunk) => {
    const haystack = normalizeForCompare(chunk.text);
    return haystack.includes(needle);
  });
}

function findChunkWindowByFragment(
  chunks: ResumeChunk[],
  fragment: string | null,
) {
  if (!fragment) {
    return undefined;
  }

  const needle = normalizeForCompare(fragment);

  if (!needle) {
    return undefined;
  }

  for (let windowSize = 2; windowSize <= 5; windowSize += 1) {
    for (let start = 0; start + windowSize <= chunks.length; start += 1) {
      const window = chunks.slice(start, start + windowSize);

      if (!isContiguousAnchorWindow(window)) {
        continue;
      }

      const haystack = normalizeForCompare(
        window.map((chunk) => chunk.text).join(" "),
      );

      if (haystack.includes(needle) || needle.includes(haystack)) {
        return {
          chunks: window,
          charStart: Math.min(...window.map((chunk) => chunk.charStart)),
          charEnd: Math.max(...window.map((chunk) => chunk.charEnd)),
        };
      }
    }
  }

  return undefined;
}

function isContiguousAnchorWindow(chunks: ResumeChunk[]) {
  if (chunks.length < 2) {
    return false;
  }

  const first = chunks[0];

  return chunks.every(
    (chunk) =>
      chunk.section === first.section &&
      (chunk.parentId ?? null) === (first.parentId ?? null),
  );
}

function locateFragmentInChunk(chunk: ResumeChunk, fragment: string | null) {
  if (!fragment) {
    return {
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      exact: false,
    };
  }

  const index = chunk.text.toLowerCase().indexOf(fragment.toLowerCase());

  if (index >= 0) {
    return {
      charStart: chunk.charStart + index,
      charEnd: chunk.charStart + index + fragment.length,
      exact: true,
    };
  }

  return {
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    exact: false,
  };
}

function getScoreImpact(finding: Pick<TypedFinding, "severity" | "category">) {
  const categoryMultiplier: Partial<Record<FindingCategory, number>> = {
    ats: 1.2,
    metrics_evidence: 1.2,
    credibility: 1.3,
    experience: 1.15,
    seniority: 1.15,
    keywords: 1.1,
  };
  const base =
    finding.severity === "red" ? -12 : finding.severity === "warning" ? -6 : 0;
  const multiplier = categoryMultiplier[finding.category] ?? 1;

  return Math.round(base * multiplier);
}

function defaultReplacement(
  finding: Omit<ValidatedFinding, "replacementOptions">,
) {
  const text =
    finding.replacementStrategy === "remove_fragment"
      ? "Удалить этот фрагмент, если он не несёт полезной информации."
      : `Переписать фрагмент по стратегии "${finding.replacementStrategy}" без выдуманных фактов. Если не хватает данных, использовать [метрика], [значение], [период], [действие].`;

  return {
    text,
    type:
      finding.replacementStrategy === "remove_fragment"
        ? "remove"
        : "metric_template",
    usesPlaceholders: text.includes("["),
    isSafe: true,
    explanation:
      "Fallback replacement создан без добавления новых фактов, потому что LLM не вернула вариант для этого finding.",
  } satisfies ReplacementOption;
}

function mergeReplacements(
  anchoredFindings: Array<Omit<ValidatedFinding, "replacementOptions">>,
  replacements: Array<{
    findingId: string;
    replacementOptions: ReplacementOption[];
  }>,
) {
  const byFindingId = new Map(
    replacements.map((item) => [item.findingId, item.replacementOptions]),
  );

  return anchoredFindings.map(
    (finding): ValidatedFinding => ({
      ...finding,
      replacementOptions: byFindingId
        .get(finding.id)
        ?.filter((option) => option.isSafe) ?? [defaultReplacement(finding)],
    }),
  );
}

function selectReplacementCandidates(
  findings: Array<Omit<ValidatedFinding, "replacementOptions">>,
  limit: number,
) {
  const severityRank: Record<FindingSeverity, number> = {
    red: 3,
    warning: 2,
    green: 1,
  };

  return findings
    .filter(
      (finding) =>
        finding.severity !== "green" &&
        finding.anchorStatus !== "missing" &&
        Boolean(finding.exactQuote ?? finding.originalFragment),
    )
    .slice()
    .sort((a, b) => {
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];

      if (severityDiff !== 0) {
        return severityDiff;
      }

      const impactDiff = Math.abs(b.scoreImpact) - Math.abs(a.scoreImpact);

      if (impactDiff !== 0) {
        return impactDiff;
      }

      return b.confidence - a.confidence;
    })
    .slice(0, limit);
}

function filterValidReplacements(
  replacements: Array<{
    findingId: string;
    replacementOptions: ReplacementOption[];
  }>,
  allowedFindingIds: Set<string>,
  context: {
    anchoredFindings: Array<Omit<ValidatedFinding, "replacementOptions">>;
    chunks: ResumeChunk[];
  },
) {
  const findingById = new Map(
    context.anchoredFindings.map((finding) => [finding.id, finding]),
  );

  return replacements
    .filter((replacement) => allowedFindingIds.has(replacement.findingId))
    .map((replacement) => ({
      findingId: replacement.findingId,
      replacementOptions: replacement.replacementOptions
        .filter((option) => {
          if (!option.isSafe || !option.text.trim()) {
            return false;
          }

          const finding = findingById.get(replacement.findingId);

          return finding
            ? isReplacementSupportedBySource(option, finding, context.chunks)
            : false;
        })
        .map((option) => ({
          ...option,
          type:
            option.type === "template"
              ? ("metric_template" as const)
              : option.type === "safe"
                ? ("safe_rewrite" as const)
                : option.type,
        }))
        .slice(0, 3),
    }))
    .filter((replacement) => replacement.replacementOptions.length > 0);
}

function isReplacementSupportedBySource(
  option: ReplacementOption,
  finding: Omit<ValidatedFinding, "replacementOptions">,
  chunks: ResumeChunk[],
) {
  if (option.type !== "safe_rewrite") {
    return true;
  }

  const context = normalizeForCompare(
    [
      finding.originalFragment ?? "",
      getFindingSourceChunks(finding, chunks)
        .map((chunk) => chunk.text)
        .join(" "),
    ].join(" "),
  );
  const replacementText = removePlaceholderText(option.text);
  const unsupportedTerms = getUnsupportedReplacementTerms(replacementText);

  return unsupportedTerms.every((term) => context.includes(term));
}

function getFindingSourceChunks(
  finding: Omit<ValidatedFinding, "replacementOptions">,
  chunks: ResumeChunk[],
) {
  const ids =
    finding.anchorChunkIds && finding.anchorChunkIds.length > 0
      ? finding.anchorChunkIds
      : finding.sourceBlockId
        ? [finding.sourceBlockId]
        : [];
  const idSet = new Set(ids);

  return chunks.filter((chunk) => idSet.has(chunk.id));
}

function removePlaceholderText(value: string) {
  return value.replace(/\[[^\]]+\]/g, " ");
}

function getUnsupportedReplacementTerms(value: string) {
  const text = normalizeForCompare(value);
  const terms = [
    "микросервис",
    "микросервисы",
    "microservice",
    "microservices",
    "kubernetes",
    "docker",
    "kafka",
    "rabbitmq",
    "grpc",
    "graphql",
    "redis",
    "postgresql",
    "mongodb",
    "aws",
    "azure",
    "fastlane",
    "github actions",
    "gitlab ci",
    "time to market",
    "многоэтапная валидация",
    "многоэтапную валидацию",
  ];

  return terms.filter((term) => text.includes(term));
}

function buildReplacementRetryPrompt(input: {
  basePrompt: string;
  allowedFindingIds: string[];
  invalidCount: number;
  previousError?: string;
}) {
  return [
    input.basePrompt,
    "",
    "Previous replacement result was rejected by deterministic validation.",
    `Allowed findingIds only: ${input.allowedFindingIds.join(", ")}`,
    `Invalid or missing replacements count: ${input.invalidCount}.`,
    input.previousError ? `Previous error: ${input.previousError}` : null,
    "Return replacements only for existing findingId values. Do not invent chunk ids.",
    "Every finding must have at least one safe_rewrite without invented facts.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReplacementPrompt(input: {
  anchoredFindings: Array<Omit<ValidatedFinding, "replacementOptions">>;
  chunks: ResumeChunk[];
  targetProfile: unknown;
  normalizedResume: unknown;
  analysisDate: string;
}) {
  const sourceBlockIds = new Set(
    input.anchoredFindings
      .flatMap((finding) =>
        finding.anchorChunkIds && finding.anchorChunkIds.length > 0
          ? finding.anchorChunkIds
          : finding.sourceBlockId
            ? [finding.sourceBlockId]
            : [],
      )
      .filter((id): id is string => Boolean(id)),
  );
  const relevantChunks = input.chunks
    .filter((chunk) => sourceBlockIds.has(chunk.id))
    .map((chunk) => ({
      id: chunk.id,
      type: chunk.type,
      section: chunk.section,
      parentId: chunk.parentId,
      text: chunk.text,
    }));
  const findings = input.anchoredFindings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    sourceBlockId: finding.sourceBlockId,
    anchorChunkIds: finding.anchorChunkIds ?? [],
    anchorSegments: finding.anchorSegments ?? [],
    sourceBlockIds: finding.sourceBlockIds ?? [],
    originalFragment: finding.originalFragment,
    exactQuote: finding.exactQuote,
    title: finding.title,
    problem: finding.problem,
    whyItMatters: finding.whyItMatters,
    replacementStrategy: finding.replacementStrategy,
    scoreImpact: finding.scoreImpact,
    priority: finding.priority,
  }));

  return [
    "Generate safe resume fragment replacements.",
    "Return only JSON matching this shape:",
    '{"replacements":[{"findingId":"finding_001","replacementOptions":[{"text":"...","type":"safe_rewrite","usesPlaceholders":false,"isSafe":true,"explanation":"..."}]}]}',
    "",
    "Rules:",
    "- Use only findingId values from allowedFindingIds.",
    "- Do not invent metrics, companies, tools, dates, roles, or achievements.",
    "- For each finding return at least one safe_rewrite.",
    "- If exact metric is missing, safe_rewrite must avoid invented numbers; optional second option may be metric_template with placeholders.",
    "- type must be one of: safe_rewrite, metric_template, remove, move, add_context.",
    "- isSafe must be true only when the replacement does not add unsupported facts.",
    "- Write Russian text.",
    "",
    `analysisDate: ${input.analysisDate}`,
    `allowedFindingIds: ${input.anchoredFindings.map((finding) => finding.id).join(", ")}`,
    "",
    "targetProfile:",
    compactState(input.targetProfile, 3_000),
    "",
    "normalizedResume:",
    compactState(input.normalizedResume, 4_000),
    "",
    "findings:",
    compactState(findings, 10_000),
    "",
    "sourceChunks:",
    compactState(relevantChunks, 8_000),
  ].join("\n");
}

function calculateScores(
  findings: ValidatedFinding[],
  documentQuality: unknown,
  context: {
    structureValidation?: unknown;
    chunks: ResumeChunk[];
    anchoredRatio: number;
    displayCoverage?: number;
    findingsCount?: number;
  },
) {
  const categoryGroups: Record<
    string,
    { categories: FindingCategory[]; label: string }
  > = {
    ats: { categories: ["ats", "keywords", "formatting"], label: "ATS" },
    structure: {
      categories: ["structure", "positioning", "summary"],
      label: "Структура",
    },
    experience: {
      categories: ["experience", "bullet_quality", "metrics_evidence"],
      label: "Опыт",
    },
    skills: { categories: ["skills", "keywords"], label: "Навыки" },
    marketFit: {
      categories: ["seniority", "market_fit", "positioning"],
      label: "Рынок",
    },
    readability: {
      categories: ["language", "readability", "formatting", "consistency"],
      label: "Читаемость",
    },
    credibility: {
      categories: ["credibility", "metrics_evidence", "consistency"],
      label: "Доверие",
    },
  };
  const qualityScore =
    documentQuality &&
    typeof documentQuality === "object" &&
    "qualityScore" in documentQuality &&
    typeof (documentQuality as { qualityScore?: unknown }).qualityScore ===
      "number"
      ? (documentQuality as { qualityScore: number }).qualityScore
      : 100;
  const scores: Record<string, unknown> = {};
  const structureMeta = getStructureCompletenessMeta(context);

  for (const [key, group] of Object.entries(categoryGroups)) {
    const related = findings.filter((finding) =>
      group.categories.includes(finding.category),
    );
    const penalty = related.reduce(
      (total, finding) =>
        total + (finding.scoreImpact < 0 ? Math.abs(finding.scoreImpact) : 0),
      0,
    );
    const technicalPenalty =
      key === "ats" ? Math.max(0, 100 - qualityScore) : 0;
    let value = clampScore(100 - penalty - technicalPenalty);

    if (key === "structure" && !structureMeta.structureComplete) {
      value = Math.min(value, 75);
    }

    if (
      key === "experience" &&
      (!structureMeta.hasExperienceBullets || !structureMeta.hasAchievements)
    ) {
      value = Math.min(value, 75);
    }

    if (key === "skills" && !structureMeta.hasSkillChunks) {
      value = Math.min(value, 75);
    }

    if (structureMeta.isPartial) {
      value = Math.min(value, 85);
    }

    const counts = countSeverity(related);
    scores[key] = {
      label: group.label,
      value,
      isPartial: structureMeta.isPartial,
      confidence: structureMeta.scoreConfidence,
      displayLabel: structureMeta.isPartial ? "Preliminary score" : undefined,
      red: counts.red,
      warning: counts.warning,
      green: counts.green,
      explanation:
        related.length === 0
          ? "Критичных замечаний в этой категории не найдено."
          : `Оценка снижена на основе ${related.length} замечаний.`,
    };
  }

  const numericValues = Object.values(scores)
    .map((score) =>
      score && typeof score === "object" && "value" in score
        ? Number((score as { value: number }).value)
        : 100,
    )
    .filter(Number.isFinite);
  let overall = Math.round(
    numericValues.reduce((total, value) => total + value, 0) /
      Math.max(numericValues.length, 1),
  );

  if (structureMeta.isPartial) {
    overall = Math.min(overall, 75);
  }

  return {
    scores: {
      overall: {
        label: "Общая оценка",
        value: overall,
        isPartial: structureMeta.isPartial,
        confidence: structureMeta.scoreConfidence,
        explanation:
          "Оценка рассчитана после typed findings: red/warning/green, ATS, evidence, keywords, readability и credibility.",
      },
      ...scores,
    },
    priorities: {
      fixFirst: findings
        .filter(
          (finding) =>
            finding.priority === "high" && finding.severity !== "green",
        )
        .slice(0, 5)
        .map(toPriorityItem),
      quickWins: findings
        .filter(
          (finding) =>
            finding.priority !== "high" && finding.severity !== "green",
        )
        .slice(0, 5)
        .map(toPriorityItem),
      lowPriority: findings
        .filter(
          (finding) =>
            finding.priority === "low" && finding.severity !== "green",
        )
        .slice(0, 5)
        .map(toPriorityItem),
      strengths: findings
        .filter((finding) => finding.severity === "green")
        .slice(0, 5)
        .map(toPriorityItem),
    },
    recommendations: findings
      .slice()
      .sort((a, b) => a.scoreImpact - b.scoreImpact)
      .slice(0, 7)
      .map((finding) => finding.title),
    metadata: structureMeta,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStructureCompletenessMeta(input: {
  structureValidation?: unknown;
  chunks: ResumeChunk[];
  anchoredRatio: number;
  displayCoverage?: number;
  findingsCount?: number;
}) {
  const validation =
    input.structureValidation &&
    typeof input.structureValidation === "object"
      ? (input.structureValidation as {
          isUsable?: boolean;
          errors?: unknown;
          warnings?: unknown;
          coverage?: {
            referencedRatio?: unknown;
            unprocessedRawBlockIds?: unknown;
          };
          sectionCompleteness?: Record<string, unknown>;
        })
      : {};
  const chunkTypes = new Set(input.chunks.map((chunk) => chunk.type));
  const sectionCompleteness = validation.sectionCompleteness ?? {};
  const hasExperienceBullets =
    chunkTypes.has("responsibility_bullet") &&
    chunkTypes.has("achievement_bullet") &&
    sectionCompleteness.responsibilities !== false &&
    sectionCompleteness.achievements !== false;
  const hasAchievements =
    chunkTypes.has("achievement_bullet") &&
    sectionCompleteness.achievements !== false;
  const hasSkillChunks = chunkTypes.has("skill_item");
  const coverageRatio =
    typeof validation.coverage?.referencedRatio === "number"
      ? validation.coverage.referencedRatio
      : 1;
  const validationErrors = Array.isArray(validation.errors)
    ? validation.errors.map(String)
    : [];
  const validationWarnings = Array.isArray(validation.warnings)
    ? validation.warnings.map(String)
    : [];
  const completenessValues = Object.values(sectionCompleteness);
  const sectionsComplete =
    completenessValues.length === 0
      ? true
      : completenessValues.every((value) => value !== false);
  const displayCoverage = input.displayCoverage ?? 1;
  const findingsCount = input.findingsCount ?? 0;
  const structureComplete =
    validation.isUsable !== false &&
    coverageRatio >= 0.8 &&
    sectionsComplete &&
    hasExperienceBullets &&
    hasSkillChunks;
  const isPartial =
    !structureComplete ||
    displayCoverage < 1 ||
    input.anchoredRatio < 0.8 ||
    findingsCount < 20;
  const pipelineWarnings = [
    ...validationErrors,
    ...validationWarnings,
    !hasExperienceBullets
      ? "Experience has no responsibility_bullet/achievement_bullet chunks."
      : null,
    !hasSkillChunks ? "Skills section has no skill_item chunks." : null,
    input.anchoredRatio < 0.8
      ? `Anchored ratio is ${input.anchoredRatio.toFixed(2)}, below 0.80.`
      : null,
    displayCoverage < 1
      ? `Display coverage is ${displayCoverage.toFixed(2)}, expected 1.00.`
      : null,
    findingsCount < 20
      ? `Findings count is ${findingsCount}, below target minimum 20.`
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    structureComplete,
    displayCoverage,
    analysisCoverage: {
      referencedRatio: coverageRatio,
      sectionCompleteness,
      unprocessedRawBlockIds:
        validation.coverage?.unprocessedRawBlockIds ?? [],
    },
    anchoredRatio: input.anchoredRatio,
    isPartial,
    scoreConfidence: isPartial ? "low" : "high",
    pipelineWarnings,
    hasExperienceBullets,
    hasAchievements,
    hasSkillChunks,
  };
}

function countSeverity(findings: ValidatedFinding[]) {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { red: 0, warning: 0, green: 0 } satisfies Record<FindingSeverity, number>,
  );
}

function toPriorityItem(finding: ValidatedFinding) {
  return {
    findingId: finding.id,
    severity: finding.severity,
    title: finding.title,
    sourceBlockId: finding.sourceBlockId,
    scoreImpact: finding.scoreImpact,
  };
}

function buildReport(input: {
  runId: string;
  analysisDate: string;
  source: unknown;
  cleanText: string;
  displayBlocks: DisplayBlock[];
  chunks: ResumeChunk[];
  sections: unknown;
  findings: ValidatedFinding[];
  scoreOutput: unknown;
  metadata: Record<string, unknown>;
}) {
  const scoreData =
    input.scoreOutput && typeof input.scoreOutput === "object"
      ? (input.scoreOutput as {
          scores?: unknown;
          priorities?: unknown;
          recommendations?: unknown;
          metadata?: unknown;
        })
      : {};

  return {
    version: RESUME_ANALYSIS_WORKFLOW_TYPE,
    runId: input.runId,
    analysisDate: input.analysisDate,
    cleanText: input.cleanText,
    displayBlocks: input.displayBlocks,
    chunks: input.chunks,
    sections: input.sections,
    findings: input.findings,
    scores: scoreData.scores ?? {},
    priorities: scoreData.priorities ?? {},
    recommendations: scoreData.recommendations ?? [],
    metadata: {
      ...input.metadata,
      ...(scoreData.metadata &&
      typeof scoreData.metadata === "object" &&
      !Array.isArray(scoreData.metadata)
        ? (scoreData.metadata as Record<string, unknown>)
        : {}),
    },
  };
}

@Injectable()
export class WorkflowService {
  private readonly listeners = new Map<string, Set<WorkflowListener>>();

  async startResumeAnalysisWorkflow(
    userId: string,
    input: ResumeAnalysisWorkflowInput,
  ) {
    const sourceResumeId = input.resumeId?.trim() || null;
    const sourceResume = sourceResumeId
      ? await prisma.resume.findFirst({
          where: {
            id: sourceResumeId,
            userId,
          },
          include: {
            versions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        })
      : null;

    if (sourceResumeId && !sourceResume) {
      throw new NotFoundException("Resume not found.");
    }

    const sourceResumeText = sourceResume?.versions[0]?.plainText?.trim() ?? "";

    if (sourceResumeId && sourceResumeText.length < 20) {
      throw new BadRequestException("Resume does not have enough text for analysis.");
    }

    const text = sourceResumeText || input.text?.trim() || demoResumeText;
    const source = sourceResume
      ? "resume_library"
      : input.text?.trim()
        ? "manual"
        : "demo";
    const modelId = input.modelId?.trim() || getResumeAnalysisModelId();
    const analysisDate = getAnalysisDate();
    const run = await prisma.workflowRun.create({
      data: {
        type: RESUME_ANALYSIS_WORKFLOW_TYPE,
        status: "pending",
        input: toJson({
          text,
          source,
          mimeType: "text/plain",
          modelId,
          analysisDate,
          persistResults: Boolean(input.persistResults && sourceResume),
          sourceResumeId: sourceResume?.id,
          sourceResumeTitle: sourceResume?.title,
          sourceResumeFolderId: sourceResume?.folderId,
          sourceOriginalFileId: sourceResume?.originalFileId,
        }),
        createdByUserId: userId,
        nodes: {
          create: workflowNodeDefinitions.map((node, index) => ({
            key: node.key,
            label: node.label,
            status: "pending",
            order: index,
            debug: toJson(
              createNodeDebug(node, {
                modelId,
              }),
            ),
          })),
        },
      },
      include: {
        nodes: true,
      },
    });
    const snapshot = this.toSnapshot(run);

    this.emit(run.id, "snapshot", snapshot);
    setTimeout(() => {
      void this.executeResumeAnalysisWorkflow(run.id).catch((error) => {
        void this.failRun(run.id, null, serializeWorkflowError(error));
      });
    }, 0);

    return snapshot;
  }

  async listRuns() {
    const runs = await prisma.workflowRun.findMany({
      where: {
        type: RESUME_ANALYSIS_WORKFLOW_TYPE,
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return {
      items: runs.map((run) => this.toSnapshot(run)),
    };
  }

  async getRunSnapshot(runId: string) {
    return this.getRunSnapshotInternal(runId);
  }

  async getRunSnapshotForUser(userId: string, runId: string) {
    return this.getRunSnapshotInternal(runId, userId);
  }

  private async getRunSnapshotInternal(runId: string, userId?: string) {
    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        ...(userId ? { createdByUserId: userId } : {}),
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException("Workflow run not found.");
    }

    const reconciledRun = await this.failTimedOutRunIfNeeded(run);

    return this.toSnapshot(reconciledRun);
  }

  private async persistResumeAnalysisArtifacts(
    run: WorkflowRunWithNodes,
    sourceText: string,
    finalOutput: unknown,
  ) {
    if (!shouldPersistResumeAnalysis(run.input)) {
      return null;
    }

    const sourceResumeId = getInputString(run.input, "sourceResumeId");

    if (!sourceResumeId) {
      return null;
    }

    const existing = await prisma.resumeAnalysisArtifact.findUnique({
      where: {
        workflowRunId: run.id,
      },
      select: {
        id: true,
        derivedResumeId: true,
      },
    });

    if (existing) {
      return {
        savedAnalysisId: existing.id,
        derivedResumeId: existing.derivedResumeId,
      };
    }

    const sourceResume = await prisma.resume.findFirst({
      where: {
        id: sourceResumeId,
        userId: run.createdByUserId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!sourceResume) {
      return null;
    }

    const plainText = getFinalCleanText(finalOutput) ?? sourceText;
    const summary = plainText.slice(0, 600);
    const baseTitle = sourceResume.title.trim() || "Резюме";

    return prisma.$transaction(async (tx) => {
      const derivedResume = await tx.resume.create({
        data: {
          userId: run.createdByUserId,
          folderId: sourceResume.folderId,
          title: `${baseTitle} — результат анализа`,
          status: "analyzed",
          originalFileId: sourceResume.originalFileId,
        },
      });
      const derivedVersion = await tx.resumeVersion.create({
        data: {
          resumeId: derivedResume.id,
          source: "uploaded",
          plainText,
          summary,
        },
      });

      await tx.resume.update({
        where: {
          id: derivedResume.id,
        },
        data: {
          currentVersionId: derivedVersion.id,
        },
      });

      const artifact = await tx.resumeAnalysisArtifact.create({
        data: {
          userId: run.createdByUserId,
          folderId: sourceResume.folderId,
          sourceResumeId: sourceResume.id,
          derivedResumeId: derivedResume.id,
          workflowRunId: run.id,
          title: `${baseTitle} — анализ`,
          finalResult: toJson(finalOutput),
        },
      });

      return {
        savedAnalysisId: artifact.id,
        derivedResumeId: derivedResume.id,
      };
    });
  }

  private async failTimedOutRunIfNeeded(run: WorkflowRunWithNodes) {
    if (run.status !== "running" || !run.currentNodeKey) {
      return run;
    }

    const currentNode = run.nodes.find((node) => node.key === run.currentNodeKey);

    if (!currentNode?.startedAt) {
      return run;
    }

    const elapsedMs = Date.now() - currentNode.startedAt.getTime();

    if (elapsedMs < workflowNodeTimeoutMs) {
      return run;
    }

    const failedNodeKey = run.currentNodeKey as WorkflowNodeKey;
    const message = `Workflow node "${failedNodeKey}" timed out after ${workflowNodeTimeoutMs}ms.`;
    const finishedAt = new Date();

    await prisma.workflowNodeRun.update({
      where: {
        runId_key: {
          runId: run.id,
          key: failedNodeKey,
        },
      },
      data: {
        status: "error",
        error: message,
        finishedAt,
        durationMs: getDurationMs(currentNode.startedAt, finishedAt),
      },
    });
    await this.failRun(run.id, failedNodeKey, message);

    const updatedRun = await prisma.workflowRun.findUnique({
      where: {
        id: run.id,
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return updatedRun ?? run;
  }

  streamRunEvents(runId: string) {
    return this.createRunEventStream(runId, () => this.getRunSnapshot(runId));
  }

  streamRunEventsForUser(userId: string, runId: string) {
    return this.createRunEventStream(runId, () =>
      this.getRunSnapshotForUser(userId, runId),
    );
  }

  private createRunEventStream(
    runId: string,
    getInitialSnapshot: () => Promise<WorkflowRunSnapshot>,
  ) {
    return new Observable<MessageEvent>((subscriber) => {
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let listener: WorkflowListener | null = null;
      let listeners: Set<WorkflowListener> | null = null;
      let closed = false;

      const cleanup = () => {
        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        if (listener && listeners) {
          listeners.delete(listener);

          if (listeners.size === 0) {
            this.listeners.delete(runId);
          }
        }
      };

      void getInitialSnapshot()
        .then((snapshot) => {
          if (closed) {
            return;
          }

          listener = (event) => {
            subscriber.next({
              type: event.type,
              data: event.data,
            });

            if (event.type === "done" || event.type === "error") {
              cleanup();
              subscriber.complete();
            }
          };
          listeners = this.listeners.get(runId) ?? new Set<WorkflowListener>();
          listeners.add(listener);
          this.listeners.set(runId, listeners);

          subscriber.next({
            type: "snapshot",
            data: snapshot,
          });

          if (snapshot.status === "success") {
            subscriber.next({
              type: "done",
              data: snapshot,
            });
            cleanup();
            subscriber.complete();
            return;
          }

          if (snapshot.status === "error") {
            subscriber.next({
              type: "error",
              data: snapshot,
            });
            cleanup();
            subscriber.complete();
            return;
          }

          heartbeat = setInterval(() => {
            subscriber.next({
              type: "heartbeat",
              data: {
                timestamp: new Date().toISOString(),
              },
            });
          }, 15_000);
        })
        .catch((error) => {
          subscriber.error(error);
        });

      return cleanup;
    });
  }

  private async executeResumeAnalysisWorkflow(runId: string) {
    const run = await prisma.workflowRun.findUnique({
      where: {
        id: runId,
      },
      include: {
        nodes: true,
      },
    });

    if (!run) {
      throw new NotFoundException("Workflow run not found.");
    }

    const text = getInputText(run.input);
    const modelId = getLlmModelId(run.input);
    const analysisDate =
      run.input && typeof run.input === "object" && "analysisDate" in run.input
        ? String((run.input as { analysisDate?: unknown }).analysisDate)
        : getAnalysisDate();
    const source =
      run.input && typeof run.input === "object" && "source" in run.input
        ? String((run.input as { source?: unknown }).source ?? "manual")
        : "manual";
    const state: WorkflowState = {
      runId,
      analysisDate,
      source: {
        mode: "admin_text",
        source,
        text,
        chars: text.length,
        mimeType: "text/plain",
      },
      modelId,
    };
    const outputs: Record<string, unknown> = {};

    try {
      for (const node of workflowNodeDefinitions) {
        const nodeInput = this.buildNodeInput(node, state, outputs);
        let promptUser = node.prompt
          ? node.key === "structure_extraction"
            ? buildStructureExtractionPrompt({
                analysisDate: state.analysisDate,
                cleanText: String(state.cleanText ?? state.plainText ?? text),
                rawBlocks: getRawBlocks(outputs),
                documentOutline: getDocumentOutline(outputs),
              })
            : renderPromptTemplate(node.prompt.userTemplate, {
              cleanText: String(state.cleanText ?? state.plainText ?? text),
              rawBlocksSummary: compactRawBlocks(getRawBlocks(outputs)),
              structureSummary: compactState(getResumeStructure(outputs) ?? {}),
              chunksSummary: compactChunks(getChunks(outputs)),
              targetProfileSummary: compactState(outputs.target_profile ?? {}),
              benchmarkSummary: compactState(outputs.benchmark_context ?? {}),
              stateSummary: compactState(safePromptState(outputs, state)),
              analysisDate: state.analysisDate,
            })
          : undefined;

        if (node.key === "replacement_generation_validation") {
          const anchoredFindings = getAnchoredFindings(outputs);
          promptUser = buildReplacementPrompt({
            anchoredFindings: selectReplacementCandidates(
              anchoredFindings,
              MAX_EAGER_REPLACEMENT_FINDINGS,
            ),
            chunks: getAnchorSourceChunks(outputs),
            targetProfile: outputs.target_profile,
            normalizedResume: outputs.resume_normalization,
            analysisDate: state.analysisDate,
          });
        }

        if (analyticalFindingNodeKeys.has(node.key)) {
          promptUser = buildAnalysisNodePrompt({
            nodeKey: node.key,
            analysisDate: state.analysisDate,
            cleanText: String(state.cleanText ?? state.plainText ?? text),
            displayBlocks: getDisplayBlocks(outputs),
            analysisTasks: getAnalysisTasks(outputs),
            resumeStructure: getResumeStructure(outputs),
            targetProfile: outputs.target_profile,
            benchmark: outputs.benchmark_context,
          });
        }

        const output = await this.runNode(
          runId,
          node.key,
          nodeInput,
          async () =>
            this.executeWorkflowNode({
              node,
              input: nodeInput,
              modelId,
              promptUser,
              state,
              text,
              outputs,
            }),
          createNodeDebug(node, {
            modelId,
            promptUser,
          }),
        );

        outputs[node.key] = output;
        state[node.key] = output;

        this.applyOutputToState(node.key, output, state);
      }

      const finalOutput =
        outputs.final_report_assembly ??
        ({
          version: RESUME_ANALYSIS_WORKFLOW_TYPE,
          completedAt: new Date().toISOString(),
          outputs,
        } satisfies Record<string, unknown>);
      const persistedArtifacts = await this.persistResumeAnalysisArtifacts(
        run,
        text,
        finalOutput,
      );

      await prisma.workflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "success",
          output: toOptionalJson(finalOutput),
          finalResult: toOptionalJson(finalOutput),
          savedAnalysisId: persistedArtifacts?.savedAnalysisId ?? null,
          derivedResumeId: persistedArtifacts?.derivedResumeId ?? null,
          currentNodeKey: null,
          nextNodeKey: null,
          finishedAt: new Date(),
        },
      });
      await this.emitCurrent(runId, "done");
    } catch (error) {
      await this.failRun(
        runId,
        this.getFailedNodeKey(error),
        serializeWorkflowError(error),
      );
    }
  }

  private buildNodeInput(
    node: WorkflowNodeDefinition,
    state: WorkflowState,
    outputs: Record<string, unknown>,
  ) {
    const rawBlocks = getRawBlocks(outputs);
    const chunks = getChunks(outputs);
    const needsFullRawBlocks = new Set([
      "lossless_document_map",
      "document_outline",
      "structure_extraction",
      "structure_repair",
      "structure_validation",
      "resume_chunking",
      "analysis_task_planner",
    ]).has(node.key);

    return {
      nodeKey: node.key,
      reads: node.reads,
      analysisDate: state.analysisDate,
      source:
        state.source && typeof state.source === "object"
          ? {
              ...(state.source as Record<string, unknown>),
              text: undefined,
            }
          : state.source,
      cleanText: state.cleanText,
      rawBlocks: needsFullRawBlocks ? rawBlocks : rawBlocks.slice(0, 140),
      documentOutline: getDocumentOutline(outputs),
      resumeStructure: getResumeStructure(outputs),
      chunks: chunks.slice(0, 120),
      previousOutputKeys: Object.keys(outputs),
    };
  }

  private async executeWorkflowNode(options: {
    node: WorkflowNodeDefinition;
    input: Record<string, unknown>;
    modelId: string;
    promptUser?: string;
    state: WorkflowState;
    text: string;
    outputs: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const { node, modelId, promptUser, state, text, outputs } = options;

    if (analyticalFindingNodeKeys.has(node.key)) {
      const reusedFrom = reusedAnalysisNodeSources[node.key];
      const reusedOutput = reusedFrom
        ? (outputs[reusedFrom] as { findings?: unknown } | undefined)
        : undefined;

      if (reusedFrom && Array.isArray(reusedOutput?.findings)) {
        return {
          findings: [],
          reusedFrom,
          reusedFindingsCount: reusedOutput.findings.length,
          schemaName: node.prompt?.outputSchemaName ?? "AnalysisFindings",
          modelId,
          warnings: [
            `Optimized workflow: ${node.key} is covered by ${reusedFrom}.`,
          ],
        };
      }

      const result = await generateAiObject({
        modelId,
        prompt: promptUser ?? text,
        schema: analysisFindingsSchema,
        system: node.prompt?.system
          ? renderPromptTemplate(node.prompt.system, {
              analysisDate: state.analysisDate,
            })
          : undefined,
        temperature: node.prompt?.temperature ?? 0.15,
      });

      return {
        findings: normalizeTypedFindings(result.object.findings, node.key),
        schemaName: node.prompt?.outputSchemaName ?? "AnalysisFindings",
        modelId: result.modelId,
        finishReason: result.finishReason,
        usage: result.usage,
        warnings: result.warnings,
      };
    }

    if (node.key === "structure_extraction") {
      const system = node.prompt?.system
        ? renderPromptTemplate(node.prompt.system, {
            analysisDate: state.analysisDate,
          })
        : undefined;
      const firstResult = await generateAiObject({
        modelId,
        prompt: promptUser ?? text,
        schema: resumeStructureSchema,
        system,
        temperature: node.prompt?.temperature ?? 0.15,
      });
      const rawBlocks = getRawBlocks(outputs);
      const cleanText = String(state.cleanText ?? state.plainText ?? text);
      const firstValidation = validateResumeStructure(
        firstResult.object,
        rawBlocks,
        cleanText,
      );

      if (firstValidation.errors.length === 0) {
        return {
          structure: firstResult.object,
          validation: firstValidation,
          attempts: 1,
          schemaName: node.prompt?.outputSchemaName ?? "ResumeStructure",
          modelId: firstResult.modelId,
          finishReason: firstResult.finishReason,
          usage: firstResult.usage,
          warnings: firstResult.warnings,
        };
      }

      const retryPrompt = buildStructureRetryPrompt({
        basePrompt: promptUser ?? text,
        validation: firstValidation,
      });
      const secondResult = await generateAiObject({
        modelId,
        prompt: retryPrompt,
        schema: resumeStructureSchema,
        system,
        temperature: 0.05,
      });
      const secondValidation = validateResumeStructure(
        secondResult.object,
        rawBlocks,
        cleanText,
      );

      return {
        structure: secondResult.object,
        validation: secondValidation,
        previousValidation: firstValidation,
        attempts: 2,
        schemaName: node.prompt?.outputSchemaName ?? "ResumeStructure",
        modelId: secondResult.modelId,
        finishReason: secondResult.finishReason,
        usage: secondResult.usage,
        warnings: [
          ...(firstResult.warnings ?? []),
          ...(secondResult.warnings ?? []),
        ],
      };
    }

    if (node.key === "resume_normalization") {
      const result = await generateAiObject({
        modelId,
        prompt: buildProfileContextPrompt({
          analysisDate: state.analysisDate,
          cleanText: String(state.cleanText ?? state.plainText ?? text),
          resumeStructure: getResumeStructure(outputs),
          chunks: getChunks(outputs),
        }),
        schema: profileContextSchema,
        system: node.prompt?.system
          ? renderPromptTemplate(node.prompt.system, {
              analysisDate: state.analysisDate,
            })
          : undefined,
        temperature: node.prompt?.temperature ?? 0.15,
      });

      return {
        normalizedResume: result.object.normalizedResume,
        targetProfile: result.object.targetProfile,
        benchmark: result.object.benchmark,
        optimizedBundle: "profile_context",
        schemaName: "ProfileContext",
        modelId: result.modelId,
        finishReason: result.finishReason,
        usage: result.usage,
        warnings: result.warnings,
      };
    }

    if (node.key === "target_profile") {
      const profileContext = outputs.resume_normalization as
        | { targetProfile?: unknown; modelId?: unknown }
        | undefined;

      if (profileContext?.targetProfile) {
        return {
          targetProfile: profileContext.targetProfile,
          reusedFrom: "resume_normalization",
          schemaName: node.prompt?.outputSchemaName ?? "TargetProfile",
          modelId:
            typeof profileContext.modelId === "string"
              ? profileContext.modelId
              : modelId,
          warnings: [
            "Optimized workflow: target_profile is produced by resume_normalization profile_context bundle.",
          ],
        };
      }

      throw new Error("Profile context did not produce targetProfile.");
    }

    if (node.key === "benchmark_context") {
      const profileContext = outputs.resume_normalization as
        | { benchmark?: unknown; modelId?: unknown }
        | undefined;

      if (profileContext?.benchmark) {
        return {
          benchmark: profileContext.benchmark,
          reusedFrom: "resume_normalization",
          schemaName: node.prompt?.outputSchemaName ?? "BenchmarkContext",
          modelId:
            typeof profileContext.modelId === "string"
              ? profileContext.modelId
              : modelId,
          warnings: [
            "Optimized workflow: benchmark_context is produced by resume_normalization profile_context bundle.",
          ],
        };
      }

      throw new Error("Profile context did not produce benchmark.");
    }

    if (node.key === "replacement_generation_validation") {
      const anchoredFindings = getAnchoredFindings(outputs);
      const replacementFindings = selectReplacementCandidates(
        anchoredFindings,
        MAX_EAGER_REPLACEMENT_FINDINGS,
      );
      const chunks = getAnchorSourceChunks(outputs);
      const allowedFindingIds = new Set(
        replacementFindings.map((finding) => finding.id),
      );
      const system = node.prompt?.system
        ? renderPromptTemplate(node.prompt.system, {
            analysisDate: state.analysisDate,
          })
        : undefined;
      const replacementPrompt =
        buildReplacementPrompt({
          anchoredFindings: replacementFindings,
          chunks,
          targetProfile: outputs.target_profile,
          normalizedResume: outputs.resume_normalization,
          analysisDate: state.analysisDate,
        });
      let replacements: Array<{
        findingId: string;
        replacementOptions: ReplacementOption[];
      }> = [];
      let attempts = 0;
      let finishReason: unknown = null;
      let usage: unknown = null;
      let warnings: unknown[] = [];
      let firstError: string | null = null;

      try {
        if (replacementFindings.length > 0) {
          attempts = 1;
          const firstResult = await generateAiObject({
            modelId,
            prompt: replacementPrompt,
            schema: replacementValidationSchema,
            system,
            temperature: node.prompt?.temperature ?? 0.15,
          });
          replacements = filterValidReplacements(
            firstResult.object.replacements,
            allowedFindingIds,
            {
              anchoredFindings: replacementFindings,
              chunks,
            },
          );
          finishReason = firstResult.finishReason;
          usage = firstResult.usage;
          warnings = firstResult.warnings ?? [];
        }
      } catch (error) {
        firstError = serializeWorkflowError(error);
      }

      if (firstError && replacementFindings.length > 0) {
        const retryPrompt = buildReplacementRetryPrompt({
          basePrompt: replacementPrompt,
          allowedFindingIds: [...allowedFindingIds],
          invalidCount: replacementFindings.length - replacements.length,
          previousError: firstError ?? undefined,
        });
        try {
          attempts = 2;
          const retryResult = await generateAiObject({
            modelId,
            prompt: retryPrompt,
            schema: replacementValidationSchema,
            system,
            temperature: 0.05,
          });
          replacements = filterValidReplacements(
            retryResult.object.replacements,
            allowedFindingIds,
            {
              anchoredFindings: replacementFindings,
              chunks,
            },
          );
          finishReason = retryResult.finishReason;
          usage = retryResult.usage;
          warnings = [...warnings, ...(retryResult.warnings ?? [])];
        } catch (error) {
          warnings = [
            ...warnings,
            {
              type: "replacement_schema_error",
              message: serializeWorkflowError(error),
            },
          ];
        }
      }

      const validatedFindings = mergeReplacements(
        anchoredFindings,
        replacements,
      );

      return {
        replacements,
        attempts,
        coverage:
          replacementFindings.length > 0
            ? replacements.length / replacementFindings.length
            : 1,
        eagerReplacementFindings: replacementFindings.length,
        fallbackReplacementFindings: Math.max(
          0,
          anchoredFindings.length - replacements.length,
        ),
        validatedFindings,
        schemaName: node.prompt?.outputSchemaName ?? "ReplacementValidation",
        modelId,
        finishReason,
        usage,
        warnings: firstError
          ? [
              ...warnings,
              {
                type: "first_attempt_schema_error",
                message: firstError,
              },
            ]
          : [
              ...warnings,
              anchoredFindings.length > replacementFindings.length
                ? {
                    type: "optimized_replacement_scope",
                    message: `Generated LLM replacements for top ${replacementFindings.length} findings; the rest use deterministic fallback until lazy replacement generation is added.`,
                  }
                : null,
            ].filter(Boolean),
      };
    }

    if (node.kind === "llm") {
      const result = await generateAiTextResult({
        modelId,
        prompt: promptUser ?? text,
        system: node.prompt?.system
          ? renderPromptTemplate(node.prompt.system, {
              analysisDate: state.analysisDate,
            })
          : undefined,
        temperature: node.prompt?.temperature ?? 0.2,
      });

      return {
        analysis: result.text,
        modelId: result.modelId,
        finishReason: result.finishReason,
        usage: result.usage,
        warnings: result.warnings,
      };
    }

    const plainText = normalizeResumeText(String(state.plainText ?? text));
    const cleanText = normalizeResumeText(String(state.cleanText ?? plainText));

    switch (node.key) {
      case "resume_intake":
        return {
          status: plainText.length >= 50 ? "file_suitable" : "file_problematic",
          source: state.source,
          chars: plainText.length,
          language: detectLanguage(plainText),
          warnings:
            plainText.length >= 50
              ? []
              : ["Текст слишком короткий для полноценного анализа."],
        };

      case "text_extraction": {
        const lines = plainText.split("\n").filter(Boolean);

        return {
          plainText,
          chars: plainText.length,
          lines: lines.length,
          encoding: "utf-8",
        };
      }

      case "document_cleanup":
        return cleanExportArtifacts(plainText);

      case "document_quality_check": {
        const replacementChars = (cleanText.match(/\uFFFD/g) ?? []).length;
        const longLines = cleanText
          .split("\n")
          .filter((line) => line.length > 180).length;
        const warnings = [
          replacementChars > 0
            ? `Найдено битых символов: ${replacementChars}.`
            : null,
          longLines > 2 ? `Много длинных строк: ${longLines}.` : null,
        ].filter(Boolean);

        return {
          qualityScore: Math.max(
            0,
            100 - replacementChars * 10 - longLines * 3,
          ),
          atsRiskFlags: warnings,
          warnings,
        };
      }

      case "raw_block_segmentation": {
        const rawBlocks = buildRawBlocks(cleanText);

        return {
          rawBlocks,
          count: rawBlocks.length,
          coverage:
            rawBlocks.length > 0
              ? {
                  firstChar: Math.min(
                    ...rawBlocks.map((block) => block.charStart),
                  ),
                  lastChar: Math.max(
                    ...rawBlocks.map((block) => block.charEnd),
                  ),
                }
            : null,
        };
      }

      case "lossless_document_map": {
        const rawBlocks = getRawBlocks(outputs);
        const displayBlocks = buildDisplayBlocks(cleanText, rawBlocks);

        return {
          displayBlocks,
          lineBlocks: displayBlocks,
          paragraphBlocks: displayBlocks,
          count: displayBlocks.length,
          displayCoverage: getDisplayCoverage(cleanText, displayBlocks),
          coverage:
            displayBlocks.length > 0
              ? {
                  firstChar: displayBlocks[0].charStart,
                  lastChar: displayBlocks[displayBlocks.length - 1].charEnd,
                  cleanTextLength: cleanText.length,
                }
              : null,
        };
      }

      case "document_outline": {
        const rawBlocks = getRawBlocks(outputs);
        const ranges = buildDocumentOutline(rawBlocks);

        return {
          ranges,
          count: ranges.length,
          coverage: {
            rawBlocks: rawBlocks.length,
            outlinedRawBlocks: uniqueStrings(
              ranges.flatMap((range) => range.rawBlockIds),
            ).length,
          },
        };
      }

      case "structure_repair": {
        const rawBlocks = getRawBlocks(outputs);
        const structure =
          getResumeStructure(outputs) ??
          ({
            header: { fields: [] },
            targetRole: null,
            experience: { jobs: [] },
            skills: [],
            education: [],
            about: [],
            otherSections: [],
            warnings: ["Structure extraction did not return a structure."],
            confidence: 0,
          } satisfies ResumeStructure);
        const result = repairResumeStructure(
          structure,
          rawBlocks,
          getDocumentOutline(outputs),
          cleanText,
        );

        return {
          ...result,
          warnings: result.warnings,
        };
      }

      case "structure_validation": {
        const rawBlocks = getRawBlocks(outputs);
        const structure =
          getResumeStructure(outputs) ??
          ({
            header: { fields: [] },
            targetRole: null,
            experience: { jobs: [] },
            skills: [],
            education: [],
            about: [],
            otherSections: [],
            warnings: ["Structure extraction did not return a structure."],
            confidence: 0,
          } satisfies ResumeStructure);
        const validation = validateResumeStructure(
          structure,
          rawBlocks,
          cleanText,
        );

        return {
          structure,
          validation,
          warnings: validation.warnings,
          isUsable: validation.isUsable,
        };
      }

      case "resume_chunking": {
        const rawBlocks = getRawBlocks(outputs);
        const structure = getResumeStructure(outputs);
        const chunks = structure
          ? buildResumeChunksFromStructure(
              structure,
              rawBlocks,
              getDocumentOutline(outputs),
            )
          : buildResumeChunks(cleanText);
        const byType = chunks.reduce<Record<string, number>>((acc, chunk) => {
          acc[chunk.type] = (acc[chunk.type] ?? 0) + 1;
          return acc;
        }, {});

        return {
          chunks,
          count: chunks.length,
          byType,
          coverage:
            chunks.length > 0
              ? {
                  firstChar: Math.min(
                    ...chunks.map((chunk) => chunk.charStart),
                  ),
                  lastChar: Math.max(...chunks.map((chunk) => chunk.charEnd)),
                }
              : null,
        };
      }

      case "scoring_rubric":
        return buildScoringRubric();

      case "analysis_task_planner": {
        const displayBlocks = getDisplayBlocks(outputs);
        const analysisTasks = buildAnalysisTasks(cleanText, displayBlocks);

        return {
          analysisTasks,
          count: analysisTasks.length,
          coverage:
            analysisTasks.length > 0
              ? {
                  firstChar: Math.min(
                    ...analysisTasks.map((task) => task.charStart),
                  ),
                  lastChar: Math.max(
                    ...analysisTasks.map((task) => task.charEnd),
                  ),
                  cleanTextLength: cleanText.length,
                }
              : null,
        };
      }

      case "findings_normalization": {
        const cleanupOutput = outputs.document_cleanup as
          | { removedArtifacts?: unknown }
          | undefined;
        const removedArtifacts = Array.isArray(
          cleanupOutput?.removedArtifacts,
        )
          ? (cleanupOutput.removedArtifacts as Array<{ text?: unknown }>)
          : [];
        const findings = dedupeFindings(
          filterFindingsForCleanText(
            collectAnalysisFindings(outputs),
            cleanText,
            removedArtifacts,
          ),
        );

        return {
          findings,
          count: findings.length,
          bySeverity: {
            red: findings.filter((finding) => finding.severity === "red")
              .length,
            warning: findings.filter(
              (finding) => finding.severity === "warning",
            ).length,
            green: findings.filter((finding) => finding.severity === "green")
              .length,
          },
        };
      }

      case "issue_coverage_gate": {
        const normalizedFindings = getNormalizedFindings(outputs, false);
        const displayBlocks = getDisplayBlocks(outputs);
        const coverageResult = enforceIssueCoverage({
          findings: normalizedFindings,
          cleanText,
          displayBlocks,
          targetMin: 20,
          targetMax: 40,
        });

        return coverageResult;
      }

      case "fragment_anchoring": {
        const findings = getNormalizedFindings(outputs);
        const displayBlocks = getDisplayBlocks(outputs);
        const anchoredFindings = anchorFindingsInCleanText(
          findings,
          cleanText,
          displayBlocks,
        );
        const anchoredCount = anchoredFindings.filter(
          (finding) =>
            finding.sourceBlockId &&
            finding.charStart !== null &&
            finding.charEnd !== null,
        ).length;

        return {
          anchoredFindings,
          count: anchoredFindings.length,
          anchoredRatio:
            anchoredFindings.length > 0
              ? anchoredCount / anchoredFindings.length
              : 0,
        };
      }

      case "score_calculation": {
        const validatedFindings = getValidatedFindings(outputs);

        return calculateScores(
          validatedFindings,
          outputs.document_quality_check,
          {
            structureValidation:
              outputs.structure_validation &&
              typeof outputs.structure_validation === "object" &&
              "validation" in outputs.structure_validation
                ? (outputs.structure_validation as { validation?: unknown })
                    .validation
                : undefined,
            chunks: getChunks(outputs),
            displayCoverage: getDisplayCoverage(
              cleanText,
              getDisplayBlocks(outputs),
            ),
            findingsCount: validatedFindings.length,
            anchoredRatio:
              outputs.fragment_anchoring &&
              typeof outputs.fragment_anchoring === "object" &&
              "anchoredRatio" in outputs.fragment_anchoring &&
              typeof (outputs.fragment_anchoring as { anchoredRatio?: unknown })
                .anchoredRatio === "number"
                ? (outputs.fragment_anchoring as { anchoredRatio: number })
                    .anchoredRatio
                : 0,
          },
        );
      }

      case "final_report_assembly": {
        const chunks = getChunks(outputs);
        const displayBlocks = getDisplayBlocks(outputs);
        const validatedFindings = getValidatedFindings(outputs);
        const resumeStructure = getResumeStructure(outputs);

        return buildReport({
          runId: state.runId,
          analysisDate: state.analysisDate,
          source:
            state.source && typeof state.source === "object"
              ? {
                  ...(state.source as Record<string, unknown>),
                  text: undefined,
                }
              : state.source,
          cleanText,
          displayBlocks,
          chunks,
          sections: resumeStructure ?? {},
          findings: validatedFindings,
          scoreOutput: outputs.score_calculation,
          metadata: {
            modelId,
            chunksCount: chunks.length,
            findingsCount: validatedFindings.length,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      default:
        return {
          ok: true,
          nodeKey: node.key,
          note: "Deterministic node executed.",
        };
    }
  }

  private applyOutputToState(
    nodeKey: WorkflowNodeKey,
    output: Record<string, unknown>,
    state: WorkflowState,
  ) {
    if (nodeKey === "text_extraction" && typeof output.plainText === "string") {
      state.plainText = output.plainText;
    }

    if (
      nodeKey === "document_cleanup" &&
      typeof output.cleanText === "string"
    ) {
      state.cleanText = output.cleanText;
    }
  }

  private async runNode<Output extends Record<string, unknown>>(
    runId: string,
    nodeKey: WorkflowNodeKey,
    input: Record<string, unknown>,
    handler?: () => Promise<Output>,
    debug?: WorkflowNodeDebug,
  ) {
    const nextNodeKey = getNextNodeKey(nodeKey);
    const startedAt = new Date();
    const nodeDebug = debug ?? getNodeDebug(nodeKey);

    await prisma.$transaction([
      prisma.workflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "running",
          currentNodeKey: nodeKey,
          nextNodeKey,
          startedAt,
        },
      }),
      prisma.workflowNodeRun.update({
        where: {
          runId_key: {
            runId,
            key: nodeKey,
          },
        },
        data: {
          status: "running",
          input: toOptionalJson(input),
          debug: toOptionalJson(nodeDebug),
          error: null,
          startedAt,
          finishedAt: null,
          durationMs: null,
        },
      }),
    ]);
    await this.emitCurrent(runId, "node_update");

    try {
      const output =
        handler === undefined
          ? ({
              source: input.source ?? "manual_or_demo",
              chars: input.chars,
              mimeType: input.mimeType,
            } as unknown as Output)
          : await withWorkflowNodeTimeout(handler(), nodeKey);
      const finishedAt = new Date();

      await prisma.workflowNodeRun.update({
        where: {
          runId_key: {
            runId,
            key: nodeKey,
          },
        },
        data: {
          status: "success",
          output: toOptionalJson(output),
          finishedAt,
          durationMs: getDurationMs(startedAt, finishedAt),
        },
      });
      await this.emitCurrent(runId, "node_update");

      return output;
    } catch (error) {
      const finishedAt = new Date();

      await prisma.workflowNodeRun.update({
        where: {
          runId_key: {
            runId,
            key: nodeKey,
          },
        },
        data: {
          status: "error",
          error: serializeWorkflowError(error),
          finishedAt,
          durationMs: getDurationMs(startedAt, finishedAt),
        },
      });

      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        {
          workflowNodeKey: nodeKey,
        },
      );
    }
  }

  private async failRun(
    runId: string,
    failedNodeKey: WorkflowNodeKey | null,
    message: string,
  ) {
    const failedIndex = failedNodeKey
      ? workflowNodeDefinitions.findIndex((node) => node.key === failedNodeKey)
      : -1;
    const skippedNodes = workflowNodeDefinitions
      .slice(Math.max(failedIndex + 1, 0))
      .map((node) => node.key);

    await prisma.$transaction([
      prisma.workflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "error",
          error: message,
          currentNodeKey: failedNodeKey,
          nextNodeKey: null,
          finishedAt: new Date(),
        },
      }),
      ...skippedNodes.map((key) =>
        prisma.workflowNodeRun.update({
          where: {
            runId_key: {
              runId,
              key,
            },
          },
          data: {
            status: "skipped",
            finishedAt: new Date(),
          },
        }),
      ),
    ]);
    await this.emitCurrent(runId, "error");
  }

  private getFailedNodeKey(error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "workflowNodeKey" in error &&
      typeof (error as { workflowNodeKey?: unknown }).workflowNodeKey ===
        "string"
    ) {
      return (error as { workflowNodeKey: WorkflowNodeKey }).workflowNodeKey;
    }

    return null;
  }

  private async emitCurrent(runId: string, type: WorkflowSseEvent["type"]) {
    const snapshot = await this.getRunSnapshot(runId);
    this.emit(runId, type, snapshot);
  }

  private emit(
    runId: string,
    type: WorkflowSseEvent["type"],
    snapshot: WorkflowRunSnapshot,
  ) {
    const listeners = this.listeners.get(runId);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener({
        type,
        data: snapshot,
      });
    }
  }

  private toSnapshot(run: WorkflowRunWithNodes): WorkflowRunSnapshot {
    return {
      id: run.id,
      type: RESUME_ANALYSIS_WORKFLOW_TYPE,
      status: run.status,
      input: run.input,
      output: run.output ?? undefined,
      error: run.error,
      currentNodeKey: run.currentNodeKey as WorkflowNodeKey | null,
      nextNodeKey: run.nextNodeKey as WorkflowNodeKey | null,
      finalResult: run.finalResult ?? undefined,
      savedAnalysisId: run.savedAnalysisId,
      derivedResumeId: run.derivedResumeId,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      startedAt: toIso(run.startedAt),
      finishedAt: toIso(run.finishedAt),
      nodes: [...run.nodes]
        .sort((a, b) => a.order - b.order)
        .map((node) => ({
          key: node.key as WorkflowNodeKey,
          label: node.label,
          status: node.status,
          input: node.input ?? undefined,
          output: node.output ?? undefined,
          debug: node.debug
            ? (node.debug as unknown as WorkflowNodeDebug)
            : undefined,
          error: node.error,
          order: node.order,
          startedAt: toIso(node.startedAt),
          finishedAt: toIso(node.finishedAt),
          durationMs: node.durationMs,
        })),
    };
  }
}

function getChunks(outputs: Record<string, unknown>) {
  const output = outputs.resume_chunking as
    | {
        chunks?: unknown;
      }
    | undefined;

  return Array.isArray(output?.chunks) ? (output.chunks as ResumeChunk[]) : [];
}

function getDisplayBlocks(outputs: Record<string, unknown>) {
  const output = outputs.lossless_document_map as
    | {
        displayBlocks?: unknown;
      }
    | undefined;

  return Array.isArray(output?.displayBlocks)
    ? (output.displayBlocks as DisplayBlock[])
    : [];
}

function getAnalysisTasks(outputs: Record<string, unknown>) {
  const output = outputs.analysis_task_planner as
    | {
        analysisTasks?: unknown;
      }
    | undefined;

  return Array.isArray(output?.analysisTasks)
    ? (output.analysisTasks as AnalysisTask[])
    : [];
}

function getAnchorSourceChunks(outputs: Record<string, unknown>) {
  const displayBlocks = getDisplayBlocks(outputs);

  if (displayBlocks.length === 0) {
    return getChunks(outputs);
  }

  return displayBlocks.map(
    (block): ResumeChunk => ({
      id: block.id,
      type: displayBlockTypeToChunkType(block.type),
      section: block.section,
      text: block.text,
      charStart: block.charStart,
      charEnd: block.charEnd,
      meta: {
        source: block.source,
        pageIndex: block.pageIndex,
      },
    }),
  );
}

function displayBlockTypeToChunkType(type: DisplayBlock["type"]): ResumeChunkType {
  if (type === "section_heading" || type === "heading") {
    return "section_heading";
  }

  if (type === "list_item") {
    return "other_section_item";
  }

  return "raw_block";
}

function getRawBlocks(outputs: Record<string, unknown>) {
  const output = outputs.raw_block_segmentation as
    | {
        rawBlocks?: unknown;
      }
    | undefined;

  return Array.isArray(output?.rawBlocks)
    ? (output.rawBlocks as RawResumeBlock[])
    : [];
}

function getDocumentOutline(outputs: Record<string, unknown>) {
  const output = outputs.document_outline as
    | {
        ranges?: unknown;
      }
    | undefined;

  return Array.isArray(output?.ranges)
    ? (output.ranges as DocumentOutlineRange[])
    : [];
}

function getResumeStructure(outputs: Record<string, unknown>) {
  const validationOutput = outputs.structure_validation as
    | {
        structure?: unknown;
      }
    | undefined;
  const repairOutput = outputs.structure_repair as
    | {
        structure?: unknown;
      }
    | undefined;
  const extractionOutput = outputs.structure_extraction as
    | {
        structure?: unknown;
      }
    | undefined;
  const structure =
    validationOutput?.structure ??
    repairOutput?.structure ??
    extractionOutput?.structure;

  return structure && typeof structure === "object"
    ? (structure as ResumeStructure)
    : null;
}

function getNormalizedFindings(
  outputs: Record<string, unknown>,
  preferCoverageGate = true,
) {
  const coverageOutput = outputs.issue_coverage_gate as
    | {
        findings?: unknown;
      }
    | undefined;
  const normalizedOutput = outputs.findings_normalization as
    | {
        findings?: unknown;
      }
    | undefined;
  const output =
    preferCoverageGate && Array.isArray(coverageOutput?.findings)
      ? coverageOutput
      : normalizedOutput;

  return Array.isArray(output?.findings)
    ? (output.findings as TypedFinding[])
    : [];
}

function getAnchoredFindings(outputs: Record<string, unknown>) {
  const output = outputs.fragment_anchoring as
    | {
        anchoredFindings?: unknown;
      }
    | undefined;

  return Array.isArray(output?.anchoredFindings)
    ? (output.anchoredFindings as Array<
        Omit<ValidatedFinding, "replacementOptions">
      >)
    : [];
}

function getValidatedFindings(outputs: Record<string, unknown>) {
  const output = outputs.replacement_generation_validation as
    | {
        validatedFindings?: unknown;
      }
    | undefined;

  return Array.isArray(output?.validatedFindings)
    ? (output.validatedFindings as ValidatedFinding[])
    : [];
}
