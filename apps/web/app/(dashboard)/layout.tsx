import { requireUser } from "@offergo/auth/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { dashboardNavigation } from "@/lib/navigation";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <DashboardShell title="Product Workspace" subtitle={`${user.name} · ${user.email}`} items={[...dashboardNavigation]}>
      {children}
    </DashboardShell>
  );
}
