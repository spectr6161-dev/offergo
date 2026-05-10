"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  LoaderCircleIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CoverLetterCodeBlock } from "@/components/cover-materials/cover-letter-code-block";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { cn } from "@/lib/utils";

type ResumeLibraryResponse = {
  items: ResumeLibraryResume[];
};

type IndividualResponseDecision = "matched" | "mismatch";

type IndividualResponseArtifact = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  vacancyText: string;
  matchScore: number;
  decision: IndividualResponseDecision;
  coverLetter: string | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  modelId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type GenerateIndividualResponseResponse = {
  item: IndividualResponseArtifact;
};

const minVacancyLength = 100;
const maxVacancyLength = 30_000;

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error &&
      "message" in body.error
        ? String(body.error.message)
        : typeof body === "object" && body && "message" in body
          ? String(body.message)
          : typeof body === "string" && body.trim()
            ? body
            : "Не удалось выполнить запрос.";

    throw new Error(message);
  }

  return body as T;
}

function formatDate(value: string) {
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
  onSelect,
}: {
  resume: ResumeLibraryResume;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !getResumeText(resume);

  return (
    <button
      type="button"
      className={cn(
        "group relative flex min-h-[210px] flex-col rounded-xl p-2 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-sky-500/10 ring-2 ring-sky-500",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
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
      href="/resumes/create"
      aria-label="Создать резюме"
      className="group relative flex min-h-[210px] flex-col items-center rounded-xl p-2 pt-[18px] text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex aspect-[210/297] w-24 items-center justify-center rounded-sm border border-dashed bg-background shadow-sm transition-colors group-hover:border-sky-500">
        <PlusIcon className="size-10 text-muted-foreground transition-colors group-hover:text-sky-500" />
      </span>
    </Link>
  );
}

function ResumeSelectionContent({
  isLoading,
  resumes,
  selectedResumeId,
  onSelect,
}: {
  isLoading: boolean;
  resumes: ResumeLibraryResume[];
  selectedResumeId: string;
  onSelect: (resume: ResumeLibraryResume) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 justify-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,156px))]">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="h-[210px] rounded-xl" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 justify-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,156px))]">
      {resumes.map((resume) => (
        <ResumeChoiceTile
          key={resume.id}
          resume={resume}
          selected={selectedResumeId === resume.id}
          onSelect={() => onSelect(resume)}
        />
      ))}
      <AddResumeTile />
    </div>
  );
}

function ResultTableSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">№</TableHead>
              <TableHead>Пункт</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${title}-${index}-${item}`}>
                <TableCell className="w-12 align-top text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="whitespace-normal align-top leading-relaxed">
                  {item}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function GenerationLoadingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2Icon className="animate-spin text-primary" />
          Идёт формирование ответа
        </CardTitle>
        <CardDescription>
          Сравниваем вакансию с резюме и готовим текст отклика.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={66} />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </CardContent>
    </Card>
  );
}

function IndividualResponseResultCard({
  item,
}: {
  item: IndividualResponseArtifact;
}) {
  async function copyCoverLetter() {
    if (!item.coverLetter) {
      return;
    }

    await navigator.clipboard.writeText(item.coverLetter);
    toast.success("Письмо скопировано.");
  }

  if (item.decision === "mismatch") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangleIcon className="text-destructive" />
          Резюме и вакансия плохо совпадают
        </div>
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Отклик не сформирован</AlertTitle>
          <AlertDescription>{item.summary}</AlertDescription>
        </Alert>
        <ResultTableSection
          title="На что обратить внимание"
          items={item.weaknesses}
        />
        <ResultTableSection title="Рекомендации" items={item.recommendations} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {item.coverLetter ? (
        <CoverLetterCodeBlock
          text={item.coverLetter}
          onCopy={() => void copyCoverLetter()}
        />
      ) : null}
      <ResultTableSection title="Сильные стороны" items={item.strengths} />
      <ResultTableSection
        title="На что обратить внимание"
        items={item.weaknesses}
      />
      <ResultTableSection title="Рекомендации" items={item.recommendations} />
    </div>
  );
}

function VacancyStepContent({
  vacancyText,
  vacancyLength,
  selectedResult,
  isGenerating,
  canGenerate,
  onVacancyTextChange,
  onGenerate,
}: {
  vacancyText: string;
  vacancyLength: number;
  selectedResult: IndividualResponseArtifact | null;
  isGenerating: boolean;
  canGenerate: boolean;
  onVacancyTextChange: (value: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="vacancyText">Описание вакансии</FieldLabel>
          <InputGroup className="min-h-96 items-stretch">
            <InputGroupTextarea
              id="vacancyText"
              value={vacancyText}
              onChange={(event) =>
                onVacancyTextChange(
                  event.target.value.slice(0, maxVacancyLength),
                )
              }
              placeholder="Вставьте сюда текст вакансии..."
              className="min-h-96 text-base leading-7"
            />
          </InputGroup>
          <FieldDescription className="flex justify-end">
            {vacancyLength.toLocaleString("ru-RU")} /{" "}
            {maxVacancyLength.toLocaleString("ru-RU")}
          </FieldDescription>
        </Field>

        <Button
          type="button"
          size="lg"
          className="h-12 w-full bg-sky-600 text-base font-semibold text-white hover:bg-sky-700 focus-visible:ring-sky-500/40 sm:h-12 sm:w-fit sm:self-end sm:px-7 sm:text-base"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          Сформировать отклик
        </Button>
      </FieldGroup>

      {isGenerating ? <GenerationLoadingCard /> : null}

      {selectedResult && !isGenerating ? (
        <IndividualResponseResultCard item={selectedResult} />
      ) : null}
    </div>
  );
}

function ProcessStepper({
  resumes,
  selectedResume,
  selectedResumeId,
  isLoading,
  isGenerating,
  vacancyText,
  vacancyLength,
  selectedResult,
  canGenerate,
  onResumeSelect,
  onVacancyTextChange,
  onGenerate,
}: {
  resumes: ResumeLibraryResume[];
  selectedResume: ResumeLibraryResume | null;
  selectedResumeId: string;
  isLoading: boolean;
  isGenerating: boolean;
  vacancyText: string;
  vacancyLength: number;
  selectedResult: IndividualResponseArtifact | null;
  canGenerate: boolean;
  onResumeSelect: (resume: ResumeLibraryResume) => void;
  onVacancyTextChange: (value: string) => void;
  onGenerate: () => void;
}) {
  const activeStep = selectedResume ? 2 : 1;

  return (
    <Stepper
      className="w-full"
      value={activeStep}
      orientation="vertical"
      indicators={{
        completed: <CheckIcon className="size-3.5" />,
        loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
      }}
    >
      <StepperNav className="w-full">
        <StepperItem
          step={1}
          completed={Boolean(selectedResume)}
          className="relative w-full items-start not-last:flex-1"
        >
          <StepperTrigger className="items-center gap-2.5 pb-0" type="button">
            <StepperIndicator className="text-xs font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=completed]:bg-sky-500 data-[state=completed]:text-white">
              1
            </StepperIndicator>
            <div className="text-left">
              <StepperTitle className="text-xl leading-none font-semibold sm:text-2xl">
                Выбор резюме
              </StepperTitle>
            </div>
          </StepperTrigger>

          <StepperDescription className="w-full pb-12 pl-8 pt-4 text-foreground">
            <ResumeSelectionContent
              isLoading={isLoading}
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              onSelect={onResumeSelect}
            />
          </StepperDescription>

          <StepperSeparator className="absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[state=completed]/step:bg-sky-500 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)]" />
        </StepperItem>

        <StepperItem
          step={2}
          loading={isGenerating}
          className="relative w-full items-start"
        >
          <StepperTrigger className="items-center gap-2.5 pb-0" type="button">
            <StepperIndicator className="text-xs font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=completed]:bg-sky-500 data-[state=completed]:text-white">
              2
            </StepperIndicator>
            <div className="text-left">
              <StepperTitle className="text-xl leading-none font-semibold sm:text-2xl">
                Текст вакансии
              </StepperTitle>
            </div>
          </StepperTrigger>

          <StepperDescription className="w-full pl-8 pt-4 text-foreground">
            <VacancyStepContent
              vacancyText={vacancyText}
              vacancyLength={vacancyLength}
              selectedResult={selectedResult}
              isGenerating={isGenerating}
              canGenerate={canGenerate}
              onVacancyTextChange={onVacancyTextChange}
              onGenerate={onGenerate}
            />
          </StepperDescription>
        </StepperItem>
      </StepperNav>
    </Stepper>
  );
}

export function IndividualResponsesClient() {
  const [resumes, setResumes] = useState<ResumeLibraryResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [vacancyText, setVacancyText] = useState("");
  const [selectedResult, setSelectedResult] =
    useState<IndividualResponseArtifact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId],
  );
  const vacancyLength = vacancyText.trim().length;
  const canGenerate =
    Boolean(selectedResume) &&
    vacancyLength >= minVacancyLength &&
    vacancyLength <= maxVacancyLength &&
    !isGenerating;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const body = await apiRequest<ResumeLibraryResponse>(
          "/api/resumes?scope=all",
        );

        if (!mounted) {
          return;
        }

        setResumes(body.items.filter((resume) => !resume.deletedAt));
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить резюме.",
        );
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  function handleResumeSelect(resume: ResumeLibraryResume) {
    if (!getResumeText(resume)) {
      return;
    }

    setSelectedResumeId(resume.id);
    setSelectedResult(null);
  }

  async function generateResponse() {
    if (!selectedResume || !canGenerate) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const body = await apiRequest<GenerateIndividualResponseResponse>(
        "/api/cover-materials/individual-responses/generate",
        {
          method: "POST",
          body: JSON.stringify({
            resumeId: selectedResume.id,
            vacancyText,
          }),
        },
      );

      setSelectedResult(body.item);
      toast.success("Отклик сформирован.");
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Не удалось сформировать отклик.";

      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ProcessStepper
        resumes={resumes}
        selectedResume={selectedResume}
        selectedResumeId={selectedResumeId}
        isLoading={isLoading}
        isGenerating={isGenerating}
        vacancyText={vacancyText}
        vacancyLength={vacancyLength}
        selectedResult={selectedResult}
        canGenerate={canGenerate}
        onResumeSelect={handleResumeSelect}
        onVacancyTextChange={setVacancyText}
        onGenerate={() => void generateResponse()}
      />
    </main>
  );
}
