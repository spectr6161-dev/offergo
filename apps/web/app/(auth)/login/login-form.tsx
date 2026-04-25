"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@offergo/auth/client";
import { getAuthClientErrorMessage } from "@/lib/auth-errors";
import { loginToAuthEmail, normalizeLogin } from "@/lib/auth-login";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type FieldErrors = {
  login?: string;
  password?: string;
};

type StatusState =
  | {
      tone: "default" | "destructive";
      message: string;
    }
  | undefined;

function validate(login: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!login.trim()) {
    errors.login = "Введите логин.";
  }

  if (!password) {
    errors.password = "Введите пароль.";
  }

  return errors;
}

export function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<StatusState>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(login, password);
    const normalizedLogin = normalizeLogin(login);
    setErrors(nextErrors);
    setStatus(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email: loginToAuthEmail(normalizedLogin),
        password,
      });

      if (error) {
        setStatus({
          tone: "destructive",
          message: error.message ?? "Не удалось войти.",
        });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setStatus({
        tone: "destructive",
        message: getAuthClientErrorMessage(error, "Не удалось войти."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleClick() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/dashboard", window.location.origin).toString(),
        errorCallbackURL: new URL(
          "/login?error=google",
          window.location.origin,
        ).toString(),
      });

      if (error) {
        setStatus({
          tone: "destructive",
          message: error.message ?? "Не удалось перейти ко входу через Google.",
        });
      }
    } catch (error) {
      setStatus({
        tone: "destructive",
        message: getAuthClientErrorMessage(
          error,
          "Не удалось перейти ко входу через Google.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {status ? (
        <Alert
          variant={status.tone}
          className="rounded-xl border-white/10 bg-[#090909] px-4 py-3 text-white shadow-none"
        >
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup className="gap-3.5">
        <Field data-invalid={Boolean(errors.login)}>
          <FieldLabel htmlFor="login-email" className="sr-only">
            Логин
          </FieldLabel>
          <Input
            id="login-email"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="Логин"
            value={login}
            aria-label="Логин"
            aria-invalid={Boolean(errors.login)}
            className="h-[3.25rem] rounded-xl border-white/10 bg-[#090909] px-4 text-[1.02rem] text-white shadow-none placeholder:text-white/38 focus-visible:border-white/20 focus-visible:ring-white/5"
            onChange={(event) => {
              setLogin(event.target.value);
              if (errors.login) {
                setErrors((current) => ({ ...current, login: undefined }));
              }
            }}
          />
          <FieldError>{errors.login}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="login-password" className="sr-only">
            Пароль
          </FieldLabel>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Пароль"
              value={password}
              aria-label="Пароль"
              aria-invalid={Boolean(errors.password)}
              className="h-[3.25rem] rounded-xl border-white/10 bg-[#090909] px-4 pr-14 text-[1.02rem] text-white shadow-none placeholder:text-white/38 focus-visible:border-white/20 focus-visible:ring-white/5"
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) {
                  setErrors((current) => ({ ...current, password: undefined }));
                }
              }}
            />
            <button
              type="button"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-white/42 transition-colors hover:text-white/70"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <FieldError>{errors.password}</FieldError>
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-[3.1rem] w-full rounded-xl bg-white text-[1.02rem] font-medium text-black shadow-none hover:bg-white/92"
      >
        {isSubmitting ? "Вход..." : "Войти"}
      </Button>

      <div className="flex items-center gap-3 py-3 text-sm font-medium text-white/38">
        <Separator className="flex-1 bg-white/10" />
        <span>или</span>
        <Separator className="flex-1 bg-white/10" />
      </div>

      <div className="flex flex-col gap-3">
        <TelegramLoginWidget />

        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={isSubmitting}
          className="h-[3.1rem] w-full rounded-xl border-white/10 bg-[#090909] text-[1.02rem] font-medium text-white hover:bg-[#111111] hover:text-white"
          onClick={handleGoogleClick}
        >
          <Image
            src="/brands/google.svg"
            alt=""
            width={20}
            height={20}
            data-icon="inline-start"
            className="size-5"
          />
          Продолжить через Google
        </Button>
      </div>
    </form>
  );
}
