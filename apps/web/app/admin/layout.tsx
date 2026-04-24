import { requireAdminUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();
  return children;
}
