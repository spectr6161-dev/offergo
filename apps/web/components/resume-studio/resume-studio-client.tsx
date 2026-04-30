"use client"

import { type MutableRefObject, useMemo, useRef, useState } from "react"
import {
  BasicMarksPlugin,
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
} from "@platejs/basic-nodes/react"
import { MenuIcon, PanelLeftOpenIcon, PanelRightOpenIcon } from "lucide-react"
import { toast } from "sonner"
import type { Value } from "platejs"
import { createPlateEditor, ParagraphPlugin } from "platejs/react"
import type {
  PanelImperativeHandle,
  PanelSize,
} from "react-resizable-panels"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { EditorToolbar } from "./editor-toolbar"
import { ResumeEditorCanvas } from "./resume-editor-canvas"
import { ResumeInspectorSidebar09 as ReviewInspector } from "./resume-inspector-sidebar-09"
import { ResumeIssuesSidebar09 } from "./resume-issues-sidebar-09"
import {
  BlockquoteElement,
  HeadingOneElement,
  HeadingThreeElement,
  HeadingTwoElement,
  ParagraphElement,
} from "./resume-editor-canvas"
import type {
  ResumeStudioData,
  ResumeStudioDocumentPage,
  ResumeStudioIssue,
  ResumeStudioMode,
} from "./types"

type ResumeStudioClientProps = {
  data: ResumeStudioData
}

const LEFT_PANEL_DEFAULT_SIZE = "350px"
const SIDE_PANEL_COLLAPSED_WIDTH = 49
const SIDE_PANEL_COLLAPSED_SIZE = `${SIDE_PANEL_COLLAPSED_WIDTH}px`
const LEFT_PANEL_COLLAPSE_THRESHOLD = 220
const RIGHT_PANEL_DEFAULT_SIZE = "28%"
const RIGHT_PANEL_COLLAPSE_THRESHOLD = 260
const LEFT_PANEL_EXPANDED_FALLBACK_WIDTH = 350
const RIGHT_PANEL_EXPANDED_FALLBACK_WIDTH = 360
const PANEL_ANIMATION_DURATION_MS = 240

function cloneValue(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value
}

function getDocumentPages(
  document: ResumeStudioData["document"]
): ResumeStudioDocumentPage[] {
  if (document.pages?.length) {
    return document.pages
  }

  return [
    {
      id: "page_1",
      title: "Page 1",
      initialValue: document.initialValue,
    },
  ]
}

function scrollToIssue(issueId: string) {
  window.requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(
      `[data-resume-issue-id="${issueId}"]`
    )

    element?.scrollIntoView({ behavior: "smooth", block: "center" })
  })
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3
}

function animatePanelResize({
  fromPx,
  onComplete,
  panel,
  toPx,
}: {
  fromPx: number
  onComplete: () => void
  panel: PanelImperativeHandle
  toPx: number
}) {
  if (Math.abs(fromPx - toPx) <= 1) {
    panel.resize(`${toPx}px`)
    onComplete()
    return () => undefined
  }

  const startedAt = performance.now()
  let frame = 0

  function tick(now: number) {
    const progress = Math.min(
      1,
      (now - startedAt) / PANEL_ANIMATION_DURATION_MS
    )
    const easedProgress = easeOutCubic(progress)
    const nextWidth = Math.round(fromPx + (toPx - fromPx) * easedProgress)

    panel.resize(`${nextWidth}px`)

    if (progress < 1) {
      frame = requestAnimationFrame(tick)
      return
    }

    panel.resize(`${toPx}px`)
    onComplete()
  }

  frame = requestAnimationFrame(tick)

  return () => cancelAnimationFrame(frame)
}

function CollapsedSideRail({
  count,
  label,
  side,
  onExpand,
}: {
  count: number
  label: string
  side: "left" | "right"
  onExpand: () => void
}) {
  const Icon = side === "left" ? PanelLeftOpenIcon : PanelRightOpenIcon

  return (
    <button
      aria-label={`Показать панель ${label}`}
      className={cn(
        "flex h-full w-full items-start justify-center bg-sidebar px-2 py-3 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        side === "left" ? "border-r" : "border-l"
      )}
      type="button"
      onClick={onExpand}
    >
      <Icon className="size-4 shrink-0" />
      <span className="sr-only">
        {label}
      </span>
      <span className="sr-only">
        {count}
      </span>
    </button>
  )
}

export function ResumeStudioClient({ data }: ResumeStudioClientProps) {
  const [fontFamily, setFontFamily] = useState("Times New Roman")
  const [fontSize, setFontSize] = useState(16)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [leftPanelFrozenWidth, setLeftPanelFrozenWidth] = useState<
    number | null
  >(null)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [mode, setMode] = useState<ResumeStudioMode>("review")
  const [selectedIssueId, setSelectedIssueId] = useState(data.issues[0]?.id ?? "")
  const [centerIssueRequestId, setCenterIssueRequestId] = useState(0)
  const [fitWidthRequestId, setFitWidthRequestId] = useState(0)
  const [resetViewRequestId, setResetViewRequestId] = useState(0)
  const [statusById, setStatusById] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.issues.map((issue) => [issue.id, issue.status]))
  )
  const [zoom, setZoom] = useState(100)
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null)
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null)
  const leftPanelExpandedWidthRef = useRef(LEFT_PANEL_EXPANDED_FALLBACK_WIDTH)
  const rightPanelExpandedWidthRef = useRef(RIGHT_PANEL_EXPANDED_FALLBACK_WIDTH)
  const leftPanelAnimatingRef = useRef(false)
  const rightPanelAnimatingRef = useRef(false)
  const leftPanelCancelAnimationRef = useRef<(() => void) | null>(null)
  const rightPanelCancelAnimationRef = useRef<(() => void) | null>(null)

  const documentPages = useMemo(
    () => getDocumentPages(data.document),
    [data.document]
  )
  const platePlugins = useMemo(
    () => [
      ParagraphPlugin.withComponent(ParagraphElement),
      H1Plugin.withComponent(HeadingOneElement),
      H2Plugin.withComponent(HeadingTwoElement),
      H3Plugin.withComponent(HeadingThreeElement),
      BlockquotePlugin.withComponent(BlockquoteElement),
      BasicMarksPlugin,
    ],
    []
  )
  const editorPages = useMemo(
    () =>
      documentPages.map((page) => ({
        id: page.id,
        title: page.title,
        editor: createPlateEditor({
          plugins: platePlugins,
          value: cloneValue(page.initialValue),
        }),
      })),
    [documentPages, platePlugins]
  )
  const pageEditorsById = useMemo(
    () => new Map(editorPages.map((page) => [page.id, page.editor])),
    [editorPages]
  )

  const issues = useMemo(
    () =>
      data.issues.map((issue) => ({
        ...issue,
        status: (statusById[issue.id] ?? issue.status) as ResumeStudioIssue["status"],
      })),
    [data.issues, statusById]
  )

  const selectedIssue =
    issues.find((issue) => issue.id === selectedIssueId) ?? issues[0]

  function selectIssue(issueId: string) {
    setSelectedIssueId(issueId)
  }

  function animateSidePanel({
    animatingRef,
    cancelAnimationRef,
    onComplete,
    panel,
    toPx,
  }: {
    animatingRef: MutableRefObject<boolean>
    cancelAnimationRef: MutableRefObject<(() => void) | null>
    onComplete: () => void
    panel: PanelImperativeHandle
    toPx: number
  }) {
    cancelAnimationRef.current?.()
    animatingRef.current = true

    cancelAnimationRef.current = animatePanelResize({
      fromPx: panel.getSize().inPixels,
      panel,
      toPx,
      onComplete: () => {
        animatingRef.current = false
        cancelAnimationRef.current = null
        onComplete()
      },
    })
  }

  function toggleLeftPanel() {
    const panel = leftPanelRef.current

    if (!panel) return

    const currentWidth = panel.getSize().inPixels
    const collapsed =
      isLeftPanelCollapsed || currentWidth <= SIDE_PANEL_COLLAPSED_WIDTH + 4

    if (collapsed) {
      setLeftPanelFrozenWidth(leftPanelExpandedWidthRef.current)
      setIsLeftPanelCollapsed(false)
      animateSidePanel({
        animatingRef: leftPanelAnimatingRef,
        cancelAnimationRef: leftPanelCancelAnimationRef,
        panel,
        toPx: leftPanelExpandedWidthRef.current,
        onComplete: () => {
          setIsLeftPanelCollapsed(false)
          setLeftPanelFrozenWidth(null)
        },
      })
      return
    }

    setLeftPanelFrozenWidth(currentWidth)
    leftPanelExpandedWidthRef.current = Math.max(
      currentWidth,
      LEFT_PANEL_EXPANDED_FALLBACK_WIDTH
    )
    animateSidePanel({
      animatingRef: leftPanelAnimatingRef,
      cancelAnimationRef: leftPanelCancelAnimationRef,
      panel,
      toPx: SIDE_PANEL_COLLAPSED_WIDTH,
      onComplete: () => {
        setIsLeftPanelCollapsed(true)
        setLeftPanelFrozenWidth(null)
      },
    })
  }

  function toggleRightPanel() {
    const panel = rightPanelRef.current

    if (!panel) return

    const currentWidth = panel.getSize().inPixels
    const collapsed =
      isRightPanelCollapsed || currentWidth <= SIDE_PANEL_COLLAPSED_WIDTH + 4

    if (collapsed) {
      animateSidePanel({
        animatingRef: rightPanelAnimatingRef,
        cancelAnimationRef: rightPanelCancelAnimationRef,
        panel,
        toPx: rightPanelExpandedWidthRef.current,
        onComplete: () => setIsRightPanelCollapsed(false),
      })
      return
    }

    rightPanelExpandedWidthRef.current = Math.max(
      currentWidth,
      RIGHT_PANEL_EXPANDED_FALLBACK_WIDTH
    )
    animateSidePanel({
      animatingRef: rightPanelAnimatingRef,
      cancelAnimationRef: rightPanelCancelAnimationRef,
      panel,
      toPx: SIDE_PANEL_COLLAPSED_WIDTH,
      onComplete: () => setIsRightPanelCollapsed(true),
    })
  }

  function handleLeftPanelResize(size: PanelSize, prevSize?: PanelSize) {
    if (leftPanelAnimatingRef.current) return

    if (size.inPixels <= SIDE_PANEL_COLLAPSED_WIDTH + 4) {
      setIsLeftPanelCollapsed(true)
      setLeftPanelFrozenWidth(null)
      return
    }

    if (size.inPixels > LEFT_PANEL_COLLAPSE_THRESHOLD) {
      leftPanelExpandedWidthRef.current = size.inPixels
      setIsLeftPanelCollapsed(false)
      setLeftPanelFrozenWidth(null)
      return
    }

    if (prevSize && !isLeftPanelCollapsed) {
      const panel = leftPanelRef.current

      if (panel) {
        setLeftPanelFrozenWidth(panel.getSize().inPixels)
        animateSidePanel({
          animatingRef: leftPanelAnimatingRef,
          cancelAnimationRef: leftPanelCancelAnimationRef,
          panel,
          toPx: SIDE_PANEL_COLLAPSED_WIDTH,
          onComplete: () => {
            setIsLeftPanelCollapsed(true)
            setLeftPanelFrozenWidth(null)
          },
        })
      }
    }
  }

  function handleRightPanelResize(size: PanelSize, prevSize?: PanelSize) {
    if (rightPanelAnimatingRef.current) return

    if (size.inPixels <= SIDE_PANEL_COLLAPSED_WIDTH + 4) {
      setIsRightPanelCollapsed(true)
      return
    }

    if (size.inPixels > RIGHT_PANEL_COLLAPSE_THRESHOLD) {
      rightPanelExpandedWidthRef.current = size.inPixels
      setIsRightPanelCollapsed(false)
      return
    }

    if (prevSize && !isRightPanelCollapsed) {
      const panel = rightPanelRef.current

      if (panel) {
        animateSidePanel({
          animatingRef: rightPanelAnimatingRef,
          cancelAnimationRef: rightPanelCancelAnimationRef,
          panel,
          toPx: SIDE_PANEL_COLLAPSED_WIDTH,
          onComplete: () => setIsRightPanelCollapsed(true),
        })
      }
    }
  }

  function applyReplacement(replacementId: string, issueId = selectedIssue.id) {
    const issue =
      issues.find((currentIssue) => currentIssue.id === issueId) ??
      selectedIssue
    const replacement = issue.replacementOptions.find(
      (option) => option.id === replacementId
    )

    if (!replacement) return

    const segments =
      issue.anchor?.segments && issue.anchor.segments.length > 0
        ? issue.anchor.segments
        : issue.anchor?.path
          ? [
              {
                pageId: issue.anchor.pageId ?? editorPages[0]?.id ?? "page_1",
                blockId: issue.anchor.blockId,
                path: issue.anchor.path,
                fromOffset: issue.anchor.fromOffset ?? 0,
                toOffset: issue.anchor.toOffset ?? issue.quote.length,
              },
            ]
          : []

    if (segments.length === 0) {
      toast.info("У замечания нет точного anchor. Замена пока не применяется.")
      return
    }

    const pageIds = new Set(segments.map((segment) => segment.pageId))

    if (pageIds.size > 1) {
      toast.info(
        "Замена для фрагмента на нескольких страницах пока не применяется."
      )
      return
    }

    const firstSegment = segments[0]
    const lastSegment = segments[segments.length - 1]
    const range = {
      anchor: { offset: firstSegment.fromOffset, path: firstSegment.path },
      focus: { offset: lastSegment.toOffset, path: lastSegment.path },
    }

    setSelectedIssueId(issue.id)
    const pageId = firstSegment.pageId
    const targetEditor = pageId ? pageEditorsById.get(pageId) : undefined

    if (!targetEditor) {
      toast.info("Anchor page is unavailable. Replacement is not applied.")
      return
    }

    targetEditor.tf.select(range)
    targetEditor.tf.insertText(replacement.text)
    setStatusById((current) => ({
      ...current,
      [issue.id]: "applied",
    }))
    toast.success("Замена применена в документе")
    scrollToIssue(issue.id)
  }

  function resetDocument() {
    documentPages.forEach((page) => {
      const pageEditor = pageEditorsById.get(page.id)

      pageEditor?.tf.setValue(cloneValue(page.initialValue))
    })
    setStatusById(
      Object.fromEntries(data.issues.map((issue) => [issue.id, issue.status]))
    )
    setSelectedIssueId(data.issues[0]?.id ?? "")
    setZoom(100)
    setResetViewRequestId((requestId) => requestId + 1)
    toast.success("Mock-документ сброшен")
  }

  const shell = (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "flex h-[calc(100vh-var(--header-height))] min-h-[720px] flex-col overflow-hidden bg-white text-black",
          isFullscreen && "fixed inset-0 z-50 h-screen min-h-0"
        )}
      >
        <EditorToolbar
          fontFamily={fontFamily}
          fontSize={fontSize}
          isFullscreen={isFullscreen}
          mode={mode}
          zoom={zoom}
          onFitWidth={() => setFitWidthRequestId((requestId) => requestId + 1)}
          onFontFamilyChange={setFontFamily}
          onFontSizeChange={setFontSize}
          onModeChange={setMode}
          onReset={resetDocument}
          onToggleFullscreen={() => setIsFullscreen((value) => !value)}
          onZoomChange={setZoom}
        />

        <div className="hidden min-h-0 flex-1 lg:block">
          <ResizablePanelGroup
            className="h-full"
            orientation="horizontal"
          >
            <ResizablePanel
              collapsible
              collapsedSize={SIDE_PANEL_COLLAPSED_SIZE}
              defaultSize={LEFT_PANEL_DEFAULT_SIZE}
              maxSize="34%"
              minSize={SIDE_PANEL_COLLAPSED_SIZE}
              panelRef={leftPanelRef}
              onResize={(size, _id, prevSize) =>
                handleLeftPanelResize(size, prevSize)
              }
            >
              <div className="h-full overflow-hidden">
              {false ? (
                <CollapsedSideRail
                  count={issues.length}
                  label="Проблемы"
                  side="left"
                  onExpand={toggleLeftPanel}
                />
              ) : (
                <ResumeIssuesSidebar09
                  frozenWidth={leftPanelFrozenWidth}
                  isCollapsed={isLeftPanelCollapsed}
                  issues={issues}
                  onCollapse={toggleLeftPanel}
                  onExpand={toggleLeftPanel}
                  selectedIssueId={selectedIssue.id}
                  onSelectIssue={selectIssue}
                />
              )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="48%" minSize="420px">
              <ResumeEditorCanvas
                centerIssueRequestId={centerIssueRequestId}
                fitWidthRequestId={fitWidthRequestId}
                fontFamily={fontFamily}
                fontSize={fontSize}
                issues={issues}
                mode={mode}
                pages={editorPages}
                resetViewRequestId={resetViewRequestId}
                selectedIssueId={selectedIssue.id}
                zoom={zoom}
                onApplyReplacement={(issueId, replacementId) =>
                  applyReplacement(replacementId, issueId)
                }
                onSelectIssue={selectIssue}
                onZoomChange={setZoom}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              collapsible
              collapsedSize={SIDE_PANEL_COLLAPSED_SIZE}
              defaultSize={RIGHT_PANEL_DEFAULT_SIZE}
              maxSize="38%"
              minSize={SIDE_PANEL_COLLAPSED_SIZE}
              panelRef={rightPanelRef}
              onResize={(size, _id, prevSize) =>
                handleRightPanelResize(size, prevSize)
              }
            >
              <div className="h-full overflow-hidden">
              {isRightPanelCollapsed ? (
                <CollapsedSideRail
                  count={selectedIssue ? 1 : 0}
                  label="Разбор"
                  side="right"
                  onExpand={toggleRightPanel}
                />
              ) : (
                <ReviewInspector
                  issue={selectedIssue}
                  onApplyReplacement={applyReplacement}
                  onCollapse={toggleRightPanel}
                  onExpand={toggleRightPanel}
                  onShowInDocument={() => selectIssue(selectedIssue.id)}
                />
              )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:hidden">
          <div className="flex items-center justify-between gap-2 border-b bg-background p-2">
            <ButtonGroup>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIssuesOpen(true)}
              >
                <MenuIcon data-icon="inline-start" />
                Проблемы
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInspectorOpen(true)}
              >
                <PanelRightOpenIcon data-icon="inline-start" />
                Разбор
              </Button>
            </ButtonGroup>
          </div>
          <ResumeEditorCanvas
            centerIssueRequestId={centerIssueRequestId}
            fitWidthRequestId={fitWidthRequestId}
            fontFamily={fontFamily}
            fontSize={fontSize}
            issues={issues}
            mode={mode}
            pages={editorPages}
            resetViewRequestId={resetViewRequestId}
            selectedIssueId={selectedIssue.id}
            zoom={zoom}
            onApplyReplacement={(issueId, replacementId) =>
              applyReplacement(replacementId, issueId)
            }
            onSelectIssue={selectIssue}
            onZoomChange={setZoom}
          />
        </div>

        <Sheet open={issuesOpen} onOpenChange={setIssuesOpen}>
          <SheetContent
            className="w-[92vw] max-w-none p-0"
            side="left"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Проблемы резюме</SheetTitle>
            </SheetHeader>
            <ResumeIssuesSidebar09
              issues={issues}
              selectedIssueId={selectedIssue.id}
              onSelectIssue={(issueId) => {
                selectIssue(issueId)
                setIssuesOpen(false)
              }}
            />
          </SheetContent>
        </Sheet>

        <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
          <SheetContent
            className="w-[92vw] max-w-none p-0"
            side="right"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Разбор замечания</SheetTitle>
            </SheetHeader>
            <ReviewInspector
              className="border-l-0"
              issue={selectedIssue}
              onApplyReplacement={applyReplacement}
              onShowInDocument={() => {
                selectIssue(selectedIssue.id)
                setInspectorOpen(false)
              }}
            />
          </SheetContent>
        </Sheet>

      </div>
    </TooltipProvider>
  )

  return shell
}
