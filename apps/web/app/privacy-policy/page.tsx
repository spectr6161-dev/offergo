import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
};

export default function PrivacyPolicyPage() {
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
            Политика обработки персональных данных
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Это базовая страница политики обработки персональных данных. Здесь
            будут размещены цели обработки данных, состав собираемой информации,
            сроки хранения и права пользователя.
          </p>
        </div>

        <div className="flex flex-col gap-5 text-base leading-7 text-foreground/88">
          <p>
            1. Сервис обрабатывает данные, необходимые для регистрации,
            аутентификации, предоставления функций платформы и поддержки
            пользователя.
          </p>
          <p>
            2. Данные не передаются третьим лицам без законных оснований,
            согласия пользователя или необходимости оказания сервиса.
          </p>
          <p>
            3. Пользователь вправе запросить уточнение, удаление или
            ограничение обработки своих персональных данных в пределах,
            предусмотренных законодательством.
          </p>
        </div>
      </div>
    </main>
  );
}
