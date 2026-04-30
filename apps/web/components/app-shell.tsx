"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@offergo/auth/client";
import {
  BotIcon,
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
  UserRoundIcon,
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
import { cn } from "@/lib/utils";
import type { WebAppUser } from "@/lib/auth";

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

const publicNavItems: NavItem[] = [
  {
    title: "Вакансии",
    href: "/vacancies",
    activeOn: ["/vacancies"],
  },
  {
    title: "Банк работодателей",
    href: "/employers-bank",
    activeOn: ["/employers-bank"],
  },
];

const authenticatedNavItems: NavItem[] = [
  ...publicNavItems,
  {
    title: "Подписка",
    href: "/subscription",
    activeOn: ["/subscription"],
  },
  {
    title: "Тарифы",
    href: "/billing",
    activeOn: ["/billing"],
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
    description: "Персональные сопроводительные материалы под конкретную вакансию",
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
];

const staticBreadcrumbs: Record<string, BreadcrumbEntry[]> = {
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
  "/admin/ai-playground": [
    { title: "Админ" },
    { title: "AI-песочница" },
  ],
  "/admin/workflows": [{ title: "Админ" }, { title: "Workflow" }],
  "/admin/employers": [{ title: "Админ" }, { title: "Работодатели" }],
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

function DesktopNavigation({
  pathname,
  user,
}: {
  pathname: string;
  user?: WebAppUser | null;
}) {
  const navItems = user ? authenticatedNavItems : publicNavItems;
  const showAdmin = user?.roles.includes("admin") ?? false;
  const resumeActive = pathname === "/resumes" || pathname.startsWith("/resumes/");
  const coverMaterialsActive = pathname.startsWith("/cover-materials/");
  const adminActive = adminNavItems.some((item) =>
    isRouteActive(pathname, item)
  );

  return (
    <NavigationMenu
      viewport={false}
      className="hidden flex-1 justify-start lg:flex"
    >
      <NavigationMenuList className="justify-start gap-1">
        {user ? (
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(resumeActive && "bg-muted text-foreground")}
            >
              Резюме
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-80 gap-1 p-2">
                {resumeNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(pathname, item);

                  return (
                    <li key={`${item.title}-${item.href}`}>
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

        {user ? (
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(coverMaterialsActive && "bg-muted text-foreground")}
            >
              Сопроводительные материалы
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-96 gap-1 p-2">
                {coverMaterialsNavItems.map((item) => {
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

        {navItems.map((item) => {
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

function MobileNavigation({
  pathname,
  user,
}: {
  pathname: string;
  user?: WebAppUser | null;
}) {
  const navItems = user ? authenticatedNavItems : publicNavItems;
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
          <BrandWordmark href={user ? "/resumes" : "/employers-bank"} size="sm" />
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <SheetDescription className="sr-only">
            Основные разделы OfferGO
          </SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-3">
          {user ? (
            <>
              <div className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                Резюме
              </div>
              {resumeNavItems.map((item) => (
                <SheetClose asChild key={`${item.title}-${item.href}`}>
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
              ))}
            </>
          ) : null}

          {user ? (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">
                Сопроводительные материалы
              </div>
              {coverMaterialsNavItems.map((item) => (
                <SheetClose asChild key={item.href}>
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
              ))}
            </>
          ) : null}

          {navItems.map((item) => (
            <SheetClose asChild key={item.href}>
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
          ))}

          {showAdmin ? (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">
                Админ
              </div>
              {adminNavItems.map((item) => (
                <SheetClose asChild key={item.href}>
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
              ))}
            </>
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
  const homeHref = user ? "/resumes" : "/employers-bank";
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
  const homeHref = user ? "/resumes" : "/employers-bank";

  return (
    <div
      className="min-h-svh bg-background text-foreground"
      style={
        {
          "--header-height": "calc(var(--spacing) * 14)",
        } as CSSProperties
      }
    >
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-(--header-height) w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <MobileNavigation pathname={pathname} user={user} />
          <BrandWordmark href={homeHref} size="sm" className="text-foreground" />
          <DesktopNavigation pathname={pathname} user={user} />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu user={user} />
          </div>
        </div>
        <div className="border-t bg-background/80">
          <div className="mx-auto flex min-h-10 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <AppBreadcrumbs pathname={pathname} user={user} />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-var(--header-height))]">
        {children}
      </main>
    </div>
  );
}
