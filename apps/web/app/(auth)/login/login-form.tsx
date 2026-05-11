"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@offergo/auth/client";
import { getAuthClientErrorMessage } from "@/lib/auth-errors";
import { loginToAuthEmail, normalizeLogin } from "@/lib/auth-login";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type LoginFormProps = {
  callbackUrl?: string;
};

type SocialProvider = "yandex" | "vk";

const socialButtonLabels: Record<SocialProvider, string> = {
  yandex: "Продолжить через Яндекс",
  vk: "Продолжить через VK",
};

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

function normalizeCallbackUrl(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/resumes";
  }

  return value;
}

function getProviderErrorMessage(provider: SocialProvider) {
  return `Не удалось перейти ко входу через ${
    provider === "yandex" ? "Яндекс" : "VK"
  }.`;
}

function SocialIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "yandex") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-5 items-center justify-center rounded-full bg-[#fc3f1d] text-xs font-semibold text-white"
      >
        Я
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 items-center justify-center rounded bg-[#0077ff] text-[0.65rem] font-semibold text-white"
    >
      VK
    </span>
  );
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const redirectTo = normalizeCallbackUrl(callbackUrl);
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

      router.push(redirectTo);
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

  async function handleSocialClick(provider: SocialProvider) {
    setStatus(undefined);
    setIsSubmitting(true);

    const callbackURL = new URL(redirectTo, window.location.origin).toString();
    const errorCallbackURL = new URL(
      `/login?error=${provider}`,
      window.location.origin,
    ).toString();
    const fallbackMessage = getProviderErrorMessage(provider);

    try {
      const result =
        provider === "yandex"
          ? await authClient.signIn.oauth2({
              providerId: "yandex",
              callbackURL,
              errorCallbackURL,
              requestSignUp: false,
            })
          : await authClient.signIn.social({
              provider: "vk",
              callbackURL,
              errorCallbackURL,
              requestSignUp: false,
            });

      if (result.error) {
        setStatus({
          tone: "destructive",
          message: result.error.message ?? fallbackMessage,
        });
      }
    } catch (error) {
      setStatus({
        tone: "destructive",
        message: getAuthClientErrorMessage(error, fallbackMessage),
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
        {(["yandex", "vk"] as const).map((provider) => (
          <Button
            key={provider}
            type="button"
            size="lg"
            variant="outline"
            disabled={isSubmitting}
            className="h-[3.1rem] w-full rounded-xl border-white/10 bg-[#090909] text-[1.02rem] font-medium text-white hover:bg-[#111111] hover:text-white"
            onClick={() => void handleSocialClick(provider)}
          >
            <SocialIcon provider={provider} />
            {socialButtonLabels[provider]}
          </Button>
        ))}
      </div>
    </form>
  );
}
