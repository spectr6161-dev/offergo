import Link from "next/link";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  LifeBuoyIcon,
  MousePointerClickIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { InstallDownloadClient } from "@/components/interview-assistant/install-download-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

function MockInstallImage({ title }: { title: string }) {
  return (
    <div className="mt-3 rounded-2xl bg-muted/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <CheckCircle2Icon />
        {title}
      </div>
      <div className="grid gap-2">
        <div className="h-3 w-2/3 rounded-full bg-background" />
        <div className="h-3 w-5/6 rounded-full bg-background" />
        <div className="h-14 rounded-xl bg-background" />
      </div>
    </div>
  );
}

function InstallStep({
  description,
  icon: Icon,
  isLast,
  title,
}: {
  description: string;
  icon: typeof DownloadIcon;
  isLast?: boolean;
  title: string;
}) {
  return (
    <>
      <Item className="items-start px-0 py-5" variant="default">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="w-full text-base">{title}</ItemTitle>
          <ItemDescription className="line-clamp-none">
            {description}
          </ItemDescription>
          <MockInstallImage title={title} />
        </ItemContent>
      </Item>
      {isLast ? null : <ItemSeparator className="my-0" />}
    </>
  );
}

export default function InterviewAssistantInstallPage() {
  return (
    <main className="min-h-svh w-full bg-background p-4 text-foreground md:p-6">
      <section className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Button asChild className="w-fit" variant="ghost">
            <Link href="/interview-assistant">
              <ArrowLeftIcon data-icon="inline-start" />
              Назад к помощнику
            </Link>
          </Button>
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Установка помощника для Windows
            </h1>
            <p className="max-w-5xl text-base text-muted-foreground md:text-lg">
              Загрузка начнётся автоматически через 10 секунд. Если браузер или
              Windows покажут предупреждение, используйте инструкцию ниже.
            </p>
          </div>
        </div>

        <InstallDownloadClient />

        <Alert>
          <ShieldAlertIcon />
          <AlertTitle>Предупреждение браузера или Windows</AlertTitle>
          <AlertDescription>
            Браузер или Windows SmartScreen могут пометить ZIP как
            “небезопасный”, потому файл новый и ещё не имеет большой истории
            скачиваний. Если файл скачан с offergo.ru, выберите “Сохранить”,
            “Оставить” или “Всё равно выполнить”. Не запускайте файл, если он
            был получен из другого источника.
          </AlertDescription>
        </Alert>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Как установить
            </h2>
            <p className="text-sm text-muted-foreground">
              Четыре шага: скачать архив, распаковать, запустить exe и войти в
              аккаунт.
            </p>
          </div>
          <ItemGroup className="gap-0">
            <InstallStep
              description="Дождитесь автоматической загрузки или нажмите кнопку “Скачать сейчас”. Файл скачивается как ZIP-архив."
              icon={DownloadIcon}
              title="Скачайте ZIP"
            />
            <InstallStep
              description="Откройте архив и распакуйте папку в удобное место. Не запускайте exe прямо из архива."
              icon={ArchiveIcon}
              title="Распакуйте архив"
            />
            <InstallStep
              description="Откройте распакованную папку и нажмите TutorOverlay.Client.exe. Если Windows покажет SmartScreen, откройте подробности и подтвердите запуск."
              icon={MousePointerClickIcon}
              title="Запустите TutorOverlay.Client.exe"
            />
            <InstallStep
              description="Дождитесь окна входа, подключите аккаунт OfferGO и проверьте лимиты в приложении."
              icon={FolderOpenIcon}
              isLast
              title="Дождитесь окна входа"
            />
          </ItemGroup>
        </section>

        <Separator />

        <section className="grid gap-5 lg:grid-cols-2">
          <ItemGroup>
            <Item className="items-start px-0 py-4" variant="default">
              <ItemMedia variant="icon">
                <AlertTriangleIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="w-full">
                  Видимость приложения
                </ItemTitle>
                <ItemDescription className="line-clamp-none">
                  В настройках можно будет включить запуск свернутым, иконку в
                  трее, скрытие окна из панели задач и создание ярлыка на
                  рабочем столе. Маскировка процесса в диспетчере задач не
                  используется.
                </ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>

          <ItemGroup>
            <Item className="items-start px-0 py-4" variant="default">
              <ItemMedia variant="icon">
                <LifeBuoyIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="w-full">Поддержка</ItemTitle>
                <ItemDescription className="line-clamp-none">
                  По вопросам работы программы можно круглосуточно писать в
                  службу технической поддержки @offergo_bot.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button asChild variant="outline">
                  <a
                    href="https://t.me/offergo_bot"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Написать
                    <ExternalLinkIcon data-icon="inline-end" />
                  </a>
                </Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        </section>

        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Использование ограничено лимитами</AlertTitle>
          <AlertDescription>
            Аудиораспознавание, анализ скриншотов и текстовые запросы работают
            в рамках лимитов вашего тарифа. Остатки можно проверить на странице{" "}
            <Link href="/subscription">подписки</Link>, а расширить лимиты — на{" "}
            <Link href="/billing">странице тарифов</Link>.
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
}
