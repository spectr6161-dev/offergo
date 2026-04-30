"use client";

import { useEffect, useState } from "react";
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    label: "Системная",
    icon: LaptopIcon,
  },
] as const;

export function ThemeSettingsCard() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme ?? "system") : "system";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Тема сайта</CardTitle>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          className="flex-wrap"
          onValueChange={(value) => {
            if (value) {
              setTheme(value);
            }
          }}
          spacing={2}
          type="single"
          value={currentTheme}
          variant="outline"
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <ToggleGroupItem
                aria-label={`Включить тему: ${option.label}`}
                className="h-11 gap-2 px-4 text-sm"
                key={option.value}
                value={option.value}
              >
                <Icon data-icon="inline-start" />
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
