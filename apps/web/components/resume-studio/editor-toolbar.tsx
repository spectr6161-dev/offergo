"use client"

import {
  Edit3Icon,
  EyeIcon,
  Maximize2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanLineIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import type { ResumeStudioMode } from "./types"

const fontOptions = ["Times New Roman", "Georgia", "Arial"] as const
const MIN_FONT_SIZE = 13
const MAX_FONT_SIZE = 22
const MIN_ZOOM = 40
const MAX_ZOOM = 220
const ZOOM_STEP = 10

type EditorToolbarProps = {
  fontFamily: string
  fontSize: number
  mode: ResumeStudioMode
  zoom: number
  isFullscreen: boolean
  onFitWidth: () => void
  onFontFamilyChange: (fontFamily: string) => void
  onFontSizeChange: (fontSize: number) => void
  onModeChange: (mode: ResumeStudioMode) => void
  onReset: () => void
  onToggleFullscreen: () => void
  onZoomChange: (zoom: number) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function EditorToolbar({
  fontFamily,
  fontSize,
  mode,
  zoom,
  isFullscreen,
  onFitWidth,
  onFontFamilyChange,
  onFontSizeChange,
  onModeChange,
  onReset,
  onToggleFullscreen,
  onZoomChange,
}: EditorToolbarProps) {
  const decreaseFontSize = () =>
    onFontSizeChange(clamp(fontSize - 1, MIN_FONT_SIZE, MAX_FONT_SIZE))
  const increaseFontSize = () =>
    onFontSizeChange(clamp(fontSize + 1, MIN_FONT_SIZE, MAX_FONT_SIZE))
  const decreaseZoom = () =>
    onZoomChange(clamp(zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))
  const increaseZoom = () =>
    onZoomChange(clamp(zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 text-foreground sm:px-4">
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
        <ToggleGroup
          size="lg"
          type="single"
          value={mode}
          variant="outline"
          onValueChange={(value) => {
            if (value) onModeChange(value as ResumeStudioMode)
          }}
        >
          <ToggleGroupItem aria-label="Review mode" value="review">
            <ScanLineIcon data-icon="inline-start" />
            <span className="hidden md:inline">Review</span>
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Edit mode" value="edit">
            <Edit3Icon data-icon="inline-start" />
            <span className="hidden md:inline">Edit</span>
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Preview mode" value="preview">
            <EyeIcon data-icon="inline-start" />
            <span className="hidden md:inline">Preview</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-3 md:flex">
          <Select value={fontFamily} onValueChange={onFontFamilyChange}>
            <SelectTrigger className="h-9 w-52 text-sm" size="default">
              <SelectValue placeholder="Шрифт" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {fontOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    <span style={{ fontFamily: option }}>{option}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <ButtonGroup>
            <Button
              aria-label="Уменьшить размер шрифта"
              size="icon-lg"
              variant="outline"
              onClick={decreaseFontSize}
            >
              <MinusIcon />
            </Button>
            <ButtonGroupText className="h-9 min-w-14 justify-center text-sm">
              {fontSize}px
            </ButtonGroupText>
            <Button
              aria-label="Увеличить размер шрифта"
              size="icon-lg"
              variant="outline"
              onClick={increaseFontSize}
            >
              <PlusIcon />
            </Button>
          </ButtonGroup>
        </div>

        <ButtonGroup>
          <Button
            aria-label="Уменьшить масштаб"
            size="icon-lg"
            variant="outline"
            onClick={decreaseZoom}
          >
            <MinusIcon />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label="Изменить масштаб"
                className="min-w-16 text-sm"
                size="lg"
                variant="outline"
              >
                {zoom}%
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Масштаб</span>
                  <span className="text-sm text-muted-foreground">{zoom}%</span>
                </div>
                <Slider
                  max={MAX_ZOOM}
                  min={MIN_ZOOM}
                  step={5}
                  value={[zoom]}
                  onValueChange={([value]) => onZoomChange(value)}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button
            aria-label="Увеличить масштаб"
            size="icon-lg"
            variant="outline"
            onClick={increaseZoom}
          >
            <PlusIcon />
          </Button>
        </ButtonGroup>

        <div className="hidden items-center gap-3 lg:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Подогнать по ширине"
                size="icon-lg"
                variant="outline"
                onClick={onFitWidth}
              >
                <PanelLeftIcon />
                <PanelRightIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit width</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Сбросить документ"
                size="icon-lg"
                variant="outline"
                onClick={onReset}
              >
                <RotateCcwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить mock-документ</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={
                  isFullscreen ? "Закрыть fullscreen" : "Открыть fullscreen"
                }
                size="icon-lg"
                variant="outline"
                onClick={onToggleFullscreen}
              >
                <Maximize2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? "Закрыть fullscreen" : "Открыть fullscreen"}
            </TooltipContent>
          </Tooltip>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Дополнительные настройки"
              className="lg:hidden"
              size="icon-lg"
              variant="outline"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Шрифт</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={fontFamily}
              onValueChange={onFontFamilyChange}
            >
              {fontOptions.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  <span style={{ fontFamily: option }}>{option}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Размер текста</DropdownMenuLabel>
            <div className="flex items-center gap-2 px-1.5 py-1">
              <Button
                aria-label="Уменьшить размер шрифта"
                size="icon-lg"
                variant="outline"
                onClick={decreaseFontSize}
              >
                <MinusIcon />
              </Button>
              <div className="min-w-14 text-center text-sm text-muted-foreground">
                {fontSize}px
              </div>
              <Button
                aria-label="Увеличить размер шрифта"
                size="icon-lg"
                variant="outline"
                onClick={increaseFontSize}
              >
                <PlusIcon />
              </Button>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onFitWidth}>
              <PanelLeftIcon data-icon="inline-start" />
              <PanelRightIcon data-icon="inline-start" />
              Подогнать по ширине
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReset}>
              <RotateCcwIcon data-icon="inline-start" />
              Сбросить документ
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleFullscreen}>
              <Maximize2Icon data-icon="inline-start" />
              {isFullscreen ? "Закрыть fullscreen" : "Открыть fullscreen"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
