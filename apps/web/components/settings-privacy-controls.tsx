"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";

type StatusState =
  | {
      tone: "default" | "destructive";
      title: string;
      message: string;
    }
  | null;

async function createPrivacyRequest(kind: "correct_data" | "restrict_processing") {
  const response = await fetch("/api/legal/privacy-requests", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ kind }),
  });

  if (!response.ok) {
    throw new Error("Не удалось создать запрос. Попробуйте позже.");
  }
}

export function SettingsPrivacyControls() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, setIsPending] = useState(false);

  async function downloadExport() {
    setIsPending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/legal/data-export");

      if (!response.ok) {
        throw new Error("Не удалось подготовить выгрузку данных.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "offergo-personal-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus({
        tone: "destructive",
        title: "Выгрузка недоступна",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подготовить выгрузку данных.",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function submitPrivacyRequest(
    kind: "correct_data" | "restrict_processing",
  ) {
    setIsPending(true);
    setStatus(null);

    try {
      await createPrivacyRequest(kind);
      setStatus({
        tone: "default",
        title: "Запрос создан",
        message: "Мы зафиксировали обращение по персональным данным.",
      });
    } catch (error) {
      setStatus({
        tone: "destructive",
        title: "Запрос не создан",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось создать запрос. Попробуйте позже.",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function deleteAccount() {
    setIsPending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/legal/account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Не удалось удалить аккаунт.");
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      setStatus({
        tone: "destructive",
        title: "Аккаунт не удалён",
        message:
          error instanceof Error ? error.message : "Не удалось удалить аккаунт.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status ? (
        <Alert variant={status.tone}>
          <AlertTitle>{status.title}</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      ) : null}

      <ItemGroup>
        <Item size="xs">
          <ItemContent>
            <ItemTitle>Выгрузить мои данные</ItemTitle>
            <ItemDescription>
              JSON-архив профиля, резюме, платежей, согласий и истории запросов.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={downloadExport}
            >
              <DownloadIcon data-icon="inline-start" />
              Скачать
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item size="xs">
          <ItemContent>
            <ItemTitle>Уточнить или ограничить обработку</ItemTitle>
            <ItemDescription>
              Создайте обращение, если нужно исправить данные или ограничить их
              обработку.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => submitPrivacyRequest("correct_data")}
            >
              Уточнить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => submitPrivacyRequest("restrict_processing")}
            >
              Ограничить
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item size="xs">
          <ItemContent>
            <ItemTitle>Удалить аккаунт</ItemTitle>
            <ItemDescription>
              Аккаунт и связанные пользовательские данные будут удалены или
              обезличены с учётом требований хранения платежных документов.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Удалить
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Действие нельзя отменить. Пользовательские файлы и данные
                    будут удалены из сервиса, если закон не требует хранить их
                    дольше.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount}>
                    Да, удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}
