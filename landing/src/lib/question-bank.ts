export type QuestionBankSort = "popular" | "recent" | "title";

export interface QuestionFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface QuestionListItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  occurrences: number;
  technologies: string[];
  topCompanies: string[];
  remainingCompaniesCount: number;
  topTags: string[];
  remainingTagsCount: number;
}

export interface QuestionListResponse {
  items: QuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: {
    categories: QuestionFacetOption[];
    technologies: QuestionFacetOption[];
    companies: QuestionFacetOption[];
    tags: QuestionFacetOption[];
  };
}

export interface QuestionDetailResponse {
  id: string;
  legacyId: string;
  slug: string;
  title: string;
  category: string;
  answerHtml: string;
  answerMarkdown: string;
  technologies: string[];
  companies: string[];
  tags: string[];
  totalOccurrences: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export const QUESTION_BANK_PAGE_SIZE = 20;

export const QUESTION_CATEGORY_LABELS: Record<string, string> = {
  technical: "Технический",
  behavioral: "Поведенческий",
  coding: "Кодинг",
};

export function getQuestionCategoryLabel(value: string) {
  return QUESTION_CATEGORY_LABELS[value] ?? value;
}

export function getQuestionBankServerApiBaseUrl() {
  const internal = process.env.INTERNAL_API_BASE_URL?.trim();
  if (internal) {
    return trimTrailingSlash(internal);
  }

  const publicBase = process.env.PUBLIC_API_BASE_URL?.trim();
  if (publicBase && /^https?:\/\//i.test(publicBase)) {
    return trimTrailingSlash(publicBase);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }

  return "http://backend:3000";
}

export async function fetchQuestionBankJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getQuestionBankServerApiBaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Question bank API failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
