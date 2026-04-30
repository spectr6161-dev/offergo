import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        {children}
      </div>
    </AppShell>
  );
}
