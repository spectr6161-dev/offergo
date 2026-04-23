import { PageFrame, SectionCard } from "@offergo/ui";
import { Typography } from "@mui/material";

export default async function AdminEntitlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame title="Entitlement detail" description="Placeholder detail route for access troubleshooting.">
      <SectionCard title={id} subtitle="Static detail placeholder.">
        <Typography variant="body2" color="text.secondary">
          Replace this route with access source, expiry, and revoke actions later.
        </Typography>
      </SectionCard>
    </PageFrame>
  );
}
