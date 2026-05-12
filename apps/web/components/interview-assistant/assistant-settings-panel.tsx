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
    description: "Вопросительные слова и прямой запрос ответа.",
  },
  {
    key: "codeTasks",
    title: "Задачи по коду",
    description: "Алгоритмы, ревью кода и реализация.",
  },
  {
    key: "errors",
    title: "Ошибки и логи",
    description: "Stack trace, ошибки сборки и runtime.",
  },
  {
    key: "architecture",
    title: "Архитектура",
    description: "API, модули, trade-off и системный дизайн.",
  },
  {
    key: "behavioral",
    title: "Поведенческие вопросы",
    description: "Опыт, конфликты, коммуникация и процессы.",
  },
  {
    key: "hr",
    title: "HR-вопросы",
    description: "Мотивация, условия, ожидания и зарплата.",
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
    description: "Не реагировать на разговоры без рабочего контекста.",
  },
  {
    key: "personal",
    title: "Личные темы",
    description: "Игнорировать вопросы вне собеседования и работы.",
  },
  {
    key: "repeats",
    title: "Повторы",
    description: "Не отвечать повторно на уже разобранный вопрос.",
  },
  {
    key: "lowConfidence",
    title: "Низкая уверенность",
    description: "Не показывать подсказку при слабом распознавании речи.",
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
    description: "Показывать подсказку без ручного текстового запроса.",
  },
  {
    key: "screenshots",
    title: "Анализ скриншотов",
    description: "Разбирать задачи, код и ошибки по снимку экрана.",
  },
  {
    key: "startMinimized",
    title: "Запускать свернутым",
    description: "После старта приложение сразу уходит в компактный режим.",
  },
  {
    key: "hideTaskbar",
    title: "Скрывать окно из панели задач",
    description: "Окно не занимает место на панели задач.",
  },
  {
    key: "trayIcon",
    title: "Показывать иконку в трее",
    description: "Быстрый доступ через область уведомлений Windows.",
  },
  {
    key: "desktopShortcut",
    title: "Создать ярлык",
    description: "Добавить быстрый запуск на рабочий стол.",
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

function ToggleGroup({
  icon: Icon,
  items,
  title,
  toggles,
  onToggle,
}: {
  icon: typeof BellRingIcon;
  items: Array<{
    key: ToggleKey;
    title: string;
    description: string;
  }>;
  title: string;
  toggles: Record<ToggleKey, boolean>;
  onToggle: (key: ToggleKey, value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 font-medium">
        <Icon />
        {title}
      </div>
      <ItemGroup className="gap-0">
        {items.map((item, index) => (
          <div key={item.key}>
            <ToggleItem
              checked={toggles[item.key]}
              description={item.description}
              onChange={(value) => onToggle(item.key, value)}
              title={item.title}
            />
            {index < items.length - 1 ? (
              <ItemSeparator className="my-0" />
            ) : null}
          </div>
        ))}
      </ItemGroup>
    </div>
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
      <h2 className="text-2xl font-semibold tracking-tight">
        Настройки помощника
      </h2>

      <div className="grid gap-8 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
        <ItemGroup className="gap-0">
          <Item className="px-0 py-4" variant="default">
            <ItemMedia variant="icon">
              <Settings2Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="w-full text-base">
                Профиль помощника
              </ItemTitle>
            </ItemContent>
            <ItemActions className="basis-full sm:basis-72">
              <Select
                onValueChange={(value) => setProfile(value as ProfileKey)}
                value={profile}
              >
                <SelectTrigger className="h-10 w-full">
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
            </ItemActions>
          </Item>
          <ItemSeparator className="my-0" />
          <SliderSetting
            icon={Settings2Icon}
            label="Чувствительность"
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
            label="Задержка"
            max={8}
            min={0}
            onChange={setDelay}
            suffix="сек"
            value={delay}
          />
        </ItemGroup>

        <div className="grid gap-6 lg:grid-cols-2">
          <ToggleGroup
            icon={BellRingIcon}
            items={reactionOptions}
            onToggle={updateToggle}
            title="Реагировать на"
            toggles={toggles}
          />
          <ToggleGroup
            icon={EyeOffIcon}
            items={ignoreOptions}
            onToggle={updateToggle}
            title="Игнорировать"
            toggles={toggles}
          />
          <div className="lg:col-span-2">
            <ToggleGroup
              icon={ScanLineIcon}
              items={behaviorOptions}
              onToggle={updateToggle}
              title="Поведение приложения"
              toggles={toggles}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
