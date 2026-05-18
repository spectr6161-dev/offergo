"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteClientCookie,
  getCookieConsentChoice,
  setCookieConsentChoice,
} from "@/lib/cookie-consent";

const legacyNoticeCookieName = "offergo_cookie_notice";
const optionalCookieNames = ["sidebar_state", legacyNoticeCookieName];

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isKeyboardInputFocused, setIsKeyboardInputFocused] = useState(false);

  useEffect(() => {
    deleteClientCookie(legacyNoticeCookieName);
    setIsVisible(getCookieConsentChoice() === null);
  }, []);

  useEffect(() => {
    function updateKeyboardFocusState() {
      const activeElement = document.activeElement;
      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute("contenteditable") === "true";
      const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;

      setIsKeyboardInputFocused(Boolean(isEditableElement && isMobileViewport));
    }

    window.addEventListener("focusin", updateKeyboardFocusState);
    window.addEventListener("focusout", updateKeyboardFocusState);
    window.addEventListener("resize", updateKeyboardFocusState);

    return () => {
      window.removeEventListener("focusin", updateKeyboardFocusState);
      window.removeEventListener("focusout", updateKeyboardFocusState);
      window.removeEventListener("resize", updateKeyboardFocusState);
    };
  }, []);

  function accept() {
    setCookieConsentChoice("accepted");
    setIsVisible(false);
  }

  function reject() {
    for (const cookieName of optionalCookieNames) {
      deleteClientCookie(cookieName);
    }

    setCookieConsentChoice("rejected");
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={
        isKeyboardInputFocused
          ? "hidden"
          : "fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6"
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-xl border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          Мы используем обязательные cookies для входа, безопасности и работы
          сервиса. Необязательные cookies и похожие технологии используются
          только с вашего согласия. Вы можете отказаться, и мы не будем
          использовать необязательные cookies для этого браузера. Подробнее в{" "}
          <Link
            href="/legal/cookie-policy"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Политике cookie
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={reject}>
            Отказаться
          </Button>
          <Button type="button" onClick={accept}>
            Принять
          </Button>
        </div>
      </div>
    </div>
  );
}
