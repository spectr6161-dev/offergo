"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  SearchIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import type {
  ResumeStudioFilter,
  ResumeStudioIssue,
  ResumeStudioSeverity,
} from "./types"

const filterLabels: Record<ResumeStudioFilter, string> = {
  all: "Все",
  error: "Ошибки",
  warning: "Предупреждения",
  recommend: "Советы",
  applied: "Применено",
}

const severityLabels: Record<ResumeStudioSeverity, string> = {
  error: "Ошибка",
  warning: "Warning",
  recommend: "Совет",
}

function getSeverityIcon(severity: ResumeStudioSeverity) {
  if (severity === "error") return XCircleIcon
  if (severity === "warning") return AlertTriangleIcon

  return SparklesIcon
}

function getSeverityClass(severity: ResumeStudioSeverity) {
  if (severity === "error") return "border-black bg-black text-white"
  if (severity === "warning") return "border-black bg-white text-black"

  return "border-black bg-white text-black"
}

type IssuesPanelProps = {
  className?: string
  filter: ResumeStudioFilter
  issues: ResumeStudioIssue[]
  query: string
  selectedIssueId: string
  onFilterChange: (filter: ResumeStudioFilter) => void
  onQueryChange: (query: string) => void
  onSelectIssue: (issueId: string) => void
}

export function IssuesPanel({
  className,
  filter,
  issues,
  query,
  selectedIssueId,
  onFilterChange,
  onQueryChange,
  onSelectIssue,
}: IssuesPanelProps) {
  const grouped = issues.reduce<Record<string, ResumeStudioIssue[]>>(
    (acc, issue) => {
      acc[issue.sectionTitle] ??= []
      acc[issue.sectionTitle].push(issue)

      return acc
    },
    {}
  )

  const counts = issues.reduce(
    (acc, issue) => {
      acc.all += 1
      acc[issue.severity] += 1
      if (issue.status === "applied") acc.applied += 1

      return acc
    },
    { all: 0, applied: 0, error: 0, recommend: 0, warning: 0 }
  )

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-black bg-white text-black",
        className
      )}
    >
      <div className="flex shrink-0 flex-col gap-4 border-b border-black p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Проблемы</h2>
          </div>
          <Badge className="rounded-none border-black bg-white text-black">
            {counts.all}
          </Badge>
        </div>

        <ToggleGroup
          className="grid grid-cols-2 gap-2"
          type="single"
          value={filter}
          onValueChange={(value) => {
            if (value) onFilterChange(value as ResumeStudioFilter)
          }}
        >
          {(Object.keys(filterLabels) as ResumeStudioFilter[]).map((key) => (
            <ToggleGroupItem
              key={key}
              className="h-8 justify-between rounded-none border border-black bg-white px-3 text-xs text-black data-[state=on]:bg-black data-[state=on]:text-white"
              value={key}
            >
              <span>{filterLabels[key]}</span>
              <span>{counts[key]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <label className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-black" />
          <Input
            className="h-9 rounded-none border-black bg-white pl-9 text-sm text-black placeholder:text-black/45"
            placeholder="Поиск по замечаниям"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          {Object.entries(grouped).map(([sectionTitle, sectionIssues]) => (
            <section className="flex flex-col gap-2" key={sectionTitle}>
              <div className="flex items-center justify-between gap-2 text-xs font-semibold tracking-[0.18em] text-black uppercase">
                <span>{sectionTitle}</span>
                <span>{sectionIssues.length}</span>
              </div>
              <Separator className="bg-black" />

              <div className="flex flex-col gap-2">
                {sectionIssues.map((issue) => {
                  const Icon = getSeverityIcon(issue.severity)
                  const selected = issue.id === selectedIssueId
                  const applied = issue.status === "applied"

                  return (
                    <Button
                      key={issue.id}
                      className={cn(
                        "h-auto justify-start rounded-none border border-black bg-white p-0 text-left text-black hover:bg-black hover:text-white",
                        selected &&
                          "bg-black text-white shadow-[inset_4px_0_0_rgba(255,255,255,1)]",
                        applied && "opacity-70"
                      )}
                      variant="ghost"
                      onClick={() => onSelectIssue(issue.id)}
                    >
                      <span className="flex w-full gap-3 p-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                            getSeverityClass(issue.severity)
                          )}
                        >
                          {applied ? (
                            <CheckCircle2Icon className="size-3.5" />
                          ) : (
                            <Icon className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="line-clamp-2 text-sm font-semibold">
                              {issue.title}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-[11px] font-medium uppercase opacity-70">
                            <CircleDotIcon className="size-3" />
                            {severityLabels[issue.severity]}
                            {applied ? " / applied" : ""}
                          </span>
                          <span className="mt-2 line-clamp-2 text-xs leading-5 opacity-80">
                            {issue.quote}
                          </span>
                        </span>
                      </span>
                    </Button>
                  )
                })}
              </div>
            </section>
          ))}

          {issues.length === 0 ? (
            <div className="rounded-none border border-dashed border-black p-5 text-center text-sm text-black">
              По текущему фильтру ничего не найдено.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  )
}
