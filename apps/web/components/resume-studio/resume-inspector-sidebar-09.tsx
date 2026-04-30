"use client"

import {
  ExternalLinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { ResumeStudioSidebarFrame } from "./resume-studio-sidebar-frame"
import type { ResumeStudioIssue, ResumeStudioSeverity } from "./types"

const sectionLabelClass =
  "text-sm leading-6 font-semibold tracking-normal text-foreground"

type ResumeInspectorSidebar09Props = {
  className?: string
  frozenWidth?: number | null
  isCollapsed?: boolean
  issue: ResumeStudioIssue
  onApplyReplacement: (replacementId: string) => void
  onCollapse?: () => void
  onExpand?: () => void
  onShowInDocument: () => void
}

function severityTitleClass(severity: ResumeStudioSeverity) {
  if (severity === "error") {
    return "border-destructive/25 bg-destructive/10"
  }

  if (severity === "warning") {
    return "border-amber-500/25 bg-amber-500/10"
  }

  return "border-emerald-500/25 bg-emerald-500/10"
}

export function ResumeInspectorSidebar09({
  className,
  frozenWidth = null,
  isCollapsed = false,
  issue,
  onApplyReplacement,
  onCollapse,
  onExpand,
}: ResumeInspectorSidebar09Props) {
  return (
    <ResumeStudioSidebarFrame
      className={className}
      collapseButtonPosition="before-title"
      collapseIcon={PanelRightCloseIcon}
      collapsedIcon={PanelRightOpenIcon}
      frozenWidth={frozenWidth}
      headerContent={
        <div
          className={cn(
            "-mx-4 -mb-4 border-t px-4 py-3",
            severityTitleClass(issue.severity)
          )}
        >
          <h2 className="text-base leading-tight font-semibold text-foreground">
            {issue.title}
          </h2>
        </div>
      }
      isCollapsed={isCollapsed}
      side="right"
      title="Разбор"
      ariaLabelCollapse="Свернуть панель разбора"
      ariaLabelExpand="Показать панель разбора"
      onCollapse={onCollapse}
      onExpand={onExpand}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={sectionLabelClass}>
            Фрагмент из резюме
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Alert className="px-3 py-3">
              <AlertDescription className="text-base leading-7 font-medium text-foreground">
                {issue.quote}
              </AlertDescription>
            </Alert>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className={sectionLabelClass}>
            Почему отмечено
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Alert className="px-3 py-3">
              <AlertDescription className="flex flex-col gap-3 text-base leading-7 text-foreground">
                <span>{issue.description}</span>
                <span>{issue.whyItMatters}</span>
              </AlertDescription>
            </Alert>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="px-0">
          <SidebarGroupLabel className={cn("px-4", sectionLabelClass)}>
            Варианты замены
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {issue.replacementOptions.map((option) => (
              <button
                className="flex w-full min-w-0 flex-col items-start gap-2 border-b border-l-4 border-l-border bg-sidebar p-4 text-left text-sm leading-tight transition-colors last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                key={option.id}
                type="button"
                onClick={() => onApplyReplacement(option.id)}
              >
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 whitespace-normal break-words font-medium">
                    {option.label}
                  </span>
                </span>
                <span className="line-clamp-4 w-full whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {option.text}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Нажмите, чтобы применить
                </span>
              </button>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {issue.articleLinks.length > 0 ? (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className={sectionLabelClass}>
                Справочные материалы
              </SidebarGroupLabel>
              <SidebarGroupContent className="flex flex-col">
                {issue.articleLinks.map((link, index) => (
                  <div className="flex flex-col" key={link.href}>
                    {index > 0 ? <Separator /> : null}
                    <Button
                      asChild
                      className="h-auto justify-between py-2 text-left"
                      variant="ghost"
                    >
                      <a href={link.href} rel="noreferrer" target="_blank">
                        <span className="line-clamp-2">{link.title}</span>
                        <ExternalLinkIcon data-icon="inline-end" />
                      </a>
                    </Button>
                  </div>
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>
    </ResumeStudioSidebarFrame>
  )
}
