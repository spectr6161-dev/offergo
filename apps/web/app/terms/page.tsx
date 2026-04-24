import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Правила пользования сервисом",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Link
          href="/register"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Назад к регистрации
        </Link>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Правила пользования сервисом
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Это базовая страница правил пользования сервисом. Здесь будут
            размещены условия доступа к платформе, правила использования
            аккаунта, ограничения ответственности и порядок разрешения споров.
          </p>
        </div>

        <div className="flex flex-col gap-5 text-base leading-7 text-foreground/88">
          <p>
            1. Пользователь обязан предоставлять достоверные данные при
            регистрации и не передавать доступ к аккаунту третьим лицам.
          </p>
          <p>
            2. Использование сервиса должно соответствовать законодательству и
            назначению платформы.
          </p>
          <p>
            3. Администратор сервиса вправе обновлять правила, уведомляя
            пользователей через опубликованную редакцию документа.
          </p>
        </div>
      </div>
    </main>
  );
}
