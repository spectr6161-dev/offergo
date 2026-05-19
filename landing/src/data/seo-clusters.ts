export type SeoClusterPage = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  lead: string;
  primaryKeywords: string[];
  sections: Array<{
    title: string;
    text: string;
  }>;
  audiences: string[];
  helps: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  cta: {
    label: string;
    href: string;
  };
  relatedSlugs: string[];
};

export const seoClusterPages: SeoClusterPage[] = [
  {
    slug: "it-interview",
    path: "/promo/it-interview",
    title: "IT собеседование: подготовка к техническому интервью",
    description:
      "Подготовка к IT собеседованию: технические вопросы, лайвкодинг, system design, вопросы для frontend, backend и mobile разработчиков.",
    h1: "Подготовка к техническому собеседованию в IT",
    eyebrow: "IT собеседование",
    lead:
      "Техническое интервью проверяет не только знания, но и способность объяснять решения. offerGO помогает повторить темы, потренировать ответы и не потеряться на звонке.",
    primaryKeywords: [
      "IT собеседование",
      "техническое собеседование",
      "вопросы на IT собеседовании",
      "лайвкодинг собеседование",
      "system design собеседование",
    ],
    sections: [
      {
        title: "Что повторить перед интервью",
        text:
          "Соберите список тем по вакансии: язык, фреймворк, базы данных, API, архитектура, алгоритмы и практические задачи. offerGO помогает превратить этот список в план подготовки.",
      },
      {
        title: "Как отвечать на технические вопросы",
        text:
          "Хороший ответ показывает контекст, trade-off и конкретный опыт. AI-помощник помогает держать структуру и говорить без лишних общих фраз.",
      },
      {
        title: "Как пройти лайвкодинг",
        text:
          "Во время задач важно проговаривать ход мысли, проверять edge cases и не молчать. Подсказки помогают быстро вспомнить подход и не зависнуть.",
      },
    ],
    audiences: ["junior перед первой технической встречей", "middle перед сменой компании", "senior перед system design интервью"],
    helps: ["вопросы", "лайвкодинг", "system design", "разбор вакансии", "подготовка ответа"],
    faq: [
      {
        question: "Что спрашивают на техническом собеседовании?",
        answer:
          "Обычно спрашивают стек вакансии, опыт в проектах, архитектурные решения, алгоритмы, базы данных, API и практические задачи.",
      },
      {
        question: "Как подготовиться к IT собеседованию за несколько дней?",
        answer:
          "Разберите требования вакансии, повторите ключевые темы, подготовьте 5-7 историй из опыта и потренируйте ответы на частые вопросы.",
      },
      {
        question: "Нужен ли system design junior-разработчику?",
        answer:
          "На junior-позициях его спрашивают редко, но базовое понимание API, очередей, БД и кеширования помогает выглядеть сильнее.",
      },
      {
        question: "Как отвечать, если не знаешь точный ответ?",
        answer:
          "Лучше честно обозначить границу знания, предложить ход рассуждения и объяснить, как бы вы проверили гипотезу на практике.",
      },
      {
        question: "Можно ли готовиться по конкретной вакансии?",
        answer:
          "Да. В offerGO можно использовать текст вакансии, резюме и банк вопросов, чтобы подготовка была ближе к реальному интервью.",
      },
    ],
    cta: {
      label: "Открыть банк вопросов",
      href: "/promo/questions",
    },
    relatedSlugs: ["resume-it", "react-vacancies", "backend-vacancies"],
  },
  {
    slug: "react-vacancies",
    path: "/promo/react-vacancies",
    title: "React вакансии и подготовка к собеседованию React-разработчика",
    description:
      "React вакансии, frontend React TypeScript, Next.js, подготовка к собеседованию React-разработчика и вопросы для frontend interview.",
    h1: "React вакансии, вопросы и подготовка к frontend-собеседованию",
    eyebrow: "React / Frontend",
    lead:
      "React-разработчику важно показать знание компонентов, состояния, производительности, TypeScript, Next.js и реальный опыт в продуктовой разработке.",
    primaryKeywords: [
      "React вакансии",
      "React разработчик вакансии",
      "React TypeScript вакансии",
      "собеседование React разработчик",
      "вопросы на собеседовании React",
    ],
    sections: [
      {
        title: "Что ищут в React вакансиях",
        text:
          "Работодатели часто смотрят TypeScript, Next.js, работу с API, формы, состояние, производительность и способность писать поддерживаемый UI-код.",
      },
      {
        title: "Как подготовиться к React interview",
        text:
          "Повторите hooks, rendering, memoization, server/client границы, архитектуру компонентов, тестирование и реальные кейсы оптимизации.",
      },
      {
        title: "Как усилить отклик",
        text:
          "Сопроводительное письмо должно сразу показать, какие требования вакансии уже закрыты вашим опытом: стек, проекты, роль и результат.",
      },
    ],
    audiences: ["junior React developer", "middle frontend разработчик", "Next.js / TypeScript специалисты"],
    helps: ["React вопросы", "frontend вакансии", "резюме", "сопроводительные письма", "live-помощник"],
    faq: [
      {
        question: "Что спрашивают на собеседовании React-разработчика?",
        answer:
          "Обычно спрашивают hooks, state management, rendering, performance, forms, TypeScript, Next.js и опыт построения компонентов.",
      },
      {
        question: "Как найти React вакансии удаленно?",
        answer:
          "Используйте поиск по React, frontend, TypeScript и Next.js, а затем фильтруйте вакансии по формату удаленной работы.",
      },
      {
        question: "Нужно ли знать Next.js для React вакансий?",
        answer:
          "Не всегда, но Next.js часто встречается в коммерческих вакансиях и повышает ценность frontend-кандидата.",
      },
      {
        question: "Как junior React-разработчику выделиться?",
        answer:
          "Покажите реальные проекты, понятное резюме, стек, вклад в UI и готовность объяснять решения на техническом интервью.",
      },
      {
        question: "Поможет ли offerGO с React-собеседованием?",
        answer:
          "Да. Можно готовиться по вопросам, разбирать вакансию, формировать отклик и использовать помощник во время тренировки.",
      },
    ],
    cta: {
      label: "Открыть React вакансии",
      href: "https://offergo.ru/vacancies?search=React",
    },
    relatedSlugs: ["it-interview", "backend-vacancies", "flutter-vacancies"],
  },
  {
    slug: "flutter-vacancies",
    path: "/promo/flutter-vacancies",
    title: "Flutter вакансии и подготовка к собеседованию Flutter-разработчика",
    description:
      "Flutter вакансии, Dart, mobile developer, удаленная работа Flutter и подготовка к собеседованию Flutter-разработчика.",
    h1: "Flutter вакансии, Dart-вопросы и подготовка к mobile interview",
    eyebrow: "Flutter / Dart",
    lead:
      "Flutter-разработчику важно уверенно говорить про Dart, widgets, state management, платформенные интеграции, производительность и релизный цикл.",
    primaryKeywords: [
      "Flutter вакансии",
      "Flutter разработчик вакансии",
      "Dart Flutter вакансии",
      "собеседование Flutter разработчик",
      "Flutter вопросы для собеседования",
    ],
    sections: [
      {
        title: "Что важно в Flutter вакансиях",
        text:
          "Вакансии часто требуют Dart, работу с REST/GraphQL, state management, navigation, нативные плагины, CI/CD и публикацию в сторах.",
      },
      {
        title: "Подготовка к Flutter собеседованию",
        text:
          "Повторите lifecycle, widgets, async, isolates, streams, state management, архитектуру приложения и подходы к оптимизации.",
      },
      {
        title: "Отклик под mobile-позицию",
        text:
          "В отклике стоит подчеркнуть реальные приложения, платформы, релизы, performance и взаимодействие с backend/API.",
      },
    ],
    audiences: ["junior Flutter developer", "mobile developer", "Dart-разработчики"],
    helps: ["Flutter вопросы", "mobile вакансии", "резюме", "сопроводительные письма", "тренировка интервью"],
    faq: [
      {
        question: "Что спрашивают на Flutter собеседовании?",
        answer:
          "Dart, widgets, build lifecycle, state management, async, streams, isolates, platform channels и опыт публикации приложений.",
      },
      {
        question: "Где искать Flutter вакансии?",
        answer:
          "Можно искать по Flutter, Dart, mobile developer, Android/iOS и фильтровать по удаленному или офисному формату.",
      },
      {
        question: "Нужно ли знать нативную разработку?",
        answer:
          "Базовое понимание Android/iOS полезно, особенно для platform channels, пушей, платежей, сборок и публикации.",
      },
      {
        question: "Как подготовиться junior Flutter-разработчику?",
        answer:
          "Соберите 2-3 демонстрационных проекта, подготовьте резюме, повторите базу Dart и потренируйте объяснение архитектуры.",
      },
      {
        question: "Можно ли тренироваться перед mobile interview?",
        answer:
          "Да. В offerGO можно разбирать вопросы, генерировать ответы и готовиться под конкретную Flutter-вакансию.",
      },
    ],
    cta: {
      label: "Открыть Flutter вакансии",
      href: "https://offergo.ru/vacancies?search=Flutter",
    },
    relatedSlugs: ["it-interview", "react-vacancies", "backend-vacancies"],
  },
  {
    slug: "backend-vacancies",
    path: "/promo/backend-vacancies",
    title: "Backend вакансии и подготовка к backend-собеседованию",
    description:
      "Backend вакансии, backend developer, Node.js, Python, Java, Go, SQL, REST API, system design и подготовка к backend собеседованию.",
    h1: "Backend вакансии, system design и вопросы по SQL/API",
    eyebrow: "Backend",
    lead:
      "Backend-собеседование обычно проверяет API, базы данных, асинхронность, надежность, очереди, масштабирование и умение объяснять архитектурные решения.",
    primaryKeywords: [
      "backend вакансии",
      "backend developer вакансии",
      "backend разработчик вакансии",
      "собеседование backend разработчик",
      "system design backend собеседование",
    ],
    sections: [
      {
        title: "Что требуют backend вакансии",
        text:
          "Чаще всего встречаются REST API, SQL, очереди, кеширование, Docker, микросервисы, мониторинг и опыт production-разработки.",
      },
      {
        title: "Как готовиться к backend interview",
        text:
          "Повторите базу языка, базы данных, транзакции, индексы, авторизацию, отказоустойчивость, очереди и system design.",
      },
      {
        title: "Как показать опыт",
        text:
          "Говорите не только о технологиях, но и о нагрузке, ограничениях, trade-off, инцидентах и результатах ваших решений.",
      },
    ],
    audiences: ["junior backend developer", "middle backend", "senior backend и system design"],
    helps: ["backend вопросы", "SQL", "REST API", "system design", "вакансии и отклики"],
    faq: [
      {
        question: "Что спрашивают backend-разработчика?",
        answer:
          "Язык и фреймворк, API, SQL, транзакции, индексы, кеширование, очереди, безопасность, масштабирование и системный дизайн.",
      },
      {
        question: "Как подготовиться к system design interview?",
        answer:
          "Повторите требования, API-контракты, хранение данных, очереди, кеши, отказоустойчивость, мониторинг и компромиссы архитектуры.",
      },
      {
        question: "Какие backend вакансии бывают без опыта?",
        answer:
          "Чаще это junior позиции, стажировки и роли с сильным фокусом на базовый язык, SQL, HTTP и простую backend-разработку.",
      },
      {
        question: "Нужно ли backend-разработчику сопроводительное письмо?",
        answer:
          "Да, если оно коротко показывает релевантный стек, опыт с API/БД и почему вы подходите под конкретную вакансию.",
      },
      {
        question: "Помогает ли offerGO с backend-вопросами?",
        answer:
          "Да. Сервис помогает повторить темы, разобрать вакансии, подготовить резюме и сформировать ответы для интервью.",
      },
    ],
    cta: {
      label: "Открыть backend вакансии",
      href: "https://offergo.ru/vacancies?search=backend",
    },
    relatedSlugs: ["it-interview", "react-vacancies", "flutter-vacancies"],
  },
  {
    slug: "resume-it",
    path: "/promo/resume-it",
    title: "Проверка резюме IT — AI-анализ резюме для разработчиков и цифровых специалистов",
    description:
      "AI-проверка резюме для IT-специалистов и смежных цифровых ролей: разработка, QA, DevOps, Data/ML, аналитика, продукт, дизайн, менеджмент, отклики и подготовка к IT-собеседованию.",
    h1: "Хватит отправлять резюме неделями. Начните получать IT-собеседования быстрее",
    eyebrow: "Резюме и оффер",
    lead:
      "offerGO помогает проверить резюме IT-специалиста, усилить опыт под разные вакансии в разработке, QA, DevOps, аналитике, продукте, дизайне и быстрее перейти к собеседованиям.",
    primaryKeywords: [
      "проверка резюме IT",
      "резюме программиста пример",
      "резюме junior разработчика",
      "резюме QA инженера",
      "резюме DevOps инженера",
      "резюме аналитика данных",
      "резюме product manager",
      "резюме UX UI дизайнера",
      "помощь с резюме IT",
      "как составить резюме программисту",
    ],
    sections: [
      {
        title: "Что должно быть в резюме",
        text:
          "Стек, коммерческий опыт, проекты, результаты, роль в команде, ссылки на портфолио и понятная структура без лишней воды.",
      },
      {
        title: "Как AI-анализ помогает",
        text:
          "Проверка показывает слабые формулировки, нехватку конкретики, проблемы структуры и несоответствие вакансии.",
      },
      {
        title: "Как перейти к откликам",
        text:
          "После улучшения резюме можно использовать индивидуальные письма и подготовку к собеседованию под каждую вакансию.",
      },
    ],
    audiences: ["junior без коммерческого опыта", "разработчики, QA, DevOps и Data/ML специалисты", "аналитики, product/project менеджеры и UX/UI-дизайнеры", "специалисты перед сменой работы"],
    helps: ["AI-анализ резюме", "сопроводительные письма", "вакансии", "подготовка к интервью"],
    faq: [
      {
        question: "Как составить резюме программисту?",
        answer:
          "Покажите стек, проекты, вклад, результаты и ссылки. Уберите общие фразы и адаптируйте опыт под целевые вакансии.",
      },
      {
        question: "Что важно в резюме junior-разработчика?",
        answer:
          "Учебные и пет-проекты, стек, задачи, которые вы реально делали, GitHub, понятная мотивация и готовность расти.",
      },
      {
        question: "Нужно ли менять резюме под каждую вакансию?",
        answer:
          "Не полностью, но стоит подсветить релевантные навыки и опыт, которые совпадают с требованиями вакансии.",
      },
      {
        question: "Как понять, что резюме слабое?",
        answer:
          "Если в нем мало конкретики, нет результатов, стек спрятан, а обязанности звучат общо, резюме лучше доработать.",
      },
      {
        question: "Можно ли сразу сформировать сопроводительное письмо?",
        answer:
          "Да. После выбора резюме можно вставить текст вакансии и получить персональный отклик на русском языке.",
      },
    ],
    cta: {
      label: "Проверить резюме",
      href: "https://offergo.ru/resumes",
    },
    relatedSlugs: ["it-interview", "react-vacancies", "backend-vacancies"],
  },
];

export const seoSitemapEntries = [
  { path: "/promo", priority: "1.0", changefreq: "weekly" },
  ...seoClusterPages.map((page) => ({ path: page.path, priority: "0.9", changefreq: "weekly" })),
  { path: "/promo/questions", priority: "0.8", changefreq: "weekly" },
  { path: "/promo/resume", priority: "0.8", changefreq: "weekly" },
  { path: "/promo/pricing", priority: "0.6", changefreq: "monthly" },
  { path: "/promo/contacts", priority: "0.4", changefreq: "monthly" },
];

export function getSeoClusterPage(slug: string) {
  const page = seoClusterPages.find((item) => item.slug === slug);

  if (!page) {
    throw new Error(`Unknown SEO cluster page: ${slug}`);
  }

  return page;
}

export function getRelatedSeoPages(page: SeoClusterPage) {
  return page.relatedSlugs.map(getSeoClusterPage);
}
