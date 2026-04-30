import type { Value } from "platejs"

import type {
  ResumeStudioData,
  ResumeStudioIssue,
  ResumeStudioSeverity,
} from "./types"

type ResumeAnalysisChunk = {
  id: string
  type: string
  section: string
  text: string
  charStart: number
  charEnd: number
  parentId?: string
}

type ResumeAnalysisDisplayBlock = {
  id: string
  type: string
  section: string
  text: string
  charStart: number
  charEnd: number
  pageIndex?: number
  source?: string
}

type ResumeAnalysisReplacementOption = {
  text?: unknown
  type?: unknown
  isSafe?: unknown
  explanation?: unknown
}

type ResumeAnalysisFinding = {
  id: string
  title: string
  severity: "red" | "warning" | "green"
  category: string
  sourceBlockId: string | null
  anchorChunkIds?: string[]
  anchorSegments?: Array<{
    blockId: string
    charStart: number
    charEnd: number
  }>
  charStart?: number | null
  charEnd?: number | null
  originalFragment: string | null
  exactQuote?: string | null
  problem: string
  whyItMatters: string
  replacementOptions?: ResumeAnalysisReplacementOption[]
  confidence?: number
  scoreImpact?: number
}

type ResumeAnalysisReport = {
  runId?: string
  cleanText?: string
  displayBlocks?: ResumeAnalysisDisplayBlock[]
  chunks: ResumeAnalysisChunk[]
  findings: ResumeAnalysisFinding[]
  scores?: {
    overall?: {
      value?: number
      label?: string
      isPartial?: boolean
      confidence?: string
    }
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

type DraftLeaf = {
  text: string
  issueId?: string
  severity?: ResumeStudioSeverity
}

type DraftBlock = {
  id: string
  type: string
  section?: string
  charStart?: number
  charEnd?: number
  children: DraftLeaf[]
  estimatedHeight: number
}

type HighlightSegment = {
  pageId: string
  blockId: string
  path: number[]
  fromOffset: number
  toOffset: number
}

const sectionLabels: Record<string, string> = {
  about: "О себе",
  education: "Образование",
  experience: "Опыт работы",
  header: "Шапка",
  skills: "Навыки",
  target_role: "Целевая роль",
}

const pageHeightBudget = 960
const lineLength = 88

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function toStudioSeverity(
  severity: ResumeAnalysisFinding["severity"]
): ResumeStudioSeverity {
  if (severity === "red") return "error"
  if (severity === "warning") return "warning"

  return "recommend"
}

function toFindingSeverity(value: unknown): ResumeAnalysisFinding["severity"] {
  if (value === "red" || value === "warning" || value === "green") {
    return value
  }

  return "warning"
}

function getChunkBlockType(chunk: ResumeAnalysisChunk) {
  if (chunk.type === "work_entry_header" || chunk.type === "job_header") {
    return "h3"
  }

  if (chunk.type === "target_role") {
    return "h3"
  }

  return "p"
}

function getDisplayBlockType(block: ResumeAnalysisDisplayBlock) {
  if (block.type === "section_heading" || block.type === "heading") {
    return "h2"
  }

  return "p"
}

function getChunkText(chunk: ResumeAnalysisChunk) {
  const shouldPrefix =
    chunk.type === "achievement_bullet" ||
    chunk.type === "responsibility_bullet" ||
    chunk.type === "skill_item"

  return {
    prefix: shouldPrefix ? "• " : "",
    text: `${shouldPrefix ? "• " : ""}${chunk.text}`,
  }
}

function estimateHeight(blockType: string, text: string) {
  if (blockType === "h1") return 70
  if (blockType === "h2") return 52
  if (blockType === "h3") return 46

  const lines = Math.max(1, Math.ceil(text.length / lineLength))

  return 18 + lines * 26
}

function getFindingChunkIds(finding: ResumeAnalysisFinding) {
  const ids = new Set<string>()

  for (const id of finding.anchorChunkIds ?? []) {
    ids.add(id)
  }

  if (finding.sourceBlockId) {
    ids.add(finding.sourceBlockId)
  }

  return ids
}

function buildLeaves(
  blockText: string,
  prefixLength: number,
  chunk: ResumeAnalysisChunk,
  findings: ResumeAnalysisFinding[]
): DraftLeaf[] {
  const highlights = findings
    .filter((finding) => getFindingChunkIds(finding).has(chunk.id))
    .map((finding) => {
      const fragment = normalizeText(finding.originalFragment ?? "")
      const normalizedBlock = normalizeText(blockText)
      const exactIndex = fragment ? normalizedBlock.indexOf(fragment) : -1

      if (exactIndex >= 0 && fragment) {
        const rawIndex = blockText.indexOf(finding.originalFragment ?? "")

        if (rawIndex >= 0) {
          return {
            issueId: finding.id,
            severity: toStudioSeverity(finding.severity),
            start: rawIndex,
            end: rawIndex + (finding.originalFragment ?? "").length,
          }
        }
      }

      return {
        issueId: finding.id,
        severity: toStudioSeverity(finding.severity),
        start: Math.min(prefixLength, blockText.length),
        end: blockText.length,
      }
    })
    .filter((highlight) => highlight.end > highlight.start)
    .sort((a, b) => a.start - b.start)

  if (highlights.length === 0) {
    return [{ text: blockText }]
  }

  const leaves: DraftLeaf[] = []
  let cursor = 0

  for (const highlight of highlights) {
    if (highlight.start < cursor) continue

    if (highlight.start > cursor) {
      leaves.push({ text: blockText.slice(cursor, highlight.start) })
    }

    leaves.push({
      text: blockText.slice(highlight.start, highlight.end),
      issueId: highlight.issueId,
      severity: highlight.severity,
    })
    cursor = highlight.end
  }

  if (cursor < blockText.length) {
    leaves.push({ text: blockText.slice(cursor) })
  }

  return leaves.filter((leaf) => leaf.text.length > 0)
}

function buildLeavesFromDisplayBlock(
  block: ResumeAnalysisDisplayBlock,
  findings: ResumeAnalysisFinding[]
): DraftLeaf[] {
  const highlights = findings
    .flatMap((finding) => getDisplayBlockHighlightRanges(block, finding))
    .filter((highlight) => highlight.end > highlight.start)
    .sort((a, b) => a.start - b.start)

  if (highlights.length === 0) {
    return [{ text: block.text }]
  }

  const leaves: DraftLeaf[] = []
  let cursor = 0

  for (const highlight of highlights) {
    if (highlight.start < cursor) continue

    if (highlight.start > cursor) {
      leaves.push({ text: block.text.slice(cursor, highlight.start) })
    }

    leaves.push({
      text: block.text.slice(highlight.start, highlight.end),
      issueId: highlight.issueId,
      severity: highlight.severity,
    })
    cursor = highlight.end
  }

  if (cursor < block.text.length) {
    leaves.push({ text: block.text.slice(cursor) })
  }

  return leaves.filter((leaf) => leaf.text.length > 0)
}

function getDisplayBlockHighlightRanges(
  block: ResumeAnalysisDisplayBlock,
  finding: ResumeAnalysisFinding
) {
  const severity = toStudioSeverity(finding.severity)
  const fromSegments = (finding.anchorSegments ?? [])
    .filter((segment) => segment.blockId === block.id)
    .map((segment) => ({
      issueId: finding.id,
      severity,
      start: Math.max(0, segment.charStart - block.charStart),
      end: Math.min(block.text.length, segment.charEnd - block.charStart),
    }))

  if (fromSegments.length > 0) {
    return fromSegments
  }

  if (
    typeof finding.charStart === "number" &&
    typeof finding.charEnd === "number" &&
    block.charStart < finding.charEnd &&
    block.charEnd > finding.charStart
  ) {
    return [
      {
        issueId: finding.id,
        severity,
        start: Math.max(0, finding.charStart - block.charStart),
        end: Math.min(block.text.length, finding.charEnd - block.charStart),
      },
    ]
  }

  const ids = getFindingChunkIds(finding)

  if (!ids.has(block.id)) {
    return []
  }

  const quote = finding.exactQuote ?? finding.originalFragment
  const index = quote ? block.text.indexOf(quote) : -1

  if (index >= 0 && quote) {
    return [
      {
        issueId: finding.id,
        severity,
        start: index,
        end: index + quote.length,
      },
    ]
  }

  return [
    {
      issueId: finding.id,
      severity,
      start: 0,
      end: block.text.length,
    },
  ]
}

function buildDraftBlocks(
  chunks: ResumeAnalysisChunk[],
  findings: ResumeAnalysisFinding[]
) {
  const blocks: DraftBlock[] = []
  let currentSection = ""

  for (const chunk of chunks) {
    if (!chunk.text.trim()) continue

    if (
      chunk.section &&
      chunk.section !== currentSection &&
      chunk.section !== "header"
    ) {
      currentSection = chunk.section
      blocks.push({
        id: `section_${chunk.section}_${blocks.length}`,
        type: "h2",
        children: [
          {
            text: sectionLabels[chunk.section] ?? chunk.section,
          },
        ],
        estimatedHeight: 52,
      })
    }

    const { prefix, text } = getChunkText(chunk)
    const type = getChunkBlockType(chunk)

    blocks.push({
      id: chunk.id,
      type,
      children: buildLeaves(text, prefix.length, chunk, findings),
      estimatedHeight: estimateHeight(type, text),
    })
  }

  return blocks
}

function buildDraftBlocksFromDisplayBlocks(
  displayBlocks: ResumeAnalysisDisplayBlock[],
  findings: ResumeAnalysisFinding[]
) {
  return displayBlocks
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
    .filter((block) => block.text.trim())
    .map((block): DraftBlock => {
      const type = getDisplayBlockType(block)

      return {
        id: block.id,
        type,
        section: block.section,
        charStart: block.charStart,
        charEnd: block.charEnd,
        children: buildLeavesFromDisplayBlock(block, findings),
        estimatedHeight: estimateHeight(type, block.text),
      }
    })
}

function paginateBlocks(blocks: DraftBlock[]) {
  const pages: DraftBlock[][] = [[]]
  let currentHeight = 0

  for (const block of blocks) {
    if (
      currentHeight + block.estimatedHeight > pageHeightBudget &&
      pages[pages.length - 1].length > 0
    ) {
      pages.push([])
      currentHeight = 0
    }

    pages[pages.length - 1].push(block)
    currentHeight += block.estimatedHeight
  }

  return pages.filter((page) => page.length > 0)
}

function toPlateNode(block: DraftBlock) {
  return {
    id: block.id,
    type: block.type,
    children: block.children,
  }
}

function getSegmentsByIssue(pages: DraftBlock[][]) {
  const segmentsByIssue = new Map<string, HighlightSegment[]>()

  pages.forEach((pageBlocks, pageIndex) => {
    const pageId = `page_${pageIndex + 1}`

    pageBlocks.forEach((block, blockIndex) => {
      block.children.forEach((leaf, leafIndex) => {
        if (!leaf.issueId) return

        const current = segmentsByIssue.get(leaf.issueId) ?? []

        current.push({
          pageId,
          blockId: block.id,
          path: [blockIndex, leafIndex],
          fromOffset: 0,
          toOffset: leaf.text.length,
        })
        segmentsByIssue.set(leaf.issueId, current)
      })
    })
  })

  return segmentsByIssue
}

type ResumeAnalysisSourceBlock = {
  id: string
  section: string
  text: string
}

function getSectionTitle(
  finding: ResumeAnalysisFinding,
  blockById: Map<string, ResumeAnalysisSourceBlock>
) {
  const block = finding.sourceBlockId ? blockById.get(finding.sourceBlockId) : null
  const section = block?.section

  if (section) {
    return sectionLabels[section] ?? section
  }

  return sectionLabels[finding.category] ?? finding.category
}

function buildIssues(
  findings: ResumeAnalysisFinding[],
  sourceBlocks: ResumeAnalysisSourceBlock[],
  segmentsByIssue: Map<string, HighlightSegment[]>
): ResumeStudioIssue[] {
  const blockById = new Map(sourceBlocks.map((block) => [block.id, block]))

  return findings.map((finding) => {
    const segments = segmentsByIssue.get(finding.id) ?? []
    const firstSegment = segments[0]
    const sourceBlock = finding.sourceBlockId
      ? blockById.get(finding.sourceBlockId)
      : undefined

    return {
      id: finding.id,
      severity: toStudioSeverity(finding.severity),
      status: "open",
      sectionTitle: getSectionTitle(finding, blockById),
      title: finding.title,
      quote:
        finding.exactQuote ??
        finding.originalFragment ??
        sourceBlock?.text ??
        finding.title,
      description: finding.problem,
      whyItMatters: finding.whyItMatters,
      articleLinks: [],
      replacementOptions: (finding.replacementOptions ?? []).map(
        (option, index) => ({
          id: `${finding.id}_replacement_${index + 1}`,
          label:
            asString(option.explanation) ||
            asString(option.type) ||
            `Вариант ${index + 1}`,
          text: asString(option.text),
          isSafe: option.isSafe !== false,
        })
      ),
      anchor: firstSegment
        ? {
            pageId: firstSegment.pageId,
            blockId: firstSegment.blockId,
            path: firstSegment.path,
            fromOffset: firstSegment.fromOffset,
            toOffset: firstSegment.toOffset,
            segments,
          }
        : null,
      confidence: finding.confidence,
      scoreImpact: finding.scoreImpact,
    } satisfies ResumeStudioIssue
  })
}

function parseReport(input: unknown): ResumeAnalysisReport | null {
  if (!isRecord(input)) return null

  const displayBlocks = Array.isArray(input.displayBlocks)
    ? input.displayBlocks
        .filter(isRecord)
        .map((block) => ({
          id: asString(block.id),
          type: asString(block.type, "paragraph"),
          section: asString(block.section, "other"),
          text: asString(block.text),
          charStart: asNumber(block.charStart),
          charEnd: asNumber(block.charEnd),
          pageIndex:
            typeof block.pageIndex === "number" ? block.pageIndex : undefined,
          source: asString(block.source) || undefined,
        }))
        .filter((block) => block.id && block.text)
    : []
  const chunks = Array.isArray(input.chunks)
    ? input.chunks
        .filter(isRecord)
        .map((chunk) => ({
          id: asString(chunk.id),
          type: asString(chunk.type, "other"),
          section: asString(chunk.section, "other"),
          text: asString(chunk.text),
          charStart: asNumber(chunk.charStart),
          charEnd: asNumber(chunk.charEnd),
          parentId: asString(chunk.parentId) || undefined,
        }))
        .filter((chunk) => chunk.id && chunk.text)
    : []
  const findings = Array.isArray(input.findings)
    ? input.findings
        .filter(isRecord)
        .map((finding) => ({
          id: asString(finding.id),
          title: asString(finding.title),
          severity: toFindingSeverity(finding.severity),
          category: asString(finding.category, "structure"),
          sourceBlockId:
            typeof finding.sourceBlockId === "string"
              ? finding.sourceBlockId
              : null,
          anchorChunkIds: Array.isArray(finding.anchorChunkIds)
            ? finding.anchorChunkIds.filter(
                (id): id is string => typeof id === "string"
              )
            : undefined,
          anchorSegments: Array.isArray(finding.anchorSegments)
            ? finding.anchorSegments
                .filter(isRecord)
                .map((segment) => ({
                  blockId: asString(segment.blockId),
                  charStart: asNumber(segment.charStart),
                  charEnd: asNumber(segment.charEnd),
                }))
                .filter((segment) => segment.blockId)
            : undefined,
          charStart:
            typeof finding.charStart === "number" ? finding.charStart : null,
          charEnd: typeof finding.charEnd === "number" ? finding.charEnd : null,
          originalFragment:
            typeof finding.originalFragment === "string"
              ? finding.originalFragment
              : null,
          exactQuote:
            typeof finding.exactQuote === "string" ? finding.exactQuote : null,
          problem: asString(finding.problem),
          whyItMatters: asString(finding.whyItMatters),
          replacementOptions: Array.isArray(finding.replacementOptions)
            ? finding.replacementOptions.filter(isRecord)
            : [],
          confidence:
            typeof finding.confidence === "number"
              ? finding.confidence
              : undefined,
          scoreImpact:
            typeof finding.scoreImpact === "number"
              ? finding.scoreImpact
              : undefined,
        }))
        .filter((finding) => finding.id && finding.title)
    : []

  return {
    runId: asString(input.runId) || undefined,
    cleanText: asString(input.cleanText),
    displayBlocks,
    chunks,
    findings,
    scores: isRecord(input.scores)
      ? (input.scores as ResumeAnalysisReport["scores"])
      : undefined,
    metadata: isRecord(input.metadata)
      ? {
          isPartial:
            typeof input.metadata.isPartial === "boolean"
              ? input.metadata.isPartial
              : undefined,
          scoreConfidence: asString(input.metadata.scoreConfidence) || undefined,
          anchoredRatio:
            typeof input.metadata.anchoredRatio === "number"
              ? input.metadata.anchoredRatio
              : undefined,
          displayCoverage:
            typeof input.metadata.displayCoverage === "number"
              ? input.metadata.displayCoverage
              : undefined,
          findingsCount:
            typeof input.metadata.findingsCount === "number"
              ? input.metadata.findingsCount
              : undefined,
          pipelineWarnings: Array.isArray(input.metadata.pipelineWarnings)
            ? input.metadata.pipelineWarnings.map(String)
            : undefined,
        }
      : undefined,
  }
}

function getDocumentTitle(chunks: ResumeAnalysisChunk[]) {
  const nameChunk = chunks.find(
    (chunk) => chunk.section === "header" && /^Имя:/i.test(chunk.text)
  )

  if (nameChunk) {
    return nameChunk.text.replace(/^Имя:\s*/i, "").trim()
  }

  return "Резюме"
}

function getDocumentSubtitle(chunks: ResumeAnalysisChunk[]) {
  const targetRole = chunks.find((chunk) => chunk.type === "target_role")

  return targetRole?.text.split("\n")[0]?.trim() || "Resume analysis"
}

function getDocumentMeta(chunks: ResumeAnalysisChunk[]) {
  return chunks
    .filter((chunk) => chunk.section === "header")
    .slice(0, 4)
    .map((chunk) => chunk.text)
}

function getDocumentTitleFromDisplayBlocks(blocks: ResumeAnalysisDisplayBlock[]) {
  const firstHeader = blocks.find(
    (block) =>
      block.section === "header" &&
      block.text.trim() &&
      !/@|\+?\d[\d\s().-]{7,}|telegram|linkedin|github/i.test(block.text)
  )

  return firstHeader?.text.trim().split("\n")[0] || "Р РµР·СЋРјРµ"
}

function getDocumentSubtitleFromDisplayBlocks(
  blocks: ResumeAnalysisDisplayBlock[]
) {
  const targetRole = blocks.find((block) => block.section === "target_role")

  return targetRole?.text.split("\n")[0]?.trim() || "Resume analysis"
}

function getDocumentMetaFromDisplayBlocks(blocks: ResumeAnalysisDisplayBlock[]) {
  return blocks
    .filter((block) => block.section === "header" && block.type === "contact")
    .slice(0, 4)
    .map((block) => block.text)
}

export function adaptResumeAnalysisReportToStudioData(
  input: unknown
): ResumeStudioData | null {
  const report = parseReport(input)

  if (
    !report ||
    (report.chunks.length === 0 && (report.displayBlocks?.length ?? 0) === 0)
  ) {
    return null
  }

  const chunks = report.chunks
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
  const displayBlocks = (report.displayBlocks ?? [])
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
  const findings = report.findings
  const blocks =
    displayBlocks.length > 0
      ? buildDraftBlocksFromDisplayBlocks(displayBlocks, findings)
      : buildDraftBlocks(chunks, findings)
  const pageBlocks = paginateBlocks(blocks)
  const pages = pageBlocks.map((page, index) => ({
    id: `page_${index + 1}`,
    title: `Page ${index + 1}`,
    initialValue: page.map(toPlateNode) as Value,
  }))
  const segmentsByIssue = getSegmentsByIssue(pageBlocks)
  const sourceBlocks =
    displayBlocks.length > 0
      ? displayBlocks.map((block) => ({
          id: block.id,
          section: block.section,
          text: block.text,
        }))
      : chunks.map((chunk) => ({
          id: chunk.id,
          section: chunk.section,
          text: chunk.text,
        }))
  const issues = buildIssues(findings, sourceBlocks, segmentsByIssue)
  const overallScore = report.scores?.overall?.value ?? 0

  return {
    runId: report.runId,
    document: {
      title:
        displayBlocks.length > 0
          ? getDocumentTitleFromDisplayBlocks(displayBlocks)
          : getDocumentTitle(chunks),
      subtitle:
        displayBlocks.length > 0
          ? getDocumentSubtitleFromDisplayBlocks(displayBlocks)
          : getDocumentSubtitle(chunks),
      meta:
        displayBlocks.length > 0
          ? getDocumentMetaFromDisplayBlocks(displayBlocks)
          : getDocumentMeta(chunks),
      initialValue: pages[0]?.initialValue ?? ([] as unknown as Value),
      pages,
    },
    issues,
    score: {
      overall: overallScore,
      label:
        report.scores?.overall?.label ??
        (report.metadata?.isPartial ? "Предварительная оценка" : "Оценка"),
    },
    metadata: report.metadata,
  }
}
