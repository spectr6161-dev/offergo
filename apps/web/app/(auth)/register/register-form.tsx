"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@offergo/auth/client";
import { getAuthClientErrorMessage } from "@/lib/auth-errors";
import {
  deriveNameFromLogin,
  loginToAuthEmail,
  normalizeLogin,
} from "@/lib/auth-login";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type FieldErrors = {
  login?: string;
  password?: string;
  termsAccepted?: string;
  privacyAccepted?: string;
  cookieAccepted?: string;
};

type StatusState =
  | {
      tone: "default" | "destructive";
      message: string;
    }
  | undefined;

type SocialProvider = "yandex" | "vk";

const socialButtonLabels: Record<SocialProvider, string> = {
  yandex: "Продолжить через Яндекс",
  vk: "Продолжить через VK",
};

function validate(
  login: string,
  password: string,
  termsAccepted: boolean,
  privacyAccepted: boolean,
  cookieAccepted: boolean,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!login.trim()) {
    errors.login = "Введите логин.";
  }

  if (!password) {
    errors.password = "Введите пароль.";
  } else if (password.length < 8) {
    errors.password = "Минимум 8 символов.";
  }

  if (!termsAccepted) {
    errors.termsAccepted = "Подтвердите публичную оферту.";
  }

  if (!privacyAccepted) {
    errors.privacyAccepted =
      "Подтвердите согласие с обработкой персональных данных.";
  }

  if (!cookieAccepted) {
    errors.cookieAccepted = "Подтвердите политику использования cookie.";
  }

  return errors;
}

async function acceptLegalDocuments(source: string) {
  const response = await fetch("/api/legal/consents/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ source }),
  });

  if (!response.ok) {
    throw new Error("Не удалось сохранить юридические согласия.");
  }
}

function getLegalErrors(
  termsAccepted: boolean,
  privacyAccepted: boolean,
  cookieAccepted: boolean,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!termsAccepted) {
    errors.termsAccepted = "Подтвердите публичную оферту.";
  }

  if (!privacyAccepted) {
    errors.privacyAccepted =
      "Подтвердите согласие с обработкой персональных данных.";
  }

  if (!cookieAccepted) {
    errors.cookieAccepted = "Подтвердите политику использования cookie.";
  }

  return errors;
}

function getProviderErrorMessage(provider: SocialProvider) {
  return `Не удалось перейти к регистрации через ${
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

export function RegisterForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cookieAccepted, setCookieAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<StatusState>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(
      login,
      password,
      termsAccepted,
      privacyAccepted,
      cookieAccepted,
    );
    const normalizedLogin = normalizeLogin(login);
    setErrors(nextErrors);
    setStatus(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signUp.email({
        name: deriveNameFromLogin(normalizedLogin),
        email: loginToAuthEmail(normalizedLogin),
        password,
      });

      if (error) {
        setStatus({
          tone: "destructive",
          message: error.message ?? "Не удалось зарегистрироваться.",
        });
        return;
      }

      await acceptLegalDocuments("register_email");
      router.push("/resumes");
      router.refresh();
    } catch (error) {
      setStatus({
        tone: "destructive",
        message: getAuthClientErrorMessage(
          error,
          "Не удалось зарегистрироваться.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialClick(provider: SocialProvider) {
    const nextErrors = getLegalErrors(
      termsAccepted,
      privacyAccepted,
      cookieAccepted,
    );

    setErrors((current) => ({ ...current, ...nextErrors }));
    setStatus(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const callbackURL = new URL(
      "/legal/accept?next=/resumes",
      window.location.origin,
    ).toString();
    const errorCallbackURL = new URL(
      `/register?error=${provider}`,
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
              requestSignUp: true,
            })
          : await authClient.signIn.social({
              provider: "vk",
              callbackURL,
              errorCallbackURL,
              requestSignUp: true,
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
          <FieldLabel htmlFor="register-login" className="sr-only">
            Логин
          </FieldLabel>
          <Input
            id="register-login"
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
          <FieldLabel htmlFor="register-password" className="sr-only">
            Пароль
          </FieldLabel>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

      <FieldGroup className="gap-3">
        <Field
          orientation="horizontal"
          data-invalid={Boolean(errors.termsAccepted)}
          className="items-start gap-3"
        >
          <Checkbox
            id="register-terms"
            checked={termsAccepted}
            aria-invalid={Boolean(errors.termsAccepted)}
            className="mt-1 border-white/18 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            onCheckedChange={(checked) => {
              setTermsAccepted(checked === true);
              if (errors.termsAccepted) {
                setErrors((current) => ({
                  ...current,
                  termsAccepted: undefined,
                }));
              }
            }}
          />
          <FieldContent className="min-w-0 gap-1">
            <FieldLabel
              htmlFor="register-terms"
              className="block w-full min-w-0 text-sm font-normal leading-6 whitespace-normal text-white/78"
            >
              Я принимаю{" "}
              <Link
                href="/legal/offer"
                className="text-white underline underline-offset-4 hover:text-white/80"
                onClick={(event) => event.stopPropagation()}
              >
                публичную оферту
              </Link>
            </FieldLabel>
            <FieldError>{errors.termsAccepted}</FieldError>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          data-invalid={Boolean(errors.privacyAccepted)}
          className="items-start gap-3"
        >
          <Checkbox
            id="register-privacy"
            checked={privacyAccepted}
            aria-invalid={Boolean(errors.privacyAccepted)}
            className="mt-1 border-white/18 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            onCheckedChange={(checked) => {
              setPrivacyAccepted(checked === true);
              if (errors.privacyAccepted) {
                setErrors((current) => ({
                  ...current,
                  privacyAccepted: undefined,
                }));
              }
            }}
          />
          <FieldContent className="min-w-0 gap-1">
            <FieldLabel
              htmlFor="register-privacy"
              className="block w-full min-w-0 text-sm font-normal leading-6 whitespace-normal text-white/78"
            >
              Я согласен с{" "}
              <Link
                href="/legal/personal-data-consent"
                className="text-white underline underline-offset-4 hover:text-white/80"
                onClick={(event) => event.stopPropagation()}
              >
                согласием на обработку персональных данных
              </Link>{" "}
              и{" "}
              <Link
                href="/legal/privacy-policy"
                className="text-white underline underline-offset-4 hover:text-white/80"
                onClick={(event) => event.stopPropagation()}
              >
                политикой обработки персональных данных
              </Link>
            </FieldLabel>
            <FieldError>{errors.privacyAccepted}</FieldError>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          data-invalid={Boolean(errors.cookieAccepted)}
          className="items-start gap-3"
        >
          <Checkbox
            id="register-cookie"
            checked={cookieAccepted}
            aria-invalid={Boolean(errors.cookieAccepted)}
            className="mt-1 border-white/18 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            onCheckedChange={(checked) => {
              setCookieAccepted(checked === true);
              if (errors.cookieAccepted) {
                setErrors((current) => ({
                  ...current,
                  cookieAccepted: undefined,
                }));
              }
            }}
          />
          <FieldContent className="min-w-0 gap-1">
            <FieldLabel
              htmlFor="register-cookie"
              className="block w-full min-w-0 text-sm font-normal leading-6 whitespace-normal text-white/78"
            >
              Я принимаю{" "}
              <Link
                href="/legal/cookie-policy"
                className="text-white underline underline-offset-4 hover:text-white/80"
                onClick={(event) => event.stopPropagation()}
              >
                политику использования cookie
              </Link>
            </FieldLabel>
            <FieldError>{errors.cookieAccepted}</FieldError>
          </FieldContent>
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-[3.1rem] w-full rounded-xl bg-white text-[1.02rem] font-medium text-black shadow-none hover:bg-white/92"
      >
        {isSubmitting ? "Создание аккаунта..." : "Зарегистрироваться"}
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
