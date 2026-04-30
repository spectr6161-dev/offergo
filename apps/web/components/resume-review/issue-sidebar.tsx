import {
  AlertTriangleIcon,
  LightbulbIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type {
  ResumeReviewData,
  ResumeReviewFinding,
  ReviewFilter,
  ReviewSeverity,
} from "./types";

const severityLabel: Record<ReviewSeverity, string> = {
  error: "Ошибка",
  warning: "Предупреждение",
  recommend: "Совет",
};

const severityIcon = {
  error: ShieldAlertIcon,
  warning: AlertTriangleIcon,
  recommend: LightbulbIcon,
};

const severityBadgeClass: Record<ReviewSeverity, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning:
    "border-[color:var(--review-warning-border)] bg-[color:var(--review-warning-bg)] text-[color:var(--review-warning)]",
  recommend:
    "border-[color:var(--review-recommend-border)] bg-[color:var(--review-recommend-bg)] text-[color:var(--review-recommend)]",
};

function sectionTitle(data: ResumeReviewData, sectionId: string) {
  return (
    data.document.sections.find((section) => section.id === sectionId)?.title ??
    "Другое"
  );
}

function groupFindings(data: ResumeReviewData, findings: ResumeReviewFinding[]) {
  const groups = new Map<string, ResumeReviewFinding[]>();

  for (const finding of findings) {
    const title = sectionTitle(data, finding.sectionId);
    groups.set(title, [...(groups.get(title) ?? []), finding]);
  }

  return Array.from(groups.entries());
}

export function IssueSidebar({
  data,
  findings,
  selectedFindingId,
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onSelectFinding,
  onCollapse,
}: {
  data: ResumeReviewData;
  findings: ResumeReviewFinding[];
  selectedFindingId: string | null;
  filter: ReviewFilter;
  query: string;
  onFilterChange: (filter: ReviewFilter) => void;
  onQueryChange: (query: string) => void;
  onSelectFinding: (findingId: string) => void;
  onCollapse?: () => void;
}) {
  const groups = groupFindings(data, findings);
  const counts = {
    all: data.findings.length,
    error: data.findings.filter((finding) => finding.severity === "error")
      .length,
    warning: data.findings.filter((finding) => finding.severity === "warning")
      .length,
    recommend: data.findings.filter(
      (finding) => finding.severity === "recommend",
    ).length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 border-r border-white/10 bg-black/95 p-4 text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
            Resume Review
          </p>
          <h2 className="mt-1 text-lg leading-tight font-semibold">
            Проблемы ({findings.length})
          </h2>
        </div>
        {onCollapse ? (
          <Button
            aria-label="Свернуть список замечаний"
            className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={onCollapse}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <span aria-hidden="true">-</span>
          </Button>
        ) : null}
      </div>

      <ToggleGroup
        aria-label="Фильтр замечаний"
        className="grid w-full grid-cols-2 gap-2"
        onValueChange={(value) => {
          if (value) {
            onFilterChange(value as ReviewFilter);
          }
        }}
        size="sm"
        type="single"
        value={filter}
        variant="outline"
      >
        <ToggleGroupItem
          className="border-white/10 bg-white/5 text-slate-300 data-[state=on]:bg-white data-[state=on]:text-black"
          value="all"
        >
          Все
          <span className="ml-1 text-xs opacity-60">{counts.all}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          className="border-white/10 bg-white/5 text-slate-300 data-[state=on]:bg-white data-[state=on]:text-black"
          value="error"
        >
          Ошибки
          <span className="ml-1 text-xs opacity-60">{counts.error}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          className="border-white/10 bg-white/5 text-slate-300 data-[state=on]:bg-white data-[state=on]:text-black"
          value="warning"
        >
          Warning
          <span className="ml-1 text-xs opacity-60">{counts.warning}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          className="border-white/10 bg-white/5 text-slate-300 data-[state=on]:bg-white data-[state=on]:text-black"
          value="recommend"
        >
          Советы
          <span className="ml-1 text-xs opacity-60">{counts.recommend}</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <label className="relative block">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
          data-icon="inline-start"
        />
        <Input
          aria-label="Поиск по замечаниям"
          className="h-10 border-white/10 bg-white/5 pr-3 pl-9 text-slate-100 placeholder:text-slate-500"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по замечаниям"
          type="search"
          value={query}
        />
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.length ? (
          <div className="flex flex-col gap-5">
            {groups.map(([section, sectionFindings]) => (
              <section className="flex flex-col gap-2" key={section}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
                    {section}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {sectionFindings.length}
                  </span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex flex-col gap-1">
                  {sectionFindings.map((finding) => {
                    const Icon = severityIcon[finding.severity];
                    const isSelected = selectedFindingId === finding.id;

                    return (
                      <button
                        className={cn(
                          "grid w-full grid-cols-[1.35rem_minmax(0,1fr)] gap-3 rounded-xl border border-transparent px-2 py-3 text-left transition",
                          "hover:border-white/10 hover:bg-white/5",
                          isSelected && "border-white/15 bg-white/[0.08]",
                        )}
                        key={finding.id}
                        onClick={() => onSelectFinding(finding.id)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-5 items-center justify-center rounded-full border",
                            severityBadgeClass[finding.severity],
                          )}
                        >
                          <Icon data-icon="inline-start" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-start justify-between gap-2">
                            <strong className="text-sm leading-snug text-slate-100">
                              {finding.title}
                            </strong>
                            <Badge
                              className={cn(
                                "shrink-0",
                                severityBadgeClass[finding.severity],
                              )}
                              variant="outline"
                            >
                              {severityLabel[finding.severity]}
                            </Badge>
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-400">
                            {finding.originalText || finding.problem}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm leading-relaxed text-slate-400">
            По выбранным условиям замечаний не найдено.
          </div>
        )}
      </div>
    </div>
  );
}
