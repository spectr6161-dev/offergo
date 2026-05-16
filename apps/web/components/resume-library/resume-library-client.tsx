"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownAZIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FilePlus2Icon,
  FileSearchIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  Grid2X2Icon,
  Loader2Icon,
  MoreVerticalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkflowRunSnapshot } from "@/lib/workflow-types";

import type {
  ResumeLibraryAnalysis,
  ResumeFolderFilter,
  ResumeLibraryFolder,
  ResumeLibraryResume,
  ResumeSortMode,
  ResumeViewMode,
} from "./types";

type ResumeLibraryResponse = {
  items: ResumeLibraryResume[];
};

type ResumeAnalysisLibraryResponse = {
  items: ResumeLibraryAnalysis[];
};

type ResumeFoldersResponse = {
  items: ResumeLibraryFolder[];
};

type RenameTarget =
  | { type: "resume"; id: string; name: string }
  | { type: "analysis"; id: string; name: string }
  | { type: "folder"; id: string; name: string }
  | null;

type ResumeActionMenuState = {
  open: boolean;
  x: number;
  y: number;
  resume: ResumeLibraryResume | null;
};

const folderRootId = "none";
const folderAllId = "all";
const folderTrashId = "trash";
const longPressDelayMs = 520;
const resumeUploadAccept =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const supportedResumeMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const PdfResumePreview = dynamic(
  () =>
    import("./pdf-resume-preview").then((module) => module.PdfResumePreview),
  {
    loading: () => (
      <div className="flex aspect-[210/297] w-full items-center justify-center rounded-sm border bg-background p-4 text-center text-xs text-muted-foreground shadow-sm">
        Готовим PDF-превью...
      </div>
    ),
    ssr: false,
  }
);

async function readResponseJson(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(value: unknown, fallback: string) {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    const maybeMessage = (value as { message?: unknown; error?: unknown })
      .message;
    const maybeError = (value as { message?: unknown; error?: unknown }).error;

    if (typeof maybeMessage === "string") return maybeMessage;
    if (typeof maybeError === "string") return maybeError;
  }

  return fallback;
}

async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const body = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Запрос не выполнен."));
  }

  return body as T;
}

function formatDate(value: string | null) {
  if (!value) return "Не открывалось";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function getResumeText(resume: ResumeLibraryResume) {
  return resume.currentVersion?.plainText?.trim() ?? "";
}

function getResumeExcerpt(resume: ResumeLibraryResume) {
  const text = getResumeText(resume);

  if (!text) {
    return resume.processingError ?? "Текстовая версия пока недоступна.";
  }

  return text.replace(/\s+/g, " ").slice(0, 180);
}

const sortOptions: Array<{
  value: ResumeSortMode;
  label: string;
  shortLabel: string;
}> = [
  {
    value: "updated-desc",
    label: "Сначала обновлённые",
    shortLabel: "Обновлённые",
  },
  {
    value: "created-desc",
    label: "Сначала новые",
    shortLabel: "Новые",
  },
  {
    value: "title-asc",
    label: "Название А-Я",
    shortLabel: "А-Я",
  },
  {
    value: "title-desc",
    label: "Название Я-А",
    shortLabel: "Я-А",
  },
];

function getSortLabel(sort: ResumeSortMode) {
  return sortOptions.find((option) => option.value === sort)?.shortLabel ?? "Сортировка";
}

function isSupportedResumeFile(file: File) {
  const name = file.name.toLowerCase();

  return (
    supportedResumeMimeTypes.has(file.type) ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt")
  );
}

function hasDraggedFiles(event: ReactDragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function sortResumes(items: ResumeLibraryResume[], sort: ResumeSortMode) {
  return [...items].sort((left, right) => {
    if (sort === "title-asc") {
      return left.title.localeCompare(right.title, "ru");
    }

    if (sort === "title-desc") {
      return right.title.localeCompare(left.title, "ru");
    }

    if (sort === "created-desc") {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

function sortAnalyses(items: ResumeLibraryAnalysis[], sort: ResumeSortMode) {
  return [...items].sort((left, right) => {
    if (sort === "title-asc") {
      return left.title.localeCompare(right.title, "ru");
    }

    if (sort === "title-desc") {
      return right.title.localeCompare(left.title, "ru");
    }

    if (sort === "created-desc") {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

function sortFolders(items: ResumeLibraryFolder[]) {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name, "ru");
  });
}

const libraryGridTileClass =
  "group relative flex min-h-[184px] flex-col rounded-xl p-2 transition-colors hover:bg-accent/60 focus-within:bg-accent/60 sm:min-h-[210px]";
const libraryGridPreviewClass =
  "flex h-28 w-full items-center justify-center rounded-lg sm:h-36";
const libraryGridMenuClass =
  "absolute right-1 top-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

function getResumeServedFile(resume: ResumeLibraryResume) {
  return resume.exportFile ?? resume.originalFile;
}

function isPdfResume(resume: ResumeLibraryResume) {
  return getResumeServedFile(resume)?.mimeType === "application/pdf";
}

function hasResumeServedFile(resume: ResumeLibraryResume) {
  return Boolean(getResumeServedFile(resume));
}

function isBuilderResume(resume: ResumeLibraryResume) {
  return resume.currentVersion?.source === "builder";
}

function ResumePreview({ resume }: { resume: ResumeLibraryResume }) {
  if (isPdfResume(resume) && hasResumeServedFile(resume)) {
    return (
      <PdfResumePreview
        fallback={<TextResumePreview className="border-0 shadow-none" resume={resume} />}
        resumeId={resume.id}
      />
    );
  }

  return <TextResumePreview resume={resume} />;
}

function getSavedAnalysisFindingCount(analysis: ResumeLibraryAnalysis) {
  const finalResult = analysis.finalResult;

  if (!finalResult || typeof finalResult !== "object") {
    return null;
  }

  const findings = (finalResult as { findings?: unknown }).findings;

  return Array.isArray(findings) ? findings.length : null;
}

function getWorkflowProgress(run: WorkflowRunSnapshot | null) {
  if (!run || run.nodes.length === 0) return 0;

  const completed = run.nodes.filter((node) =>
    ["success", "error", "skipped"].includes(node.status)
  ).length;

  return Math.round((completed / run.nodes.length) * 100);
}

function getWorkflowCurrentNode(run: WorkflowRunSnapshot | null) {
  if (!run) return null;

  return (
    run.nodes.find((node) => node.key === run.currentNodeKey) ??
    run.nodes.find((node) => node.status === "running") ??
    null
  );
}

function TextResumePreview({
  resume,
  className,
}: {
  resume: ResumeLibraryResume;
  className?: string;
}) {
  const text = getResumeText(resume);
  const lines = text
    ? text
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .slice(0, 34)
    : [
        resume.processingError ??
          "Текст не извлечён. Оригинальный файл можно скачать из меню.",
      ];

  return (
    <div
      className={cn(
        "aspect-[210/297] w-full overflow-hidden rounded-sm border bg-background shadow-sm",
        className
      )}
    >
      <div className="flex h-full flex-col gap-0.5 p-3 font-serif text-[5px] leading-tight text-foreground">
        <div className="mb-1 text-[8px] font-bold leading-none">
          {resume.title}
        </div>
        {lines.map((line, index) => (
          <div
            className={cn(
              "min-h-[5px] truncate",
              index % 7 === 0 && "font-semibold"
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

function ResumeCard({
  resume,
  folders,
  view,
  onOpen,
  onAnalyze,
  onOpenActionMenu,
  onOpenContextMenu,
  onOpenPdf,
  onEdit,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onRestore,
}: {
  resume: ResumeLibraryResume;
  folders: ResumeLibraryFolder[];
  view: ResumeViewMode;
  onOpen: (resume: ResumeLibraryResume) => void;
  onAnalyze: (resume: ResumeLibraryResume) => void;
  onOpenActionMenu: (
    resume: ResumeLibraryResume,
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onOpenContextMenu: (
    resume: ResumeLibraryResume,
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onOpenPdf: (resume: ResumeLibraryResume) => void;
  onEdit: (resume: ResumeLibraryResume) => void;
  onRename: (resume: ResumeLibraryResume) => void;
  onDuplicate: (resume: ResumeLibraryResume) => void;
  onMove: (resume: ResumeLibraryResume, folderId: string | null) => void;
  onDelete: (resume: ResumeLibraryResume) => void;
  onRestore: (resume: ResumeLibraryResume) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: resume.id,
      disabled: Boolean(resume.deletedAt),
    });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;
  const text = getResumeText(resume);

  if (view === "list") {
    return (
      <Card
        data-library-item
        className={cn("transition-opacity", isDragging && "opacity-60")}
        ref={setNodeRef}
        style={style}
        onContextMenu={(event) => onOpenContextMenu(resume, event)}
        onDoubleClick={(event) => onOpenActionMenu(resume, event)}
      >
        <CardContent className="flex items-center gap-4 p-3">
          <button
            className="hidden w-16 shrink-0 cursor-grab sm:block"
            type="button"
            {...attributes}
            {...listeners}
          >
            <ResumePreview resume={resume} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="truncate text-left font-medium hover:underline"
                type="button"
              >
                {resume.title}
              </button>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {getResumeExcerpt(resume)}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Обновлено: {formatDate(resume.updatedAt)}</span>
              {text ? <span>{text.length} знаков</span> : null}
            </div>
          </div>
          <ResumeCardMenu
            folders={folders}
            resume={resume}
            onAnalyze={onAnalyze}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            onMove={onMove}
            onOpen={onOpen}
            onOpenPdf={onOpenPdf}
            onRename={onRename}
            onRestore={onRestore}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      data-library-item
      className={cn(libraryGridTileClass, isDragging && "opacity-60")}
      ref={setNodeRef}
      style={style}
      onContextMenu={(event) => onOpenContextMenu(resume, event)}
      onDoubleClick={(event) => onOpenActionMenu(resume, event)}
    >
      <button
        className={cn(libraryGridPreviewClass, "cursor-grab")}
        type="button"
        {...attributes}
        {...listeners}
      >
        <div className="w-20 sm:w-24">
          <ResumePreview resume={resume} />
        </div>
      </button>
      <button
        className="mt-2 line-clamp-2 min-h-8 text-left text-xs font-medium leading-tight hover:underline sm:text-sm"
        type="button"
      >
        {resume.title}
      </button>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {formatDate(resume.updatedAt)}
      </p>
      <div className={libraryGridMenuClass}>
        <ResumeCardMenu
          folders={folders}
          resume={resume}
          onAnalyze={onAnalyze}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onMove={onMove}
          onOpen={onOpen}
          onOpenPdf={onOpenPdf}
          onRename={onRename}
          onRestore={onRestore}
        />
      </div>
    </div>
  );
}

function SavedAnalysisPreview({ analysis }: { analysis: ResumeLibraryAnalysis }) {
  const findingsCount = getSavedAnalysisFindingCount(analysis);

  return (
    <div className="flex aspect-[210/297] w-full flex-col justify-between overflow-hidden rounded-sm border bg-primary/10 p-3 text-primary shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <FileSearchIcon className="size-5" />
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
          Анализ
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="line-clamp-3 text-xs font-semibold leading-tight text-foreground">
          {analysis.title}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {findingsCount === null
            ? "Сохранённый отчёт"
            : `${findingsCount} замечаний`}
        </div>
      </div>
    </div>
  );
}

function SavedAnalysisMenu({
  analysis,
  folders,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onRestore,
}: {
  analysis: ResumeLibraryAnalysis;
  folders: ResumeLibraryFolder[];
  onOpen: (analysis: ResumeLibraryAnalysis) => void;
  onRename: (analysis: ResumeLibraryAnalysis) => void;
  onMove: (analysis: ResumeLibraryAnalysis, folderId: string | null) => void;
  onDelete: (analysis: ResumeLibraryAnalysis) => void;
  onRestore: (analysis: ResumeLibraryAnalysis) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Действия" size="icon" variant="ghost">
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Анализ</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onOpen(analysis)}>
            <FileSearchIcon data-icon="inline-start" />
            Открыть
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(analysis)}>
            <PencilIcon data-icon="inline-start" />
            Переименовать
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Переместить</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem onClick={() => onMove(analysis, null)}>
              Без папки
            </DropdownMenuItem>
            {folders.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onClick={() => onMove(analysis, folder.id)}
              >
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {analysis.deletedAt ? (
          <DropdownMenuItem onClick={() => onRestore(analysis)}>
            <Undo2Icon data-icon="inline-start" />
            Восстановить
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(analysis)}>
            <Trash2Icon data-icon="inline-start" />
            Удалить
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavedAnalysisCard({
  analysis,
  folders,
  view,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onRestore,
}: {
  analysis: ResumeLibraryAnalysis;
  folders: ResumeLibraryFolder[];
  view: ResumeViewMode;
  onOpen: (analysis: ResumeLibraryAnalysis) => void;
  onRename: (analysis: ResumeLibraryAnalysis) => void;
  onMove: (analysis: ResumeLibraryAnalysis, folderId: string | null) => void;
  onDelete: (analysis: ResumeLibraryAnalysis) => void;
  onRestore: (analysis: ResumeLibraryAnalysis) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `analysis:${analysis.id}`,
      disabled: Boolean(analysis.deletedAt),
    });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;
  const findingsCount = getSavedAnalysisFindingCount(analysis);

  if (view === "list") {
    return (
      <Card
        data-library-item
        className={cn("transition-opacity", isDragging && "opacity-60")}
        ref={setNodeRef}
        style={style}
        onDoubleClick={() => onOpen(analysis)}
      >
        <CardContent className="flex items-center gap-4 p-3">
          <button
            className="hidden w-16 shrink-0 cursor-grab sm:block"
            type="button"
            {...attributes}
            {...listeners}
          >
            <SavedAnalysisPreview analysis={analysis} />
          </button>
          <button
            className="min-w-0 flex-1 text-left"
            type="button"
            onClick={() => onOpen(analysis)}
          >
            <div className="truncate font-medium">{analysis.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {findingsCount === null
                ? "Сохранённый анализ"
                : `Сохранённый анализ · ${findingsCount} замечаний`}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              Обновлено: {formatDate(analysis.updatedAt)}
            </div>
          </button>
          <SavedAnalysisMenu
            analysis={analysis}
            folders={folders}
            onDelete={onDelete}
            onMove={onMove}
            onOpen={onOpen}
            onRename={onRename}
            onRestore={onRestore}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      data-library-item
      className={cn(libraryGridTileClass, isDragging && "opacity-60")}
      ref={setNodeRef}
      style={style}
      onDoubleClick={() => onOpen(analysis)}
    >
      <button
        className={cn(libraryGridPreviewClass, "cursor-grab")}
        type="button"
        {...attributes}
        {...listeners}
      >
        <div className="w-20 sm:w-24">
          <SavedAnalysisPreview analysis={analysis} />
        </div>
      </button>
      <button
        className="mt-2 line-clamp-2 min-h-8 text-left text-xs font-medium leading-tight hover:underline sm:text-sm"
        type="button"
        onClick={() => onOpen(analysis)}
      >
        {analysis.title}
      </button>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        Анализ · {formatDate(analysis.updatedAt)}
      </p>
      <div className={libraryGridMenuClass}>
        <SavedAnalysisMenu
          analysis={analysis}
          folders={folders}
          onDelete={onDelete}
          onMove={onMove}
          onOpen={onOpen}
          onRename={onRename}
          onRestore={onRestore}
        />
      </div>
    </div>
  );
}

function FolderPreview({ isOver = false }: { isOver?: boolean }) {
  return (
    <div
      className={cn(
        "relative mx-auto h-16 w-24 transition-transform sm:h-20 sm:w-28",
        isOver && "scale-105"
      )}
    >
      <div className="absolute left-1 top-1 h-7 w-14 rounded-t-xl bg-amber-200" />
      <div className="absolute inset-x-0 bottom-1 h-16 rounded-xl bg-amber-200 shadow-sm ring-1 ring-amber-300/60" />
      <div className="absolute inset-x-0 bottom-1 h-12 rounded-b-xl bg-amber-100/70" />
      {isOver ? (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background" />
      ) : null}
    </div>
  );
}

function FolderCardMenu({
  folder,
  onRename,
  onDelete,
}: {
  folder: ResumeLibraryFolder;
  onRename: (folder: ResumeLibraryFolder) => void;
  onDelete: (folder: ResumeLibraryFolder) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Действия с папкой"
          className="shrink-0"
          size="icon"
          variant="ghost"
        >
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onRename(folder)}>
            <PencilIcon data-icon="inline-start" />
            Переименовать
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(folder)}>
            <Trash2Icon data-icon="inline-start" />
            Удалить папку
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderTile({
  folder,
  view,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: ResumeLibraryFolder;
  view: ResumeViewMode;
  onOpen: (folder: ResumeLibraryFolder) => void;
  onRename: (folder: ResumeLibraryFolder) => void;
  onDelete: (folder: ResumeLibraryFolder) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${folder.id}`,
  });

  if (view === "list") {
    return (
      <Card
        data-library-item
        className={cn("transition-colors", isOver && "ring-2 ring-primary")}
        ref={setNodeRef}
      >
        <CardContent className="flex items-center gap-4 p-3">
          <button
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            type="button"
            onClick={() => onOpen(folder)}
          >
            <div className="flex size-16 shrink-0 items-center justify-center">
              <FolderIcon className="text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{folder.name}</div>
              <div className="text-xs text-muted-foreground">
                {folder.resumeCount} резюме
              </div>
            </div>
          </button>
          <FolderCardMenu
            folder={folder}
            onDelete={onDelete}
            onRename={onRename}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      data-library-item
      className={cn(libraryGridTileClass, isOver && "bg-accent/60")}
      ref={setNodeRef}
    >
      <button
        className={libraryGridPreviewClass}
        type="button"
        onClick={() => onOpen(folder)}
      >
        <FolderPreview isOver={isOver} />
      </button>
      <button
        className="mt-2 line-clamp-2 min-h-8 text-left text-xs font-medium leading-tight hover:underline sm:text-sm"
        type="button"
        onClick={() => onOpen(folder)}
      >
        {folder.name}
      </button>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        Папка · {folder.resumeCount} резюме
      </p>
      <div className={libraryGridMenuClass}>
        <FolderCardMenu
          folder={folder}
          onDelete={onDelete}
          onRename={onRename}
        />
      </div>
    </div>
  );
}

function ResumeCardMenu({
  resume,
  folders,
  onOpen,
  onAnalyze,
  onOpenPdf,
  onEdit,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onRestore,
}: {
  resume: ResumeLibraryResume;
  folders: ResumeLibraryFolder[];
  onOpen: (resume: ResumeLibraryResume) => void;
  onAnalyze: (resume: ResumeLibraryResume) => void;
  onOpenPdf: (resume: ResumeLibraryResume) => void;
  onEdit: (resume: ResumeLibraryResume) => void;
  onRename: (resume: ResumeLibraryResume) => void;
  onDuplicate: (resume: ResumeLibraryResume) => void;
  onMove: (resume: ResumeLibraryResume, folderId: string | null) => void;
  onDelete: (resume: ResumeLibraryResume) => void;
  onRestore: (resume: ResumeLibraryResume) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Действия" size="icon" variant="ghost">
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ResumeCardMenuContent
          folders={folders}
          resume={resume}
          onAnalyze={onAnalyze}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onMove={onMove}
          onOpen={onOpen}
          onOpenPdf={onOpenPdf}
          onRename={onRename}
          onRestore={onRestore}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResumeCardMenuContent({
  resume,
  folders,
  onOpen,
  onAnalyze,
  onOpenPdf,
  onEdit,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onRestore,
}: {
  resume: ResumeLibraryResume;
  folders: ResumeLibraryFolder[];
  onOpen: (resume: ResumeLibraryResume) => void;
  onAnalyze: (resume: ResumeLibraryResume) => void;
  onOpenPdf: (resume: ResumeLibraryResume) => void;
  onEdit: (resume: ResumeLibraryResume) => void;
  onRename: (resume: ResumeLibraryResume) => void;
  onDuplicate: (resume: ResumeLibraryResume) => void;
  onMove: (resume: ResumeLibraryResume, folderId: string | null) => void;
  onDelete: (resume: ResumeLibraryResume) => void;
  onRestore: (resume: ResumeLibraryResume) => void;
}) {
  const hasText = Boolean(getResumeText(resume));

  return (
    <>
        <DropdownMenuLabel>Резюме</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onOpen(resume)}>
            <FileTextIcon data-icon="inline-start" />
            Открыть
          </DropdownMenuItem>
          {isPdfResume(resume) && hasResumeServedFile(resume) ? (
            <DropdownMenuItem onClick={() => onOpenPdf(resume)}>
              <FileSearchIcon data-icon="inline-start" />
              Открыть PDF
            </DropdownMenuItem>
          ) : null}
          {isBuilderResume(resume) ? (
            <DropdownMenuItem onClick={() => onEdit(resume)}>
              <PencilIcon data-icon="inline-start" />
              Редактировать анкету
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={!hasText} onClick={() => onAnalyze(resume)}>
            <PlayIcon data-icon="inline-start" />
            Анализировать
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(resume)}>
            <PencilIcon data-icon="inline-start" />
            Переименовать
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasText} onClick={() => onDuplicate(resume)}>
            <CopyIcon data-icon="inline-start" />
            Дублировать
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Переместить</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem onClick={() => onMove(resume, null)}>
              Без папки
            </DropdownMenuItem>
            {folders.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onClick={() => onMove(resume, folder.id)}
              >
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {hasResumeServedFile(resume) ? (
          <DropdownMenuItem asChild>
            <a href={`/api/resumes/${resume.id}/source-file`}>
              <DownloadIcon data-icon="inline-start" />
              Скачать оригинал
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {resume.deletedAt ? (
          <DropdownMenuItem onClick={() => onRestore(resume)}>
            <Undo2Icon data-icon="inline-start" />
            Восстановить
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(resume)}>
            <Trash2Icon data-icon="inline-start" />
            Удалить
          </DropdownMenuItem>
        )}
    </>
  );
}

export function ResumeLibraryClient() {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resumeContextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisEventSourceRef = useRef<EventSource | null>(null);
  const fileDragDepthRef = useRef(0);
  const [resumes, setResumes] = useState<ResumeLibraryResume[]>([]);
  const [analyses, setAnalyses] = useState<ResumeLibraryAnalysis[]>([]);
  const [folders, setFolders] = useState<ResumeLibraryFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] =
    useState<ResumeFolderFilter>(folderRootId);
  const [sort, setSort] = useState<ResumeSortMode>("updated-desc");
  const [view, setView] = useState<ResumeViewMode>("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingResume, setIsCreatingResume] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [newResumeTitle, setNewResumeTitle] = useState("");
  const [newResumeText, setNewResumeText] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");
  const [analysisCandidate, setAnalysisCandidate] =
    useState<ResumeLibraryResume | null>(null);
  const [analysisRun, setAnalysisRun] = useState<WorkflowRunSnapshot | null>(
    null
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [analysisOverlayOpen, setAnalysisOverlayOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
  });
  const [actionMenu, setActionMenu] = useState<ResumeActionMenuState>({
    open: false,
    x: 0,
    y: 0,
    resume: null,
  });
  const [resumeContextMenu, setResumeContextMenu] =
    useState<ResumeActionMenuState>({
      open: false,
      x: 0,
      y: 0,
      resume: null,
    });

  async function loadLibrary() {
    setIsLoading(true);

    try {
      const [resumeBody, analysisBody, folderBody] = await Promise.all([
        apiRequest<ResumeLibraryResponse>("/api/resumes?scope=all"),
        apiRequest<ResumeAnalysisLibraryResponse>("/api/resume-analysis/saved"),
        apiRequest<ResumeFoldersResponse>("/api/resume-folders"),
      ]);

      setResumes(resumeBody.items);
      setAnalyses(analysisBody.items);
      setFolders(folderBody.items);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить библиотеку резюме."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      analysisEventSourceRef.current?.close();
    };
  }, []);

  const visibleResumes = useMemo(() => {
    let filtered = resumes;

    if (selectedFolderId === folderTrashId) {
      filtered = filtered.filter((resume) => Boolean(resume.deletedAt));
    } else {
      filtered = filtered.filter((resume) => !resume.deletedAt);

      if (selectedFolderId === folderRootId) {
        filtered = filtered.filter((resume) => !resume.folderId);
      } else if (selectedFolderId !== folderAllId) {
        filtered = filtered.filter(
          (resume) => resume.folderId === selectedFolderId
        );
      }
    }

    return sortResumes(filtered, sort);
  }, [resumes, selectedFolderId, sort]);
  const visibleAnalyses = useMemo(() => {
    let filtered = analyses;

    if (selectedFolderId === folderTrashId) {
      filtered = filtered.filter((analysis) => Boolean(analysis.deletedAt));
    } else {
      filtered = filtered.filter((analysis) => !analysis.deletedAt);

      if (selectedFolderId === folderRootId) {
        filtered = filtered.filter((analysis) => !analysis.folderId);
      } else if (selectedFolderId !== folderAllId) {
        filtered = filtered.filter(
          (analysis) => analysis.folderId === selectedFolderId
        );
      }
    }

    return sortAnalyses(filtered, sort);
  }, [analyses, selectedFolderId, sort]);
  const visibleFolders = useMemo(() => {
    if (selectedFolderId !== folderRootId) return [];

    return sortFolders(folders);
  }, [folders, selectedFolderId]);
  const currentFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );
  const hasLibraryItems =
    visibleFolders.length > 0 ||
    visibleAnalyses.length > 0 ||
    visibleResumes.length > 0;
  const analysisProgress = getWorkflowProgress(analysisRun);
  const currentAnalysisNode = getWorkflowCurrentNode(analysisRun);

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    if (!isSupportedResumeFile(file)) {
      toast.error("Поддерживаются только PDF, DOCX и TXT.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);

      if (
        selectedFolderId !== folderAllId &&
        selectedFolderId !== folderTrashId &&
        selectedFolderId !== folderRootId
      ) {
        formData.set("folderId", selectedFolderId);
      }

      await apiRequest("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });
      toast.success("Резюме загружено.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось загрузить резюме."
      );
    } finally {
      setIsUploading(false);

      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  async function handleCreateFolder() {
    const name = folderName.trim();

    if (!name) return;

    try {
      await apiRequest("/api/resume-folders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      setFolderName("");
      setIsCreatingFolder(false);
      toast.success("Папка создана.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать папку."
      );
    }
  }

  async function handleCreateResume() {
    const title = newResumeTitle.trim();
    const plainText = newResumeText.trim();

    if (!title || !plainText) return;

    try {
      await apiRequest("/api/resumes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          plainText,
          folderId:
            selectedFolderId !== folderAllId && selectedFolderId !== folderTrashId
              ? selectedFolderId === folderRootId
                ? null
                : selectedFolderId
              : null,
        }),
      });
      setNewResumeTitle("");
      setNewResumeText("");
      setIsCreatingResume(false);
      toast.success("Резюме создано.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать резюме."
      );
    }
  }

  async function handleRename() {
    if (!renameTarget) return;

    const name = renameValue.trim();

    if (!name) return;

    try {
      if (renameTarget.type === "resume") {
        await apiRequest(`/api/resumes/${renameTarget.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ title: name }),
        });
      } else if (renameTarget.type === "analysis") {
        await apiRequest(`/api/resume-analysis/saved/${renameTarget.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ title: name }),
        });
      } else {
        await apiRequest(`/api/resume-folders/${renameTarget.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ name }),
        });
      }

      setRenameTarget(null);
      setRenameValue("");
      toast.success("Название обновлено.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось обновить название."
      );
    }
  }

  async function handleDeleteFolder(folder: ResumeLibraryFolder) {
    try {
      await apiRequest(`/api/resume-folders/${folder.id}`, {
        method: "DELETE",
      });
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(folderRootId);
      }
      toast.success("Папка удалена. Резюме перенесены в «Без папки».");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить папку."
      );
    }
  }

  async function handleMove(resume: ResumeLibraryResume, folderId: string | null) {
    try {
      await apiRequest(`/api/resumes/${resume.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ folderId }),
      });
      toast.success("Резюме перемещено.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось переместить резюме."
      );
    }
  }

  async function handleMoveAnalysis(
    analysis: ResumeLibraryAnalysis,
    folderId: string | null
  ) {
    try {
      await apiRequest(`/api/resume-analysis/saved/${analysis.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ folderId }),
      });
      toast.success("Анализ перемещён.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось переместить анализ."
      );
    }
  }

  async function handleDelete(resume: ResumeLibraryResume) {
    try {
      await apiRequest(`/api/resumes/${resume.id}`, {
        method: "DELETE",
      });
      toast.success("Резюме перемещено в корзину.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить резюме."
      );
    }
  }

  async function handleDeleteAnalysis(analysis: ResumeLibraryAnalysis) {
    try {
      await apiRequest(`/api/resume-analysis/saved/${analysis.id}`, {
        method: "DELETE",
      });
      toast.success("Анализ перемещён в корзину.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить анализ."
      );
    }
  }

  async function handleRestore(resume: ResumeLibraryResume) {
    try {
      await apiRequest(`/api/resumes/${resume.id}/restore`, {
        method: "POST",
      });
      toast.success("Резюме восстановлено.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось восстановить резюме."
      );
    }
  }

  async function handleRestoreAnalysis(analysis: ResumeLibraryAnalysis) {
    try {
      await apiRequest(`/api/resume-analysis/saved/${analysis.id}/restore`, {
        method: "POST",
      });
      toast.success("Анализ восстановлен.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось восстановить анализ."
      );
    }
  }

  async function handleDuplicate(resume: ResumeLibraryResume) {
    try {
      await apiRequest(`/api/resumes/${resume.id}/duplicate`, {
        method: "POST",
      });
      toast.success("Копия создана.");
      await loadLibrary();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать копию."
      );
    }
  }

  async function handleAnalyze(resume: ResumeLibraryResume) {
    const text = getResumeText(resume);

    if (!text) {
      toast.error("У резюме нет текстовой версии для анализа.");
      return;
    }

    try {
      const body = await apiRequest<{ id: string }>("/api/resume-analysis/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      router.push(`/resume?runId=${body.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось запустить анализ."
      );
    }
  }

  function handleEditBuilder(resume: ResumeLibraryResume) {
    router.push(`/resumes/${resume.id}/edit`);
  }

  function handleOpen(resume: ResumeLibraryResume) {
    if (isBuilderResume(resume)) {
      router.push(`/resumes/${resume.id}`);
      return;
    }

    router.push(`/resumes/${resume.id}`);
  }

  function handleOpenAnalysis(analysis: ResumeLibraryAnalysis) {
    router.push(`/resume?analysisId=${analysis.id}`);
  }

  function requestAnalyze(resume: ResumeLibraryResume) {
    const text = getResumeText(resume);

    if (!text) {
      toast.error("У резюме нет текстовой версии для анализа.");
      return;
    }

    setAnalysisCandidate(resume);
  }

  function connectToAnalysisRun(runId: string) {
    analysisEventSourceRef.current?.close();

    const source = new EventSource(`/api/resume-analysis/runs/${runId}/events`);
    analysisEventSourceRef.current = source;
    let receivedTerminalEvent = false;

    const updateRun = (event: MessageEvent<string>) => {
      if (!event.data) return;

      let nextRun: WorkflowRunSnapshot;

      try {
        nextRun = JSON.parse(event.data) as WorkflowRunSnapshot;
      } catch {
        setAnalysisError("SSE-поток анализа вернул некорректное событие.");
        source.close();
        return;
      }

      setAnalysisRun(nextRun);

      if (nextRun.status === "success") {
        receivedTerminalEvent = true;
        source.close();
        analysisEventSourceRef.current = null;
        toast.success("Анализ сохранён в библиотеку.");
        void loadLibrary();
        setAnalysisOverlayOpen(false);

        if (nextRun.savedAnalysisId) {
          router.push(`/resume?analysisId=${nextRun.savedAnalysisId}`);
        } else {
          router.push(`/resume?runId=${nextRun.id}`);
        }
      }

      if (nextRun.status === "error") {
        receivedTerminalEvent = true;
        source.close();
        analysisEventSourceRef.current = null;
        setAnalysisError(nextRun.error ?? "Workflow failed.");
      }
    };

    source.addEventListener("snapshot", updateRun);
    source.addEventListener("run_update", updateRun);
    source.addEventListener("node_update", updateRun);
    source.addEventListener("done", updateRun);
    source.addEventListener("error", updateRun);
    source.onerror = (event) => {
      const data = (event as MessageEvent<string>).data;

      if (typeof data === "string" && data) {
        updateRun(event as MessageEvent<string>);
        return;
      }

      if (!receivedTerminalEvent) {
        setAnalysisError("SSE-поток анализа отключён.");
      }

      source.close();
      analysisEventSourceRef.current = null;
    };
  }

  async function startConfirmedAnalysis() {
    const resume = analysisCandidate;

    if (!resume) return;

    setIsStartingAnalysis(true);
    setAnalysisError(null);
    setAnalysisRun(null);
    setAnalysisOverlayOpen(true);

    try {
      const body = await apiRequest<WorkflowRunSnapshot>(
        "/api/resume-analysis/runs",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ resumeId: resume.id }),
        }
      );

      setAnalysisCandidate(null);
      setAnalysisRun(body);
      connectToAnalysisRun(body.id);
    } catch (error) {
      setAnalysisOverlayOpen(false);
      toast.error(
        error instanceof Error ? error.message : "Не удалось запустить анализ."
      );
    } finally {
      setIsStartingAnalysis(false);
    }
  }

  function handleOpenPdf(resume: ResumeLibraryResume) {
    if (!isPdfResume(resume) || !hasResumeServedFile(resume)) {
      toast.error("У этого резюме нет оригинального PDF.");
      return;
    }

    router.push(`/resumes/${resume.id}/pdf`);
  }

  function closeActionMenu() {
    setActionMenu((value) => ({ ...value, open: false }));
  }

  function handleActionOpenEditor(resume: ResumeLibraryResume) {
    closeActionMenu();
    handleOpen(resume);
  }

  function handleActionOpenPdf(resume: ResumeLibraryResume) {
    closeActionMenu();
    handleOpenPdf(resume);
  }

  function handleActionAnalyze(resume: ResumeLibraryResume) {
    closeActionMenu();
    requestAnalyze(resume);
  }

  function openResumeActionMenu(
    resume: ResumeLibraryResume,
    event: ReactMouseEvent<HTMLElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    setActionMenu({
      open: true,
      resume,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function openResumeContextMenu(
    resume: ResumeLibraryResume,
    event: ReactMouseEvent<HTMLElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    setResumeContextMenu({
      open: true,
      resume,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleOpenFolder(folder: ResumeLibraryFolder) {
    setSelectedFolderId(folder.id);
  }

  function openCreateFolderDialog() {
    setContextMenu((value) => ({ ...value, open: false }));
    setSelectedFolderId(folderRootId);
    setIsCreatingFolder(true);
  }

  function openCreateResumeDialog() {
    setContextMenu((value) => ({ ...value, open: false }));
    setIsCreatingResume(true);
  }

  function openUploadPicker() {
    setContextMenu((value) => ({ ...value, open: false }));
    uploadInputRef.current?.click();
  }

  function isLibrarySurfaceTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      !target.closest("[data-library-item], [data-library-control]")
    );
  }

  function openWorkspaceContextMenu(x: number, y: number) {
    setContextMenu({ open: true, x, y });
  }

  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function resetFileDragState() {
    fileDragDepthRef.current = 0;
    setIsFileDragging(false);
  }

  function handleFileDragEnter(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    fileDragDepthRef.current += 1;
    setIsFileDragging(true);
  }

  function handleFileDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsFileDragging(true);
  }

  function handleFileDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;

    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);

    if (fileDragDepthRef.current === 0) {
      setIsFileDragging(false);
    }
  }

  function handleFileDrop(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    resetFileDragState();
    void handleUpload(event.dataTransfer.files?.[0]);
  }

  function handleWorkspaceContextMenu(
    event: ReactMouseEvent<HTMLElement>
  ) {
    if (!isLibrarySurfaceTarget(event.target)) return;

    event.preventDefault();
    openWorkspaceContextMenu(event.clientX, event.clientY);
  }

  function handleWorkspacePointerDown(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (event.pointerType === "mouse" || !isLibrarySurfaceTarget(event.target)) {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      openWorkspaceContextMenu(event.clientX, event.clientY);
    }, longPressDelayMs);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    const analysisId = activeId.startsWith("analysis:")
      ? activeId.slice("analysis:".length)
      : null;
    const analysis = analysisId
      ? analyses.find((item) => item.id === analysisId)
      : null;
    const resumeId = analysisId ? "" : activeId;
    const resume = resumes.find((item) => item.id === resumeId);

    if ((!resume && !analysis) || !overId || overId === folderAllId) return;

    if (overId.startsWith("folder:")) {
      const folderId = overId.slice("folder:".length);

      if (analysis) {
        await handleMoveAnalysis(analysis, folderId);
      } else if (resume) {
        await handleMove(resume, folderId);
      }
      return;
    }

    if (overId === folderTrashId) {
      if (analysis) {
        await handleDeleteAnalysis(analysis);
      } else if (resume) {
        await handleDelete(resume);
      }
      return;
    }

    const folderId = overId === folderRootId ? null : overId;

    if (analysis) {
      await handleMoveAnalysis(analysis, folderId);
    } else if (resume) {
      await handleMove(resume, folderId);
    }
  }

  function openRenameDialog(target: RenameTarget) {
    setRenameTarget(target);
    setRenameValue(target?.name ?? "");
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        className="flex h-[calc(100vh-var(--header-height))] min-h-[720px] flex-col bg-background"
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDragOver={handleFileDragOver}
        onDrop={handleFileDrop}
      >
        <input
          accept={resumeUploadAccept}
          className="hidden"
          ref={uploadInputRef}
          type="file"
          onChange={(event) => void handleUpload(event.target.files?.[0])}
        />
        <DropdownMenu
          open={contextMenu.open}
          onOpenChange={(open) =>
            setContextMenu((value) => ({ ...value, open }))
          }
        >
          <DropdownMenuTrigger asChild>
            <button
              aria-hidden="true"
              className="fixed size-px opacity-0"
              ref={contextMenuTriggerRef}
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
              }}
              tabIndex={-1}
              type="button"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" side="right">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={openCreateFolderDialog}>
                <FolderPlusIcon data-icon="inline-start" />
                Новая папка
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openCreateResumeDialog}>
                <FilePlus2Icon data-icon="inline-start" />
                Новое резюме
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={openUploadPicker}>
                <UploadIcon data-icon="inline-start" />
                Загрузить файл
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu
          open={actionMenu.open}
          onOpenChange={(open) =>
            setActionMenu((value) => ({
              ...value,
              open,
              resume: open ? value.resume : null,
            }))
          }
        >
          <DropdownMenuTrigger asChild>
            <button
              aria-hidden="true"
              className="fixed size-px opacity-0"
              ref={actionMenuTriggerRef}
              style={{
                left: actionMenu.x,
                top: actionMenu.y,
              }}
              tabIndex={-1}
              type="button"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60" side="right">
            <DropdownMenuLabel>Выберите действие</DropdownMenuLabel>
            {actionMenu.resume ? (
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => handleActionOpenEditor(actionMenu.resume!)}
                >
                  <FileTextIcon data-icon="inline-start" />
                  Открыть в редакторе
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    !isPdfResume(actionMenu.resume) ||
                    !hasResumeServedFile(actionMenu.resume)
                  }
                  onClick={() => handleActionOpenPdf(actionMenu.resume!)}
                >
                  <FileSearchIcon data-icon="inline-start" />
                  Открыть оригинал PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!getResumeText(actionMenu.resume)}
                  onClick={() => handleActionAnalyze(actionMenu.resume!)}
                >
                  <PlayIcon data-icon="inline-start" />
                  Запустить анализатор
                </DropdownMenuItem>
              </DropdownMenuGroup>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu
          open={resumeContextMenu.open}
          onOpenChange={(open) =>
            setResumeContextMenu((value) => ({
              ...value,
              open,
              resume: open ? value.resume : null,
            }))
          }
        >
          <DropdownMenuTrigger asChild>
            <button
              aria-hidden="true"
              className="fixed size-px opacity-0"
              ref={resumeContextMenuTriggerRef}
              style={{
                left: resumeContextMenu.x,
                top: resumeContextMenu.y,
              }}
              tabIndex={-1}
              type="button"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" side="right">
            {resumeContextMenu.resume ? (
              <ResumeCardMenuContent
                folders={folders}
                resume={resumeContextMenu.resume}
                onAnalyze={requestAnalyze}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onEdit={handleEditBuilder}
                onMove={handleMove}
                onOpen={handleOpen}
                onOpenPdf={handleOpenPdf}
                onRename={(item) =>
                  openRenameDialog({
                    type: "resume",
                    id: item.id,
                    name: item.title,
                  })
                }
                onRestore={handleRestore}
              />
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-h-0 flex-1">
          <main
            className="min-h-0 overflow-auto p-4"
            onContextMenu={handleWorkspaceContextMenu}
            onPointerCancel={clearLongPressTimer}
            onPointerDown={handleWorkspacePointerDown}
            onPointerLeave={clearLongPressTimer}
            onPointerMove={clearLongPressTimer}
            onPointerUp={clearLongPressTimer}
          >
            <div
              className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
              data-library-control
            >
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                {currentFolder ? (
                  <>
                    <Button
                      className="h-8 px-2"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedFolderId(folderRootId)}
                    >
                      Файлы
                    </Button>
                    <span className="text-muted-foreground">/</span>
                    <span className="truncate">{currentFolder.name}</span>
                  </>
                ) : (
                  <span>Файлы</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-8 gap-1 px-2 text-sm"
                      size="sm"
                      variant="outline"
                    >
                      <ArrowDownAZIcon data-icon="inline-start" />
                      {getSortLabel(sort)}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Сортировка</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sort}
                        onValueChange={(value) => setSort(value as ResumeSortMode)}
                      >
                        {sortOptions.map((option) => (
                          <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ToggleGroup
                  size="default"
                  type="single"
                  value={view}
                  variant="outline"
                  onValueChange={(value) => {
                    if (value) setView(value as ResumeViewMode);
                  }}
                >
                  <ToggleGroupItem aria-label="Сетка" value="grid">
                    <Grid2X2Icon data-icon="inline-start" />
                    <span>Сетка</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem aria-label="Построчно" value="list">
                    <CalendarClockIcon data-icon="inline-start" />
                    <span>Построчно</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="hidden flex-1 sm:block" />
                <Button
                  className="h-8 gap-1 px-2 text-sm"
                  disabled={isUploading}
                  size="sm"
                  variant="outline"
                  onClick={openUploadPicker}
                >
                  {isUploading ? (
                    <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <UploadIcon data-icon="inline-start" />
                  )}
                  <span className="sm:hidden">Загрузить</span>
                  <span className="hidden sm:inline">Загрузить резюме</span>
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-96 items-center justify-center text-muted-foreground">
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
                Загружаем библиотеку...
              </div>
            ) : !hasLibraryItems ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
                <FileTextIcon className="text-muted-foreground" />
                <div>
                  <h2 className="font-medium">Здесь пока нет резюме</h2>
                  <p className="text-sm text-muted-foreground">
                    Загрузите PDF/DOCX/TXT или создайте текстовую версию вручную.
                  </p>
                </div>
              </div>
          ) : (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-2 justify-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,156px))]"
                    : "flex flex-col gap-3"
                }
              >
                {visibleFolders.map((folder) => (
                  <FolderTile
                    folder={folder}
                    key={folder.id}
                    view={view}
                    onDelete={(item) => void handleDeleteFolder(item)}
                    onOpen={handleOpenFolder}
                    onRename={(item) =>
                      openRenameDialog({
                        type: "folder",
                        id: item.id,
                        name: item.name,
                      })
                    }
                  />
                ))}
                {visibleAnalyses.map((analysis) => (
                  <SavedAnalysisCard
                    analysis={analysis}
                    folders={folders}
                    key={analysis.id}
                    view={view}
                    onDelete={handleDeleteAnalysis}
                    onMove={handleMoveAnalysis}
                    onOpen={handleOpenAnalysis}
                    onRename={(item) =>
                      openRenameDialog({
                        type: "analysis",
                        id: item.id,
                        name: item.title,
                      })
                    }
                    onRestore={handleRestoreAnalysis}
                  />
                ))}
                {visibleResumes.map((resume) => (
                  <ResumeCard
                    folders={folders}
                    key={resume.id}
                    resume={resume}
                    view={view}
                    onAnalyze={requestAnalyze}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onEdit={handleEditBuilder}
                    onMove={handleMove}
                    onOpen={handleOpen}
                    onOpenActionMenu={openResumeActionMenu}
                    onOpenContextMenu={openResumeContextMenu}
                    onOpenPdf={handleOpenPdf}
                    onRename={(item) =>
                      openRenameDialog({
                        type: "resume",
                        id: item.id,
                        name: item.title,
                      })
                    }
                    onRestore={handleRestore}
                  />
                ))}
              </div>
          )}
          </main>
        </div>
        {isFileDragging ? (
          <div className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-background/75 text-center shadow-lg backdrop-blur-sm">
            <div className="rounded-2xl border bg-background px-6 py-4 shadow-sm">
              <UploadIcon className="mx-auto mb-3 text-primary" />
              <div className="text-sm font-medium">Отпустите файл для загрузки</div>
              <div className="mt-1 text-xs text-muted-foreground">
                PDF, DOCX или TXT
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={Boolean(analysisCandidate)}
        onOpenChange={(open) => {
          if (!open && !isStartingAnalysis) {
            setAnalysisCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <PlayIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Запустить анализ резюме?</AlertDialogTitle>
            <AlertDialogDescription>
              После завершения в библиотеке появятся сохранённый отчёт анализа и
              отдельная копия резюме. Исходный файл не будет изменён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStartingAnalysis}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isStartingAnalysis}
              onClick={(event) => {
                event.preventDefault();
                void startConfirmedAnalysis();
              }}
            >
              {isStartingAnalysis ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              Запустить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={analysisOverlayOpen}
        onOpenChange={(open) => {
          if (!open && analysisError) {
            setAnalysisOverlayOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl" showCloseButton={Boolean(analysisError)}>
          <DialogHeader>
            <DialogTitle>Анализ резюме выполняется</DialogTitle>
            <DialogDescription>
              Workflow проходит документ по шагам. После успеха результат
              сохранится в “Мои резюме”.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Progress value={analysisProgress} />
            {analysisError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {analysisError}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="animate-spin" />
                {currentAnalysisNode
                  ? `Текущий шаг: ${currentAnalysisNode.label}`
                  : "Запускаем workflow..."}
              </div>
            )}
            {analysisRun ? (
              <div className="grid max-h-80 gap-2 overflow-auto pr-1">
                {analysisRun.nodes.map((node) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                    key={node.key}
                  >
                    <span className="min-w-0 truncate">{node.label}</span>
                    {node.status === "running" ? (
                      <Loader2Icon className="shrink-0 animate-spin" />
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {node.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingFolder} onOpenChange={setIsCreatingFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая папка</DialogTitle>
            <DialogDescription>
              Папки одноуровневые. Удаление папки не удаляет резюме.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Например: Flutter"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreateFolder();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingFolder(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateFolder()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingResume} onOpenChange={setIsCreatingResume}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Новое резюме</DialogTitle>
            <DialogDescription>
              Вставьте plain text. Полное редактирование откроется в редакторе.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Название"
              value={newResumeTitle}
              onChange={(event) => setNewResumeTitle(event.target.value)}
            />
            <Textarea
              className="min-h-72 font-mono text-sm"
              placeholder="Текст резюме"
              value={newResumeText}
              onChange={(event) => setNewResumeText(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingResume(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateResume()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать</DialogTitle>
            <DialogDescription>
              Изменится только название в библиотеке.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Отмена
            </Button>
            <Button onClick={() => void handleRename()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
