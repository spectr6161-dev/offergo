import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="min-h-svh bg-background p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Аккаунт</p>
          <h1 className="text-3xl font-semibold tracking-tight">Профиль</h1>
          <p className="max-w-2xl text-muted-foreground">
            Тестовый экран для проверки защищённого маршрута и данных текущей
            сессии.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Данные сессии</CardTitle>
              <CardDescription>
                Эти значения приходят из backend `/api/v1/auth/me`.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-1">
                <span className="text-muted-foreground">ID пользователя</span>
                <span className="font-mono text-xs">{user.id}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground">Логин / email</span>
                <span>{user.email}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground">Роли</span>
                <span>{user.roles.join(", ")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
