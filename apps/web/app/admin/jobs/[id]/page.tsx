import { PageFrame, SectionCard } from "@offergo/ui";
import { Typography } from "@mui/material";

export default async function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame title="Job detail" description="Placeholder detail route for worker diagnostics.">
      <SectionCard title={id} subtitle="Static detail placeholder.">
        <Typography variant="body2" color="text.secondary">
          Replace this route with attempts, payload, result, and retry controls later.
        </Typography>
      </SectionCard>
    </PageFrame>
  );
}
