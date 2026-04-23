"use client";

import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import { authClient } from "@offergo/auth/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="outlined"
      color="inherit"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
