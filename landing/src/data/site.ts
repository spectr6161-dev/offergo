export const brand = {
  name: "offerGO",
  tagline: "Скрытый AI-ассистент для live-ситуаций",
  telegramUrl: "https://t.me/offer_go",
  supportEmail: "support@offergo.ru",
  windowsInstallerUrl: "https://offergo.ru/downloads/offergo-interview-assistant.zip",
  windowsInstallerFileName: "offergo-interview-assistant.zip",
  downloadInfoUrl: "/promo/download",
  downloadUrl: "/promo/download",
  installerUrl: "https://offergo.ru/downloads/offergo-interview-assistant.zip",
  loginUrl: "https://offergo.ru/login",
  apiBaseUrl: import.meta.env.PUBLIC_API_BASE_URL || "https://offergo.ru/api/v1",
};

export const navigation = [
  { label: "Возможности", href: "/promo/#features" },
  { label: "Вопросы", href: "/promo/questions" },
];

export type PlatformLogoItem = {
  id: string;
  name: string;
  assetPath: string;
  alt: string;
  row: 1 | 2 | 3;
  logoTone?: "brand" | "light";
};

export type CapabilityItem = {
  step: string;
  title: string;
  subtitle: string;
  text: string;
  visualType:
    | "capture-shield"
    | "dual-audio"
    | "speed-pipeline"
    | "screenshot-flow"
    | "price-compare";
  layout: "wide" | "tall" | "medium" | "wide-price";
};

export type HeroContent = {
  badge: string;
  titleMain: string;
  titleAccent: string;
  description: string;
  microcopy: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  modules: Array<{
    icon: string;
    label: string;
    title: string;
    detail: string;
  }>;
};

export type PricingSectionPlan = {
  title: string;
  price?: string;
  period?: string;
  description: string;
  features?: string[];
  ctaLabel: string;
};

export const hero: HeroContent = {
  badge: "Web App + Desktop + Mobile",
  titleMain: "Платформа для собеседований",
  titleAccent: "до оффера, а не до стресса",
  description:
    "Один offerGO объединяет веб-инструменты для резюме и банка вопросов, desktop overlay для live-интервью и мобильные тренировки перед реальным звонком.",
  microcopy: "15 минут бесплатно • 999 ₽ в месяц после демо • Web, Desktop и Mobile в одной системе",
  primaryCtaLabel: "Попробовать бесплатно",
  primaryCtaHref: "https://offergo.ru/register",
  secondaryCtaLabel: "Скачать для Windows",
  secondaryCtaHref: "https://offergo.ru/downloads/offergo-interview-assistant.zip",
  modules: [
    {
      icon: "🌐",
      label: "Web App",
      title: "Резюме, банк вопросов и отклики",
      detail: "Подготовка к интервью, оптимизация резюме, вопросы по компаниям и ручная работа с вакансиями.",
    },
    {
      icon: "🖥",
      label: "Windows / macOS",
      title: "Live-подсказки в overlay",
      detail: "Десктопный клиент для живого собеседования, подсказок в реальном времени и работы со скриншотом.",
    },
    {
      icon: "📱",
      label: "Android / iOS",
      title: "Тренировки перед интервью",
      detail: "Зубрёжка вопросов, тренировки с ИИ-ментором и быстрый доступ к web-инструментам с телефона.",
    },
    {
      icon: "⚡",
      label: "Free demo",
      title: "Быстрый старт без оплаты",
      detail: "Проверка сценария, демо-режим на 15 минут и подключение своей базы знаний перед переходом на тариф.",
    },
  ],
};

export const platforms: PlatformLogoItem[] = [
  {
    id: "google-meet",
    name: "Google Meet",
    assetPath: "/promo/brands/google-meet.png",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Google Meet",
    row: 1,
  },
  {
    id: "zoom",
    name: "Zoom",
    assetPath: "/promo/brands/zoom.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Zoom",
    row: 1,
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    assetPath: "/promo/brands/microsoft-teams.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Microsoft Teams",
    row: 1,
  },
  {
    id: "salute-jazz",
    name: "Salute Jazz",
    assetPath: "/promo/brands/salute-jazz.png",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Salute Jazz",
    row: 1,
  },
  {
    id: "vk-calls",
    name: "VK Calls",
    assetPath: "/promo/brands/vk-calls.ico",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F VK Calls",
    row: 2,
  },
  {
    id: "yandex-telemost",
    name: "\u042F\u043D\u0434\u0435\u043A\u0441 \u0422\u0435\u043B\u0435\u043C\u043E\u0441\u0442",
    assetPath: "/promo/brands/yandex-telemost.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F \u042F\u043D\u0434\u0435\u043A\u0441 \u0422\u0435\u043B\u0435\u043C\u043E\u0441\u0442",
    row: 2,
  },
  {
    id: "discord",
    name: "Discord",
    assetPath: "/promo/brands/discord.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Discord",
    row: 2,
  },
  {
    id: "webex",
    name: "Cisco Webex",
    assetPath: "/promo/brands/webex.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Cisco Webex",
    row: 2,
  },
  {
    id: "whereby",
    name: "Whereby",
    assetPath: "/promo/brands/whereby.ico",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Whereby",
    row: 3,
  },
  {
    id: "wb-stream",
    name: "WB Stream",
    assetPath: "/promo/brands/wb-stream.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F WB Stream",
    row: 2,
  },
  {
    id: "dion",
    name: "DION",
    assetPath: "/promo/brands/dion.ico",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F DION",
    row: 3,
  },
  {
    id: "chime",
    name: "Chime",
    assetPath: "/promo/brands/chime.ico",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Chime",
    row: 2,
  },
  {
    id: "jitsi",
    name: "Jitsi",
    assetPath: "/promo/brands/jitsi.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F Jitsi",
    row: 3,
    logoTone: "light",
  },
  {
    id: "kontur-talk",
    name: "\u041A\u043E\u043D\u0442\u0443\u0440 \u0422\u043E\u043B\u043A",
    assetPath: "/promo/brands/kontur-talk.png",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F \u041A\u043E\u043D\u0442\u0443\u0440 \u0422\u043E\u043B\u043A",
    row: 3,
  },
  {
    id: "pachca",
    name: "\u041F\u0430\u0447\u043A\u0430",
    assetPath: "/promo/brands/pachca.svg",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F \u041F\u0430\u0447\u043A\u0430",
    row: 3,
  },
];

export const capabilities: CapabilityItem[] = [
  {
    step: "01",
    title: "Невидим на демонстрации",
    subtitle: "",
    text: "Программа работает поверх системы и не видна при демонстрации экрана, ваш собеседник без предупреждения не узнает о ней.",
    visualType: "capture-shield",
    layout: "wide",
  },
  {
    step: "02",
    title: "Слышит вас и собеседника",
    subtitle: "Понимает, кто говорит, и ловит сам вопрос",
    text: "Клиент захватывает входящий и исходящий звук, распознаёт речь в live-режиме и поддерживает разные языки. Приоритет — поймать вопрос, а не утонуть в стенограмме.",
    visualType: "dual-audio",
    layout: "tall",
  },
  {
    step: "03",
    title: "Отвечает быстро",
    subtitle: "Не думает лишнего, а быстро даёт суть",
    text: "Пайплайн собран под подсказку в реальном времени: минимум лишних шагов, короткий ответ и формулировка, которую можно сразу озвучить.",
    visualType: "speed-pipeline",
    layout: "medium",
  },
  {
    step: "04",
    title: "Решает по скриншоту",
    subtitle: "Задача на экране -> ответ в overlay",
    text: "Можно снять весь экран или только область. Изображение уходит в анализ вместе с контекстом, а ответ возвращается в ту же ленту подсказок.",
    visualType: "screenshot-flow",
    layout: "medium",
  },
  {
    step: "05",
    title: "Стоит в 2–3 раза дешевле рынка",
    subtitle: "Ровно 1 000 ₽ в месяц",
    text: "Конкуренты берут 2–3 тысячи рублей за тот же базовый сценарий. offerGO стоит 1 000 ₽ в месяц и не режет ключевой функционал.",
    visualType: "price-compare",
    layout: "wide-price",
  },
];

export const pricing = [
  {
    name: "Beta",
    price: "0 ₽",
    period: "на время пилота",
    description: "Для первых пользователей, которые помогают докрутить продукт.",
    features: ["Windows-клиент", "Live-подсказки", "Скриншоты в AI", "Telegram-поддержка"],
    cta: "Получить beta-доступ",
    ctaHref: brand.windowsInstallerUrl,
    ctaDownload: true,
    highlighted: false,
  },
  {
    name: "Personal",
    price: "1 000 ₽",
    period: "в месяц",
    description: "Основной тариф без ограничений для звонков, скриншотов и быстрых live-подсказок.",
    features: ["Все функции сервиса", "Без лимитов на основные сценарии", "Короткие и подробные ответы", "Приоритетные обновления"],
    cta: "Скоро",
    ctaHref: "#",
    ctaDownload: false,
    highlighted: true,
  },
  {
    name: "Team",
    price: "по запросу",
    period: "для команд",
    description: "Для компаний, которым нужен управляемый доступ и единые настройки.",
    features: ["Командные политики", "Единый billing", "Onboarding сотрудников", "Расширенная поддержка"],
    cta: "Обсудить",
    ctaHref: `mailto:${brand.supportEmail}`,
    ctaDownload: false,
    highlighted: false,
  },
];

export const pricingSection = {
  mainPlan: {
    title: "Полный доступ",
    price: "999 ₽",
    period: "в месяц",
    description: "Полный доступ ко всем возможностям offerGO.",
    features: [
      "Live-подсказки во время звонка",
      "Разбор задач по скриншоту",
      "Быстрые ответы в overlay",
      "Без ограничений на основной сценарий",
    ],
    ctaLabel: "Скачать для Windows",
  } satisfies PricingSectionPlan,
  demoPlan: {
    title: "15 минут бесплатно",
    description: "Чтобы проверить сервис в реальном звонке.",
    ctaLabel: "Скачать для Windows",
  } satisfies PricingSectionPlan,
};

export const questions = [
  {
    category: "IT",
    title: "Что такое event loop и почему он важен в JavaScript?",
    answer: "Коротко объяснить очередь задач, microtasks и влияние на асинхронный код.",
  },
  {
    category: "Маркетинг",
    title: "Как оценить эффективность performance-кампании?",
    answer: "Связать CAC, LTV, ROMI, конверсии по воронке и качество трафика.",
  },
  {
    category: "Продукт",
    title: "Как выбрать метрику для нового onboarding?",
    answer: "Оттолкнуться от активации, time-to-value и удержания первой недели.",
  },
  {
    category: "Аналитика",
    title: "Чем медиана лучше среднего в отчёте по времени ответа?",
    answer: "Показать устойчивость к выбросам и объяснить, когда нужны percentiles.",
  },
  {
    category: "Системный дизайн",
    title: "Как спроектировать очередь уведомлений?",
    answer: "Разложить producer, broker, retry, idempotency, rate limits и мониторинг.",
  },
  {
    category: "Код",
    title: "Почему UI может зависнуть при live streaming?",
    answer: "Объяснить блокировку UI-потока, backpressure и bounded queue.",
  },
];

export const faq = [
  {
    question: "offerGO уже можно скачать?",
    answer: "Да. На странице скачивания доступен прямой setup-файл Windows-клиента, который устанавливается как обычная программа.",
  },
  {
    question: "Приложение видно при демонстрации экрана?",
    answer: "Клиент использует Windows capture exclusion там, где это поддерживается. Если режим недоступен, приложение должно явно показать degraded state.",
  },
  {
    question: "Какие звонки поддерживаются?",
    answer: "Цель MVP - Meet, Zoom через браузер, Teams, Телемост и другие browser calls. Поддержка зависит от выбранного режима захвата аудио.",
  },
  {
    question: "Можно ли задавать вопрос вручную?",
    answer: "Да. Помимо live-аудио и скриншота, в overlay есть короткое поле ручного запроса.",
  },
  {
    question: "Это замена подготовке?",
    answer: "Нет. Это инструмент live-поддержки: он помогает быстрее сформулировать ответ, но не заменяет знания и ответственность пользователя.",
  },
];
