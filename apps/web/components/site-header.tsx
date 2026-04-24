"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/dashboard": "Панель управления",
  "/resume": "Резюме",
  "/trainer": "Тренажёр",
  "/questions": "Вопросы",
  "/subscription": "Подписка",
  "/billing": "Тарифы и оплата",
  "/settings": "Профиль",
};

function getTitle(pathname: string) {
  if (pathname.startsWith("/billing/payment/")) {
    return "Оплата";
  }

  return titles[pathname] ?? "Панель управления";
}

export function SiteHeader() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mx-2 data-[orientation=vertical]:h-4"
          orientation="vertical"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
    </header>
  );
}
