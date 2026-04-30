"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { WorkflowRunSnapshot } from "@/lib/workflow-types"
import { cn } from "@/lib/utils"

import { adaptResumeAnalysisReportToStudioData } from "./resume-analysis-report-adapter"
import { ResumeStudioClient } from "./resume-studio-client"

type SavedAnalysisResponse = {
  item?: {
    id: string
    title: string
    finalResult?: unknown
    studioData?: unknown
  }
}

async function readResponseJson(response: Response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getErrorMessage(value: unknown, fallback: string) {
  if (typeof value === "string") return value

  if (value && typeof value === "object") {
    if (
      "message" in value &&
      typeof (value as { message?: unknown }).message === "string"
    ) {
      return (value as { message: string }).message
    }

    if (
      "error" in value &&
      typeof (value as { error?: unknown }).error === "string"
    ) {
      return (value as { error: string }).error
    }
  }

  return fallback
}

function getRunProgress(run: WorkflowRunSnapshot | null) {
  if (!run || run.nodes.length === 0) return 0

  const completed = run.nodes.filter((node) =>
    ["success", "error", "skipped"].includes(node.status)
  ).length

  return Math.round((completed / run.nodes.length) * 100)
}

function getCurrentNodeLabel(run: WorkflowRunSnapshot | null) {
  if (!run) return null

  const current =
    run.nodes.find((node) => node.key === run.currentNodeKey) ??
    run.nodes.find((node) => node.status === "running")

  return current?.label ?? null
}

function getNodeStatusClass(status: string) {
  if (status === "success") return "border-emerald-500/30 bg-emerald-500/10"
  if (status === "running") return "border-primary/40 bg-primary/10"
  if (status === "error") return "border-destructive/40 bg-destructive/10"

  return "border-border bg-card"
}

export function ResumeWorkflowRunner() {
  const router = useRouter()
  const [run, setRun] = useState<WorkflowRunSnapshot | null>(null)
  const [savedFinalResult, setSavedFinalResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"loading" | "running" | "result" | "error">(
    "loading"
  )
  const hydratedRef = useRef(false)
  const finalResult =
    savedFinalResult ?? (run?.status === "success" ? run.finalResult : null)
  const studioData = useMemo(
    () => (finalResult ? adaptResumeAnalysisReportToStudioData(finalResult) : null),
    [finalResult]
  )
  const progress = getRunProgress(run)
  const currentNodeLabel = getCurrentNodeLabel(run)

  function connectToRun(runId: string) {
    const source = new EventSource(`/api/resume-analysis/runs/${runId}/events`)
    let receivedTerminalEvent = false

    const updateRun = (event: MessageEvent<string>) => {
      if (!event.data) return

      let nextRun: WorkflowRunSnapshot

      try {
        nextRun = JSON.parse(event.data) as WorkflowRunSnapshot
      } catch {
        setError("SSE-поток анализа вернул некорректное событие.")
        setMode("error")
        source.close()
        return
      }

      setRun(nextRun)

      if (nextRun.status === "success") {
        receivedTerminalEvent = true
        source.close()

        if (nextRun.savedAnalysisId) {
          router.replace(`/resume?analysisId=${nextRun.savedAnalysisId}`)
          return
        }

        setMode("result")
      }

      if (nextRun.status === "error") {
        receivedTerminalEvent = true
        source.close()
        setError(nextRun.error ?? "Workflow failed.")
        setMode("error")
      }
    }

    source.addEventListener("snapshot", updateRun)
    source.addEventListener("run_update", updateRun)
    source.addEventListener("node_update", updateRun)
    source.addEventListener("done", updateRun)
    source.addEventListener("error", updateRun)
    source.onerror = (event) => {
      const data = (event as MessageEvent<string>).data

      if (typeof data === "string" && data) {
        updateRun(event as MessageEvent<string>)
        return
      }

      if (!receivedTerminalEvent) {
        setError("SSE-поток анализа отключён.")
        setMode("error")
      }

      source.close()
    }
  }

  useEffect(() => {
    if (hydratedRef.current) return

    hydratedRef.current = true

    const searchParams = new URLSearchParams(window.location.search)
    const runId = searchParams.get("runId")
    const analysisId = searchParams.get("analysisId")

    if (!runId && !analysisId) {
      router.replace("/resumes")
      return
    }

    if (analysisId) {
      setMode("loading")
      setError(null)

      void fetch(`/api/resume-analysis/saved/${analysisId}`)
        .then(async (response) => {
          const body = await readResponseJson(response)

          if (!response.ok) {
            throw new Error(
              getErrorMessage(body, "Сохранённый анализ не найден.")
            )
          }

          const item = (body as SavedAnalysisResponse).item

          if (!item?.finalResult) {
            throw new Error("У сохранённого анализа нет финального отчёта.")
          }

          setSavedFinalResult(item.finalResult)
          setMode("result")
        })
        .catch((loadError) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Сохранённый анализ не загружен."
          )
          setMode("error")
        })
      return
    }

    setMode("running")
    setError(null)

    void fetch(`/api/resume-analysis/runs/${runId}`)
      .then(async (response) => {
        const body = await readResponseJson(response)

        if (!response.ok) {
          throw new Error(getErrorMessage(body, "Анализ не загружен."))
        }

        const nextRun = body as WorkflowRunSnapshot

        setRun(nextRun)

        if (nextRun.status === "success") {
          if (nextRun.savedAnalysisId) {
            router.replace(`/resume?analysisId=${nextRun.savedAnalysisId}`)
            return
          }

          setMode("result")
          return
        }

        if (nextRun.status === "error") {
          setError(nextRun.error ?? "Workflow failed.")
          setMode("error")
          return
        }

        connectToRun(nextRun.id)
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Анализ не загружен."
        )
        setMode("error")
      })
  }, [router])

  if (mode === "result" && studioData) {
    return <ResumeStudioClient key={run?.id ?? "saved-analysis"} data={studioData} />
  }

  if (mode === "result" && !studioData) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center bg-background p-6">
        <Alert className="max-w-2xl">
          <AlertCircleIcon />
          <AlertTitle>Результат анализа не подходит для редактора</AlertTitle>
          <AlertDescription>
            Финальный отчёт сохранён, но его не удалось преобразовать в Resume Studio.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (mode === "error") {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Анализ не завершён</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="w-fit" variant="outline" onClick={() => router.push("/resumes")}>
            <ArrowLeftIcon data-icon="inline-start" />
            К моим резюме
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-[720px] items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-3xl flex-col gap-5 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Badge className="w-fit" variant="outline">
              Resume analysis workflow
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              Анализ резюме
            </h1>
          </div>
          {mode === "loading" ? (
            <Loader2Icon className="animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="secondary">{run?.status ?? "running"}</Badge>
          )}
        </div>

        {mode === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              {currentNodeLabel
                ? `Текущий шаг: ${currentNodeLabel}`
                : "Запускаем workflow..."}
            </p>
            <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
              {(run?.nodes ?? []).map((node) => (
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
                    getNodeStatusClass(node.status)
                  )}
                  key={node.key}
                >
                  <span className="min-w-0 truncate">{node.label}</span>
                  {node.status === "running" ? (
                    <Loader2Icon className="shrink-0 animate-spin" />
                  ) : node.status === "success" ? (
                    <CheckCircle2Icon className="shrink-0 text-emerald-500" />
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {node.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
