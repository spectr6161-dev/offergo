export type ResumeSeverity = "error" | "warning" | "suggestion";
export type ResumeVariant = "corrected" | "ats" | "role_targeted";
export type ResumeStatus = "draft" | "analyzed" | "versions_ready";

export interface ResumeDocument {
  id: string;
  rawText: string;
  normalizedText: string;
  sections: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    order: number;
    blocks: Array<{
      id: string;
      text: string;
      startOffset: number;
      endOffset: number;
    }>;
  }>;
  metadata: {
    sourceFormat: string;
    detectedLanguage: string;
    charCount: number;
    wordCount: number;
    detectedRole?: string | null;
    confirmedRole?: string | null;
    detectedSeniority?: string | null;
    title?: string | null;
  };
}

export interface ResumeDocumentSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  blocks: Array<{
    id: string;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  title: string;
  sourceKind: string;
  sourceFormat: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileHash: string | null;
  rawText: string;
  normalizedText: string;
  documentJson: ResumeDocument;
  detectedRole: string | null;
  confirmedRole: string | null;
  detectedSeniority: string | null;
  status: ResumeStatus;
  latestScore: number | null;
  latestSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeListItem {
  id: string;
  title: string;
  sourceKind: string;
  sourceFormat: string;
  detectedRole: string | null;
  confirmedRole: string | null;
  detectedSeniority: string | null;
  status: ResumeStatus;
  latestScore: number | null;
  latestSummary: string | null;
  updatedAt: string;
}

export interface ResumeIssue {
  id: string;
  resumeId: string;
  severity: ResumeSeverity;
  title: string;
  description: string;
  reason: string;
  originalText: string;
  suggestedText?: string | null;
  section: string;
  startOffset: number;
  endOffset: number;
  confidence: number;
  tags: string[];
  status: "open" | "applied" | "rejected";
  createdAt: string;
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  variantType: ResumeVariant;
  title: string;
  normalizedText: string;
  documentJson: ResumeDocument;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}
