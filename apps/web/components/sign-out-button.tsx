"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@offergo/auth/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="sign-out-button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
