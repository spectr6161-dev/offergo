export type ReviewSeverity = "error" | "warning" | "recommend";

export type ReviewFilter = "all" | ReviewSeverity;

export type ResumeReviewBlockKind =
  | "heading"
  | "paragraph"
  | "bullet"
  | "compact";

export type ResumeReviewBlock = {
  id: string;
  text: string;
  charStart: number;
  charEnd: number;
  kind?: ResumeReviewBlockKind;
};

export type ResumeReviewSection = {
  id: string;
  type: string;
  title: string;
  blocks: ResumeReviewBlock[];
};

export type ResumeReviewAnchor = {
  blockId: string;
  charStart: number;
  charEnd: number;
  anchorStatus?: "exact" | "fuzzy" | "section_level" | "missing";
};

export type ResumeReviewReplacement = {
  text: string;
  type: string;
  isSafe: boolean;
};

export type ResumeReviewFinding = {
  id: string;
  severity: ReviewSeverity;
  sectionId: string;
  title: string;
  originalText: string;
  problem: string;
  whyItMatters: string;
  replacementOptions: ResumeReviewReplacement[];
  anchors: ResumeReviewAnchor[];
  confidence?: number;
  scoreImpact?: number;
};

export type ResumeReviewData = {
  document: {
    title: string;
    role?: string;
    contacts?: string[];
    sections: ResumeReviewSection[];
  };
  findings: ResumeReviewFinding[];
};

export type ResumeReviewFixture = {
  id: string;
  name: string;
  description: string;
  data: ResumeReviewData;
};
