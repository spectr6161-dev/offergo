"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@offergo/auth/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: true,
      callbackURL: "/dashboard",
    });

    if (error) {
      setError("root", {
        message: error.message,
      });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  });

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      {errors.root?.message ? <Alert severity="error">{errors.root.message}</Alert> : null}
      <TextField label="Email" type="email" {...register("email")} error={Boolean(errors.email)} helperText={errors.email?.message} />
      <TextField label="Password" type="password" {...register("password")} error={Boolean(errors.password)} helperText={errors.password?.message} />
      <Button type="submit" variant="contained" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Link href="/register">Create account</Link>
        <Link href="/forgot-password">Forgot password</Link>
      </Stack>
    </Stack>
  );
}
