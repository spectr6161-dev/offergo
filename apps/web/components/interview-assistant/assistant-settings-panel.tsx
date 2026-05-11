"use client";

import { useState } from "react";
import {
  BellRingIcon,
  Code2Icon,
  EyeOffIcon,
  ScanLineIcon,
  Settings2Icon,
  TimerIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileKey =
  | "flutter"
  | "react"
  | "backend"
  | "product"
  | "qa"
  | "data"
  | "general";

type ToggleKey =
  | "directQuestions"
  | "codeTasks"
  | "errors"
  | "architecture"
  | "behavioral"
  | "hr"
  | "smallTalk"
  | "personal"
  | "repeats"
  | "lowConfidence"
  | "autoAnswer"
  | "screenshots"
  | "startMinimized"
  | "hideTaskbar"
  | "trayIcon"
  | "desktopShortcut";

const profiles: Array<{
  key: ProfileKey;
  label: string;
}> = [
  { key: "flutter", label: "Flutter / Dart" },
  { key: "react", label: "React / Next.js" },
  { key: "backend", label: "Backend / Node.js" },
  { key: "product", label: "Product / Analyst" },
  { key: "qa", label: "QA Engineer" },
  { key: "data", label: "Data Analyst" },
  { key: "general", label: "Общий помощник" },
];

const reactionOptions: Array<{
  key: ToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "directQuestions",
    title: "Явные вопросы",
    description: "Фразы с вопросительными словами и прямым запросом ответа.",
  },
  {
    key: "codeTasks",
    title: "Задачи по коду",
    description:
      "Алгоритмы, ревью кода, вопросы по реализации и синтаксису.",
  },
  {
    key: "errors",
    title: "Ошибки и логи",
    description: "Stack trace, сообщения компилятора и runtime-ошибки.",
  },
  {
    key: "architecture",
    title: "Архитектура",
    description:
      "Системный дизайн, API, границы модулей и trade-off решения.",
  },
  {
    key: "behavioral",
    title: "Поведенческие вопросы",
    description:
      "Опыт, конфликты, коммуникация, ответственность и процессы.",
  },
  {
    key: "hr",
    title: "HR-вопросы",
    description:
      "Мотивация, ожидания, причины смены работы, условия и зарплата.",
  },
];

const ignoreOptions: Array<{
  key: ToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "smallTalk",
    title: "Small talk",
    description:
      "Не реагировать на приветствия и разговоры без рабочего контекста.",
  },
  {
    key: "personal",
    title: "Личные темы",
    description:
      "Игнорировать вопросы, не относящиеся к собеседованию или работе.",
  },
  {
    key: "repeats",
    title: "Повторы",
    description: "Не отвечать повторно на уже разобранный вопрос.",
  },
  {
    key: "lowConfidence",
    title: "Низкая уверенность распознавания",
    description:
      "Не давать подсказку, если речь распознана неуверенно.",
  },
];

const behaviorOptions: Array<{
  key: ToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "autoAnswer",
    title: "Автоответы",
    description:
      "Показывать подсказку без ручного текстового запроса.",
  },
  {
    key: "screenshots",
    title: "Анализ скриншотов",
    description:
      "Разбирать задачи, код и ошибки по снимку экрана.",
  },
  {
    key: "startMinimized",
    title: "Запускать свернутым",
    description:
      "После старта приложение сразу уходит в компактный режим.",
  },
  {
    key: "hideTaskbar",
    title: "Скрывать окно из панели задач",
    description:
      "Окно не занимает место на панели задач, управление остается в приложении.",
  },
  {
    key: "trayIcon",
    title: "Показывать иконку в трее",
    description:
      "Быстрый доступ к помощнику через область уведомлений Windows.",
  },
  {
    key: "desktopShortcut",
    title: "Создать ярлык на рабочем столе",
    description: "Добавить быстрый запуск после первого входа.",
  },
];

const initialToggles: Record<ToggleKey, boolean> = {
  directQuestions: true,
  codeTasks: true,
  errors: true,
  architecture: true,
  behavioral: true,
  hr: false,
  smallTalk: true,
  personal: true,
  repeats: true,
  lowConfidence: true,
  autoAnswer: true,
  screenshots: true,
  startMinimized: false,
  hideTaskbar: false,
  trayIcon: true,
  desktopShortcut: true,
};

function ToggleItem({
  checked,
  description,
  onChange,
  title,
}: {
  checked: boolean;
  description: string;
  onChange: (value: boolean) => void;
  title: string;
}) {
  return (
    <Item className="px-0 py-3" variant="default">
      <ItemMedia>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(Boolean(value))}
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full">{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function SliderSetting({
  icon: Icon,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  icon: typeof Settings2Icon;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <Item className="px-0 py-4" variant="default">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full justify-between">
          <span>{label}</span>
          <Badge variant="secondary">
            {value} {suffix}
          </Badge>
        </ItemTitle>
        <ItemDescription>
          UI-настройка, сохранение будет добавлено позже.
        </ItemDescription>
      </ItemContent>
      <div className="basis-full pt-2">
        <Slider
          max={max}
          min={min}
          onValueChange={(next) => onChange(next[0] ?? value)}
          step={1}
          value={[value]}
        />
      </div>
    </Item>
  );
}

export function AssistantSettingsPanel() {
  const [profile, setProfile] = useState<ProfileKey>("flutter");
  const [toggles, setToggles] = useState(initialToggles);
  const [sensitivity, setSensitivity] = useState(72);
  const [answerLength, setAnswerLength] = useState(55);
  const [delay, setDelay] = useState(3);

  function updateToggle(key: ToggleKey, value: boolean) {
    setToggles((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Настройки работы помощника
        </h2>
        <p className="text-sm text-muted-foreground">
          Пока это прототип интерфейса. Настройки показывают будущую модель
          управления помощником и не сохраняются на сервере.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList
          className="w-full justify-start overflow-x-auto"
          variant="line"
        >
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="reactions">Реакции</TabsTrigger>
          <TabsTrigger value="behavior">Поведение</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-4" value="profile">
          <Select
            onValueChange={(value) => setProfile(value as ProfileKey)}
            value={profile}
          >
            <SelectTrigger className="h-12 w-full text-base md:max-w-xl">
              <SelectValue placeholder="Выберите профиль" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {profiles.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </TabsContent>

        <TabsContent className="pt-4" value="reactions">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 font-medium">
                <BellRingIcon />
                Реагировать на
              </div>
              <ItemGroup className="gap-0">
                {reactionOptions.map((item, index) => (
                  <div key={item.key}>
                    <ToggleItem
                      checked={toggles[item.key]}
                      description={item.description}
                      onChange={(value) => updateToggle(item.key, value)}
                      title={item.title}
                    />
                    {index < reactionOptions.length - 1 ? (
                      <ItemSeparator className="my-0" />
                    ) : null}
                  </div>
                ))}
              </ItemGroup>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 font-medium">
                <EyeOffIcon />
                Игнорировать
              </div>
              <ItemGroup className="gap-0">
                {ignoreOptions.map((item, index) => (
                  <div key={item.key}>
                    <ToggleItem
                      checked={toggles[item.key]}
                      description={item.description}
                      onChange={(value) => updateToggle(item.key, value)}
                      title={item.title}
                    />
                    {index < ignoreOptions.length - 1 ? (
                      <ItemSeparator className="my-0" />
                    ) : null}
                  </div>
                ))}
              </ItemGroup>
            </div>
          </div>
        </TabsContent>

        <TabsContent className="pt-4" value="behavior">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <ItemGroup className="gap-0">
              <SliderSetting
                icon={Settings2Icon}
                label="Чувствительность автоответа"
                max={100}
                min={10}
                onChange={setSensitivity}
                suffix="%"
                value={sensitivity}
              />
              <ItemSeparator className="my-0" />
              <SliderSetting
                icon={Code2Icon}
                label="Длина ответа"
                max={100}
                min={20}
                onChange={setAnswerLength}
                suffix="%"
                value={answerLength}
              />
              <ItemSeparator className="my-0" />
              <SliderSetting
                icon={TimerIcon}
                label="Задержка перед ответом"
                max={8}
                min={0}
                onChange={setDelay}
                suffix="сек"
                value={delay}
              />
            </ItemGroup>

            <ItemGroup className="gap-0">
              {behaviorOptions.map((item, index) => (
                <div key={item.key}>
                  <ToggleItem
                    checked={toggles[item.key]}
                    description={item.description}
                    onChange={(value) => updateToggle(item.key, value)}
                    title={item.title}
                  />
                  {index < behaviorOptions.length - 1 ? (
                    <ItemSeparator className="my-0" />
                  ) : null}
                </div>
              ))}
              <Item className="mt-3 px-0 py-3" variant="default">
                <ItemMedia variant="icon">
                  <ScanLineIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="w-full">
                    Безопасная видимость окна
                  </ItemTitle>
                  <ItemDescription>
                    Скрытие окна из панели задач не маскирует процесс в системе,
                    а только делает интерфейс менее навязчивым.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline">UI only</Badge>
                </ItemActions>
              </Item>
            </ItemGroup>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
