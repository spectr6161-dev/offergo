import { Stack } from "@mui/material";
import { PageFrame, StatCard } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function AdminPage() {
  return (
    <PageFrame title="Admin Overview" description="Backoffice shell anchored in the same Next app with a dedicated access boundary.">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard label="Users" value="Grid ready" />
        <StatCard label="Payments" value="Grid ready" />
        <StatCard label="Jobs" value="Grid ready" />
      </Stack>
      <FoundationPlaceholder
        title="Admin shell"
        summary="Admin navigation and MUI X surfaces are scaffolded with placeholder data. Operational logic and live DB queries come later."
        next={["Replace static grid rows with repositories", "Add support-safe actions", "Expose audit log drill-downs"]}
      />
    </PageFrame>
  );
}
