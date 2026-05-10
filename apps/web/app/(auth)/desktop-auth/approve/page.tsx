import { redirect } from "next/navigation";
import { getConsentStatus, getCurrentUser } from "@/lib/auth";
import { DesktopAuthApproveClient } from "./desktop-auth-approve-client";

type PageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

export default async function DesktopAuthApprovePage({
  searchParams,
}: PageProps) {
  const { code } = await searchParams;
  const normalizedCode = code?.trim().toUpperCase() ?? "";

  if (!normalizedCode) {
    redirect("/login");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/desktop-auth/approve?code=${normalizedCode}`,
      )}`,
    );
  }

  const consentStatus = await getConsentStatus();

  if (!consentStatus.ok) {
    redirect(
      `/legal/accept?next=${encodeURIComponent(
        `/desktop-auth/approve?code=${normalizedCode}`,
      )}`,
    );
  }

  return (
    <DesktopAuthApproveClient
      code={normalizedCode}
      userEmail={user.email}
    />
  );
}
