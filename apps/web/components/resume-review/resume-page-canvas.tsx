import type { KeyboardEvent, ReactNode } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

import type {
  ResumeReviewBlock,
  ResumeReviewData,
  ResumeReviewFinding,
  ReviewSeverity,
} from "./types";

type HighlightSegment = {
  key: string;
  text: string;
  finding: ResumeReviewFinding | null;
};

const highlightClass: Record<ReviewSeverity, string> = {
  error:
    "border-b-2 border-destructive bg-destructive/15 text-inherit ring-destructive/0",
  warning:
    "border-b-2 border-[color:var(--review-warning)] bg-[color:var(--review-warning-paper)] text-inherit",
  recommend:
    "border-b-2 border-[color:var(--review-recommend)] bg-[color:var(--review-recommend-paper)] text-inherit",
};

function buildBlockSegments(
  block: ResumeReviewBlock,
  findings: ResumeReviewFinding[],
): HighlightSegment[] {
  const anchors = findings
    .flatMap((finding) =>
      finding.anchors
        .filter((anchor) => anchor.blockId === block.id)
        .map((anchor) => ({
          finding,
          start: Math.max(0, anchor.charStart - block.charStart),
          end: Math.min(block.text.length, anchor.charEnd - block.charStart),
        })),
    )
    .filter((anchor) => anchor.end > anchor.start)
    .sort((left, right) => left.start - right.start || right.end - left.end);

  if (!anchors.length) {
    return [{ key: `${block.id}-plain`, text: block.text, finding: null }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const anchor of anchors) {
    if (anchor.end <= cursor) {
      continue;
    }

    if (anchor.start > cursor) {
      segments.push({
        key: `${block.id}-plain-${cursor}-${anchor.start}`,
        text: block.text.slice(cursor, anchor.start),
        finding: null,
      });
    }

    const start = Math.max(cursor, anchor.start);
    segments.push({
      key: `${block.id}-${anchor.finding.id}-${start}-${anchor.end}`,
      text: block.text.slice(start, anchor.end),
      finding: anchor.finding,
    });
    cursor = anchor.end;
  }

  if (cursor < block.text.length) {
    segments.push({
      key: `${block.id}-plain-${cursor}-${block.text.length}`,
      text: block.text.slice(cursor),
      finding: null,
    });
  }

  return segments;
}

function renderSegments({
  block,
  findings,
  selectedFindingId,
  onSelectFinding,
}: {
  block: ResumeReviewBlock;
  findings: ResumeReviewFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}) {
  return buildBlockSegments(block, findings).map((segment) => {
    if (!segment.finding) {
      return <span key={segment.key}>{segment.text}</span>;
    }

    const selected = selectedFindingId === segment.finding.id;

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelectFinding(segment.finding!.id);
      }
    };

    return (
      <HoverCard closeDelay={90} key={segment.key} openDelay={120}>
        <HoverCardTrigger asChild>
          <mark
            className={cn(
              "cursor-pointer rounded-[3px] px-0.5 py-px transition outline-none focus-visible:ring-2",
              highlightClass[segment.finding.severity],
              selected &&
                "ring-2 ring-black ring-offset-2 ring-offset-white shadow-[0_0_0_4px_rgba(15,23,42,0.08)]",
            )}
            data-finding-id={segment.finding.id}
            onClick={() => onSelectFinding(segment.finding!.id)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
          >
            {segment.text}
          </mark>
        </HoverCardTrigger>
        <HoverCardContent
          className="w-80 border-slate-800 bg-black text-slate-100"
          side="top"
        >
          <div className="flex flex-col gap-2">
            <strong className="text-sm">{segment.finding.title}</strong>
            <p className="text-xs leading-relaxed text-slate-400">
              {segment.finding.problem}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  });
}

function renderBlock({
  block,
  findings,
  selectedFindingId,
  onSelectFinding,
}: {
  block: ResumeReviewBlock;
  findings: ResumeReviewFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}): ReactNode {
  const content = renderSegments({
    block,
    findings,
    selectedFindingId,
    onSelectFinding,
  });

  if (block.kind === "heading") {
    return (
      <h3 className="mt-3 text-[15px] leading-snug font-bold" key={block.id}>
        {content}
      </h3>
    );
  }

  if (block.kind === "bullet") {
    return (
      <li className="pl-1 leading-[1.58]" key={block.id}>
        {content}
      </li>
    );
  }

  if (block.kind === "compact") {
    return (
      <p className="leading-[1.58]" key={block.id}>
        {content}
      </p>
    );
  }

  return (
    <p className="leading-[1.65]" key={block.id}>
      {content}
    </p>
  );
}

export function ResumePageCanvas({
  data,
  selectedFindingId,
  zoom,
  onSelectFinding,
}: {
  data: ResumeReviewData;
  selectedFindingId: string | null;
  zoom: number;
  onSelectFinding: (findingId: string) => void;
}) {
  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_32%),#05070b] px-4 py-6">
      <article
        className="mx-auto min-h-[1123px] w-[794px] origin-top bg-white px-[64px] py-[56px] text-[#111827] shadow-[0_28px_90px_rgba(0,0,0,0.42)] transition-transform"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          transform: `scale(${zoom})`,
          marginBottom: `${Math.max(40, 1123 * (zoom - 1) + 40)}px`,
        }}
      >
        <header className="mb-8">
          <h1 className="text-[34px] leading-none font-bold tracking-[-0.04em]">
            {data.document.title}
          </h1>
          {data.document.role ? (
            <p className="mt-2 text-[19px] leading-tight font-bold text-blue-700">
              {data.document.role}
            </p>
          ) : null}
          {data.document.contacts?.length ? (
            <p className="mt-4 text-[15px] leading-relaxed">
              {data.document.contacts.join(" • ")}
            </p>
          ) : null}
        </header>

        <div className="flex flex-col gap-7">
          {data.document.sections.map((section) => {
            const bulletBlocks = section.blocks.filter(
              (block) => block.kind === "bullet",
            );

            return (
              <section className="break-inside-avoid" key={section.id}>
                <h2 className="border-b border-slate-900 pb-1 text-[18px] leading-tight font-bold tracking-[0.03em] uppercase">
                  {section.title}
                </h2>
                <div className="mt-3 text-[15px] leading-relaxed">
                  {section.blocks.map((block, index) => {
                    if (block.kind !== "bullet") {
                      return renderBlock({
                        block,
                        findings: data.findings,
                        selectedFindingId,
                        onSelectFinding,
                      });
                    }

                    const previous = section.blocks[index - 1];
                    if (previous?.kind === "bullet") {
                      return null;
                    }

                    return (
                      <ul className="mt-2 list-disc pl-5" key={`${section.id}-bullets-${index}`}>
                        {bulletBlocks
                          .filter((candidate) => {
                            const candidateIndex =
                              section.blocks.indexOf(candidate);
                            if (candidateIndex < index) {
                              return false;
                            }
                            const between = section.blocks.slice(
                              index,
                              candidateIndex + 1,
                            );
                            return between.every(
                              (item) => item.kind === "bullet",
                            );
                          })
                          .map((candidate) =>
                            renderBlock({
                              block: candidate,
                              findings: data.findings,
                              selectedFindingId,
                              onSelectFinding,
                            }),
                          )}
                      </ul>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}
