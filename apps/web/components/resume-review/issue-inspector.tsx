import {
  CopyIcon,
  ExternalLinkIcon,
  LockIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { ResumeReviewFinding, ReviewSeverity } from "./types";

const severityLabel: Record<ReviewSeverity, string> = {
  error: "Ошибка",
  warning: "Предупреждение",
  recommend: "Совет",
};

const severityClass: Record<ReviewSeverity, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning:
    "border-[color:var(--review-warning-border)] bg-[color:var(--review-warning-bg)] text-[color:var(--review-warning)]",
  recommend:
    "border-[color:var(--review-recommend-border)] bg-[color:var(--review-recommend-bg)] text-[color:var(--review-recommend)]",
};

function formatConfidence(value?: number) {
  if (typeof value !== "number") {
    return "не указана";
  }

  return `${Math.round(value * 100)}%`;
}

export function IssueInspector({
  finding,
  copiedReplacement,
  onCopyReplacement,
  onShowInDocument,
  onCollapse,
}: {
  finding: ResumeReviewFinding | null;
  copiedReplacement: string | null;
  onCopyReplacement: (replacement: string) => void;
  onShowInDocument: (findingId: string) => void;
  onCollapse?: () => void;
}) {
  if (!finding) {
    return (
      <aside className="flex h-full min-h-0 flex-col border-l border-white/10 bg-black/95 p-4 text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
              Inspector
            </p>
            <h2 className="mt-1 text-lg leading-tight font-semibold">
              Разбор фрагмента
            </h2>
          </div>
          {onCollapse ? (
            <Button
              aria-label="Свернуть инспектор"
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
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-4 text-sm leading-relaxed text-slate-400">
          Выберите замечание слева или подсветку в документе.
        </div>
      </aside>
    );
  }

  const hasAnchor = finding.anchors.length > 0;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-white/10 bg-black/95 p-4 text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
            Inspector
          </p>
          <h2 className="mt-1 text-lg leading-tight font-semibold">
            Разбор фрагмента
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn("shrink-0", severityClass[finding.severity])}
            variant="outline"
          >
            {severityLabel[finding.severity]}
          </Badge>
          {onCollapse ? (
            <Button
              aria-label="Свернуть инспектор"
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
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <Tabs className="flex flex-col gap-4" defaultValue="analysis">
          <TabsList className="grid w-full grid-cols-2 bg-white/5">
            <TabsTrigger value="analysis">Разбор</TabsTrigger>
            <TabsTrigger value="replacements">Замены</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-0 flex flex-col gap-4" value="analysis">
            <div>
              <h3 className="text-xl leading-tight font-semibold">
                {finding.title}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="border-white/10 bg-white/5" variant="outline">
                  Confidence: {formatConfidence(finding.confidence)}
                </Badge>
                <Badge className="border-white/10 bg-white/5" variant="outline">
                  Impact: {finding.scoreImpact ?? 0}
                </Badge>
                <Badge className="border-white/10 bg-white/5" variant="outline">
                  Anchor: {hasAnchor ? "exact" : "section-level"}
                </Badge>
              </div>
            </div>

            <Card className="border-white/10 bg-white/5 text-slate-100">
              <CardHeader>
                <CardTitle className="text-sm">Фрагмент из резюме</CardTitle>
                <CardDescription className="text-slate-400">
                  То место, которое подсвечено на A4-странице.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <code className="block rounded-lg border border-white/10 bg-black/50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-100">
                  {finding.originalText || "Точного фрагмента нет: замечание относится к секции целиком."}
                </code>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 text-slate-100">
              <CardHeader>
                <CardTitle className="text-sm">Почему это отмечено</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-slate-300">
                <p>{finding.problem}</p>
                <Separator className="bg-white/10" />
                <div>
                  <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
                    Почему важно
                  </span>
                  <p className="mt-2">{finding.whyItMatters}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                className="flex-1 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                disabled={!hasAnchor}
                onClick={() => onShowInDocument(finding.id)}
                type="button"
                variant="outline"
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Показать в документе
              </Button>
              <Button className="flex-1" disabled type="button" variant="secondary">
                <LockIcon data-icon="inline-start" />
                Apply позже
              </Button>
            </div>
          </TabsContent>

          <TabsContent className="mt-0 flex flex-col gap-3" value="replacements">
            {finding.replacementOptions.length ? (
              finding.replacementOptions.map((replacement, index) => (
                <Card
                  className="border-white/10 bg-white/5 text-slate-100"
                  key={`${finding.id}-${replacement.type}-${index}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm">
                          Вариант {index + 1}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          {replacement.type}
                        </CardDescription>
                      </div>
                      <Badge
                        className={
                          replacement.isSafe
                            ? "border-[color:var(--review-recommend-border)] bg-[color:var(--review-recommend-bg)] text-[color:var(--review-recommend)]"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                        variant="outline"
                      >
                        <ShieldCheckIcon data-icon="inline-start" />
                        {replacement.isSafe ? "safe" : "check"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="rounded-lg border border-white/10 bg-black/50 p-3 text-sm leading-relaxed text-slate-100">
                      {replacement.text}
                    </p>
                    <Button
                      className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      onClick={() => onCopyReplacement(replacement.text)}
                      type="button"
                      variant="outline"
                    >
                      <CopyIcon data-icon="inline-start" />
                      {copiedReplacement === replacement.text
                        ? "Скопировано"
                        : "Copy replacement"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
                Для этого замечания пока нет готовой замены.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
