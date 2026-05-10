import { AppShell } from "@/components/app-shell";
import { requireAcceptedLegalDocuments, requireUser } from "@/lib/auth";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await requireAcceptedLegalDocuments();

  return (
    <AppShell user={user}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        {children}
      </div>
    </AppShell>
  );
}
