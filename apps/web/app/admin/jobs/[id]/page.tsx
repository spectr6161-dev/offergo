import { UiResetPage } from "@/components/ui-reset-page";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <UiResetPage title="Job detail screen removed" />;
}
