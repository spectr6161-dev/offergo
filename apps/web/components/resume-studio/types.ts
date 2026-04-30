import type { Value } from "platejs"

export type ResumeStudioSeverity = "error" | "warning" | "recommend"

export type ResumeStudioIssueStatus = "open" | "applied" | "dismissed"

export type ResumeStudioMode = "review" | "edit" | "preview"

export type ResumeStudioIssue = {
  id: string
  severity: ResumeStudioSeverity
  status: ResumeStudioIssueStatus
  sectionTitle: string
  title: string
  quote: string
  description: string
  whyItMatters: string
  articleLinks: Array<{ title: string; href: string }>
  replacementOptions: Array<{
    id: string
    label: string
    text: string
    isSafe: boolean
  }>
  anchor: {
    pageId?: string
    blockId: string
    path?: number[]
    fromOffset?: number
    toOffset?: number
    charStart?: number
    charEnd?: number
    segments?: Array<{
      pageId: string
      blockId: string
      path: number[]
      fromOffset: number
      toOffset: number
    }>
  } | null
  confidence?: number
  scoreImpact?: number
}

export type ResumeStudioDocumentPage = {
  id: string
  title?: string
  initialValue: Value
}

export type ResumeStudioDocument = {
  title: string
  subtitle: string
  meta: string[]
  initialValue: Value
  pages?: ResumeStudioDocumentPage[]
}

export type ResumeStudioData = {
  runId?: string
  document: ResumeStudioDocument
  issues: ResumeStudioIssue[]
  score: {
    overall: number
    label: string
  }
  metadata?: {
    isPartial?: boolean
    scoreConfidence?: string
    anchoredRatio?: number
    displayCoverage?: number
    findingsCount?: number
    pipelineWarnings?: string[]
  }
}

export type ResumeStudioFilter =
  | "all"
  | "error"
  | "warning"
  | "recommend"
  | "applied"
