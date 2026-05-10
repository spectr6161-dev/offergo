"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type ResumeBuilderPhotoFile = {
  id: string;
  mimeType: string;
  size: number;
  createdAt: string | Date;
} | null;

export type ResumeBuilderPhotoSettings = {
  positionX: number;
  positionY: number;
  scale: number;
};

type ResumePhotoControlProps = {
  initials: string;
  photoFile: ResumeBuilderPhotoFile;
  photoSettings: ResumeBuilderPhotoSettings;
  resumeId: string;
};

const defaultPhotoSettings: ResumeBuilderPhotoSettings = {
  positionX: 50,
  positionY: 50,
  scale: 1,
};
const maxPhotoSizeBytes = 5 * 1024 * 1024;
const supportedPhotoMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type PhotoApiResponse = {
  photoFile: ResumeBuilderPhotoFile;
  photoSettings: ResumeBuilderPhotoSettings;
};

type DragState = {
  origin: ResumeBuilderPhotoSettings;
  pointerId: number;
  startX: number;
  startY: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePhotoSettings(
  settings: Partial<ResumeBuilderPhotoSettings> | null | undefined,
): ResumeBuilderPhotoSettings {
  return {
    positionX: clampNumber(settings?.positionX ?? 50, 0, 100),
    positionY: clampNumber(settings?.positionY ?? 50, 0, 100),
    scale: clampNumber(settings?.scale ?? 1, 1, 3),
  };
}

function getPhotoImageStyle(settings: ResumeBuilderPhotoSettings): CSSProperties {
  const normalized = normalizePhotoSettings(settings);
  const origin = `${normalized.positionX}% ${normalized.positionY}%`;

  return {
    objectPosition: origin,
    transform: `scale(${normalized.scale})`,
    transformOrigin: origin,
  };
}

async function readApiError(response: Response) {
  const text = await response.text();

  if (!text) {
    return "Не удалось обновить фотографию.";
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string;
      };
      message?: string;
    };

    return parsed.error?.message ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

export function ResumePhotoControl({
  initials,
  photoFile: initialPhotoFile,
  photoSettings: initialPhotoSettings,
  resumeId,
}: ResumePhotoControlProps) {
  const cropRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [photoFile, setPhotoFile] = useState(initialPhotoFile);
  const [photoSettings, setPhotoSettings] = useState(
    normalizePhotoSettings(initialPhotoSettings),
  );
  const [draftSettings, setDraftSettings] = useState(
    normalizePhotoSettings(initialPhotoSettings),
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMovingPhoto, setIsMovingPhoto] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const photoUrl = photoFile
    ? `/api/resumes/${resumeId}/builder/photo?v=${encodeURIComponent(photoFile.id)}`
    : "";
  const previewUrl = selectedPreviewUrl || photoUrl;
  const inputId = `resume-photo-${resumeId}`;

  useEffect(() => {
    setPhotoFile(initialPhotoFile);
  }, [initialPhotoFile]);

  useEffect(() => {
    const normalized = normalizePhotoSettings(initialPhotoSettings);

    setPhotoSettings(normalized);
    setDraftSettings(normalized);
  }, [initialPhotoSettings]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetSelection() {
    setSelectedFile(null);
    setIsDragging(false);
    resetFileInput();
  }

  function resetDraftSettings() {
    setDraftSettings(defaultPhotoSettings);
  }

  function handleDialogOpenChange(open: boolean) {
    setIsDialogOpen(open);

    if (open) {
      setDraftSettings(photoFile ? photoSettings : defaultPhotoSettings);
      return;
    }

    if (!isUpdating) {
      resetSelection();
      setDraftSettings(photoSettings);
    }
  }

  function openFilePicker() {
    if (!isUpdating) {
      inputRef.current?.click();
    }
  }

  function handleSelectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!supportedPhotoMimeTypes.has(file.type)) {
      toast.error("Поддерживаются только JPEG, PNG и WebP.");
      resetFileInput();
      return;
    }

    if (file.size > maxPhotoSizeBytes) {
      toast.error("Фотография должна быть не больше 5 МБ.");
      resetFileInput();
      return;
    }

    setSelectedFile(file);
    setDraftSettings(defaultPhotoSettings);
  }

  async function savePhotoSettings(settings: ResumeBuilderPhotoSettings) {
    const response = await fetch(`/api/resumes/${resumeId}/builder/photo`, {
      body: JSON.stringify(settings),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    return (await response.json()) as PhotoApiResponse;
  }

  async function uploadPhoto() {
    if (!selectedFile) {
      return null;
    }

    const formData = new FormData();
    formData.set("file", selectedFile);

    const response = await fetch(`/api/resumes/${resumeId}/builder/photo`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    return (await response.json()) as PhotoApiResponse;
  }

  async function handleSave() {
    if (isUpdating) {
      return;
    }

    if (!selectedFile && !photoFile) {
      openFilePicker();
      return;
    }

    const nextSettings = normalizePhotoSettings(draftSettings);
    setIsUpdating(true);

    try {
      if (selectedFile) {
        const uploaded = await uploadPhoto();

        setPhotoFile(uploaded?.photoFile ?? null);
      }

      const saved = await savePhotoSettings(nextSettings);

      setPhotoFile(saved.photoFile);
      setPhotoSettings(saved.photoSettings);
      setDraftSettings(saved.photoSettings);
      resetSelection();
      setIsDialogOpen(false);
      toast.success(selectedFile ? "Фотография обновлена." : "Область фотографии сохранена.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось обновить фотографию.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!photoFile || isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/resumes/${resumeId}/builder/photo`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as PhotoApiResponse;

      setPhotoFile(null);
      setPhotoSettings(normalizePhotoSettings(body.photoSettings));
      setDraftSettings(defaultPhotoSettings);
      resetSelection();
      setIsDialogOpen(false);
      toast.success("Фотография удалена.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось удалить фотографию.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!isUpdating) {
      setIsDragging(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isUpdating) {
      return;
    }

    handleSelectFile(event.dataTransfer.files?.[0]);
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openFilePicker();
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!previewUrl || isUpdating) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      origin: draftSettings,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsMovingPhoto(true);
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    const bounds = cropRef.current?.getBoundingClientRect();

    if (!dragState || !bounds || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = ((event.clientX - dragState.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / bounds.height) * 100;
    const scale = Math.max(dragState.origin.scale, 1);

    setDraftSettings({
      ...dragState.origin,
      positionX: clampNumber(dragState.origin.positionX - deltaX / scale, 0, 100),
      positionY: clampNumber(dragState.origin.positionY - deltaY / scale, 0, 100),
    });
  }

  function handleCropPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsMovingPhoto(false);
    }
  }

  const avatarImageStyle = getPhotoImageStyle(photoSettings);
  const previewImageStyle = getPhotoImageStyle(draftSettings);

  return (
    <>
      <div className="relative w-fit">
        <Avatar className="size-24 overflow-hidden rounded-2xl">
          {photoUrl ? (
            <AvatarImage
              alt="Фотография в резюме"
              className="rounded-2xl transition-transform"
              src={photoUrl}
              style={avatarImageStyle}
            />
          ) : null}
          <AvatarFallback className="rounded-2xl text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <Button
          aria-label={
            photoFile ? "Изменить фотографию" : "Добавить фотографию"
          }
          className="absolute -right-2 -bottom-2 rounded-full"
          disabled={isUpdating}
          onClick={() => setIsDialogOpen(true)}
          size="icon"
          type="button"
        >
          {isUpdating ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <PencilIcon />
          )}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-[640px]">
          <DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="text-2xl font-semibold">
              Фото резюме
            </DialogTitle>
            <DialogDescription>
              Загрузите фото и настройте область, которая будет видна в резюме.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="px-5 pb-5 sm:px-6">
            <Field>
              <div
                aria-disabled={isUpdating}
                aria-label="Загрузить фотографию"
                className={cn(
                  "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-6",
                  isDragging && "border-primary bg-primary/5",
                  selectedPreviewUrl && "border-primary bg-primary/5",
                  isUpdating && "cursor-not-allowed opacity-70",
                )}
                onClick={openFilePicker}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={handleDropzoneKeyDown}
                role="button"
                tabIndex={isUpdating ? -1 : 0}
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                  <ImageIcon />
                </div>

                <div className="flex max-w-sm flex-col gap-1">
                  <p className="text-base font-medium">
                    Перетащите фото сюда или выберите файл
                  </p>
                  <FieldDescription className="text-center">
                    JPG, PNG, WebP до 5 МБ
                  </FieldDescription>
                </div>

                <Button
                  disabled={isUpdating}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                  type="button"
                  variant="secondary"
                >
                  <UploadIcon data-icon="inline-start" />
                  Выбрать фото
                </Button>
              </div>

              <Input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id={inputId}
                onChange={(event) => handleSelectFile(event.target.files?.[0])}
                ref={inputRef}
                type="file"
              />
            </Field>

            {previewUrl ? (
              <Field className="items-center">
                <div
                  className={cn(
                    "relative size-56 touch-none overflow-hidden rounded-2xl bg-muted ring-1 ring-border sm:size-64",
                    isMovingPhoto && "cursor-grabbing",
                    !isMovingPhoto && "cursor-grab",
                  )}
                  onPointerCancel={handleCropPointerEnd}
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerEnd}
                  ref={cropRef}
                >
                  <img
                    alt="Настройка области фотографии"
                    className="size-full select-none object-cover transition-transform"
                    draggable={false}
                    src={previewUrl}
                    style={previewImageStyle}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-background/80 ring-inset" />
                </div>

                <div className="flex w-full max-w-md flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <FieldDescription>Масштаб</FieldDescription>
                    <span className="text-sm text-muted-foreground">
                      {draftSettings.scale.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    max={3}
                    min={1}
                    onValueChange={(value) => {
                      setDraftSettings((current) => ({
                        ...current,
                        scale: value[0] ?? 1,
                      }));
                    }}
                    step={0.1}
                    value={[draftSettings.scale]}
                  />
                  <Button
                    className="w-fit"
                    disabled={isUpdating}
                    onClick={resetDraftSettings}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Сбросить область
                  </Button>
                </div>
              </Field>
            ) : null}
          </FieldGroup>

          <DialogFooter className="m-0 flex-col gap-2 rounded-b-xl border-t bg-muted/50 p-5 sm:flex-row sm:justify-between sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              {photoFile ? (
                <Button
                  disabled={isUpdating}
                  onClick={() => void handleDelete()}
                  type="button"
                  variant="destructive"
                >
                  <Trash2Icon data-icon="inline-start" />
                  Удалить фото
                </Button>
              ) : null}
              {selectedFile ? (
                <Button
                  disabled={isUpdating}
                  onClick={resetSelection}
                  type="button"
                  variant="outline"
                >
                  Отменить выбор
                </Button>
              ) : null}
            </div>

            <Button
              disabled={isUpdating || (!selectedFile && !photoFile)}
              onClick={() => void handleSave()}
              type="button"
            >
              {isUpdating ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {selectedFile ? "Сохранить фото" : "Сохранить область"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
