"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CircleCheckIcon,
  InboxIcon,
  PanelLeftCloseIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { ResumeStudioSidebarFrame } from "./resume-studio-sidebar-frame"
import type { ResumeStudioIssue, ResumeStudioSeverity } from "./types"

type IssueFilter = "all" | ResumeStudioSeverity

type ResumeIssuesSidebar09Props = {
  frozenWidth?: number | null
  isCollapsed?: boolean
  issues: ResumeStudioIssue[]
  selectedIssueId: string
  onCollapse?: () => void
  onExpand?: () => void
  onSelectIssue: (issueId: string) => void
}

const filterOptions: Array<{ label: string; value: IssueFilter }> = [
  { label: "Все", value: "all" },
  { label: "Ошибки", value: "error" },
  { label: "Предупреждения", value: "warning" },
  { label: "Советы", value: "recommend" },
]

function severityLabel(severity: ResumeStudioSeverity) {
  if (severity === "error") return "Ошибка"
  if (severity === "warning") return "Предупреждение"
  return "Совет"
}

function SeverityIcon({ severity }: { severity: ResumeStudioSeverity }) {
  if (severity === "error") return <AlertCircleIcon />
  if (severity === "warning") return <AlertTriangleIcon />
  return <CircleCheckIcon />
}

function severityItemClass(severity: ResumeStudioSeverity) {
  if (severity === "error") {
    return "border-l-red-500 bg-red-50/55 hover:bg-red-50 dark:border-l-red-500 dark:bg-red-950/20 dark:hover:bg-red-950/30"
  }

  if (severity === "warning") {
    return "border-l-amber-500 bg-amber-50/60 hover:bg-amber-50 dark:border-l-amber-500 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
  }

  return "border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 dark:border-l-emerald-500 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
}

function severityIconClass(severity: ResumeStudioSeverity) {
  if (severity === "error") return "text-red-600 dark:text-red-400"
  if (severity === "warning") return "text-amber-600 dark:text-amber-400"
  return "text-emerald-600 dark:text-emerald-400"
}

function severityStatusClass(severity: ResumeStudioSeverity) {
  if (severity === "error") {
    return "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
}

export function ResumeIssuesSidebar09({
  frozenWidth = null,
  isCollapsed = false,
  issues,
  onCollapse,
  onExpand,
  selectedIssueId,
  onSelectIssue,
}: ResumeIssuesSidebar09Props) {
  const [filters, setFilters] = React.useState<IssueFilter[]>(["all"])
  const filteredIssues = filters.includes("all")
    ? issues
    : issues.filter((issue) => filters.includes(issue.severity))

  function toggleFilter(filter: IssueFilter) {
    if (filter === "all") {
      setFilters(["all"])
      return
    }

    const newFilters = filters.includes(filter)
      ? filters.filter((currentFilter) => currentFilter !== filter)
      : [...filters.filter((currentFilter) => currentFilter !== "all"), filter]

    setFilters(newFilters.length === 0 ? ["all"] : newFilters)
  }

  return (
    <ResumeStudioSidebarFrame
      collapseIcon={PanelLeftCloseIcon}
      collapsedIcon={InboxIcon}
      count={issues.length}
      frozenWidth={frozenWidth}
      headerContent={
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={filters.includes(filter.value) ? "default" : "outline"}
              onClick={() => toggleFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      }
      isCollapsed={isCollapsed}
      side="left"
      title="Проблемы"
      ariaLabelCollapse="Свернуть панель проблем"
      ariaLabelExpand="Показать панель проблем"
      onCollapse={onCollapse}
      onExpand={onExpand}
    >
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {filteredIssues.map((issue) => (
              <a
                href="#"
                key={issue.id}
                className={cn(
                  "flex min-w-0 flex-col items-start gap-2 border-b border-l-4 p-4 text-sm leading-tight transition-colors last:border-b-0 hover:text-sidebar-accent-foreground",
                  severityItemClass(issue.severity),
                  selectedIssueId === issue.id &&
                    "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-inset ring-foreground/12"
                )}
                onClick={(event) => {
                  event.preventDefault()
                  onSelectIssue(issue.id)
                }}
              >
                <div className="flex w-full min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center [&>svg]:size-4",
                      severityIconClass(issue.severity)
                    )}
                  >
                    <SeverityIcon severity={issue.severity} />
                  </span>
                  <span className="min-w-0 flex-1 whitespace-normal break-words">
                    {severityLabel(issue.severity)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium",
                      severityStatusClass(issue.severity)
                    )}
                  >
                    {issue.status === "applied" ? "applied" : "open"}
                  </span>
                </div>
                <span className="w-full whitespace-normal break-words font-medium">
                  {issue.title}
                </span>
                <span className="line-clamp-3 w-full whitespace-pre-wrap break-words text-xs">
                  {issue.quote}
                </span>
              </a>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </ResumeStudioSidebarFrame>
  )
}
