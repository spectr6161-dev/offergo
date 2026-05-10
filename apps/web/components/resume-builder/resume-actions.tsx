"use client";

import {
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  PrinterIcon,
  Trash2Icon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getExportHref(resumeId: string, format: "docx" | "pdf" | "txt") {
  return `/api/resumes/${resumeId}/builder/export?format=${format}`;
}

type ExportFormat = {
  format: "docx" | "pdf" | "txt";
  label: string;
};

const exportFormats: ExportFormat[] = [
  {
    format: "docx",
    label: "Microsoft Word .docx",
  },
  {
    format: "pdf",
    label: "Adobe Reader .pdf",
  },
  {
    format: "txt",
    label: "Простой текст .txt",
  },
];

export function ResumeActions({ resumeId }: { resumeId: string }) {
  const exportItemClassName =
    "min-h-12 gap-3 px-3 py-2.5 text-base font-medium [&_svg:not([class*='size-'])]:size-5";

  function downloadResume(format: ExportFormat["format"]) {
    window.location.assign(getExportHref(resumeId, format));
  }

  function printResume() {
    const printWindow = window.open(
      `/resumes/${resumeId}/print`,
      "_blank",
      "noopener,noreferrer",
    );

    if (!printWindow) {
      window.location.assign(`/resumes/${resumeId}/print`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2" size="lg" variant="outline">
            По-русски
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Язык резюме</DropdownMenuLabel>
          <DropdownMenuRadioGroup defaultValue="ru">
            <DropdownMenuRadioItem value="ru">По-русски</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Скачать резюме"
          className={buttonVariants({
            className: "[&_svg:not([class*='size-'])]:size-5",
            size: "icon-lg",
            variant: "outline",
          })}
        >
          <DownloadIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Скачать резюме</DropdownMenuLabel>
          <DropdownMenuGroup>
            {exportFormats.map((item) => (
              <DropdownMenuItem
                className={exportItemClassName}
                key={item.format}
                onSelect={() => downloadResume(item.format)}
              >
                <FileTextIcon data-icon="inline-start" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        aria-label="Распечатать резюме"
        onClick={printResume}
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <PrinterIcon />
      </Button>
      <Button
        aria-label="Удалить резюме"
        size="icon-lg"
        type="button"
        variant="destructive"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
