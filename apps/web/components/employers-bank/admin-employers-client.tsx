"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  EyeOffIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type EmployerCategory = {
  id: string;
  name: string;
  slug: string;
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

type FormState = {
  id?: string;
  name: string;
  website: string;
  status: "published" | "hidden";
  categories: string;
};

const emptyForm: FormState = {
  name: "",
  website: "",
  status: "published",
  categories: "",
};

const pageSize = 50;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function categoryTextToArray(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function createFormFromEmployer(employer: Employer): FormState {
  return {
    id: employer.id,
    name: employer.name,
    website: employer.website ?? "",
    status: employer.status,
    categories: employer.categories.map((category) => category.name).join(", "),
  };
}

export function AdminEmployersClient() {
  const [items, setItems] = useState<Employer[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "hidden">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const dialogTitle = useMemo(
    () => (form?.id ? "Редактировать работодателя" : "Новый работодатель"),
    [form?.id],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          cursor: "0",
          limit: String(pageSize),
          status,
        });

        if (query) {
          params.set("q", query);
        }

        const data = await fetchJson<EmployersResponse>(
          `/api/admin/employers?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        setItems(data.items);
        setTotal(data.total);
        setNextCursor(data.nextCursor);
      } catch {
        if (!controller.signal.aborted) {
          setError("Не удалось загрузить работодателей.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [query, status]);

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
        status,
      });

      if (query) {
        params.set("q", query);
      }

      const data = await fetchJson<EmployersResponse>(
        `/api/admin/employers?${params.toString()}`,
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryInput.trim());
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        website: form.website || null,
        status: form.status,
        categoryNames: categoryTextToArray(form.categories),
      };
      const response = await fetchJson<{ item: Employer }>(
        form.id ? `/api/admin/employers/${form.id}` : "/api/admin/employers",
        {
          method: form.id ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setItems((current) => {
        if (!form.id) {
          return [response.item, ...current];
        }

        return current.map((item) =>
          item.id === response.item.id ? response.item : item,
        );
      });
      setForm(null);
    } catch {
      setError("Не удалось сохранить работодателя.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleHide(employer: Employer) {
    setError(null);

    try {
      await fetch(`/api/admin/employers/${employer.id}`, {
        method: "DELETE",
      });
      setItems((current) =>
        current.map((item) =>
          item.id === employer.id ? { ...item, status: "hidden" } : item,
        ),
      );
    } catch {
      setError("Не удалось скрыть работодателя.");
    }
  }

  return (
    <main className="flex w-full flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Работодатели
            </h1>
            <p className="text-sm text-muted-foreground">
              {total} карточек в текущей выборке
            </p>
          </div>
          <Button type="button" onClick={() => setForm(emptyForm)}>
            <PlusIcon data-icon="inline-start" />
            Добавить работодателя
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={handleSearch}>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Название, сайт или категория"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">
              Найти
            </Button>
          </form>

          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "all" | "published" | "hidden")
            }
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="published">Опубликованы</SelectItem>
                <SelectItem value="hidden">Скрыты</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Компания</TableHead>
              <TableHead>Сайт</TableHead>
              <TableHead>Категории</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-56" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-7 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              : items.map((employer) => (
                  <TableRow key={employer.id}>
                    <TableCell className="max-w-56 whitespace-normal font-medium">
                      {employer.name}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                      {employer.website ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-normal">
                      <div className="flex flex-wrap gap-1.5">
                        {employer.categories.slice(0, 4).map((category) => (
                          <Badge key={category.id} variant="secondary">
                            {category.name}
                          </Badge>
                        ))}
                        {employer.categories.length > 4 ? (
                          <Badge variant="outline">
                            +{employer.categories.length - 4}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          employer.status === "published"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {employer.status === "published"
                          ? "Опубликован"
                          : "Скрыт"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm(createFormFromEmployer(employer))}
                        >
                          <PencilIcon data-icon="inline-start" />
                          Изменить
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={employer.status === "hidden"}
                          onClick={() => handleHide(employer)}
                        >
                          <EyeOffIcon data-icon="inline-start" />
                          Скрыть
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {nextCursor !== null && !isLoading ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isLoadingMore}
          onClick={loadMore}
        >
          {isLoadingMore ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : null}
          Показать ещё
        </Button>
      ) : null}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                Изменения сразу влияют на публичный банк работодателей.
              </DialogDescription>
            </DialogHeader>

            {form ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="employer-name">Название</FieldLabel>
                  <Input
                    id="employer-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employer-website">Сайт</FieldLabel>
                  <Input
                    id="employer-website"
                    placeholder="https://example.com"
                    value={form.website}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? { ...current, website: event.target.value }
                          : current,
                      )
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employer-categories">
                    Категории
                  </FieldLabel>
                  <Textarea
                    id="employer-categories"
                    placeholder="SEO под ключ, Разработка сайтов"
                    value={form.categories}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? { ...current, categories: event.target.value }
                          : current,
                      )
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Статус</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              status: value as "published" | "hidden",
                            }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="published">Опубликован</SelectItem>
                        <SelectItem value="hidden">Скрыт</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm(null)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : null}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
