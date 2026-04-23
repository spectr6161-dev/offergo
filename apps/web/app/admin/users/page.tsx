import { PageFrame, SectionCard } from "@offergo/ui";
import { UsersGrid } from "@/components/admin/users-grid";

const rows = [
  {
    id: "seed-admin",
    name: "Seed Admin",
    email: "admin@offergo.local",
    roles: "admin",
  },
];

export default function AdminUsersPage() {
  return (
    <PageFrame title="Users" description="Placeholder MUI X surface for user administration.">
      <SectionCard title="User list" subtitle="Static rows for foundation-only scaffolding.">
        <UsersGrid rows={rows} />
      </SectionCard>
    </PageFrame>
  );
}
