import { UiResetPage } from "@/components/ui-reset-page";

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <UiResetPage title="Payment detail screen removed" />;
}
