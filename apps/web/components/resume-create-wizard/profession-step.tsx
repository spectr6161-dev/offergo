"use client";
import { useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { professionSuggestions, WizardTitle } from "./shared";
export function ProfessionStep({
  value,
  onSelect,
  error,
}: {
  value: string;
  onSelect: (value: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    const normalized = trimmed.toLocaleLowerCase("ru-RU");
    const custom =
      trimmed &&
      !professionSuggestions.some(
        (item) => item.title.toLocaleLowerCase("ru-RU") === normalized,
      )
        ? [
            {
              title: trimmed,
              description: "Использовать как свою IT-профессию",
              keywords: [trimmed],
            },
          ]
        : [];
    const filtered = professionSuggestions.filter(
      (item) =>
        !normalized ||
        item.title.toLocaleLowerCase("ru-RU").includes(normalized) ||
        item.description.toLocaleLowerCase("ru-RU").includes(normalized) ||
        item.keywords.some((keyword) =>
          keyword.toLocaleLowerCase("ru-RU").includes(normalized),
        ),
    );

    return [...custom, ...filtered];
  }, [query]);

  function toggleSuggestion(title: string, selected: boolean) {
    if (selected) {
      onSelect("");
      setQuery("");
      return;
    }

    onSelect(title);
    setQuery(title);
  }

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Выберите или укажите профессию</WizardTitle>
      <div className="flex flex-col gap-3">
        <Field data-invalid={Boolean(error)}>
        <InputGroup className="h-14 rounded-xl border-input bg-background">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            value={query}
            aria-invalid={Boolean(error)}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Профессия, стек или специализация"
            className="text-base md:text-base"
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label="Очистить"
                onClick={() => setQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
          <FieldError>{error}</FieldError>
        </Field>

        <ItemGroup className="gap-3">
          {suggestions.map((suggestion) => {
            const selected =
              suggestion.title.toLocaleLowerCase("ru-RU") ===
              value.trim().toLocaleLowerCase("ru-RU");

            return (
              <Item
                key={suggestion.title}
                role="button"
                tabIndex={0}
                variant="outline"
                onClick={() => toggleSuggestion(suggestion.title, selected)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleSuggestion(suggestion.title, selected);
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-xl border border-input bg-background px-4 py-3 transition hover:border-primary/60 hover:bg-accent/50",
                  selected && "border-primary bg-primary/10 ring-1 ring-primary/40",
                )}
              >
                <ItemContent>
                  <ItemTitle className="text-base">{suggestion.title}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Checkbox
                    checked={selected}
                    tabIndex={-1}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={
                      selected
                        ? `Профессия ${suggestion.title} выбрана`
                        : `Выбрать профессию ${suggestion.title}`
                    }
                    onCheckedChange={() => toggleSuggestion(suggestion.title, selected)}
                  />
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </div>
    </div>
  );
}
