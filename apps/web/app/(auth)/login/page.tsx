import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7 py-4 sm:px-8 sm:py-5">
        <Link href="/" aria-label="offerGO" className="inline-flex">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 18"
            className="h-[1.15rem] w-[1.15rem] fill-white"
          >
            <path d="M10 0 20 18H0z" />
          </svg>
        </Link>

        <Button
          asChild
          variant="outline"
          className="h-10 rounded-xl border-white/12 bg-[#0a0a0a] px-4 text-sm font-semibold text-white hover:bg-[#111111] hover:text-white"
        >
          <Link href="/register">Создать аккаунт</Link>
        </Button>
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6">
        <div className="w-full max-w-[20.125rem]">
          <h1 className="mb-7 text-center text-[2.05rem] font-semibold tracking-[-0.06em] text-white sm:text-[2.35rem]">
            Войти в аккаунт
          </h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
