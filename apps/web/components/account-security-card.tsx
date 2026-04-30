"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@offergo/auth/client";
import { LogOutIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AccountSecurityCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(() => {
      void authClient
        .signOut()
        .then(() => {
          router.push("/login");
          router.refresh();
        })
        .catch(() => {
          toast.error("Не удалось выйти из аккаунта.");
        });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Безопасность</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          className="justify-start"
          disabled={isPending}
          onClick={handleSignOut}
          type="button"
          variant="outline"
        >
          <LogOutIcon data-icon="inline-start" />
          Выйти из аккаунта
        </Button>
        <Button
          className="justify-start"
          disabled
          type="button"
          variant="destructive"
        >
          <Trash2Icon data-icon="inline-start" />
          Удалить аккаунт
        </Button>
      </CardContent>
    </Card>
  );
}
