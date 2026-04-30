"use client"

import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import type { ResumeStudioIssue, ResumeStudioSeverity } from "./types"

const severityTone: Record<ResumeStudioSeverity, string> = {
  error: "border-black bg-black text-white",
  recommend: "border-black bg-white text-black",
  warning: "border-black bg-white text-black",
}

const severityLabel: Record<ResumeStudioSeverity, string> = {
  error: "Ошибка",
  recommend: "Совет",
  warning: "Предупреждение",
}

type ReviewInspectorProps = {
  className?: string
  issue: ResumeStudioIssue
  onApplyReplacement: (replacementId: string) => void
  onShowInDocument: () => void
}

export function ReviewInspector({
  className,
  issue,
  onApplyReplacement,
  onShowInDocument,
}: ReviewInspectorProps) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-l border-black bg-white text-black",
        className
      )}
    >
      <div className="shrink-0 border-b border-black p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.24em] text-black uppercase">
              Inspector
            </p>
            <h2 className="mt-2 text-xl leading-tight font-semibold">
              {issue.title}
            </h2>
          </div>
          <Badge className={cn("shrink-0 rounded-none border", severityTone[issue.severity])}>
            {severityLabel[issue.severity]}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-black">
          <span>{issue.sectionTitle}</span>
          <span>•</span>
          <span>
            confidence{" "}
            {issue.confidence ? Math.round(issue.confidence * 100) : "—"}%
          </span>
          <span>•</span>
          <span>impact {issue.scoreImpact ?? 0}</span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-5">
          <Card className="rounded-none border-black bg-white text-black shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Фрагмент из резюме</CardTitle>
              <CardDescription className="text-black/60">
                То, что подсвечено в документе.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <blockquote className="rounded-none border border-black bg-white p-4 text-sm leading-6 text-black">
                “{issue.quote}”
              </blockquote>
            </CardContent>
          </Card>

          <Card className="rounded-none border-black bg-white text-black shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Почему отмечено</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-6 text-black">
              <p>{issue.description}</p>
              <Separator className="bg-black" />
              <p>{issue.whyItMatters}</p>
            </CardContent>
          </Card>

          <Card className="rounded-none border-black bg-white text-black shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Варианты замены</CardTitle>
              <CardDescription className="text-black/60">
                Клик применяет текст в рабочей области.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {issue.replacementOptions.map((option) => (
                <div
                  className="rounded-none border border-black bg-white p-3"
                  key={option.id}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-black">
                      {option.isSafe ? (
                        <ShieldCheckIcon className="size-4 text-black" />
                      ) : null}
                      {option.label}
                    </div>
                    {issue.status === "applied" ? (
                      <Badge className="rounded-none border-black bg-black text-white">
                        <CheckIcon className="size-3" />
                        Applied
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-sm leading-6 text-black">
                    {option.text}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      className="h-8 rounded-none border border-black bg-black text-white hover:bg-white hover:text-black"
                      size="sm"
                      onClick={() => onApplyReplacement(option.id)}
                    >
                      Применить
                      <ArrowRightIcon className="size-3.5" />
                    </Button>
                    <Button
                      className="h-8 rounded-none border-black bg-white text-black hover:bg-black hover:text-white"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(option.text)
                        toast.success("Замена скопирована")
                      }}
                    >
                      <CopyIcon className="size-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {issue.articleLinks.length > 0 ? (
            <Card className="rounded-none border-black bg-white text-black shadow-none">
              <CardHeader>
                <CardTitle className="text-sm">Материалы</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {issue.articleLinks.map((link) => (
                  <Button
                    asChild
                    className="h-auto justify-between rounded-lg py-2 text-left"
                    key={link.href}
                    variant="ghost"
                  >
                    <a
                      href={link.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="line-clamp-2">{link.title}</span>
                      <ExternalLinkIcon className="size-3.5 shrink-0" />
                    </a>
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-black p-4">
        <Button
          className="w-full justify-center rounded-none border-black bg-white text-black hover:bg-black hover:text-white"
          variant="outline"
          onClick={onShowInDocument}
        >
          <LocateFixedIcon className="size-4" />
          Показать в документе
        </Button>
      </div>
    </aside>
  )
}
