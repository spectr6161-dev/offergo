import { requireUser } from "@/lib/auth";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}
