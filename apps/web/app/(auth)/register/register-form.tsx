"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@offergo/auth/client";

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
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
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/dashboard",
    });

    if (error) {
      setError("root", {
        message: error.message,
      });
      return;
    }

    router.push("/verify-email");
    router.refresh();
  });

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      {errors.root?.message ? <Alert severity="error">{errors.root.message}</Alert> : null}
      <TextField label="Full name" {...register("name")} error={Boolean(errors.name)} helperText={errors.name?.message} />
      <TextField label="Email" type="email" {...register("email")} error={Boolean(errors.email)} helperText={errors.email?.message} />
      <TextField label="Password" type="password" {...register("password")} error={Boolean(errors.password)} helperText={errors.password?.message} />
      <TextField
        label="Confirm password"
        type="password"
        {...register("confirmPassword")}
        error={Boolean(errors.confirmPassword)}
        helperText={errors.confirmPassword?.message}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create account"}
      </Button>
      <Link href="/login">Already have an account?</Link>
    </Stack>
  );
}
