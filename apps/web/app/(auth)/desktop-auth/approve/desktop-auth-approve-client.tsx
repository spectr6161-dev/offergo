"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MonitorCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  code: string;
  userEmail: string;
};

export function DesktopAuthApproveClient({ code, userEmail }: Props) {
  const [status, setStatus] = useState<
    | { tone: "default" | "destructive"; title: string; message: string }
    | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);

  async function approve() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/desktop-auth/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayCode: code }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось подтвердить вход.");
      }

      setApproved(true);
      setStatus({
        tone: "default",
        title: "Вход подтверждён",
        message:
          "Вернитесь в desktop-приложение, оно продолжит вход автоматически.",
      });
    } catch (error) {
      setStatus({
        tone: "destructive",
        title: "Не удалось подтвердить вход",
        message:
          error instanceof Error
            ? error.message
            : "Запрос подтверждения завершился ошибкой.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
            {approved ? (
              <CheckCircle2 className="size-7" />
            ) : (
              <MonitorCheck className="size-7" />
            )}
          </div>
          <CardTitle className="text-2xl">Подтверждение входа</CardTitle>
          <p className="text-sm text-muted-foreground">
            Вы входите в desktop-приложение как {userEmail}.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="rounded-xl border bg-muted/30 px-4 py-5 text-center">
            <div className="text-sm text-muted-foreground">Код устройства</div>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em]">
              {code}
            </div>
          </div>

          {status ? (
            <Alert variant={status.tone}>
              <AlertTitle>{status.title}</AlertTitle>
              <AlertDescription className="break-words">
                {status.message}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 flex-1 bg-sky-600 text-white hover:bg-sky-700"
              disabled={approved || isSubmitting}
              onClick={approve}
            >
              {isSubmitting ? <Loader2 data-icon="inline-start" /> : null}
              Подтвердить вход
            </Button>
            <Button asChild className="h-11 flex-1" variant="outline">
              <Link href="/resumes">В приложение</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
