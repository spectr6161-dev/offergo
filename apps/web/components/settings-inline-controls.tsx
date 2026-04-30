"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@offergo/auth/client";
import {
  LaptopIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const themeOptions = [
  {
    value: "light",
    label: "Светлая",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Тёмная",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "Система",
    icon: LaptopIcon,
  },
] as const;

export function SettingsThemeTiles() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme ?? "system") : "system";

  return (
    <ToggleGroup
      className="grid w-full grid-cols-3 gap-3"
      onValueChange={(value) => {
        if (value) {
          setTheme(value);
        }
      }}
      spacing={0}
      type="single"
      value={currentTheme}
      variant="outline"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleGroupItem
            aria-label={`Включить тему: ${option.label}`}
            className="h-20 flex-col gap-2 rounded-3xl border bg-muted/50 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            key={option.value}
            value={option.value}
          >
            <Icon />
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function SettingsThemeToggleCompact() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme ?? "system") : "system";

  return (
    <ToggleGroup
      className="rounded-full bg-background shadow-sm"
      onValueChange={(value) => {
        if (value) {
          setTheme(value);
        }
      }}
      spacing={0}
      type="single"
      value={currentTheme}
      variant="outline"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleGroupItem
            aria-label={`Включить тему: ${option.label}`}
            className="size-8 rounded-full px-0"
            key={option.value}
            value={option.value}
          >
            <Icon />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function SettingsLogoutIconButton() {
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
    <Button
      aria-label="Выйти из аккаунта"
      disabled={isPending}
      onClick={handleSignOut}
      size="icon"
      type="button"
      variant="outline"
    >
      <LogOutIcon />
    </Button>
  );
}

export function SettingsSecurityTiles() {
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
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        className="h-20 justify-start rounded-3xl px-5 text-base"
        disabled={isPending}
        onClick={handleSignOut}
        type="button"
        variant="outline"
      >
        <LogOutIcon data-icon="inline-start" />
        Выйти
      </Button>
      <Button
        className="h-20 justify-start rounded-3xl px-5 text-base"
        disabled
        type="button"
        variant="destructive"
      >
        <Trash2Icon data-icon="inline-start" />
        Удалить аккаунт
      </Button>
    </div>
  );
}

export function SettingsSecurityTextActions() {
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
    <div className="flex flex-col items-start divide-y rounded-2xl border">
      <Button
        className="h-11 w-full justify-start rounded-none px-0 text-base first:rounded-t-2xl"
        disabled={isPending}
        onClick={handleSignOut}
        type="button"
        variant="ghost"
      >
        <span className="px-4">Выйти из аккаунта</span>
      </Button>
      <Button
        className="h-11 w-full justify-start rounded-none px-0 text-base text-destructive last:rounded-b-2xl"
        disabled
        type="button"
        variant="ghost"
      >
        <span className="px-4">Удалить аккаунт</span>
      </Button>
    </div>
  );
}
