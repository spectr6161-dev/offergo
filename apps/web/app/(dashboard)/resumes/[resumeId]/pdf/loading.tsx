import { Skeleton } from "@/components/ui/skeleton";

export default function ResumePdfLoading() {
  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-5 w-64 max-w-[45vw]" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-muted/30 px-3 py-6 sm:px-6">
        <Skeleton className="mx-auto aspect-[210/297] h-full max-h-[920px] w-full max-w-3xl rounded-sm" />
      </div>
    </div>
  );
}
