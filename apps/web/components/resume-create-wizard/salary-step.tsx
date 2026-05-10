"use client";
import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { ResumeBuilderSalary } from "@/components/resume-builder/builder-data";
import { formatAmount, parseAmount } from "./formatters";
import { WizardTitle } from "./shared";
const currencyOptions: Array<{
  value: ResumeBuilderSalary["currency"];
  label: string;
  symbol: string;
}> = [
  { value: "RUB", label: "Рубли", symbol: "₽" },
  { value: "EUR", label: "Евро", symbol: "€" },
  { value: "USD", label: "Доллары", symbol: "$" },
];

export function SalaryStep({
  salary,
  setSalary,
  error,
}: {
  salary: ResumeBuilderSalary;
  setSalary: (next: ResumeBuilderSalary) => void;
  error?: string;
}) {
  const selectedCurrency =
    currencyOptions.find((item) => item.value === salary.currency) ??
    currencyOptions[0];

  return (
    <div className="flex flex-col gap-7">
      <WizardTitle>Укажите желаемую зарплату</WizardTitle>
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <InputGroup className="h-14 rounded-xl bg-background">
            <InputGroupInput
              aria-invalid={Boolean(error)}
              className="h-full px-4 text-xl font-semibold tracking-tight md:text-xl"
              inputMode="numeric"
              placeholder="Сумма"
              value={formatAmount(salary.amount)}
              onChange={(event) =>
                setSalary({
                  ...salary,
                  amount: parseAmount(event.target.value),
                })
              }
            />
            <InputGroupAddon align="inline-end" className="pr-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton
                    className="h-10 min-w-14 justify-center rounded-lg px-3 text-base font-semibold"
                    size="sm"
                  >
                    {selectedCurrency.symbol}
                    <ChevronDownIcon data-icon="inline-end" />
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-36">
                  <DropdownMenuRadioGroup
                    value={salary.currency}
                    onValueChange={(value) =>
                      setSalary({
                        ...salary,
                        currency: value as ResumeBuilderSalary["currency"],
                      })
                    }
                  >
                    {currencyOptions.map((item) => (
                      <DropdownMenuRadioItem key={item.value} value={item.value}>
                        <span className="min-w-4 font-semibold">{item.symbol}</span>
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
          </InputGroup>
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>
    </div>
  );
}
