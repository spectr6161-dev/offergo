"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@offergo/auth/client";
import {
  BotIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CircleUserRoundIcon,
  CreditCardIcon,
  FilePlus2Icon,
  FileSearchIcon,
  FileTextIcon,
  GemIcon,
  GitBranchIcon,
  LogInIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
} from "lucide-react";

import { BrandWordmark } from "@/components/brand-wordmark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { WebAppUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  user?: WebAppUser | null;
};

type NavItem = {
  title: string;
  href: string;
  activeOn: string[];
  match?: "exact" | "prefix";
};

type AdminNavItem = NavItem & {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroupItem = NavItem & {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type BreadcrumbEntry = {
  title: string;
  href?: string;
};

const authenticatedNavItems: NavItem[] = [
  {
    title: "Главная",
    href: "/dashboard",
    activeOn: ["/dashboard"],
    match: "exact",
  },
  {
    title: "Тарифы",
    href: "/billing",
    activeOn: ["/billing"],
  },
];

const workNavItems: NavGroupItem[] = [
  {
    title: "Вакансии",
    href: "/vacancies",
    activeOn: ["/vacancies"],
    description: "Поиск вакансий, фильтры и карточки предложений",
    icon: BriefcaseBusinessIcon,
  },
  {
    title: "Банк работодателей",
    href: "/employers-bank",
    activeOn: ["/employers-bank"],
    description: "Компании, категории и быстрый переход к работодателям",
    icon: Building2Icon,
  },
];

const resumeNavItems: NavGroupItem[] = [
  {
    title: "Мои резюме",
    href: "/resumes",
    activeOn: ["/resumes"],
    match: "exact",
    description: "Библиотека файлов, папок и сохранённых анализов",
    icon: FileTextIcon,
  },
  {
    title: "Создать резюме",
    href: "/resumes/create",
    activeOn: ["/resumes/create"],
    description: "Открыть форму нового текстового резюме",
    icon: FilePlus2Icon,
  },
  {
    title: "Анализировать резюме",
    href: "/resumes",
    activeOn: [],
    description: "Открыть страницу результата или запуска анализа",
    icon: FileSearchIcon,
  },
];

const coverMaterialsNavItems: NavGroupItem[] = [
  {
    title: "Индивидуальные отклики",
    href: "/cover-materials/individual-responses",
    activeOn: ["/cover-materials/individual-responses"],
    description: "Персональное сопроводительное письмо под конкретную вакансию",
    icon: FileTextIcon,
  },
  {
    title: "Письма для рассылки",
    href: "/cover-materials/mailing-letters",
    activeOn: ["/cover-materials/mailing-letters"],
    description: "Шаблоны писем для массовой отправки работодателям",
    icon: MailIcon,
  },
  {
    title: "Автоматические отклики",
    href: "/cover-materials/auto-responses",
    activeOn: ["/cover-materials/auto-responses"],
    description: "Сценарии и настройки автоматических откликов",
    icon: BotIcon,
  },
];

const adminNavItems: AdminNavItem[] = [
  {
    title: "AI-песочница",
    href: "/admin/ai-playground",
    activeOn: ["/admin/ai-playground"],
    description: "Проверка моделей и AI-инструментов",
    icon: BotIcon,
  },
  {
    title: "Workflow",
    href: "/admin/workflows",
    activeOn: ["/admin/workflows"],
    description: "Запуски, события и отладка workflow",
    icon: GitBranchIcon,
  },
  {
    title: "Работодатели",
    href: "/admin/employers",
    activeOn: ["/admin/employers"],
    description: "Редактирование карточек банка работодателей",
    icon: Building2Icon,
  },
  {
    title: "Вакансии",
    href: "/admin/vacancies",
    activeOn: ["/admin/vacancies"],
    description: "Редактирование вакансий и статусов публикации",
    icon: BriefcaseBusinessIcon,
  },
];

const staticBreadcrumbs: Record<string, BreadcrumbEntry[]> = {
  "/dashboard": [{ title: "Главная" }],
  "/resumes": [{ title: "Мои резюме" }],
  "/vacancies": [{ title: "Вакансии" }],
  "/employers-bank": [{ title: "Банк работодателей" }],
  "/subscription": [{ title: "Подписка" }],
  "/billing": [{ title: "Тарифы и оплата" }],
  "/settings": [{ title: "Профиль" }],
  "/resume": [{ title: "Анализ резюме" }],
  "/cover-materials/individual-responses": [
    { title: "Сопроводительные материалы" },
    { title: "Индивидуальные отклики" },
  ],
  "/cover-materials/mailing-letters": [
    { title: "Сопроводительные материалы" },
    { title: "Письма для рассылки" },
  ],
  "/cover-materials/auto-responses": [
    { title: "Сопроводительные материалы" },
    { title: "Автоматические отклики" },
  ],
  "/admin/ai-playground": [{ title: "Админ" }, { title: "AI-песочница" }],
  "/admin/workflows": [{ title: "Админ" }, { title: "Workflow" }],
  "/admin/employers": [{ title: "Админ" }, { title: "Работодатели" }],
  "/admin/vacancies": [{ title: "Админ" }, { title: "Вакансии" }],
};

function isRouteActive(pathname: string, item: NavItem) {
  return item.activeOn.some((path) => {
    if (item.match === "exact") {
      return pathname === path;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  if (pathname === "/resumes/create") {
    return [
      { title: "Мои резюме", href: "/resumes" },
      { title: "Создать резюме" },
    ];
  }

  if (pathname.startsWith("/resumes/") && pathname.endsWith("/pdf")) {
    return [
      { title: "Мои резюме", href: "/resumes" },
      { title: "PDF" },
    ];
  }

  if (pathname.startsWith("/resumes/")) {
    return [
      { title: "Мои резюме", href: "/resumes" },
      { title: "Редактор" },
    ];
  }

  if (pathname.startsWith("/billing/payment/")) {
    return [
      { title: "Тарифы и оплата", href: "/billing" },
      { title: "Платёж" },
    ];
  }

  return staticBreadcrumbs[pathname] ?? [{ title: "OfferGO" }];
}

function NavigationGroup({
  title,
  items,
  pathname,
  widthClassName = "w-80",
}: {
  title: string;
  items: NavGroupItem[];
  pathname: string;
  widthClassName?: string;
}) {
  const active = items.some((item) => isRouteActive(pathname, item));

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className={cn(active && "bg-muted text-foreground")}>
        {title}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className={cn("grid gap-1 p-2", widthClassName)}>
          {items.map((item) => {
            const Icon = item.icon;
            const itemActive = isRouteActive(pathname, item);

            return (
              <li key={`${item.title}-${item.href}`}>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    "items-start gap-3 p-3",
                    itemActive && "bg-muted text-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="mt-0.5" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function DesktopNavigation({
  pathname,
  user,
}: {
  pathname: string;
  user?: WebAppUser | null;
}) {
  const showAdmin = user?.roles.includes("admin") ?? false;
  const adminActive = adminNavItems.some((item) => isRouteActive(pathname, item));

  return (
    <NavigationMenu
      viewport={false}
      className="hidden w-full max-w-none flex-1 justify-start lg:flex"
    >
      <NavigationMenuList className="w-full justify-start gap-1">
        {user
          ? authenticatedNavItems.slice(0, 1).map((item) => {
              const active = isRouteActive(pathname, item);

              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                    asChild
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "text-muted-foreground",
                      active && "bg-muted text-foreground"
                    )}
                  >
                    <Link href={item.href}>{item.title}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })
          : null}

        <NavigationGroup title="Работа" items={workNavItems} pathname={pathname} />

        {user ? (
          <>
            <NavigationGroup
              title="Резюме"
              items={resumeNavItems}
              pathname={pathname}
            />
            <NavigationGroup
              title="Сопроводительные материалы"
              items={coverMaterialsNavItems}
              pathname={pathname}
              widthClassName="w-96"
            />
            {authenticatedNavItems.slice(1).map((item) => {
              const active = isRouteActive(pathname, item);

              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                    asChild
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "text-muted-foreground",
                      active && "bg-muted text-foreground"
                    )}
                  >
                    <Link href={item.href}>{item.title}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </>
        ) : null}

        {showAdmin ? (
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(adminActive && "bg-muted text-foreground")}
            >
              Админ
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-72 gap-1 p-2">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(pathname, item);

                  return (
                    <li key={item.href}>
                      <NavigationMenuLink
                        asChild
                        className={cn(
                          "items-start gap-3 p-3",
                          active && "bg-muted text-foreground"
                        )}
                      >
                        <Link href={item.href}>
                          <Icon className="mt-0.5" />
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  );
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ) : null}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  return (
    <SheetClose asChild>
      <Link
        href={item.href}
        className={cn(
          "flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
          isRouteActive(pathname, item) && "bg-muted text-foreground"
        )}
      >
        {item.title}
      </Link>
    </SheetClose>
  );
}

function MobileGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavGroupItem[];
  pathname: string;
}) {
  return (
    <>
      <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      {items.map((item) => (
        <MobileNavLink item={item} key={item.href} pathname={pathname} />
      ))}
    </>
  );
}

function MobileNavigation({
  pathname,
  user,
}: {
  pathname: string;
  user?: WebAppUser | null;
}) {
  const showAdmin = user?.roles.includes("admin") ?? false;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Открыть меню"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-sm gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <BrandWordmark href={user ? "/dashboard" : "/employers-bank"} size="sm" />
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <SheetDescription className="sr-only">
            Основные разделы OfferGO
          </SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-3">
          {user ? (
            <MobileNavLink
              item={authenticatedNavItems[0]}
              pathname={pathname}
            />
          ) : null}
          <MobileGroup title="Работа" items={workNavItems} pathname={pathname} />
          {user ? (
            <>
              <MobileGroup title="Резюме" items={resumeNavItems} pathname={pathname} />
              <MobileGroup
                title="Сопроводительные материалы"
                items={coverMaterialsNavItems}
                pathname={pathname}
              />
              {authenticatedNavItems.slice(1).map((item) => (
                <MobileNavLink item={item} key={item.href} pathname={pathname} />
              ))}
            </>
          ) : null}
          {showAdmin ? (
            <MobileGroup title="Админ" items={adminNavItems} pathname={pathname} />
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function UserMenu({ user }: { user?: WebAppUser | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">
          <LogInIcon data-icon="inline-start" />
          Войти
        </Link>
      </Button>
    );
  }

  const initials = getInitials(user.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-2 rounded-full px-2"
        >
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <CircleUserRoundIcon />
              Профиль
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/subscription">
              <GemIcon />
              Подписка
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/billing">
              <CreditCardIcon />
              Тарифы и оплата
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOutIcon />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppBreadcrumbs({
  pathname,
  user,
}: {
  pathname: string;
  user?: WebAppUser | null;
}) {
  const homeHref = user ? "/dashboard" : "/employers-bank";
  const items = getBreadcrumbs(pathname);
  const showHome = pathname !== homeHref;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showHome ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={homeHref}>Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}

        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <Fragment key={`${item.title}-${index}`}>
              <BreadcrumbItem>
                {item.href && !last ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.title}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.title}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!last ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const homeHref = user ? "/dashboard" : "/employers-bank";

  return (
    <div
      className="min-h-svh bg-background text-foreground"
      style={
        {
          "--header-height": "calc(var(--spacing) * 14)",
          "--breadcrumb-height": "calc(var(--spacing) * 10)",
          "--shell-header-height":
            "calc(var(--header-height) + var(--breadcrumb-height))",
        } as CSSProperties
      }
    >
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-(--header-height) w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          <MobileNavigation pathname={pathname} user={user} />
          <BrandWordmark href={homeHref} size="sm" className="text-foreground" />
          <DesktopNavigation pathname={pathname} user={user} />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu user={user} />
          </div>
        </div>
        <div className="border-t bg-background/80">
          <div className="flex min-h-10 w-full items-center px-4 sm:px-6 lg:px-8">
            <AppBreadcrumbs pathname={pathname} user={user} />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100svh-var(--shell-header-height))]">
        {children}
      </main>
    </div>
  );
}
