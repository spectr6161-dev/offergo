export type WorkflowRunStatus = "pending" | "running" | "success" | "error"

export type WorkflowNodeStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped"

export type WorkflowNodeSnapshot = {
  key: string
  label: string
  status: WorkflowNodeStatus
  input?: unknown
  output?: unknown
  debug?: unknown
  error?: string | null
  order: number
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
}

export type WorkflowRunSnapshot = {
  id: string
  type: string
  status: WorkflowRunStatus
  input: unknown
  output?: unknown
  error?: string | null
  currentNodeKey?: string | null
  nextNodeKey?: string | null
  finalResult?: unknown
  savedAnalysisId?: string | null
  derivedResumeId?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  nodes: WorkflowNodeSnapshot[]
}
