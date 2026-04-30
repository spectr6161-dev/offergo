import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <AppShell user={user}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        {children}
      </div>
    </AppShell>
  );
}
