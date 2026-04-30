"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  FileSearchIcon,
  PanelLeftOpenIcon,
  PanelRightOpenIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { IssueInspector } from "./issue-inspector";
import { IssueSidebar } from "./issue-sidebar";
import { ResumePageCanvas } from "./resume-page-canvas";
import type {
  ResumeReviewData,
  ResumeReviewFinding,
  ResumeReviewFixture,
  ReviewFilter,
} from "./types";

function filterFindings({
  findings,
  filter,
  query,
}: {
  findings: ResumeReviewFinding[];
  filter: ReviewFilter;
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  return findings.filter((finding) => {
    if (filter !== "all" && finding.severity !== filter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      finding.title,
      finding.originalText,
      finding.problem,
      finding.whyItMatters,
      finding.replacementOptions.map((option) => option.text).join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function findFirstFinding(
  findings: ResumeReviewFinding[],
  selectedFindingId: string | null,
) {
  if (
    selectedFindingId &&
    findings.some((finding) => finding.id === selectedFindingId)
  ) {
    return selectedFindingId;
  }

  return findings[0]?.id ?? null;
}

function scrollFindingIntoView(findingId: string) {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(
        `[data-finding-id="${CSS.escape(findingId)}"]`,
      )
      ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  });
}

export function ResumeReviewWorkspace({
  initialData,
  fixtures = [],
}: {
  initialData: ResumeReviewData;
  fixtures?: ResumeReviewFixture[];
}) {
  const [activeFixtureId, setActiveFixtureId] = useState(
    fixtures[0]?.id ?? "default",
  );
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    initialData.findings[0]?.id ?? null,
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobileIssuesOpen, setMobileIssuesOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [copiedReplacement, setCopiedReplacement] = useState<string | null>(
    null,
  );

  const activeFixture =
    fixtures.find((fixture) => fixture.id === activeFixtureId) ?? fixtures[0];
  const data = activeFixture?.data ?? initialData;
  const filteredFindings = useMemo(
    () =>
      filterFindings({
        findings: data.findings,
        filter,
        query: deferredQuery,
      }),
    [data.findings, deferredQuery, filter],
  );
  const effectiveSelectedFindingId = findFirstFinding(
    filteredFindings,
    selectedFindingId,
  );
  const selectedFinding =
    data.findings.find((finding) => finding.id === effectiveSelectedFindingId) ??
    null;
  const counts = {
    error: data.findings.filter((finding) => finding.severity === "error")
      .length,
    warning: data.findings.filter((finding) => finding.severity === "warning")
      .length,
    recommend: data.findings.filter((finding) => finding.severity === "recommend")
      .length,
  };

  const selectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    setMobileIssuesOpen(false);
    scrollFindingIntoView(findingId);
  };

  const showInDocument = (findingId: string) => {
    setSelectedFindingId(findingId);
    setMobileInspectorOpen(false);
    scrollFindingIntoView(findingId);
  };

  const copyReplacement = (replacement: string) => {
    setCopiedReplacement(replacement);
    void navigator.clipboard?.writeText(replacement);
    window.setTimeout(() => {
      setCopiedReplacement((current) =>
        current === replacement ? null : current,
      );
    }, 1400);
  };

  const sidebar = (
    <IssueSidebar
      data={data}
      filter={filter}
      findings={filteredFindings}
      onCollapse={() => setLeftCollapsed(true)}
      onFilterChange={setFilter}
      onQueryChange={setQuery}
      onSelectFinding={selectFinding}
      query={query}
      selectedFindingId={effectiveSelectedFindingId}
    />
  );

  const inspector = (
    <IssueInspector
      copiedReplacement={copiedReplacement}
      finding={selectedFinding}
      onCollapse={() => setRightCollapsed(true)}
      onCopyReplacement={copyReplacement}
      onShowInDocument={showInDocument}
    />
  );

  return (
    <section
      className="min-h-[620px] overflow-hidden bg-black text-slate-100 [--review-recommend:#34d399] [--review-recommend-bg:rgba(52,211,153,0.13)] [--review-recommend-border:rgba(52,211,153,0.35)] [--review-recommend-paper:rgba(16,185,129,0.15)] [--review-warning:#fbbf24] [--review-warning-bg:rgba(251,191,36,0.14)] [--review-warning-border:rgba(251,191,36,0.38)] [--review-warning-paper:rgba(251,191,36,0.22)]"
      style={{ height: "calc(100vh - var(--header-height))" }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/95 px-3 py-2 lg:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 lg:hidden"
              onClick={() => setMobileIssuesOpen(true)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <PanelLeftOpenIcon data-icon="inline-start" />
              <span className="sr-only">Открыть список замечаний</span>
            </Button>
            <div className="hidden rounded-lg border border-white/10 bg-white/5 p-2 lg:flex">
              <FileSearchIcon data-icon="inline-start" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold lg:text-base">
                Анализ резюме как code review
              </h1>
              <p className="truncate text-xs text-slate-500">
                UI-only preview · {data.document.title} · {data.findings.length} замечаний
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {fixtures.length > 1 ? (
              <ToggleGroup
                aria-label="Mock fixture"
                className="hidden rounded-lg border border-white/10 bg-white/5 p-1 md:flex"
                onValueChange={(value) => {
                  if (value) {
                    setActiveFixtureId(value);
                    setFilter("all");
                    setQuery("");
                  }
                }}
                size="sm"
                type="single"
                value={activeFixtureId}
                variant="outline"
              >
                {fixtures.map((fixture) => (
                  <ToggleGroupItem
                    className="text-slate-400 data-[state=on]:bg-white data-[state=on]:text-black"
                    key={fixture.id}
                    value={fixture.id}
                  >
                    {fixture.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}

            <div className="hidden items-center gap-1 lg:flex">
              <Badge className="border-destructive/30 bg-destructive/10 text-destructive" variant="outline">
                {counts.error} error
              </Badge>
              <Badge
                className="border-[color:var(--review-warning-border)] bg-[color:var(--review-warning-bg)] text-[color:var(--review-warning)]"
                variant="outline"
              >
                {counts.warning} warning
              </Badge>
              <Badge
                className="border-[color:var(--review-recommend-border)] bg-[color:var(--review-recommend-bg)] text-[color:var(--review-recommend)]"
                variant="outline"
              >
                {counts.recommend} recommend
              </Badge>
            </div>

            <ToggleGroup
              aria-label="Zoom"
              className="hidden rounded-lg border border-white/10 bg-white/5 p-1 sm:flex"
              onValueChange={(value) => {
                if (value) {
                  setZoom(Number(value));
                }
              }}
              size="sm"
              type="single"
              value={String(zoom)}
              variant="outline"
            >
              <ToggleGroupItem
                className="text-slate-400 data-[state=on]:bg-white data-[state=on]:text-black"
                value="0.9"
              >
                90
              </ToggleGroupItem>
              <ToggleGroupItem
                className="text-slate-400 data-[state=on]:bg-white data-[state=on]:text-black"
                value="1"
              >
                100
              </ToggleGroupItem>
              <ToggleGroupItem
                className="text-slate-400 data-[state=on]:bg-white data-[state=on]:text-black"
                value="1.2"
              >
                120
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 lg:hidden"
              onClick={() => setMobileInspectorOpen(true)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <PanelRightOpenIcon data-icon="inline-start" />
              <span className="sr-only">Открыть разбор</span>
            </Button>
          </div>
        </header>

        <div
          className="hidden min-h-0 flex-1 lg:grid"
          style={{
            gridTemplateColumns: `${
              leftCollapsed ? "56px" : "312px"
            } minmax(0, 1fr) ${rightCollapsed ? "56px" : "370px"}`,
          }}
        >
          {leftCollapsed ? (
            <button
              className="flex h-full items-start justify-center border-r border-white/10 bg-black/95 px-2 py-4 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
              onClick={() => setLeftCollapsed(false)}
              type="button"
            >
              <span className="flex rotate-90 items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
                <PanelLeftOpenIcon data-icon="inline-start" />
                Problems
              </span>
            </button>
          ) : (
            sidebar
          )}

          <main className="min-h-0">
            <ResumePageCanvas
              data={data}
              onSelectFinding={selectFinding}
              selectedFindingId={effectiveSelectedFindingId}
              zoom={zoom}
            />
          </main>

          {rightCollapsed ? (
            <button
              className="flex h-full items-start justify-center border-l border-white/10 bg-black/95 px-2 py-4 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
              onClick={() => setRightCollapsed(false)}
              type="button"
            >
              <span className="flex rotate-90 items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
                <PanelRightOpenIcon data-icon="inline-start" />
                Inspector
              </span>
            </button>
          ) : (
            inspector
          )}
        </div>

        <div className="min-h-0 flex-1 lg:hidden">
          <ResumePageCanvas
            data={data}
            onSelectFinding={(findingId) => {
              selectFinding(findingId);
              setMobileInspectorOpen(true);
            }}
            selectedFindingId={effectiveSelectedFindingId}
            zoom={0.72}
          />
        </div>
      </div>

      <Sheet onOpenChange={setMobileIssuesOpen} open={mobileIssuesOpen}>
        <SheetContent
          className="w-[88vw] max-w-sm gap-0 overflow-hidden border-white/10 bg-black p-0 text-slate-100"
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Список замечаний</SheetTitle>
            <SheetDescription>
              Фильтры и список найденных проблем в резюме.
            </SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <Drawer
        direction="bottom"
        onOpenChange={setMobileInspectorOpen}
        open={mobileInspectorOpen}
      >
        <DrawerContent className="max-h-[88vh] border-white/10 bg-black text-slate-100">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Разбор замечания</DrawerTitle>
            <DrawerDescription>
              Детали выбранного фрагмента и варианты замены.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <IssueInspector
              copiedReplacement={copiedReplacement}
              finding={selectedFinding}
              onCopyReplacement={copyReplacement}
              onShowInDocument={showInDocument}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <div className="sr-only" aria-live="polite">
        {copiedReplacement ? "Замена скопирована" : ""}
      </div>
    </section>
  );
}
