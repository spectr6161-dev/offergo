import { PageFrame, SectionCard } from "@offergo/ui";
import { EntitlementsGrid } from "@/components/admin/entitlements-grid";

const rows = [
  {
    id: "sample-entitlement",
    plan: "starter-monthly",
    status: "active",
    window: "2026-04-01 -> 2026-05-01",
  },
];

export default function AdminEntitlementsPage() {
  return (
    <PageFrame title="Entitlements" description="Placeholder MUI X surface for access windows and plan grants.">
      <SectionCard title="Entitlement list" subtitle="Static rows for foundation-only scaffolding.">
        <EntitlementsGrid rows={rows} />
      </SectionCard>
    </PageFrame>
  );
}
