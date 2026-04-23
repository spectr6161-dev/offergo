"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Alert, Stack, TextField } from "@mui/material";
import { authClient } from "@offergo/auth/client";

export function VerifyEmailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ severity: "success" | "info" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    void authClient
      .verifyEmail({
        query: {
          token,
        },
      })
      .then(({ error }) => {
        if (!active) {
          return;
        }

        if (error) {
          setStatus({
            severity: "error",
            message: error.message ?? "Unable to verify email.",
          });
          return;
        }

        setStatus({
          severity: "success",
          message: "Email verified. Redirecting to dashboard...",
        });

        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1200);
      });

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <Stack spacing={2}>
      {status ? <Alert severity={status.severity}>{status.message}</Alert> : null}
      <TextField label="Email to resend verification" value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button
        variant="contained"
        onClick={async () => {
          const { error } = await authClient.sendVerificationEmail({
            email,
            callbackURL: "/dashboard",
          });

          setStatus({
            severity: error ? "error" : "info",
            message: error ? (error.message ?? "Unable to send verification email.") : "Verification email sent.",
          });
        }}
      >
        Resend verification
      </Button>
      <Link href="/login">Back to sign in</Link>
    </Stack>
  );
}
