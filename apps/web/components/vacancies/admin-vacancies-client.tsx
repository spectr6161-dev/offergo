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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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

type Vacancy = {
  id: string;
  externalId: string;
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
  applyButtonLabel: string | null;
  applyDirectKind: string | null;
  description: string;
  skillsText: string | null;
  qualificationsText: string | null;
  benefitsText: string | null;
  url: string | null;
  status: "published" | "hidden";
  updatedAt: string;
};

type VacanciesResponse = {
  items: Vacancy[];
  total: number;
  nextCursor: number | null;
};

type FormState = {
  id?: string;
  externalId: string;
  title: string;
  companyName: string;
  categoryName: string;
  categorySlug: string;
  level: string;
  salaryText: string;
  salaryValue: string;
  salaryCurrency: string;
  workFormat: string;
  location: string;
  datePosted: string;
  employmentType: string;
  directApply: "true" | "false";
  applyButtonLabel: string;
  applyDirectKind: string;
  description: string;
  skillsText: string;
  qualificationsText: string;
  benefitsText: string;
  url: string;
  status: "published" | "hidden";
};

const emptyForm: FormState = {
  externalId: "",
  title: "",
  companyName: "",
  categoryName: "",
  categorySlug: "",
  level: "middle",
  salaryText: "",
  salaryValue: "",
  salaryCurrency: "RUB",
  workFormat: "",
  location: "",
  datePosted: "",
  employmentType: "FULL_TIME",
  directApply: "false",
  applyButtonLabel: "",
  applyDirectKind: "",
  description: "",
  skillsText: "",
  qualificationsText: "",
  benefitsText: "",
  url: "",
  status: "published",
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё_-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

function createFormFromVacancy(vacancy: Vacancy): FormState {
  return {
    id: vacancy.id,
    externalId: vacancy.externalId,
    title: vacancy.title,
    companyName: vacancy.companyName,
    categoryName: vacancy.categoryName,
    categorySlug: vacancy.categorySlug,
    level: vacancy.level,
    salaryText: vacancy.salaryText ?? "",
    salaryValue: vacancy.salaryValue ? String(vacancy.salaryValue) : "",
    salaryCurrency: vacancy.salaryCurrency ?? "RUB",
    workFormat: vacancy.workFormat ?? "",
    location: vacancy.location ?? "",
    datePosted: toDateTimeLocal(vacancy.datePosted),
    employmentType: vacancy.employmentType ?? "FULL_TIME",
    directApply: vacancy.directApply ? "true" : "false",
    applyButtonLabel: vacancy.applyButtonLabel ?? "",
    applyDirectKind: vacancy.applyDirectKind ?? "",
    description: vacancy.description,
    skillsText: vacancy.skillsText ?? "",
    qualificationsText: vacancy.qualificationsText ?? "",
    benefitsText: vacancy.benefitsText ?? "",
    url: vacancy.url ?? "",
    status: vacancy.status,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminVacanciesClient() {
  const [items, setItems] = useState<Vacancy[]>([]);
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
    () => (form?.id ? "Редактировать вакансию" : "Новая вакансия"),
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

        const data = await fetchJson<VacanciesResponse>(
          `/api/admin/vacancies?${params.toString()}`,
          { signal: controller.signal },
        );

        setItems(data.items);
        setTotal(data.total);
        setNextCursor(data.nextCursor);
      } catch {
        if (!controller.signal.aborted) {
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

      const data = await fetchJson<VacanciesResponse>(
        `/api/admin/vacancies?${params.toString()}`,
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
        externalId: form.externalId || undefined,
        title: form.title,
        companyName: form.companyName,
        categoryName: form.categoryName,
        categorySlug: form.categorySlug || slugify(form.categoryName),
        level: form.level,
        salaryText: form.salaryText || null,
        salaryValue: form.salaryValue ? Number.parseInt(form.salaryValue, 10) : null,
        salaryCurrency: form.salaryCurrency || null,
        workFormat: form.workFormat || null,
        location: form.location || null,
        datePosted: form.datePosted ? new Date(form.datePosted).toISOString() : null,
        employmentType: form.employmentType || null,
        directApply: form.directApply === "true",
        applyButtonLabel: form.applyButtonLabel || null,
        applyDirectKind: form.applyDirectKind || null,
        description: form.description,
        skillsText: form.skillsText || null,
        qualificationsText: form.qualificationsText || null,
        benefitsText: form.benefitsText || null,
        url: form.url || null,
        status: form.status,
      };
      const response = await fetchJson<{ item: Vacancy }>(
        form.id ? `/api/admin/vacancies/${form.id}` : "/api/admin/vacancies",
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
      setError("Не удалось сохранить вакансию.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleHide(vacancy: Vacancy) {
    setError(null);

    try {
      await fetch(`/api/admin/vacancies/${vacancy.id}`, {
        method: "DELETE",
      });
      setItems((current) =>
        current.map((item) =>
          item.id === vacancy.id ? { ...item, status: "hidden" } : item,
        ),
      );
    } catch {
      setError("Не удалось скрыть вакансию.");
    }
  }

  return (
    <main className="flex w-full flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Вакансии</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString("ru-RU")} записей в текущей выборке
            </p>
          </div>
          <Button type="button" onClick={() => setForm(emptyForm)}>
            <PlusIcon data-icon="inline-start" />
            Добавить вакансию
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={handleSearch}>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Должность, компания, категория"
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
              <TableHead>Вакансия</TableHead>
              <TableHead>Компания</TableHead>
              <TableHead>Грейд</TableHead>
              <TableHead>Зарплата</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-7 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              : items.map((vacancy) => (
                  <TableRow key={vacancy.id}>
                    <TableCell className="max-w-sm">
                      <div className="truncate font-medium">{vacancy.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {vacancy.categoryName}
                      </div>
                    </TableCell>
                    <TableCell>{vacancy.companyName}</TableCell>
                    <TableCell>{vacancy.level}</TableCell>
                    <TableCell>
                      {vacancy.salaryText ??
                        (vacancy.salaryValue
                          ? `${vacancy.salaryValue.toLocaleString("ru-RU")} ₽`
                          : "не указана")}
                    </TableCell>
                    <TableCell>{formatDate(vacancy.datePosted)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          vacancy.status === "published"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {vacancy.status === "published"
                          ? "Опубликована"
                          : "Скрыта"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setForm(createFormFromVacancy(vacancy))}
                        >
                          <PencilIcon />
                          <span className="sr-only">Редактировать</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={vacancy.status === "hidden"}
                          onClick={() => void handleHide(vacancy)}
                        >
                          <EyeOffIcon />
                          <span className="sr-only">Скрыть</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {nextCursor !== null ? (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          disabled={isLoadingMore}
          onClick={loadMore}
        >
          {isLoadingMore ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : null}
          Загрузить ещё
        </Button>
      ) : null}

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Заполните поля вакансии. Пустые необязательные поля будут очищены.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <form className="flex flex-col gap-5" onSubmit={handleSave}>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="title">Название</FieldLabel>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="companyName">Компания</FieldLabel>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={(event) =>
                      setForm({ ...form, companyName: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="categoryName">Категория</FieldLabel>
                  <Input
                    id="categoryName"
                    value={form.categoryName}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        categoryName: event.target.value,
                        categorySlug:
                          form.categorySlug || slugify(event.target.value),
                      })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="categorySlug">Slug категории</FieldLabel>
                  <Input
                    id="categorySlug"
                    value={form.categorySlug}
                    onChange={(event) =>
                      setForm({ ...form, categorySlug: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="level">Грейд</FieldLabel>
                  <Input
                    id="level"
                    value={form.level}
                    onChange={(event) =>
                      setForm({ ...form, level: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="workFormat">Формат</FieldLabel>
                  <Input
                    id="workFormat"
                    value={form.workFormat}
                    onChange={(event) =>
                      setForm({ ...form, workFormat: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="location">Локация</FieldLabel>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="datePosted">Дата публикации</FieldLabel>
                  <Input
                    id="datePosted"
                    type="datetime-local"
                    value={form.datePosted}
                    onChange={(event) =>
                      setForm({ ...form, datePosted: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="salaryText">Зарплата текстом</FieldLabel>
                  <Input
                    id="salaryText"
                    value={form.salaryText}
                    onChange={(event) =>
                      setForm({ ...form, salaryText: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="salaryValue">Зарплата числом</FieldLabel>
                  <Input
                    id="salaryValue"
                    inputMode="numeric"
                    value={form.salaryValue}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        salaryValue: event.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="salaryCurrency">Валюта</FieldLabel>
                  <Input
                    id="salaryCurrency"
                    value={form.salaryCurrency}
                    onChange={(event) =>
                      setForm({ ...form, salaryCurrency: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employmentType">Тип занятости</FieldLabel>
                  <Input
                    id="employmentType"
                    value={form.employmentType}
                    onChange={(event) =>
                      setForm({ ...form, employmentType: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="directApply">Прямой отклик</FieldLabel>
                  <Select
                    value={form.directApply}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        directApply: value as "true" | "false",
                      })
                    }
                  >
                    <SelectTrigger id="directApply">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="false">Нет</SelectItem>
                        <SelectItem value="true">Да</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="status">Статус</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        status: value as "published" | "hidden",
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="published">Опубликована</SelectItem>
                        <SelectItem value="hidden">Скрыта</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="url">URL</FieldLabel>
                  <Input
                    id="url"
                    value={form.url}
                    onChange={(event) =>
                      setForm({ ...form, url: event.target.value })
                    }
                  />
                </Field>
              </FieldGroup>

              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="applyButtonLabel">Текст кнопки отклика</FieldLabel>
                  <Input
                    id="applyButtonLabel"
                    value={form.applyButtonLabel}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        applyButtonLabel: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="applyDirectKind">Тип прямого отклика</FieldLabel>
                  <Input
                    id="applyDirectKind"
                    value={form.applyDirectKind}
                    onChange={(event) =>
                      setForm({ ...form, applyDirectKind: event.target.value })
                    }
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="description">Описание</FieldLabel>
                  <Textarea
                    id="description"
                    className="min-h-36"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="skillsText">Навыки</FieldLabel>
                  <Textarea
                    id="skillsText"
                    className="min-h-24"
                    value={form.skillsText}
                    onChange={(event) =>
                      setForm({ ...form, skillsText: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="qualificationsText">Требования</FieldLabel>
                  <Textarea
                    id="qualificationsText"
                    className="min-h-24"
                    value={form.qualificationsText}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        qualificationsText: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="benefitsText">Условия</FieldLabel>
                  <Textarea
                    id="benefitsText"
                    className="min-h-24"
                    value={form.benefitsText}
                    onChange={(event) =>
                      setForm({ ...form, benefitsText: event.target.value })
                    }
                  />
                </Field>
              </FieldGroup>

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
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
