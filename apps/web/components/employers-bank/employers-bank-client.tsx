"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  BadgeCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  HeartIcon,
  ListFilterIcon,
  Loader2Icon,
  MailPlusIcon,
  MessageCircleIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type EmployerCategory = {
  id: string;
  name: string;
  slug: string;
  employersCount?: number;
};

type Employer = {
  id: string;
  name: string;
  website: string | null;
  status: "published" | "hidden";
  source: string;
  createdAt: string;
  updatedAt: string;
  categories: EmployerCategory[];
};

type EmployersResponse = {
  items: Employer[];
  total: number;
  nextCursor: number | null;
};

type CategoriesResponse = {
  items: EmployerCategory[];
};

type CategoryOption = {
  label: string;
  value: string;
  count?: number;
};

const pageSize = 25;

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

function getHost(website: string | null) {
  if (!website) {
    return "Сайт не указан";
  }

  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

function SelectedCategoryBadges({
  options,
  selectedCategories,
  onRemove,
}: {
  options: CategoryOption[];
  selectedCategories: string[];
  onRemove: (category: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const selectedValues = new Set(selectedCategories);
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.value),
  );
  const visibleOptions = showAll ? selectedOptions : selectedOptions.slice(0, 4);
  const hiddenCount = Math.max(selectedOptions.length - 4, 0);

  useEffect(() => {
    if (selectedOptions.length <= 4 && showAll) {
      setShowAll(false);
    }
  }, [selectedOptions.length, showAll]);

  if (selectedOptions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleOptions.map((option) => (
        <Badge
          key={option.value}
          asChild
          className="h-7 max-w-full cursor-pointer rounded-[6px] bg-blue-50 px-2.5 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        >
          <button
            type="button"
            aria-label={`Убрать категорию ${option.label}`}
            onClick={() => onRemove(option.value)}
          >
            <span className="truncate">{option.label}</span>
            <XIcon data-icon="inline-end" />
          </button>
        </Badge>
      ))}
      {selectedOptions.length > 4 ? (
        <Badge
          asChild
          variant="outline"
          className="h-7 cursor-pointer rounded-[6px] px-2.5 text-sm"
        >
          <button
            type="button"
            aria-expanded={showAll}
            aria-label={
              showAll
                ? "Свернуть выбранные категории"
                : `Показать ещё ${hiddenCount} выбранных категорий`
            }
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Свернуть" : `+${hiddenCount}`}
          </button>
        </Badge>
      ) : null}
    </div>
  );
}

function EmployerSearchBar({
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

function EmployerCategorySelector({
  options,
  selectedCategories,
  onChange,
  className,
  listClassName,
}: {
  options: CategoryOption[];
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  className?: string;
  listClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const selectedValues = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories],
  );

  function toggleCategory(category: string) {
    if (selectedValues.has(category)) {
      onChange(selectedCategories.filter((item) => item !== category));
      return;
    }

    onChange([...selectedCategories, category]);
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "flex min-h-0 flex-col rounded-[8px] border bg-card text-card-foreground shadow-xs",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold tracking-tight">
              Категории
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {selectedCategories.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Очистить выбранные категории"
                onClick={() => onChange([])}
              >
                <Trash2Icon />
              </Button>
            ) : null}
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isOpen ? "Скрыть категории" : "Показать категории"}
              >
                <ChevronDownIcon
                  className={cn(
                    "transition-transform duration-200",
                    !isOpen && "-rotate-90",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
      </div>

      <CollapsibleContent
        className="overflow-hidden data-[state=closed]:animate-[employer-category-collapsible-up_220ms_ease-out] data-[state=open]:animate-[employer-category-collapsible-down_260ms_ease-out]"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-3">
            <SelectedCategoryBadges
              options={options}
              selectedCategories={selectedCategories}
              onRemove={toggleCategory}
            />
          </div>

          <Command className="min-h-0 rounded-none bg-transparent p-0">
            <div className="p-3 pb-2">
              <CommandInput placeholder="Найти категорию..." />
            </div>
            <ScrollArea className={cn("h-[calc(100vh-19rem)]", listClassName)}>
              <CommandList className="max-h-none overflow-visible px-3 pb-3">
                <CommandEmpty>Категории не найдены.</CommandEmpty>
                <CommandGroup className="p-0">
                  {options.map((option) => {
                    const isSelected = selectedValues.has(option.value);

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        aria-checked={isSelected}
                        className="cursor-pointer rounded-[6px] px-2.5 py-2"
                        onSelect={() => toggleCategory(option.value)}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[6px] border",
                            isSelected
                              ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                              : "border-muted-foreground/30 bg-background",
                          )}
                        >
                          {isSelected ? <CheckIcon className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                        {typeof option.count === "number" ? (
                          <Badge
                            variant="outline"
                            className="rounded-[6px] font-mono tabular-nums"
                          >
                            {option.count}
                          </Badge>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MobileCategorySheet({
  options,
  selectedCategories,
  onChange,
}: {
  options: CategoryOption[];
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="lg:hidden">
          <ListFilterIcon data-icon="inline-start" />
          Категории
          {selectedCategories.length > 0 ? (
            <Badge variant="secondary" className="rounded-[6px]">
              {selectedCategories.length}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Категории</SheetTitle>
          <SheetDescription>
            Фильтр работодателей по нескольким категориям
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 p-3">
          <EmployerCategorySelector
            options={options}
            selectedCategories={selectedCategories}
            onChange={onChange}
            className="h-full border-0 shadow-none"
            listClassName="h-[calc(100vh-20rem)]"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmployerCard({ employer }: { employer: Employer }) {
  const primaryCategory = employer.categories[0]?.name ?? "IT-работодатель";
  const visibleCategories = employer.categories.slice(0, 4);
  const hiddenCategoriesCount = Math.max(
    employer.categories.length - visibleCategories.length,
    0,
  );

  return (
    <article className="relative min-h-[256px] rounded-[22px] border bg-card px-5 py-5 text-card-foreground shadow-xs sm:px-6 sm:py-6">
      <div className="absolute top-7 right-6 hidden items-center gap-4 text-muted-foreground sm:flex">
        <Button variant="ghost" size="icon-sm" aria-label="Написать заметку">
          <MessageCircleIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Добавить в избранное"
        >
          <HeartIcon />
        </Button>
      </div>

      <div className="flex min-w-0 flex-col gap-4 pr-0 sm:pr-24">
        <div className="flex flex-col gap-2">
          <h2 className="line-clamp-2 text-[21px] font-semibold leading-tight tracking-tight sm:text-[22px]">
            {employer.name}
          </h2>
          <div>
            <Badge variant="secondary" className="h-6 rounded-md px-2">
              {primaryCategory}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {employer.website ? (
              <a
                className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                href={employer.website}
                rel="noreferrer"
                target="_blank"
              >
                {getHost(employer.website)}
                <BadgeCheckIcon className="size-4 fill-primary text-primary" />
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
              </a>
            ) : (
              <span>{getHost(employer.website)}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
            <span>Источник: Workspace</span>
            <span>·</span>
            <span>{employer.categories.length} категорий</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {visibleCategories.map((category, index) => (
            <span key={category.id} className="inline-flex items-center gap-1">
              {index > 0 ? (
                <span className="text-red-500" aria-hidden="true">
                  ·
                </span>
              ) : null}
              <span>{category.name}</span>
            </span>
          ))}
          {hiddenCategoriesCount > 0 ? (
            <span className="text-muted-foreground">
              и еще {hiddenCategoriesCount}
            </span>
          ) : null}
        </div>

        <div className="pt-1">
          {employer.website ? (
            <Button
              asChild
              size="lg"
              className="h-11 rounded-xl !bg-sidebar-primary px-4 !text-sidebar-primary-foreground shadow-none hover:!bg-sidebar-primary/90 focus-visible:!ring-sidebar-primary/40 [&_svg]:!text-sidebar-primary-foreground"
            >
              <a href={employer.website} rel="noreferrer" target="_blank">
                <MailPlusIcon data-icon="inline-start" />
                Отправить сопроводительное
              </a>
            </Button>
          ) : (
            <Button
              disabled
              size="lg"
              className="h-11 rounded-xl !bg-sidebar-primary/60 px-4 !text-sidebar-primary-foreground shadow-none [&_svg]:!text-sidebar-primary-foreground"
            >
              <MailPlusIcon data-icon="inline-start" />
              Отправить сопроводительное
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function EmployerSkeleton() {
  return (
    <div className="rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
    </div>
  );
}

export function EmployersBankClient() {
  const [categories, setCategories] = useState<EmployerCategory[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryOptions = useMemo<CategoryOption[]>(
    () =>
      [...categories]
        .sort(
          (left, right) =>
            (right.employersCount ?? 0) - (left.employersCount ?? 0) ||
            left.name.localeCompare(right.name, "ru"),
        )
        .map((category) => ({
          label: category.name,
          value: category.slug,
          count: category.employersCount,
        })),
    [categories],
  );

  useEffect(() => {
    let isMounted = true;

    fetchJson<CategoriesResponse>("/api/employers/categories")
      .then((data) => {
        if (isMounted) {
          setCategories(data.items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCategories([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchText]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFirstPage() {
      setIsInitialLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          cursor: "0",
          limit: String(pageSize),
        });

        if (selectedCategories.length > 0) {
          params.set("categories", selectedCategories.join(","));
        }

        if (searchQuery) {
          params.set("q", searchQuery);
        }

        const data = await fetchJson<EmployersResponse>(
          `/api/employers?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        setEmployers(data.items);
        setTotal(data.total);
        setNextCursor(data.nextCursor);
      } catch {
        if (!controller.signal.aborted) {
          setError("Не удалось загрузить работодателей.");
          setEmployers([]);
          setTotal(0);
          setNextCursor(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadFirstPage();

    return () => {
      controller.abort();
    };
  }, [selectedCategories, searchQuery]);

  async function loadMore() {
    if (nextCursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cursor: String(nextCursor),
        limit: String(pageSize),
      });

      if (selectedCategories.length > 0) {
        params.set("categories", selectedCategories.join(","));
      }

      if (searchQuery) {
        params.set("q", searchQuery);
      }

      const data = await fetchJson<EmployersResponse>(
        `/api/employers?${params.toString()}`,
      );

      setEmployers((current) => [...current, ...data.items]);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Не удалось загрузить следующую страницу.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleCategoriesChange(nextCategories: string[]) {
    startTransition(() => {
      setSelectedCategories(nextCategories);
    });
  }

  function handleSearchSubmit() {
    setSearchQuery(searchText.trim());
  }

  return (
    <main className="mx-auto grid w-full max-w-none grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:px-8">
      <div className="lg:col-span-2">
        <EmployerSearchBar
          value={searchText}
          onValueChange={setSearchText}
          onSubmit={handleSearchSubmit}
        />
      </div>

      <EmployerCategorySelector
        options={categoryOptions}
        selectedCategories={selectedCategories}
        onChange={handleCategoriesChange}
        className="sticky top-5 hidden lg:mt-5 lg:flex"
      />

      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <SelectedCategoryBadges
            options={categoryOptions}
            selectedCategories={selectedCategories}
            onRemove={(category) =>
              handleCategoriesChange(
                selectedCategories.filter((item) => item !== category),
              )
            }
          />
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {total > 0
                ? `Найдено работодателей: ${total}`
                : "Банк работодателей"}
            </span>
            <MobileCategorySheet
              options={categoryOptions}
              selectedCategories={selectedCategories}
              onChange={handleCategoriesChange}
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-4", isPending && "opacity-70")}>
          {isInitialLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <EmployerSkeleton key={index} />
              ))
            : employers.map((employer) => (
                <EmployerCard key={employer.id} employer={employer} />
              ))}
        </div>

        {!isInitialLoading && employers.length === 0 ? (
          <div className="rounded-3xl border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">Ничего не найдено</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Попробуйте выбрать другие категории.
            </p>
          </div>
        ) : null}

        {nextCursor !== null && !isInitialLoading ? (
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
            Показать ещё работодателей
          </Button>
        ) : null}
      </section>

    </main>
  );
}
