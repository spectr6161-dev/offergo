import { PageFrame, SectionCard } from "@offergo/ui";
import { Typography } from "@mui/material";

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame title="Payment detail" description="Placeholder detail route for billing incident triage.">
      <SectionCard title={id} subtitle="Static detail placeholder.">
        <Typography variant="body2" color="text.secondary">
          Replace this route with provider payload, entitlement links, and audit events later.
        </Typography>
      </SectionCard>
    </PageFrame>
  );
}
