import { Loader2Icon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardRouteSkeletonVariant =
  | "default"
  | "library"
  | "resume"
  | "settings"
  | "subscription"
  | "billing";

type DashboardRouteSkeletonProps = {
  variant?: DashboardRouteSkeletonVariant;
};

export function DashboardRouteSkeleton({
  variant = "default",
}: DashboardRouteSkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="min-h-[calc(100vh-var(--header-height))] w-full p-4 md:p-6"
    >
      <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="animate-spin" />
        <span>Загрузка страницы</span>
      </div>

      {variant === "library" ? <LibrarySkeleton /> : null}
      {variant === "resume" ? <ResumeStudioSkeleton /> : null}
      {variant === "settings" ? <SettingsSkeleton /> : null}
      {variant === "subscription" ? <SubscriptionSkeleton /> : null}
      {variant === "billing" ? <BillingSkeleton /> : null}
      {variant === "default" ? <DefaultSkeleton /> : null}
    </main>
  );
}

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-36" />
        <div className="hidden flex-1 sm:block" />
        <Skeleton className="hidden h-8 w-40 sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,156px))]">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-[178px] flex-col gap-3 rounded-xl border bg-card p-3"
          >
            <Skeleton
              className={cn(
                "mx-auto h-24 w-20 rounded-sm",
                index % 4 === 0 && "h-16 w-24 rounded-xl"
              )}
            />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeStudioSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-var(--header-height)-3rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <div className="hidden flex-col gap-3 rounded-xl border bg-card p-3 lg:flex">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-lg" />
        ))}
      </div>
      <div className="flex items-start justify-center rounded-xl border bg-muted/40 p-6">
        <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-sm border bg-card p-8 shadow-sm">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-3 rounded-xl border bg-card p-4 lg:flex">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <section className="flex flex-col items-center gap-4">
        <Skeleton className="size-32 rounded-full" />
        <Skeleton className="h-7 w-56" />
      </section>
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-36" />
          <div className="overflow-hidden rounded-lg border">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div
                key={rowIndex}
                className="flex items-center justify-between gap-4 border-b p-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>
      <div className="overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 gap-4 border-b p-4 last:border-b-0"
          >
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex min-h-80 flex-col gap-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="mt-auto flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
