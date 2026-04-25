"use client";

import Link from "next/link";
import {
  CircleHelpIcon,
  BotIcon,
  CommandIcon,
  CreditCardIcon,
  DumbbellIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ReceiptTextIcon,
  Settings2Icon,
  UserRoundIcon,
} from "lucide-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { WebAppUser } from "@/lib/auth";

const data = {
  navMain: [
    {
      title: "Дашборд",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Резюме",
      url: "/resume",
      icon: <FileTextIcon />,
    },
    {
      title: "Тренажёр",
      url: "/trainer",
      icon: <DumbbellIcon />,
    },
    {
      title: "Вопросы",
      url: "/questions",
      icon: <ListChecksIcon />,
    },
    {
      title: "Подписка",
      url: "/subscription",
      icon: <ReceiptTextIcon />,
    },
    {
      title: "Тарифы",
      url: "/billing",
      icon: <CreditCardIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Настройки",
      url: "/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Помощь",
      url: "/questions",
      icon: <CircleHelpIcon />,
    },
  ],
  documents: [
    {
      name: "Профиль",
      url: "/settings",
      icon: <UserRoundIcon />,
    },
    {
      name: "Документы",
      url: "/resume",
      icon: <FileTextIcon />,
    },
  ],
};

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: WebAppUser;
}) {
  const navSecondary = user.roles.includes("admin")
    ? [
        {
          title: "AI-песочница",
          url: "/admin/ai-playground",
          icon: <BotIcon />,
        },
        ...data.navSecondary,
      ]
    : data.navSecondary;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">offerGO</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary className="mt-auto" items={navSecondary} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: user.name, email: user.email }} />
      </SidebarFooter>
    </Sidebar>
  );
}
