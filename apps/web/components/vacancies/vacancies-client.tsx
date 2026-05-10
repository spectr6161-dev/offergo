"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  FilterIcon,
  Loader2Icon,
  MailPlusIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Vacancy = {
  id: string;
  title: string;
  companyName: string;
  categoryName: string;
  categorySlug: string;
  level: string;
  salaryText: string | null;
  salaryValue: number | null;
  salaryCurrency: string | null;
  workFormat: string | null;
  location: string | null;
  datePosted: string | null;
  employmentType: string | null;
  directApply: boolean;
  description: string;
  skillsText: string | null;
  qualificationsText: string | null;
  benefitsText: string | null;
  url: string | null;
};

type VacanciesResponse = {
  items: Vacancy[];
  total: number;
  nextCursor: number | null;
};

type FilterOption = {
  value?: string | null;
  slug?: string;
  name?: string;
  count: number;
};

type VacancyFiltersResponse = {
  categories: FilterOption[];
  levels: FilterOption[];
  workFormats: FilterOption[];
  locations: FilterOption[];
};

type SalaryPreset = {
  label: string;
  minSalary?: number;
  maxSalary?: number;
};

type VacancyEventType =
  | "view_detail"
  | "open_source"
  | "cover_letter_start"
  | "application_confirmed";

type FilterGroupId = "category" | "level" | "workFormat" | "location";

const pageSize = 25;
const visibleFilterOptions = 3;
const salaryPresets: SalaryPreset[] = [
  { label: "Любая" },
  { label: "до 150К", maxSalary: 150_000 },
  { label: "150-250К", minSalary: 150_000, maxSalary: 250_000 },
  { label: "250К+", minSalary: 250_000 },
];

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function recordVacancyEvent(vacancyId: string, type: VacancyEventType) {
  await fetch(`/api/vacancies/${vacancyId}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type,
      source: "web",
    }),
  }).catch(() => undefined);
}

function formatDate(value: string | null) {
  if (!value) {
    return "дата не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatSalary(vacancy: Vacancy) {
  if (vacancy.salaryText) {
    return vacancy.salaryText;
  }

  if (!vacancy.salaryValue) {
    return "зарплата не указана";
  }

  return `от ${vacancy.salaryValue.toLocaleString("ru-RU")} ₽`;
}

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

function splitList(value: string | null) {
  return (value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOptionValue(option: FilterOption, kind: "category" | "value") {
  if (kind === "category") {
    return option.slug ?? "";
  }

  return option.value ?? "";
}

function getOptionLabel(option: FilterOption, kind: "category" | "value") {
  if (kind === "category") {
    return option.name ?? "Без категории";
  }

  return option.value ?? "Не указано";
}

function sortOptions(
  options: FilterOption[],
  kind: "category" | "value",
) {
  return [...options]
    .filter((option) => getOptionValue(option, kind))
    .sort(
      (left, right) =>
        right.count - left.count ||
        getOptionLabel(left, kind).localeCompare(getOptionLabel(right, kind), "ru"),
    );
}

function toggleSelectedValue(
  current: string[],
  value: string,
  shouldSelect: boolean,
) {
  if (shouldSelect) {
    return current.includes(value) ? current : [...current, value];
  }

  return current.filter((item) => item !== value);
}

function appendListParam(
  search: URLSearchParams,
  name: string,
  values: string[],
) {
  if (values.length > 0) {
    search.set(name, values.join(","));
  }
}

function buildQuery(params: {
  cursor: number;
  query: string;
  categories: string[];
  levels: string[];
  workFormats: string[];
  locations: string[];
  salaryPreset: SalaryPreset;
}) {
  const search = new URLSearchParams({
    cursor: String(params.cursor),
    limit: String(pageSize),
  });

  if (params.query) {
    search.set("q", params.query);
  }

  appendListParam(search, "category", params.categories);
  appendListParam(search, "level", params.levels);
  appendListParam(search, "workFormat", params.workFormats);
  appendListParam(search, "location", params.locations);

  if (params.salaryPreset.minSalary !== undefined) {
    search.set("minSalary", String(params.salaryPreset.minSalary));
  }

  if (params.salaryPreset.maxSalary !== undefined) {
    search.set("maxSalary", String(params.salaryPreset.maxSalary));
  }

  return search;
}

function VacancyTags({ vacancy }: { vacancy: Vacancy }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="rounded-md">
        {vacancy.level}
      </Badge>
      {vacancy.workFormat ? (
        <Badge variant="outline" className="rounded-md">
          {vacancy.workFormat}
        </Badge>
      ) : null}
      {vacancy.location ? (
        <Badge variant="outline" className="rounded-md">
          {vacancy.location}
        </Badge>
      ) : null}
      <Badge variant="outline" className="rounded-md">
        {vacancy.categoryName}
      </Badge>
    </div>
  );
}

function VacancyListCard({
  vacancy,
  selected,
  onSelect,
  onCoverLetter,
}: {
  vacancy: Vacancy;
  selected: boolean;
  onSelect: () => void;
  onCoverLetter: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={cn(
        "relative min-h-[236px] cursor-pointer rounded-[22px] border bg-card px-5 py-5 text-left text-card-foreground shadow-xs transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6 sm:py-6",
        selected && "border-primary",
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute top-6 right-6 text-xs text-muted-foreground">
        {formatDate(vacancy.datePosted)}
      </div>

      <div className="flex min-w-0 flex-col gap-4 pr-0 sm:pr-28">
        <div className="truncate text-sm font-semibold">
          {vacancy.companyName}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight sm:text-[24px]">
            {vacancy.title}
          </h2>
          <p className="text-base font-semibold">{formatSalary(vacancy)}</p>
        </div>

        <VacancyTags vacancy={vacancy} />

        <div className="pt-1">
          <Button
            type="button"
            size="lg"
            className="h-11 rounded-xl !bg-sidebar-primary px-4 !text-sidebar-primary-foreground shadow-none hover:!bg-sidebar-primary/90 focus-visible:!ring-sidebar-primary/40 [&_svg]:!text-sidebar-primary-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onCoverLetter();
            }}
          >
            <MailPlusIcon data-icon="inline-start" />
            Отправить сопроводительное
          </Button>
        </div>
      </div>
    </article>
  );
}

function FilterGroup({
  title,
  options,
  selectedValues,
  onChange,
  kind,
  expanded,
  onExpandedChange,
}: {
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  kind: "category" | "value";
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
}) {
  const sortedOptions = useMemo(() => sortOptions(options, kind), [kind, options]);
  const visibleOptions = sortedOptions.slice(0, visibleFilterOptions);
  const hiddenOptions = sortedOptions.slice(visibleFilterOptions);
  const hiddenCount = hiddenOptions.length;
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  if (sortedOptions.length === 0) {
    return null;
  }

  const renderOption = (option: FilterOption) => {
    const optionValue = getOptionValue(option, kind);
    const optionLabel = getOptionLabel(option, kind);
    const checkboxId = `vacancy-filter-${title}-${optionValue}`;

    return (
      <label
        key={optionValue}
        htmlFor={checkboxId}
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
      >
        <Checkbox
          id={checkboxId}
          checked={selectedSet.has(optionValue)}
          onCheckedChange={(checked) =>
            onChange(
              toggleSelectedValue(
                selectedValues,
                optionValue,
                checked === true,
              ),
            )
          }
        />
        <span className="min-w-0 flex-1 truncate">{optionLabel}</span>
        <Badge variant="outline" className="rounded-md font-mono">
          {option.count}
        </Badge>
      </label>
    );
  };

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onExpandedChange}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {selectedValues.length > 0 ? (
            <Badge variant="secondary" className="rounded-md">
              {selectedValues.length}
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selectedValues.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Очистить фильтр ${title}`}
              onClick={() => onChange([])}
            >
              <XIcon />
              <span className="sr-only">Очистить фильтр {title}</span>
            </Button>
          ) : null}
          {hiddenCount > 0 ? (
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  expanded
                    ? `Свернуть фильтр ${title}`
                    : `Показать все варианты фильтра ${title}`
                }
              >
                {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                <span className="sr-only">
                  {expanded
                    ? `Свернуть фильтр ${title}`
                    : `Показать все варианты фильтра ${title}`}
                </span>
              </Button>
            </CollapsibleTrigger>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visibleOptions.map(renderOption)}
      </div>

      {hiddenCount > 0 ? (
        <CollapsibleContent>
          <div className="max-h-64 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">{hiddenOptions.map(renderOption)}</div>
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

function SelectedFilterBadges({
  filters,
  selectedCategories,
  selectedLevels,
  selectedWorkFormats,
  selectedLocations,
  onRemoveCategory,
  onRemoveLevel,
  onRemoveWorkFormat,
  onRemoveLocation,
}: {
  filters: VacancyFiltersResponse | null;
  selectedCategories: string[];
  selectedLevels: string[];
  selectedWorkFormats: string[];
  selectedLocations: string[];
  onRemoveCategory: (value: string) => void;
  onRemoveLevel: (value: string) => void;
  onRemoveWorkFormat: (value: string) => void;
  onRemoveLocation: (value: string) => void;
}) {
  const labels = useMemo(() => {
    const result = new Map<string, string>();

    for (const category of filters?.categories ?? []) {
      const value = getOptionValue(category, "category");

      if (value) {
        result.set(`category:${value}`, getOptionLabel(category, "category"));
      }
    }

    for (const [key, options] of [
      ["level", filters?.levels ?? []],
      ["workFormat", filters?.workFormats ?? []],
      ["location", filters?.locations ?? []],
    ] as const) {
      for (const option of options) {
        const value = getOptionValue(option, "value");

        if (value) {
          result.set(`${key}:${value}`, getOptionLabel(option, "value"));
        }
      }
    }

    return result;
  }, [filters]);

  const items = [
    ...selectedCategories.map((value) => ({
      key: `category:${value}`,
      value,
      label: labels.get(`category:${value}`) ?? value,
      onRemove: onRemoveCategory,
    })),
    ...selectedLevels.map((value) => ({
      key: `level:${value}`,
      value,
      label: labels.get(`level:${value}`) ?? value,
      onRemove: onRemoveLevel,
    })),
    ...selectedWorkFormats.map((value) => ({
      key: `workFormat:${value}`,
      value,
      label: labels.get(`workFormat:${value}`) ?? value,
      onRemove: onRemoveWorkFormat,
    })),
    ...selectedLocations.map((value) => ({
      key: `location:${value}`,
      value,
      label: labels.get(`location:${value}`) ?? value,
      onRemove: onRemoveLocation,
    })),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item.key} asChild variant="secondary" className="h-7 max-w-full rounded-md">
          <button
            type="button"
            aria-label={`Убрать фильтр ${item.label}`}
            onClick={() => item.onRemove(item.value)}
          >
            <span className="truncate">{item.label}</span>
            <XIcon data-icon="inline-end" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function SalaryFilterGroup({
  salaryPresetIndex,
  onSalaryPresetChange,
}: {
  salaryPresetIndex: number;
  onSalaryPresetChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold">Зарплата</h3>
          {salaryPresetIndex > 0 ? (
            <Badge variant="secondary" className="rounded-md">
              1
            </Badge>
          ) : null}
        </div>
        {salaryPresetIndex > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Очистить фильтр зарплаты"
            onClick={() => onSalaryPresetChange(0)}
          >
            <XIcon />
            <span className="sr-only">Очистить фильтр зарплаты</span>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {salaryPresets.map((preset, index) => (
          <Button
            key={preset.label}
            type="button"
            variant={salaryPresetIndex === index ? "default" : "outline"}
            size="sm"
            onClick={() => onSalaryPresetChange(index)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  selectedCategories,
  selectedLevels,
  selectedWorkFormats,
  selectedLocations,
  salaryPresetIndex,
  onCategoriesChange,
  onLevelsChange,
  onWorkFormatsChange,
  onLocationsChange,
  onSalaryPresetChange,
}: {
  filters: VacancyFiltersResponse | null;
  selectedCategories: string[];
  selectedLevels: string[];
  selectedWorkFormats: string[];
  selectedLocations: string[];
  salaryPresetIndex: number;
  onCategoriesChange: (values: string[]) => void;
  onLevelsChange: (values: string[]) => void;
  onWorkFormatsChange: (values: string[]) => void;
  onLocationsChange: (values: string[]) => void;
  onSalaryPresetChange: (value: number) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<FilterGroupId, boolean>>({
    category: false,
    level: false,
    workFormat: false,
    location: false,
  });

  useEffect(() => {
    function updateAvailableHeight() {
      const element = scrollContainerRef.current;

      if (!element) {
        return;
      }

      setAvailableHeight(window.innerHeight - element.getBoundingClientRect().top);
    }

    updateAvailableHeight();

    window.addEventListener("resize", updateAvailableHeight);
    window.addEventListener("scroll", updateAvailableHeight, { passive: true });

    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      window.removeEventListener("scroll", updateAvailableHeight);
    };
  }, []);

  const filterScrollStyle =
    availableHeight === null ? undefined : { maxHeight: availableHeight };

  function setGroupExpanded(groupId: FilterGroupId, value: boolean) {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: value,
    }));
  }

  if (!filters) {
    return (
      <div
        ref={scrollContainerRef}
        className="flex min-h-0 w-full flex-col gap-3 overflow-y-auto pr-2"
        style={filterScrollStyle}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-lg border p-3">
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex min-h-0 w-full flex-col gap-3 overflow-y-auto pr-2"
      style={filterScrollStyle}
    >
      <FilterGroup
        title="Категория"
        options={filters.categories}
        selectedValues={selectedCategories}
        onChange={onCategoriesChange}
        kind="category"
        expanded={expandedGroups.category}
        onExpandedChange={(value) => setGroupExpanded("category", value)}
      />
      <FilterGroup
        title="Грейд"
        options={filters.levels}
        selectedValues={selectedLevels}
        onChange={onLevelsChange}
        kind="value"
        expanded={expandedGroups.level}
        onExpandedChange={(value) => setGroupExpanded("level", value)}
      />
      <FilterGroup
        title="Формат"
        options={filters.workFormats}
        selectedValues={selectedWorkFormats}
        onChange={onWorkFormatsChange}
        kind="value"
        expanded={expandedGroups.workFormat}
        onExpandedChange={(value) => setGroupExpanded("workFormat", value)}
      />
      <FilterGroup
        title="География"
        options={filters.locations}
        selectedValues={selectedLocations}
        onChange={onLocationsChange}
        kind="value"
        expanded={expandedGroups.location}
        onExpandedChange={(value) => setGroupExpanded("location", value)}
      />
      <SalaryFilterGroup
        salaryPresetIndex={salaryPresetIndex}
        onSalaryPresetChange={onSalaryPresetChange}
      />
    </div>
  );
}

function MobileFiltersSheet({
  activeFiltersCount,
  children,
}: {
  activeFiltersCount: number;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="lg:hidden">
          <FilterIcon data-icon="inline-start" />
          Фильтры
          {activeFiltersCount > 0 ? (
            <Badge variant="secondary" className="rounded-md">
              {activeFiltersCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription>Настройте выдачу вакансий.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 p-3">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function SearchBar({
  value,
  onValueChange,
  onSubmit,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex w-full items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <InputGroup className="h-11 flex-1 rounded-[10px] bg-background">
        <InputGroupAddon align="inline-start" className="pl-3">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={value}
          placeholder="Профессия, должность или компания"
          onChange={(event) => onValueChange(event.target.value)}
        />
      </InputGroup>
      <Button
        type="submit"
        className="hidden h-11 min-w-44 rounded-[10px] bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:inline-flex"
      >
        Найти
      </Button>
    </form>
  );
}

function VacancyDetail({
  vacancy,
  confirmed,
  onTrackEvent,
  onConfirmApplication,
}: {
  vacancy: Vacancy | null;
  confirmed: boolean;
  onTrackEvent: (vacancy: Vacancy, type: VacancyEventType) => void;
  onConfirmApplication: (vacancy: Vacancy) => void;
}) {
  const skills = splitList(vacancy?.skillsText ?? null);
  const benefits = splitList(vacancy?.benefitsText ?? null);

  if (!vacancy) {
    return null;
  }

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle className="text-2xl">{vacancy.title}</SheetTitle>
        <SheetDescription>
          {vacancy.companyName} · {formatSalary(vacancy)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-6">
        <VacancyTags vacancy={vacancy} />

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Описание</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {vacancy.description || "Описание не указано."}
          </p>
        </section>

        {skills.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="font-semibold">Навыки</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        {vacancy.qualificationsText ? (
          <section className="flex flex-col gap-3">
            <h3 className="font-semibold">Требования</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {vacancy.qualificationsText}
            </p>
          </section>
        ) : null}

        {benefits.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="font-semibold">Условия</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {benefits.map((benefit) => (
                <li key={benefit}>• {benefit}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {vacancy.url ? (
          <Button asChild className="w-full">
            <a
              href={vacancy.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => onTrackEvent(vacancy, "open_source")}
            >
              Открыть вакансию
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={confirmed ? "secondary" : "outline"}
          className="w-full"
          disabled={confirmed}
          onClick={() => onConfirmApplication(vacancy)}
        >
          <CheckCircle2Icon data-icon="inline-start" />
          {confirmed ? "Отклик отмечен" : "Отметить отправленным"}
        </Button>
      </div>
    </SheetContent>
  );
}

function VacancySkeleton() {
  return (
    <div className="rounded-[22px] border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-3/5" />
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function VacanciesClient() {
  const [items, setItems] = useState<Vacancy[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [filters, setFilters] = useState<VacancyFiltersResponse | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedWorkFormats, setSelectedWorkFormats] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [salaryPresetIndex, setSalaryPresetIndex] = useState(0);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [confirmedVacancyIds, setConfirmedVacancyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const salaryPreset = salaryPresets[salaryPresetIndex] ?? salaryPresets[0];
  const activeFiltersCount =
    selectedCategories.length +
    selectedLevels.length +
    selectedWorkFormats.length +
    selectedLocations.length +
    (salaryPresetIndex === 0 ? 0 : 1);
  const isFiltered = Boolean(query) || activeFiltersCount > 0;

  useEffect(() => {
    const controller = new AbortController();

    fetchJson<VacancyFiltersResponse>("/api/vacancies/filters", {
      signal: controller.signal,
    })
      .then(setFilters)
      .catch(() => {
        if (!controller.signal.aborted) {
          setFilters({
            categories: [],
            levels: [],
            workFormats: [],
            locations: [],
          });
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const params = buildQuery({
          cursor: 0,
          query,
          categories: selectedCategories,
          levels: selectedLevels,
          workFormats: selectedWorkFormats,
          locations: selectedLocations,
          salaryPreset,
        });
        const data = await fetchJson<VacanciesResponse>(
          `/api/vacancies?${params.toString()}`,
          { signal: controller.signal },
        );

        setItems(data.items);
        setTotal(data.total);
        setNextCursor(data.nextCursor);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setTotal(0);
          setNextCursor(null);
          setError("Не удалось загрузить вакансии.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [
    query,
    salaryPreset,
    selectedCategories,
    selectedLevels,
    selectedLocations,
    selectedWorkFormats,
  ]);

  async function loadMore() {
    if (nextCursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const params = buildQuery({
        cursor: nextCursor,
        query,
        categories: selectedCategories,
        levels: selectedLevels,
        workFormats: selectedWorkFormats,
        locations: selectedLocations,
        salaryPreset,
      });
      const data = await fetchJson<VacanciesResponse>(
        `/api/vacancies?${params.toString()}`,
      );

      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Не удалось загрузить следующую страницу.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleSearchSubmit() {
    setQuery(queryInput.trim());
  }

  function resetFilters() {
    startTransition(() => {
      setQuery("");
      setQueryInput("");
      setSelectedCategories([]);
      setSelectedLevels([]);
      setSelectedWorkFormats([]);
      setSelectedLocations([]);
      setSalaryPresetIndex(0);
    });
  }

  function selectVacancy(vacancy: Vacancy, eventType: VacancyEventType) {
    setSelectedVacancy(vacancy);
    void recordVacancyEvent(vacancy.id, eventType);
  }

  function trackVacancyEvent(vacancy: Vacancy, eventType: VacancyEventType) {
    void recordVacancyEvent(vacancy.id, eventType);
  }

  function confirmApplication(vacancy: Vacancy) {
    if (confirmedVacancyIds.has(vacancy.id)) {
      return;
    }

    setConfirmedVacancyIds((current) => {
      const next = new Set(current);
      next.add(vacancy.id);
      return next;
    });
    void recordVacancyEvent(vacancy.id, "application_confirmed");
  }

  function renderFilterPanel() {
    return (
      <FiltersPanel
        filters={filters}
        selectedCategories={selectedCategories}
        selectedLevels={selectedLevels}
        selectedWorkFormats={selectedWorkFormats}
        selectedLocations={selectedLocations}
        salaryPresetIndex={salaryPresetIndex}
        onCategoriesChange={(values) =>
          startTransition(() => setSelectedCategories(values))
        }
        onLevelsChange={(values) =>
          startTransition(() => setSelectedLevels(values))
        }
        onWorkFormatsChange={(values) =>
          startTransition(() => setSelectedWorkFormats(values))
        }
        onLocationsChange={(values) =>
          startTransition(() => setSelectedLocations(values))
        }
        onSalaryPresetChange={(value) =>
          startTransition(() => setSalaryPresetIndex(value))
        }
      />
    );
  }

  return (
    <Sheet
      open={Boolean(selectedVacancy)}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedVacancy(null);
        }
      }}
    >
      <main className="mx-auto grid w-full max-w-none grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:px-8">
        <div className="lg:col-span-2">
          <SearchBar
            value={queryInput}
            onValueChange={setQueryInput}
            onSubmit={handleSearchSubmit}
          />
        </div>

        <aside className="sticky top-[calc(var(--shell-header-height)+1.25rem)] hidden lg:flex">
          {renderFilterPanel()}
        </aside>

        <section className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <SelectedFilterBadges
              filters={filters}
              selectedCategories={selectedCategories}
              selectedLevels={selectedLevels}
              selectedWorkFormats={selectedWorkFormats}
              selectedLocations={selectedLocations}
              onRemoveCategory={(value) =>
                startTransition(() =>
                  setSelectedCategories((current) =>
                    current.filter((item) => item !== value),
                  ),
                )
              }
              onRemoveLevel={(value) =>
                startTransition(() =>
                  setSelectedLevels((current) =>
                    current.filter((item) => item !== value),
                  ),
                )
              }
              onRemoveWorkFormat={(value) =>
                startTransition(() =>
                  setSelectedWorkFormats((current) =>
                    current.filter((item) => item !== value),
                  ),
                )
              }
              onRemoveLocation={(value) =>
                startTransition(() =>
                  setSelectedLocations((current) =>
                    current.filter((item) => item !== value),
                  ),
                )
              }
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {total > 0
                  ? `Найдено вакансий: ${formatCount(total)}`
                  : "Все вакансии"}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MobileFiltersSheet activeFiltersCount={activeFiltersCount}>
                  {renderFilterPanel()}
                </MobileFiltersSheet>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div
            className={cn(
              "flex flex-col gap-4",
              isPending && "opacity-70",
            )}
          >
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <VacancySkeleton key={index} />
                ))
              : items.map((vacancy) => (
                  <VacancyListCard
                      key={vacancy.id}
                      vacancy={vacancy}
                      selected={selectedVacancy?.id === vacancy.id}
                      onSelect={() => selectVacancy(vacancy, "view_detail")}
                      onCoverLetter={() =>
                        selectVacancy(vacancy, "cover_letter_start")
                      }
                    />
                  ))}
          </div>

          {!isLoading && items.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-8 text-center">
              <h2 className="text-lg font-semibold">Вакансии не найдены</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {isFiltered
                  ? "Попробуйте изменить фильтры или поисковый запрос."
                  : "Список вакансий пока пуст."}
              </p>
              {isFiltered ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Сбросить все фильтры"
                  onClick={resetFilters}
                >
                  <RotateCcwIcon />
                  <span className="sr-only">Сбросить все фильтры</span>
                </Button>
              ) : null}
            </div>
          ) : null}

          {nextCursor !== null && !isLoading ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full rounded-xl"
              disabled={isLoadingMore}
              onClick={loadMore}
            >
              {isLoadingMore ? (
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
              ) : null}
              Показать ещё вакансии
            </Button>
          ) : null}
        </section>
      </main>

      <VacancyDetail
        vacancy={selectedVacancy}
        confirmed={
          selectedVacancy ? confirmedVacancyIds.has(selectedVacancy.id) : false
        }
        onTrackEvent={trackVacancyEvent}
        onConfirmApplication={confirmApplication}
      />
    </Sheet>
  );
}
