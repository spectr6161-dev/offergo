"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@offergo/auth/client";

const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setError("root", {
        message: "Missing token in query string.",
      });
      return;
    }

    const { error } = await authClient.resetPassword({
      token,
      newPassword: values.password,
    });

    if (error) {
      setError("root", {
        message: error.message,
      });
      return;
    }

    router.push("/login");
    router.refresh();
  });

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      {errors.root?.message ? <Alert severity="error">{errors.root.message}</Alert> : null}
      <TextField label="New password" type="password" {...register("password")} error={Boolean(errors.password)} helperText={errors.password?.message} />
      <TextField
        label="Confirm password"
        type="password"
        {...register("confirmPassword")}
        error={Boolean(errors.confirmPassword)}
        helperText={errors.confirmPassword?.message}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Update password"}
      </Button>
      <Link href="/login">Back to sign in</Link>
    </Stack>
  );
}
