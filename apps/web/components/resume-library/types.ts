export type ResumeLibraryVersion = {
  id: string;
  source: string;
  plainText: string | null;
  content: unknown;
  summary: string | null;
  createdAt: string;
};

export type ResumeLibraryFile = {
  id: string;
  mimeType: string;
  size: number;
  createdAt: string;
} | null;

export type ResumeLibraryResume = {
  id: string;
  title: string;
  status: string;
  folderId: string | null;
  originalFileId: string | null;
  currentVersionId: string | null;
  sortOrder: number;
  lastOpenedAt: string | null;
  processingError: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  originalFile: ResumeLibraryFile;
  currentVersion: ResumeLibraryVersion | null;
};

export type ResumeLibraryAnalysis = {
  id: string;
  title: string;
  folderId: string | null;
  sourceResumeId: string;
  derivedResumeId: string | null;
  workflowRunId: string;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  finalResult?: unknown;
  studioData?: unknown;
};

export type ResumeLibraryFolder = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  resumeCount: number;
};

export type ResumeFolderFilter = "all" | "none" | "trash" | string;

export type ResumeSortMode =
  | "updated-desc"
  | "created-desc"
  | "title-asc"
  | "title-desc";

export type ResumeViewMode = "grid" | "list";
