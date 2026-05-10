import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-black text-white">
      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <BrandWordmark href="/" size="sm" />

        <Button
          asChild
          variant="outline"
          className="h-10 rounded-xl border-white/12 bg-[#0a0a0a] px-4 text-sm font-semibold text-white hover:bg-[#111111] hover:text-white"
        >
          <Link href="/login">Войти</Link>
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-start px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center sm:pt-12 sm:pb-12">
        <div className="w-full max-w-[20.125rem]">
          <h1 className="mb-7 text-center text-[2.05rem] font-semibold tracking-[-0.06em] text-white sm:text-[2.35rem]">
            Создать аккаунт
          </h1>
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
