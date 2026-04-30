"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type ResumeStudioSidebarFrameProps = {
  children: React.ReactNode
  collapseIcon: LucideIcon
  collapsedIcon: LucideIcon
  title: string
  ariaLabelCollapse?: string
  ariaLabelExpand?: string
  className?: string
  collapseButtonPosition?: "before-title" | "after-title"
  count?: number
  frozenWidth?: number | null
  headerContent?: React.ReactNode
  isCollapsed?: boolean
  side?: "left" | "right"
  width?: string
  onCollapse?: () => void
  onExpand?: () => void
}

export function ResumeStudioSidebarFrame({
  children,
  className,
  collapseIcon: CollapseIcon,
  collapsedIcon: CollapsedIcon,
  collapseButtonPosition = "after-title",
  count,
  frozenWidth = null,
  headerContent,
  isCollapsed = false,
  side = "left",
  title,
  width = "350px",
  ariaLabelCollapse = `Свернуть панель ${title}`,
  ariaLabelExpand = `Показать панель ${title}`,
  onCollapse,
  onExpand,
}: ResumeStudioSidebarFrameProps) {
  const frozenWidthStyle =
    frozenWidth !== null
      ? ({
          maxWidth: `${Math.round(frozenWidth)}px`,
          minWidth: `${Math.round(frozenWidth)}px`,
          width: `${Math.round(frozenWidth)}px`,
        } satisfies React.CSSProperties)
      : undefined

  if (isCollapsed) {
    return (
      <button
        aria-label={ariaLabelExpand}
        className={cn(
          "flex h-full w-full items-start justify-center bg-sidebar px-2 py-3 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          side === "left" ? "border-r" : "border-l"
        )}
        type="button"
        onClick={onExpand}
      >
        <CollapsedIcon className="size-4" />
      </button>
    )
  }

  return (
    <SidebarProvider
      className="h-full min-h-0"
      style={
        {
          "--sidebar-width": width,
        } as React.CSSProperties
      }
    >
      <div className="flex h-full w-full overflow-hidden bg-sidebar text-sidebar-foreground">
        <div
          className={cn("h-full", frozenWidth === null ? "w-full" : "shrink-0")}
          style={frozenWidthStyle}
        >
          <Sidebar side={side} collapsible="none" className={cn("w-full", className)}>
            <SidebarHeader className="gap-3.5 border-b p-4">
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {onCollapse && collapseButtonPosition === "before-title" ? (
                    <Button
                      aria-label={ariaLabelCollapse}
                      size="icon-sm"
                      variant="ghost"
                      onClick={onCollapse}
                    >
                      <CollapseIcon />
                    </Button>
                  ) : null}
                  <div className="min-w-0 truncate text-base font-medium text-foreground">
                    {title}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {typeof count === "number" ? (
                    <div className="text-sm text-muted-foreground">{count}</div>
                  ) : null}
                  {onCollapse && collapseButtonPosition === "after-title" ? (
                    <Button
                      aria-label={ariaLabelCollapse}
                      size="icon-sm"
                      variant="ghost"
                      onClick={onCollapse}
                    >
                      <CollapseIcon />
                    </Button>
                  ) : null}
                </div>
              </div>
              {headerContent}
            </SidebarHeader>
            {children}
          </Sidebar>
        </div>
      </div>
    </SidebarProvider>
  )
}
