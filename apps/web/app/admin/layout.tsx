import { requireRole } from "@offergo/auth/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { adminNavigation } from "@/lib/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin", "support"]);

  return (
    <DashboardShell title="Admin Backoffice" subtitle={`${user.name} · ${user.roles.join(", ")}`} items={[...adminNavigation]}>
      {children}
    </DashboardShell>
  );
}
