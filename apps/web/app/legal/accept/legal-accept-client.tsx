"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

type ConsentDocument = {
  id: string;
  slug: string;
  title: string;
  version: string;
};

export function LegalAcceptClient({
  documents,
  nextPath,
}: {
  documents: ConsentDocument[];
  nextPath: string;
}) {
  const router = useRouter();
  const [acceptedIds, setAcceptedIds] = useState(() => new Set<string>());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allAccepted = useMemo(
    () => documents.every((document) => acceptedIds.has(document.id)),
    [acceptedIds, documents],
  );

  async function submit() {
    if (!allAccepted || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/legal/consents/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source: "web_acceptance",
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось сохранить согласия. Попробуйте ещё раз.");
      }

      router.push(nextPath);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить согласия. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon data-icon="inline-start" />
          <AlertTitle>Согласия не сохранены</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        {documents.map((document) => (
          <Field
            key={document.id}
            orientation="horizontal"
            className="items-start gap-3"
          >
            <Checkbox
              id={`legal-${document.id}`}
              checked={acceptedIds.has(document.id)}
              onCheckedChange={(checked) => {
                setAcceptedIds((current) => {
                  const next = new Set(current);

                  if (checked === true) {
                    next.add(document.id);
                  } else {
                    next.delete(document.id);
                  }

                  return next;
                });
              }}
            />
            <FieldContent className="gap-1">
              <FieldLabel
                htmlFor={`legal-${document.id}`}
                className="font-normal leading-6"
              >
                Я принимаю документ{" "}
                <Link
                  href={`/legal/${document.slug}`}
                  className="font-medium underline underline-offset-4"
                  target="_blank"
                >
                  {document.title}
                </Link>
              </FieldLabel>
              <p className="text-sm text-muted-foreground">
                Версия {document.version}
              </p>
            </FieldContent>
          </Field>
        ))}
      </FieldGroup>

      <Button
        type="button"
        disabled={!allAccepted || isSubmitting}
        onClick={submit}
      >
        {isSubmitting ? "Сохраняем..." : "Принять и продолжить"}
      </Button>
    </div>
  );
}
