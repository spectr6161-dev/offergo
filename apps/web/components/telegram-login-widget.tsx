"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const botUsername =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() ?? "";

type TelegramLoginWidgetProps = {
  className?: string;
};

function buildAuthUrl(origin: string) {
  const url = new URL("/api/auth/telegram/callback", origin);
  url.searchParams.set("callbackURL", "/dashboard");
  url.searchParams.set("errorCallbackURL", "/login?error=telegram");
  return url.toString();
}

export function TelegramLoginWidget({ className }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !origin || !botUsername) {
      return;
    }

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", buildAuthUrl(origin));

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [origin]);

  if (!botUsername) {
    return (
      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled
        className={cn(
          "h-[3.1rem] w-full rounded-xl border-white/10 bg-[#090909] text-[1.02rem] font-medium text-white/45 shadow-none",
          className,
        )}
      >
        Продолжить через Telegram
      </Button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-[3.1rem] w-full items-center justify-center overflow-hidden rounded-xl bg-transparent [&>iframe]:origin-center [&>iframe]:scale-[1.24]",
        className,
      )}
    />
  );
}
