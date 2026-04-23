import { PageFrame, SectionCard } from "@offergo/ui";
import { PaymentsGrid } from "@/components/admin/payments-grid";

const rows = [
  {
    id: "sample-payment",
    provider: "platega",
    status: "pending",
    amountRub: 1490,
  },
];

export default function AdminPaymentsPage() {
  return (
    <PageFrame title="Payments" description="Placeholder MUI X surface for billing operations.">
      <SectionCard title="Payment list" subtitle="Static rows for foundation-only scaffolding.">
        <PaymentsGrid rows={rows} />
      </SectionCard>
    </PageFrame>
  );
}
