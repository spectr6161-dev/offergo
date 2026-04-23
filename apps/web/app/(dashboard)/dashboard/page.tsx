import { Stack } from "@mui/material";
import { PageFrame, StatCard } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function DashboardPage() {
  return (
    <PageFrame title="Overview" description="Foundation shell for the new product app. The metrics below are static placeholders until domain services are wired.">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard label="Auth" value="Ready" hint="Better Auth mounted" />
        <StatCard label="Billing" value="Stubbed" hint="Platega adapter and webhook contract" />
        <StatCard label="Queues" value="Ready" hint="BullMQ worker scaffolded" />
      </Stack>
      <FoundationPlaceholder
        title="Application foundation"
        summary="This dashboard confirms the app shell, protected routing, MUI theme, and shared workspace packages."
        next={["Replace static cards with real DB-backed stats", "Add feature flags per module", "Wire product modules incrementally"]}
      />
    </PageFrame>
  );
}
