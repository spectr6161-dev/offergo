import { AppShell } from "@/components/app-shell";
import { requireAdminUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminUser();

  return (
    <AppShell user={user}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        {children}
      </div>
    </AppShell>
  );
}
