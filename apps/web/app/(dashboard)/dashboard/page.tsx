import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  OffergoDashboardClient,
  type DashboardSummary,
} from "@/components/dashboard/offergo-dashboard-client";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

export default async function DashboardPage() {
  try {
    const summary = await apiFetch<DashboardSummary>("/api/v1/dashboard/summary");

    return <OffergoDashboardClient summary={summary} />;
  } catch (error) {
    return (
      <main className="flex w-full px-4 py-6 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить главную страницу</AlertTitle>
          <AlertDescription>{getApiErrorMessage(error)}</AlertDescription>
        </Alert>
      </main>
    );
  }
}
