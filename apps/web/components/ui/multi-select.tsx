"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  label: string;
  value: string;
  count?: number;
  disabled?: boolean;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  maxCount?: number;
  disabled?: boolean;
  className?: string;
};

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Выберите значения",
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено.",
  maxCount = 3,
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedValues = React.useMemo(() => new Set(value), [value]);
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedValues.has(option.value)),
    [options, selectedValues],
  );
  const enabledOptions = React.useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );
  const allEnabledSelected =
    enabledOptions.length > 0 &&
    enabledOptions.every((option) => selectedValues.has(option.value));

  function toggleOption(optionValue: string) {
    if (selectedValues.has(optionValue)) {
      onValueChange(value.filter((item) => item !== optionValue));
      return;
    }

    onValueChange([...value, optionValue]);
  }

  function clearSelected(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    onValueChange([]);
  }

  function toggleAll() {
    if (allEnabledSelected) {
      onValueChange([]);
      return;
    }

    onValueChange(enabledOptions.map((option) => option.value));
  }

  const visibleSelectedOptions = selectedOptions.slice(0, maxCount);
  const hiddenSelectedCount = Math.max(selectedOptions.length - maxCount, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 w-full justify-between gap-2 rounded-xl px-3 py-2 text-left font-normal",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectedOptions.length === 0 ? (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            ) : (
              <>
                {visibleSelectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="max-w-[12rem] rounded-md bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/15"
                  >
                    <span className="truncate">{option.label}</span>
                  </Badge>
                ))}
                {hiddenSelectedCount > 0 ? (
                  <Badge variant="outline" className="rounded-md">
                    +{hiddenSelectedCount}
                  </Badge>
                ) : null}
              </>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-1">
            {selectedOptions.length > 0 ? (
              <span
                role="button"
                aria-label="Очистить"
                tabIndex={0}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={clearSelected}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    clearSelected();
                  }
                }}
              >
                <XIcon className="size-4" />
              </span>
            ) : null}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                data-checked={allEnabledSelected}
                onSelect={toggleAll}
              >
                <CheckIcon className="size-4 opacity-70" />
                {allEnabledSelected ? "Снять выбор" : "Выбрать все"}
              </CommandItem>
              {selectedOptions.length > 0 ? (
                <CommandItem onSelect={() => onValueChange([])}>
                  <XIcon className="size-4 opacity-70" />
                  Очистить
                </CommandItem>
              ) : null}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    aria-checked={isSelected}
                    disabled={option.disabled}
                    value={option.label}
                    onSelect={() => toggleOption(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {isSelected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {typeof option.count === "number" ? (
                      <span className="mr-6 font-mono text-xs text-muted-foreground tabular-nums">
                        {option.count}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
