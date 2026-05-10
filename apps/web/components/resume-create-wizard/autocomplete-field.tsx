"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

type AutocompleteSuggestion = {
  id: string;
  label: string;
  source: string;
  subtitle?: string;
};

type AutocompleteResponse = {
  items?: AutocompleteSuggestion[];
};

export function AutocompleteField({
  endpoint,
  error,
  label,
  onChange,
  placeholder,
  value,
}: {
  endpoint: string;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const inputId = useId();
  const invalid = Boolean(error);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const cacheRef = useRef(new Map<string, AutocompleteSuggestion[]>());
  const normalizedQuery = value.trim();
  const isOpen = focused && normalizedQuery.length >= 2;

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams({ q: normalizedQuery });

    return `${endpoint}?${params.toString()}`;
  }, [endpoint, normalizedQuery]);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(normalizedQuery.toLocaleLowerCase("ru-RU"));

    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetch(searchUrl, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            return { items: [] };
          }

          return (await response.json()) as AutocompleteResponse;
        })
        .then((data) => {
          const nextSuggestions = data.items ?? [];

          cacheRef.current.set(
            normalizedQuery.toLocaleLowerCase("ru-RU"),
            nextSuggestions,
          );
          setSuggestions(nextSuggestions);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string }).name !== "AbortError") {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery, searchUrl]);

  return (
    <Field data-invalid={invalid}>
      <Popover open={isOpen}>
        <PopoverAnchor asChild>
          <Input
            id={inputId}
            aria-invalid={invalid}
            aria-label={label}
            autoComplete="off"
            className="h-14 rounded-xl border-input px-4 text-base shadow-none md:text-base"
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onChange={(event) => {
              setFocused(true);
              onChange(event.target.value);
            }}
            onFocus={() => setFocused(true)}
            placeholder={placeholder ?? label}
            value={value}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {loading ? (
                <div className="flex min-h-12 items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  Ищем подсказки...
                </div>
              ) : null}
              {!loading && suggestions.length === 0 ? (
                <CommandEmpty>Подсказок не найдено</CommandEmpty>
              ) : null}
              {suggestions.length ? (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.source}-${suggestion.id}`}
                      className="min-h-11 items-start px-3 py-2"
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => {
                        onChange(suggestion.label);
                        setFocused(false);
                      }}
                      value={suggestion.label}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-base">{suggestion.label}</span>
                        {suggestion.subtitle ? (
                          <span className="truncate text-sm text-muted-foreground">
                            {suggestion.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
