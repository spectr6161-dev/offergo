import { PageFrame, SectionCard } from "@offergo/ui";
import { Typography } from "@mui/material";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame title="User detail" description="Placeholder detail route for future support tooling.">
      <SectionCard title={id} subtitle="Static detail placeholder.">
        <Typography variant="body2" color="text.secondary">
          Replace this route with repository-backed user detail once admin logic starts.
        </Typography>
      </SectionCard>
    </PageFrame>
  );
}
