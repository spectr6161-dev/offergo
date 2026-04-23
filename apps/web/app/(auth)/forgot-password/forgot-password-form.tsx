"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@offergo/auth/client";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("root", {
        message: error.message,
      });
      return;
    }

    setValue("email", "");
    setError("root", {
      message: "If the account exists, a reset link has been sent.",
    });
  });

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      {errors.root?.message ? <Alert severity="info">{errors.root.message}</Alert> : null}
      <TextField label="Email" type="email" {...register("email")} error={Boolean(errors.email)} helperText={errors.email?.message} />
      <Button type="submit" variant="contained" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      <Link href="/login">Back to sign in</Link>
    </Stack>
  );
}
