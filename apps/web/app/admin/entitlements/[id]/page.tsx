import { UiResetPage } from "@/components/ui-reset-page";

export default async function AdminEntitlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <UiResetPage title="Entitlement detail screen removed" />;
}
