"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  LinkIcon,
  LogOutIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { CoverLetterCodeBlock } from "@/components/cover-materials/cover-letter-code-block";
import type { BillingSubscriptionSummary } from "@/components/pricing-section";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { cn } from "@/lib/utils";

type AutoResponseSettings = {
  defaultResumeId: string | null;
  updatedAt: string;
};

type IndividualResponseArtifact = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  vacancyText: string;
  source?: string | null;
  vacancyUrl?: string | null;
  vacancyTitle?: string | null;
  employerName?: string | null;
  decision: "matched" | "mismatch";
  coverLetter: string | null;
  summary: string;
  createdAt: string;
};

type ExtensionStartResponse = {
  displayCode: string;
  expiresAt: string;
};

const extensionDownloadHref = "/extensions/offergo-auto-responses.zip";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function getResumeText(resume: ResumeLibraryResume) {
  return resume.currentVersion?.plainText?.trim() ?? "";
}

function hasResumeText(resume: ResumeLibraryResume) {
  return Boolean(
    resume.currentVersion?.plainText?.trim() ||
      resume.currentVersion?.summary?.trim(),
  );
}

function getIndividualResponseLimit(subscription: BillingSubscriptionSummary) {
  return subscription.limits.find(
    (item) => item.feature === "individual_response",
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      "Не удалось выполнить запрос.";
    throw new Error(message);
  }

  return body as T;
}

function TextResumePreview({ resume }: { resume: ResumeLibraryResume }) {
  const text = getResumeText(resume);
  const lines = text
    ? text
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .slice(0, 34)
    : ["Текст не извлечён."];

  return (
    <div className="aspect-[210/297] w-full overflow-hidden rounded-sm border bg-background shadow-sm">
      <div className="flex h-full flex-col gap-0.5 p-3 font-serif text-[5px] leading-tight text-foreground">
        <div className="mb-1 text-[8px] leading-none font-bold">
          {resume.title}
        </div>
        {lines.map((line, index) => (
          <div
            className={cn(
              "min-h-[5px] truncate",
              index % 7 === 0 && "font-semibold",
            )}
            key={`${line}-${index}`}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeChoiceTile({
  resume,
  selected,
  pending,
  onSelect,
}: {
  resume: ResumeLibraryResume;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const disabled = !hasResumeText(resume) || pending;

  return (
    <button
      type="button"
      className={cn(
        "group relative flex min-h-[210px] flex-col rounded-xl p-2 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-sky-500/10 ring-2 ring-sky-500",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
    >
      <div className="flex h-36 w-full items-center justify-center rounded-lg">
        <div className="w-24">
          <TextResumePreview resume={resume} />
        </div>
      </div>
      <div className="mt-2 flex min-h-8 items-start gap-2">
        <FileTextIcon className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="line-clamp-2 text-xs leading-tight font-medium sm:text-sm">
            {resume.title}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {formatDate(resume.updatedAt)}
          </div>
        </div>
      </div>
    </button>
  );
}

function AddResumeTile() {
  return (
    <Link
      aria-label="Создать резюме"
      className="group relative flex min-h-[210px] flex-col rounded-xl p-2 pt-[18px] text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      href="/resumes/create"
    >
      <span className="flex aspect-[210/297] w-24 items-center justify-center rounded-sm border border-dashed bg-background shadow-sm transition-colors group-hover:border-sky-500">
        <PlusIcon className="size-10 text-muted-foreground transition-colors group-hover:text-sky-500" />
      </span>
    </Link>
  );
}

function ResumeGrid({
  isPending,
  resumes,
  selectedResumeId,
  onSelect,
}: {
  isPending: boolean;
  resumes: ResumeLibraryResume[];
  selectedResumeId: string;
  onSelect: (resume: ResumeLibraryResume) => void;
}) {
  return (
    <div className="grid grid-cols-2 justify-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,156px))]">
      {resumes.map((resume) => (
        <ResumeChoiceTile
          key={resume.id}
          resume={resume}
          selected={selectedResumeId === resume.id}
          pending={isPending}
          onSelect={() => onSelect(resume)}
        />
      ))}
      <AddResumeTile />
    </div>
  );
}

function ExtensionCode({
  code,
  expiresAt,
  isPending,
  isVisible,
  onCopy,
  onDisconnect,
  onShow,
}: {
  code: string | null;
  expiresAt: string | null;
  isPending: boolean;
  isVisible: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  onShow: () => void;
}) {
  const displayCode = code && isVisible ? code : "******";
  const displayExpiresAt = code && expiresAt ? formatDate(expiresAt) : "** мая, **:**";

  return (
    <Item variant="default" className="px-0">
      <ItemMedia variant="icon">
        <LinkIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-sm text-muted-foreground">
          Код подключения
        </ItemTitle>
        <div className="font-mono text-4xl font-black tracking-[0.2em] sm:text-5xl">
          {displayCode}
        </div>
        <ItemDescription>Действует до {displayExpiresAt}</ItemDescription>
      </ItemContent>
      <ItemActions className="w-full justify-start sm:w-auto sm:justify-end">
        <Button
          aria-label="Показать код"
          disabled={isPending}
          onClick={onShow}
          size="icon"
          type="button"
          variant="outline"
        >
          <EyeIcon />
        </Button>
        <Button
          aria-label="Скопировать код"
          disabled={!code}
          onClick={onCopy}
          size="icon"
          type="button"
          variant="outline"
        >
          <ClipboardCopyIcon />
        </Button>
        {code ? (
          <Button
            aria-label="Отключить расширение"
            disabled={isPending}
            onClick={onDisconnect}
            size="icon"
            type="button"
            variant="outline"
          >
            <LogOutIcon />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}

function UsageLimitItem({ subscription }: { subscription: BillingSubscriptionSummary }) {
  const limit = getIndividualResponseLimit(subscription);
  const used = limit ? limit.used + limit.reserved : 0;
  const limitValue = limit?.enforcementLimit ?? limit?.limit ?? null;
  const progress =
    limitValue && limitValue > 0 ? Math.min(100, (used / limitValue) * 100) : 0;
  const exhausted = Boolean(limitValue && used >= limitValue);

  return (
    <Item variant="default" className="px-0">
      <ItemMedia variant="icon">
        <Settings2Icon />
      </ItemMedia>
      <ItemContent>
        <ItemHeader>
          <ItemTitle>Индивидуальные отклики</ItemTitle>
          <Badge variant={exhausted ? "destructive" : "secondary"}>
            {limit?.unlimited
              ? `${used.toLocaleString("ru-RU")} / безлимит`
              : `${used.toLocaleString("ru-RU")} / ${
                  limitValue?.toLocaleString("ru-RU") ?? "0"
                }`}
          </Badge>
        </ItemHeader>
        <ItemFooter className="mt-2">
          <Progress value={progress} />
        </ItemFooter>
      </ItemContent>
    </Item>
  );
}

const historyPageSize = 10;

function getVacancyTitle(item: IndividualResponseArtifact) {
  return item.vacancyTitle?.trim() || "Вакансия";
}

function getEmployerName(item: IndividualResponseArtifact) {
  return item.employerName?.trim() || "Работодатель не указан";
}

function getHistoryStatusLabel(item: IndividualResponseArtifact) {
  return item.decision === "matched" ? "Подходит" : "Не подходит";
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 break-words">{value}</div>
    </div>
  );
}

function HistoryList({ history }: { history: IndividualResponseArtifact[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );

  if (history.length === 0) {
    return (
      <Alert>
        <AlertTitle>История пока пустая</AlertTitle>
        <AlertDescription>
          После генерации результаты появятся здесь.
        </AlertDescription>
      </Alert>
    );
  }

  const totalPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * historyPageSize;
  const pageItems = history.slice(pageStart, pageStart + historyPageSize);
  const showPagination = history.length > historyPageSize;

  function changePage(page: number) {
    setCurrentPage(page);
    setExpandedHistoryId(null);
  }

  async function copyCoverLetter(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Отклик скопирован.");
  }

  return (
    <div className="flex flex-col gap-4">
      <ItemGroup>
        {pageItems.map((item, index) => {
          const isOpen = expandedHistoryId === item.id;
          const vacancyTitle = getVacancyTitle(item);
          const employerName = getEmployerName(item);
          const toggleItem = () =>
            setExpandedHistoryId(isOpen ? null : item.id);

          return (
            <div key={item.id}>
              <Collapsible open={isOpen}>
                <Item
                  className="cursor-pointer px-3 py-3 text-left hover:bg-muted/50"
                  onClick={toggleItem}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleItem();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  variant="default"
                >
                  <ItemMedia variant="icon">
                    <FileTextIcon />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="max-w-full">
                      <span className="truncate">
                        {employerName} / {vacancyTitle}
                      </span>
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1">
                      {formatDate(item.createdAt)} · {item.resumeTitle}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="ml-auto">
                    <Badge
                      variant={
                        item.decision === "matched"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {getHistoryStatusLabel(item)}
                    </Badge>
                    <ChevronDownIcon
                      className={cn(
                        "transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </ItemActions>
                </Item>

                <CollapsibleContent>
                  <div className="flex flex-col gap-4 pt-3 pb-5 pl-3 sm:pl-12">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <HistoryMeta label="Вакансия" value={vacancyTitle} />
                      <HistoryMeta label="Работодатель" value={employerName} />
                      <HistoryMeta label="Резюме" value={item.resumeTitle} />
                      <HistoryMeta
                        label="Дата"
                        value={formatDate(item.createdAt)}
                      />
                    </div>

                    {item.coverLetter ? (
                      <CoverLetterCodeBlock
                        onCopy={() => void copyCoverLetter(item.coverLetter!)}
                        text={item.coverLetter}
                      />
                    ) : (
                      <Alert variant="destructive">
                        <AlertTriangleIcon />
                        <AlertTitle>Отклик не сформирован</AlertTitle>
                        <AlertDescription>{item.summary}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {index < pageItems.length - 1 ? <ItemSeparator /> : null}
            </div>
          );
        })}
      </ItemGroup>

      {showPagination ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Страница {safeCurrentPage} из {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={safeCurrentPage <= 1}
              onClick={() => changePage(safeCurrentPage - 1)}
              type="button"
              variant="outline"
            >
              Назад
            </Button>
            <Button
              disabled={safeCurrentPage >= totalPages}
              onClick={() => changePage(safeCurrentPage + 1)}
              type="button"
              variant="outline"
            >
              Вперёд
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AutoResponsesClient({
  history,
  resumes,
  settings,
  subscription,
}: {
  history: IndividualResponseArtifact[];
  resumes: ResumeLibraryResume[];
  settings: AutoResponseSettings;
  subscription: BillingSubscriptionSummary;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [defaultResumeId, setDefaultResumeId] = useState(
    settings.defaultResumeId ?? "",
  );
  const [isPending, startTransition] = useTransition();
  const availableResumes = resumes.filter(hasResumeText);
  const hasAnyResumes = resumes.length > 0;

  function createCode() {
    startTransition(async () => {
      try {
        const result = await requestJson<ExtensionStartResponse>(
          "/api/auth/extension/browser/start",
          {
            method: "POST",
          },
        );
        setCode(result.displayCode);
        setExpiresAt(result.expiresAt);
        setIsCodeVisible(true);
        toast.success("Код подключения создан.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Ошибка подключения.",
        );
      }
    });
  }

  function disconnectExtension() {
    startTransition(async () => {
      try {
        await requestJson<{ ok: true }>("/api/auth/extension/logout", {
          method: "POST",
        });
        setCode(null);
        setExpiresAt(null);
        setIsCodeVisible(false);
        toast.success("Расширение отключено.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось отключить.",
        );
      }
    });
  }

  function updateDefaultResume(resume: ResumeLibraryResume) {
    setDefaultResumeId(resume.id);
    startTransition(async () => {
      try {
        await requestJson<AutoResponseSettings>(
          "/api/cover-materials/auto-responses/settings",
          {
            method: "PUT",
            body: JSON.stringify({ defaultResumeId: resume.id }),
          },
        );
        toast.success("Резюме для автооткликов сохранено.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось сохранить.",
        );
      }
    });
  }

  function showCode() {
    if (code) {
      setIsCodeVisible(true);
      return;
    }

    createCode();
  }

  async function copyCode() {
    if (!code) {
      toast.error("Сначала покажите код подключения.");
      return;
    }

    await navigator.clipboard.writeText(code);
    toast.success("Код скопирован.");
  }

  function downloadExtension() {
    const link = document.createElement("a");
    link.href = extensionDownloadHref;
    link.download = "offergo-auto-responses.zip";
    document.body.append(link);
    link.click();
    link.remove();
  }

  return (
    <main className="flex w-full flex-col gap-10 px-4 py-6 md:px-6 lg:px-8">
      <section className="flex flex-col gap-4">
        <ItemGroup>
          <Item variant="default" className="px-0">
            <ItemMedia variant="icon">
              <DownloadIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Актуальная версия расширения</ItemTitle>
              <ItemDescription>
                Скачайте архив, распакуйте его и подключите в браузере через
                режим разработчика.
              </ItemDescription>
            </ItemContent>
            <ItemActions className="w-full sm:w-auto">
              <Button
                className="w-full sm:w-fit"
                onClick={downloadExtension}
                type="button"
              >
                <DownloadIcon data-icon="inline-start" />
                Скачать расширение
              </Button>
            </ItemActions>
          </Item>

          <ItemSeparator />

          <ExtensionCode
            code={code}
            expiresAt={expiresAt}
            isPending={isPending}
            isVisible={isCodeVisible}
            onCopy={() => void copyCode()}
            onDisconnect={disconnectExtension}
            onShow={showCode}
          />
        </ItemGroup>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Резюме</h2>
          <p className="text-sm text-muted-foreground">
            Это резюме будет использоваться расширением по умолчанию.
          </p>
        </div>

        {availableResumes.length > 0 ? (
          <ResumeGrid
            isPending={isPending}
            resumes={availableResumes}
            selectedResumeId={defaultResumeId}
            onSelect={updateDefaultResume}
          />
        ) : (
          <Alert variant={hasAnyResumes ? "destructive" : "default"}>
            <AlertTitle>
              {hasAnyResumes
                ? "Нет резюме с текстовой версией"
                : "Нет активных резюме"}
            </AlertTitle>
            <AlertDescription>
              Создайте резюме или сохраните текстовую версию существующего,
              чтобы использовать автоотклики.
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Как установить</h2>
        <ItemGroup>
          {[
            "Скачайте ZIP-архив расширения.",
            "Распакуйте архив в отдельную папку.",
            "Откройте chrome://extensions или edge://extensions.",
            "Включите режим разработчика и выберите распакованную папку.",
            "Откройте popup расширения и введите код подключения.",
          ].map((step, index, items) => (
            <div key={step}>
              <Item variant="default" className="px-0">
                <ItemMedia>
                  <Badge variant="secondary">{index + 1}</Badge>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{step}</ItemTitle>
                </ItemContent>
              </Item>
              {index < items.length - 1 ? <ItemSeparator /> : null}
            </div>
          ))}
        </ItemGroup>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Лимит</h2>
        <ItemGroup>
          <UsageLimitItem subscription={subscription} />
        </ItemGroup>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">История</h2>
        <HistoryList history={history} />
      </section>
    </main>
  );
}
