import { UiResetPage } from "@/components/ui-reset-page";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <UiResetPage title="User detail screen removed" />;
}
