"use client"

import {
  type CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ChevronDownIcon,
  Maximize2Icon,
  RotateCcwIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Background,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useOnViewportChange,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeOrigin,
} from "@xyflow/react"
import type { PlateEditor, PlateElementProps } from "platejs/react"
import {
  Plate,
  PlateContent,
  PlateElement,
} from "platejs/react"

import { cn } from "@/lib/utils"

import type {
  ResumeStudioDocumentPage,
  ResumeStudioIssue,
  ResumeStudioMode,
  ResumeStudioSeverity,
} from "./types"

export type ResumeEditorCanvasPage = Pick<
  ResumeStudioDocumentPage,
  "id" | "title"
> & {
  editor: PlateEditor
}

type ResumeEditorCanvasProps = {
  centerIssueRequestId?: number
  fitWidthRequestId?: number
  fontFamily: string
  fontSize: number
  issues: ResumeStudioIssue[]
  mode: ResumeStudioMode
  pages: ResumeEditorCanvasPage[]
  resetViewRequestId?: number
  selectedIssueId: string
  zoom: number
  onApplyReplacement: (issueId: string, replacementId: string) => void
  onSelectIssue: (issueId: string) => void
  onZoomChange: (zoom: number) => void
}

type ResumePageNodeData = {
  editor: PlateEditor
  fontFamily: string
  fontSize: number
  issues: ResumeStudioIssue[]
  mode: ResumeStudioMode
  pageCount: number
  pageId: string
  pageNumber: number
  pageTitle?: string
  selectedIssueId: string
  onApplyReplacement: (issueId: string, replacementId: string) => void
  onSelectIssue: (issueId: string) => void
} & Record<string, unknown>

type ResumePageNode = Node<ResumePageNodeData, "resumePage">

const MAX_ZOOM = 220
const MIN_ZOOM = 40
const PAGE_HEIGHT = 1123
const PAGE_VERTICAL_GAP = 96
const emptyEdges: Edge[] = []
const nodeOrigin: NodeOrigin = [0.5, 0]
const zoomPresets = [40, 50, 75, 100, 125, 150, 200]

function getResumePageNodeId(pageId: string) {
  return `resume-page-${pageId}`
}

function getResumePageNodePosition(pageIndex: number) {
  return {
    x: 0,
    y: pageIndex * (PAGE_HEIGHT + PAGE_VERTICAL_GAP),
  }
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)))
}

function getHighlightClass(
  severity: ResumeStudioSeverity,
  selected: boolean,
  applied: boolean
) {
  if (applied) {
    return "bg-emerald-100 text-emerald-950 decoration-emerald-700 ring-1 ring-emerald-300"
  }

  if (severity === "error") {
    return cn(
      "bg-red-100 text-red-950 decoration-red-700",
      selected && "ring-2 ring-red-500"
    )
  }

  if (severity === "warning") {
    return cn(
      "bg-amber-100 text-amber-950 decoration-amber-700",
      selected && "ring-2 ring-amber-500"
    )
  }

  return cn(
    "bg-emerald-100 text-emerald-950 decoration-emerald-700",
    selected && "ring-2 ring-emerald-500"
  )
}

function HeadingOneElement(props: PlateElementProps) {
  const element = props.element as { id?: string }

  return (
    <PlateElement
      {...props}
      as="h1"
      className="mb-1 text-[2.25em] leading-none font-bold tracking-tight"
      data-resume-block-id={element.id}
    />
  )
}

function HeadingTwoElement(props: PlateElementProps) {
  const element = props.element as { id?: string }

  return (
    <PlateElement
      {...props}
      as="h2"
      className="mt-7 mb-3 border-b-2 border-slate-900 pb-1 text-[1.25em] leading-tight font-bold tracking-wide"
      data-resume-block-id={element.id}
    />
  )
}

function HeadingThreeElement(props: PlateElementProps) {
  const element = props.element as { id?: string }

  return (
    <PlateElement
      {...props}
      as="h3"
      className="mt-3 mb-2 text-[1.05em] leading-snug font-bold text-black"
      data-resume-block-id={element.id}
    />
  )
}

function ParagraphElement(props: PlateElementProps) {
  const element = props.element as { id?: string }

  return (
    <PlateElement
      {...props}
      as="p"
      className="mb-2 leading-7"
      data-resume-block-id={element.id}
    />
  )
}

function BlockquoteElement(props: PlateElementProps) {
  const element = props.element as { id?: string }

  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="my-3 border-l-4 border-black pl-4 text-black italic"
      data-resume-block-id={element.id}
    />
  )
}

export const resumeStudioPlateComponents = {
  blockquote: BlockquoteElement,
  h1: HeadingOneElement,
  h2: HeadingTwoElement,
  h3: HeadingThreeElement,
  p: ParagraphElement,
}

function ResumePageNodeCard({ data }: NodeProps<ResumePageNode>) {
  const issueById = new Map(data.issues.map((issue) => [issue.id, issue]))
  const editorStyle = {
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
  } as CSSProperties

  return (
    <div className="text-black">
      <article
        className={cn(
          "min-h-[1123px] w-[794px] rounded-sm border border-slate-300 bg-white px-[64px] py-[52px] text-black shadow-[0_1px_1px_rgba(15,23,42,0.08),0_10px_28px_rgba(15,23,42,0.12),0_28px_70px_rgba(15,23,42,0.10)] ring-1 ring-white/80",
          data.mode !== "edit" && "touch-none select-none",
          data.mode === "edit"
            ? "nodrag nopan nowheel cursor-text"
            : "cursor-grab active:cursor-grabbing"
        )}
        style={editorStyle}
      >
        <Plate
          editor={data.editor}
          renderLeaf={(props) => {
            const leaf = props.leaf as {
              applied?: boolean
              issueId?: string
              severity?: ResumeStudioSeverity
              text: string
            }

            if (!leaf.issueId || data.mode === "preview") {
              return <span {...props.attributes}>{props.children}</span>
            }

            const issue = issueById.get(leaf.issueId)
            const selected = leaf.issueId === data.selectedIssueId
            const severity = leaf.severity ?? issue?.severity ?? "recommend"

            const highlight = (
              <mark
                {...props.attributes}
                className={cn(
                  props.attributes.className,
                  "rounded-[3px] px-0.5 underline decoration-2 underline-offset-2 transition",
                  data.mode === "edit" ? "cursor-text" : "cursor-pointer",
                  getHighlightClass(
                    severity,
                    selected,
                    issue?.status === "applied"
                  )
                )}
                data-resume-issue-id={leaf.issueId}
                onMouseDown={(event) => {
                  if (data.mode === "edit") return

                  event.preventDefault()
                  data.onSelectIssue(leaf.issueId!)
                }}
              >
                {props.children}
              </mark>
            )

            if (data.mode === "edit" || !issue?.replacementOptions.length) {
              return highlight
            }

            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {highlight}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-80 max-w-[calc(100vw-2rem)] p-0"
                  side="bottom"
                  sideOffset={8}
                >
                  <DropdownMenuGroup>
                    {issue.replacementOptions.map((option, index) => (
                      <Fragment key={option.id}>
                        <DropdownMenuItem
                          className="cursor-pointer whitespace-normal rounded-none px-3 py-2.5 text-sm leading-5"
                          onSelect={() => {
                            data.onApplyReplacement(issue.id, option.id)
                          }}
                        >
                          {option.text}
                        </DropdownMenuItem>
                        {index < issue.replacementOptions.length - 1 && (
                          <DropdownMenuSeparator className="m-0" />
                        )}
                      </Fragment>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }}
        >
          <PlateContent
            autoFocusOnEditable
            className={cn(
              "min-h-[1010px] outline-none selection:bg-black selection:text-white",
              data.mode === "edit" && "nodrag nopan nowheel cursor-text"
            )}
            placeholder="Резюме появится здесь"
            readOnly={data.mode !== "edit"}
            spellCheck={false}
          />
        </Plate>
      </article>
    </div>
  )
}

const nodeTypes = {
  resumePage: ResumePageNodeCard,
}

function createResumePageNode(
  data: ResumePageNodeData,
  pageIndex: number
): ResumePageNode {
  return {
    id: getResumePageNodeId(data.pageId),
    type: "resumePage",
    position: getResumePageNodePosition(pageIndex),
    data,
  }
}

function ResumeFlowCanvas(props: ResumeEditorCanvasProps) {
  const {
    centerIssueRequestId = 0,
    fitWidthRequestId = 0,
    fontFamily,
    fontSize,
    issues,
    mode,
    pages,
    resetViewRequestId = 0,
    selectedIssueId,
    zoom,
    onApplyReplacement,
    onSelectIssue,
    onZoomChange,
  } = props
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const lastObservedSizeRef = useRef<{
    height: number
    isMobile: boolean | null
    width: number
  }>({
    height: 0,
    isMobile: null,
    width: 0,
  })
  const [isMobileCanvas, setIsMobileCanvas] = useState(false)
  const nodesInitialized = useNodesInitialized()
  const reactFlow = useReactFlow<ResumePageNode>()
  const nodeDataList = useMemo<ResumePageNodeData[]>(
    () =>
      pages.map((page, pageIndex) => ({
        editor: page.editor,
        fontFamily,
        fontSize,
        issues,
        mode,
        pageCount: pages.length,
        pageId: page.id,
        pageNumber: pageIndex + 1,
        pageTitle: page.title,
        selectedIssueId,
        onApplyReplacement,
        onSelectIssue,
      })),
    [
      fontFamily,
      fontSize,
      issues,
      mode,
      pages,
      selectedIssueId,
      onApplyReplacement,
      onSelectIssue,
    ]
  )
  const pageNodeIds = useMemo(
    () => nodeDataList.map((data) => getResumePageNodeId(data.pageId)),
    [nodeDataList]
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<ResumePageNode>(
    nodeDataList.map((data, pageIndex) => createResumePageNode(data, pageIndex))
  )

  const fitResumePage = useCallback(
    ({
      duration = 160,
      isMobile = isMobileCanvas,
    }: {
      duration?: number
      isMobile?: boolean
    } = {}) => {
      if (pageNodeIds.length === 0) return

      void reactFlow.fitView({
        duration,
        maxZoom: isMobile ? 0.68 : 1.4,
        minZoom: MIN_ZOOM / 100,
        nodes: pageNodeIds.map((id) => ({ id })),
        padding: isMobile ? 0.08 : 0.18,
      })
    },
    [isMobileCanvas, pageNodeIds, reactFlow]
  )
  const setCanvasZoom = useCallback(
    (nextZoom: number) => {
      const normalizedZoom = clampZoom(nextZoom)
      const currentViewport = reactFlow.getViewport()

      void reactFlow.setViewport(
        {
          ...currentViewport,
          zoom: normalizedZoom / 100,
        },
        { duration: 140 }
      )
      onZoomChange(normalizedZoom)
    },
    [onZoomChange, reactFlow]
  )
  const modeLabel =
    mode === "edit" ? "Edit" : mode === "preview" ? "Preview" : "Review"

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]))

      return nodeDataList.map((data, pageIndex) => {
        const id = getResumePageNodeId(data.pageId)
        const currentNode = currentById.get(id)

        return {
          ...(currentNode ?? createResumePageNode(data, pageIndex)),
          id,
          type: "resumePage",
          data,
          position:
            currentNode?.position ?? getResumePageNodePosition(pageIndex),
        }
      })
    })
  }, [nodeDataList, setNodes])

  const resetPageNodePositions = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const pageIndex = pageNodeIds.indexOf(node.id)

        if (pageIndex === -1) {
          return node
        }

        return {
          ...node,
          position: getResumePageNodePosition(pageIndex),
        }
      })
    )
  }, [pageNodeIds, setNodes])

  useOnViewportChange({
    onChange: ({ zoom: viewportZoom }) => {
      onZoomChange(clampZoom(viewportZoom * 100))
    },
  })

  useEffect(() => {
    if (!nodesInitialized) return

    const canvas = canvasRef.current

    if (!canvas) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return

      const { height, width } = entry.contentRect

      if (width < 10 || height < 10) return

      const isMobile = width < 640
      const previous = lastObservedSizeRef.current
      const becameVisible = previous.width < 10 || previous.height < 10
      const breakpointChanged = previous.isMobile !== isMobile
      const mobileSizeChanged =
        isMobile &&
        (Math.abs(previous.width - width) > 18 ||
          Math.abs(previous.height - height) > 36)

      lastObservedSizeRef.current = {
        height,
        isMobile,
        width,
      }
      setIsMobileCanvas(isMobile)

      if (becameVisible || breakpointChanged || mobileSizeChanged) {
        window.requestAnimationFrame(() => {
          fitResumePage({
            duration: becameVisible ? 0 : 180,
            isMobile,
          })
        })
      }
    })

    observer.observe(canvas)

    return () => observer.disconnect()
  }, [fitResumePage, nodesInitialized])

  useEffect(() => {
    if (fitWidthRequestId <= 0) return

    fitResumePage({
      duration: 180,
      isMobile: isMobileCanvas,
    })
  }, [fitResumePage, fitWidthRequestId, isMobileCanvas])

  useEffect(() => {
    if (resetViewRequestId <= 0) return

    resetPageNodePositions()
    window.requestAnimationFrame(() => {
      fitResumePage({
        duration: 180,
        isMobile: isMobileCanvas,
      })
      onZoomChange(100)
    })
  }, [
    fitResumePage,
    isMobileCanvas,
    onZoomChange,
    resetPageNodePositions,
    resetViewRequestId,
  ])

  useEffect(() => {
    if (centerIssueRequestId <= 0) return

    const selectedElement = document.querySelector<HTMLElement>(
      `[data-resume-issue-id="${selectedIssueId}"]`
    )

    if (!selectedElement) return

    window.requestAnimationFrame(() => {
      const elementRect = selectedElement.getBoundingClientRect()
      const elementCenter = reactFlow.screenToFlowPosition({
        x: elementRect.left + elementRect.width / 2,
        y: elementRect.top + elementRect.height / 2,
      })

      void reactFlow.setCenter(elementCenter.x, elementCenter.y, {
        duration: 220,
        zoom: reactFlow.getZoom(),
      })
    })
  }, [centerIssueRequestId, reactFlow, selectedIssueId])

  return (
    <div
      ref={canvasRef}
      className="relative h-full min-h-0 flex-1 overflow-hidden bg-white text-black"
    >
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-lg border bg-background p-1 text-foreground shadow-sm">
        <Badge className="h-6 rounded-md px-2 font-normal" variant="secondary">
          {modeLabel}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-6 gap-1 px-2 font-mono text-xs"
              size="sm"
              variant="ghost"
            >
              {zoom}%
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Zoom</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={zoomPresets.includes(zoom) ? String(zoom) : ""}
                onValueChange={(value) => setCanvasZoom(Number(value))}
              >
                {zoomPresets.map((preset) => (
                  <DropdownMenuRadioItem key={preset} value={String(preset)}>
                    {preset}%
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => fitResumePage({ duration: 180 })}>
                <Maximize2Icon />
                Fit width
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCanvasZoom(100)}>
                100%
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  resetPageNodePositions()
                  window.requestAnimationFrame(() => {
                    fitResumePage({
                      duration: 180,
                      isMobile: isMobileCanvas,
                    })
                  })
                }}
              >
                <RotateCcwIcon />
                Reset view
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ReactFlow
        className="bg-white"
        colorMode="light"
        edges={emptyEdges}
        elementsSelectable
        maxZoom={MAX_ZOOM / 100}
        minZoom={MIN_ZOOM / 100}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={!isMobileCanvas}
        nodeTypes={nodeTypes}
        nodeOrigin={nodeOrigin}
        onNodesChange={onNodesChange}
        panOnDrag={isMobileCanvas ? [0, 1, 2] : true}
        panOnScroll={isMobileCanvas}
        panOnScrollMode={PanOnScrollMode.Free}
        panOnScrollSpeed={0.7}
        preventScrolling
        proOptions={{ hideAttribution: true }}
        selectNodesOnDrag={false}
        selectionOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        zoomOnDoubleClick={false}
        zoomOnPinch
        zoomOnScroll
      >
        <Background />
      </ReactFlow>
    </div>
  )
}

export function ResumeEditorCanvas(props: ResumeEditorCanvasProps) {
  return (
    <ReactFlowProvider>
      <ResumeFlowCanvas {...props} />
    </ReactFlowProvider>
  )
}

export {
  BlockquoteElement,
  HeadingOneElement,
  HeadingThreeElement,
  HeadingTwoElement,
  ParagraphElement,
}
