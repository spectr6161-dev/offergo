import type {
  ResumeReviewBlock,
  ResumeReviewBlockKind,
  ResumeReviewData,
  ResumeReviewFixture,
  ResumeReviewReplacement,
  ReviewSeverity,
} from "./types";

type BlockInput = {
  id: string;
  text: string;
  kind?: ResumeReviewBlockKind;
};

type SectionInput = {
  id: string;
  type: string;
  title: string;
  blocks: BlockInput[];
};

type FindingInput = {
  id: string;
  severity: ReviewSeverity;
  sectionId: string;
  title: string;
  originalText: string;
  problem: string;
  whyItMatters: string;
  replacementOptions: ResumeReviewReplacement[];
  blockId?: string;
  confidence?: number;
  scoreImpact?: number;
};

function buildReviewData(input: {
  title: string;
  role?: string;
  contacts?: string[];
  sections: SectionInput[];
  findings: FindingInput[];
}): ResumeReviewData {
  let cursor = 0;
  const blockIndex = new Map<string, ResumeReviewBlock>();

  const sections = input.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      const nextBlock: ResumeReviewBlock = {
        ...block,
        charStart: cursor,
        charEnd: cursor + block.text.length,
      };
      cursor = nextBlock.charEnd + 2;
      blockIndex.set(nextBlock.id, nextBlock);
      return nextBlock;
    }),
  }));

  const findings = input.findings.map((finding) => {
    const block = finding.blockId ? blockIndex.get(finding.blockId) : null;
    const localIndex = block?.text.indexOf(finding.originalText) ?? -1;
    const anchors =
      block && localIndex >= 0
        ? [
            {
              blockId: block.id,
              charStart: block.charStart + localIndex,
              charEnd: block.charStart + localIndex + finding.originalText.length,
              anchorStatus: "exact" as const,
            },
          ]
        : [];

    return {
      ...finding,
      anchors,
    };
  });

  return {
    document: {
      title: input.title,
      role: input.role,
      contacts: input.contacts,
      sections,
    },
    findings,
  };
}

const productManagerReview = buildReviewData({
  title: "Алексей Смирнов",
  role: "Senior Product Manager",
  contacts: ["Москва", "alexey.smirnov@email.com", "Telegram: @alex_pm_best"],
  sections: [
    {
      id: "summary",
      type: "summary",
      title: "О себе",
      blocks: [
        {
          id: "summary-main",
          kind: "paragraph",
          text: "Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и увеличил выручку в 3 раза за 2 месяца. Сфокусирован на monetization, activation и развитии продуктовой аналитики.",
        },
      ],
    },
    {
      id: "experience",
      type: "experience",
      title: "Опыт работы",
      blocks: [
        {
          id: "exp-saasflow-heading",
          kind: "heading",
          text: "ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время",
        },
        {
          id: "exp-saasflow-desc",
          kind: "paragraph",
          text: "Отвечал за growth-направление, подписки и монетизацию корпоративного продукта.",
        },
        {
          id: "exp-saasflow-team",
          kind: "bullet",
          text: "Управлял командой из 5 человек, запускал эксперименты и синхронизировал roadmap с sales и support.",
        },
        {
          id: "exp-saasflow-churn",
          kind: "bullet",
          text: "Снизил churn на 11% за счёт пересборки paywall и тарифной логики.",
        },
        {
          id: "exp-datapeak-heading",
          kind: "heading",
          text: "ООО «DataPeak» — Product Manager | 2020 — 2022",
        },
        {
          id: "exp-datapeak-discovery",
          kind: "bullet",
          text: "Вёл discovery по новому BI-модулю, проводил CustDev, формировал backlog и критерии приоритизации.",
        },
      ],
    },
    {
      id: "skills",
      type: "skills",
      title: "Навыки",
      blocks: [
        {
          id: "skills-main",
          kind: "compact",
          text: "SQL, A/B-тесты, продуктовая аналитика, JTBD, roadmap, discovery, стрессоустойчивость, коммуникабельность, обучаемость",
        },
      ],
    },
    {
      id: "education",
      type: "education",
      title: "Образование",
      blocks: [
        {
          id: "education-main",
          kind: "paragraph",
          text: "НИУ ВШЭ — Менеджмент, бакалавриат",
        },
      ],
    },
  ],
  findings: [
    {
      id: "pm-error-revenue",
      severity: "error",
      sectionId: "summary",
      title: "Слишком сильное достижение без доказательства",
      originalText: "увеличил выручку в 3 раза за 2 месяца",
      problem:
        "Фраза звучит как крупный бизнес-результат, но не объясняет базу сравнения, продуктовый рычаг и измерение.",
      whyItMatters:
        "Для senior-уровня сильные цифры должны быть проверяемыми. Без контекста рекрутер воспринимает их как рискованное преувеличение.",
      replacementOptions: [
        {
          type: "safe_rewrite",
          isSafe: true,
          text: "Увеличил выручку продуктового направления за счёт пересборки onboarding-воронки и запуска paywall-экспериментов.",
        },
        {
          type: "metric_template",
          isSafe: true,
          text: "Увеличил выручку на [значение]% за [период] за счёт [изменение продукта], при базе сравнения [период/когорта].",
        },
      ],
      blockId: "summary-main",
      confidence: 0.93,
      scoreImpact: -14,
    },
    {
      id: "pm-warning-team",
      severity: "warning",
      sectionId: "experience",
      title: "Обязанность вместо результата",
      originalText: "Управлял командой из 5 человек",
      problem:
        "Фрагмент описывает управленческую активность, но не показывает, что изменилось для продукта или бизнеса.",
      whyItMatters:
        "В опыте сильнее выглядят формулировки, где есть действие, масштаб, контекст и результат.",
      replacementOptions: [
        {
          type: "safe_rewrite",
          isSafe: true,
          text: "Руководил кросс-функциональной командой из 5 человек и синхронизировал delivery roadmap с sales и support для запуска growth-экспериментов.",
        },
      ],
      blockId: "exp-saasflow-team",
      confidence: 0.82,
      scoreImpact: -7,
    },
    {
      id: "pm-recommend-soft-skills",
      severity: "recommend",
      sectionId: "skills",
      title: "Общие soft skills можно заменить на рабочие компетенции",
      originalText: "стрессоустойчивость, коммуникабельность, обучаемость",
      problem:
        "Эти слова слишком общие и почти не помогают понять реальную профессиональную ценность кандидата.",
      whyItMatters:
        "ATS и нанимающий менеджер лучше реагируют на прикладные навыки, связанные с ролью и ежедневными задачами.",
      replacementOptions: [
        {
          type: "safe_rewrite",
          isSafe: true,
          text: "CustDev, JTBD, продуктовая аналитика, stakeholder management, фасилитация discovery-сессий",
        },
      ],
      blockId: "skills-main",
      confidence: 0.68,
      scoreImpact: 0,
    },
  ],
});

const flutterReview = buildReviewData({
  title: "Максим Дружинин",
  role: "Flutter Developer (Mobile)",
  contacts: ["Воронеж", "+7 (920) 224-14-06", "albertododermano@gmail.com"],
  sections: [
    {
      id: "summary",
      type: "summary",
      title: "О себе",
      blocks: [
        {
          id: "flutter-summary",
          kind: "paragraph",
          text: "Flutter-разработчик с 4+ годами коммерческого опыта в разработке мобильных приложений для iOS и Android. Работаю с Flutter, Dart, BLoC/Cubit, REST API, Dio, SQLite, Firebase, WebSocket, Git, CI/CD.",
        },
      ],
    },
    {
      id: "experience",
      type: "experience",
      title: "Опыт работы",
      blocks: [
        {
          id: "boravto-heading",
          kind: "heading",
          text: "Боравто — Senior Flutter-разработчик | Сентябрь 2024 — настоящее время",
        },
        {
          id: "boravto-desc",
          kind: "paragraph",
          text: "Разрабатывал внутреннее мобильное приложение на Flutter/Dart для автоматизации осмотра, диагностики, оценки и выкупа автомобилей с пробегом.",
        },
        {
          id: "boravto-offline",
          kind: "bullet",
          text: "Полностью переработал offline-first синхронизацию: реализовал хранение намерений на отправку, FIFO-обработку очередей и надежную доставку данных на сервер.",
        },
        {
          id: "boravto-stability",
          kind: "bullet",
          text: "Существенно повысил стабильность приложения в условиях нестабильного интернета, что было критично для выездных осмотров.",
        },
        {
          id: "boravto-process",
          kind: "bullet",
          text: "Реализовал сложный внутренний бизнес-процесс согласования цены автомобиля.",
        },
        {
          id: "boravto-cicd",
          kind: "bullet",
          text: "Выстроил стабильный релизный процесс: автоматизированные сборки, доставка тестовых и production-сборок, публикация в сторы и уведомления о статусе сборки в Telegram.",
        },
        {
          id: "innim-heading",
          kind: "heading",
          text: "Инним — Flutter-разработчик | Май 2021 — Сентябрь 2024",
        },
        {
          id: "innim-desc",
          kind: "paragraph",
          text: "Работал над крупным приложением для учета личных и семейных финансов с аудиторией 10+ млн установок и локализацией на 38 языков.",
        },
        {
          id: "innim-experience",
          kind: "bullet",
          text: "Получил практический опыт Flutter-разработки полного цикла: UI, бизнес-логика, сетевое взаимодействие, локальное хранение, аналитика, тестирование, релизы и production-поддержка.",
        },
      ],
    },
    {
      id: "skills",
      type: "skills",
      title: "Навыки",
      blocks: [
        {
          id: "flutter-skills",
          kind: "compact",
          text: "Flutter, Dart, iOS, Android, BLoC, Cubit, Widget Lifecycle, REST API, JSON, Dio, SQLite, Firebase, Platform Channel, CI/CD, Unit Tests, Integration Tests, Git, Code Review, Figma, Localization, Kotlin, Swift",
        },
      ],
    },
    {
      id: "education",
      type: "education",
      title: "Образование",
      blocks: [
        {
          id: "flutter-education-1",
          kind: "paragraph",
          text: "Воронежский государственный университет инженерных технологий — Прикладная информатика, 2027",
        },
        {
          id: "flutter-education-2",
          kind: "paragraph",
          text: "Борисоглебский техникум промышленных и информационных технологий — Прикладная информатика, 2022",
        },
      ],
    },
  ],
  findings: [
    {
      id: "flutter-warning-stability",
      severity: "warning",
      sectionId: "experience",
      title: "Сильный результат без измеримой метрики",
      originalText: "Существенно повысил стабильность приложения",
      problem:
        "Формулировка показывает полезный результат, но не даёт масштаба: crash-free users, количество инцидентов или SLA не указаны.",
      whyItMatters:
        "Для мобильного senior-разработчика стабильность важна, но без измерения результат сложнее сравнить с другими кандидатами.",
      replacementOptions: [
        {
          type: "safe_rewrite",
          isSafe: true,
          text: "Повысил стабильность приложения в условиях нестабильного интернета: переработал сценарии повторной доставки данных и снизил риск потери данных при выездных осмотрах.",
        },
        {
          type: "metric_template",
          isSafe: true,
          text: "Повысил стабильность приложения на [значение]% / снизил количество инцидентов на [значение] за счёт переработки offline-first синхронизации.",
        },
      ],
      blockId: "boravto-stability",
      confidence: 0.88,
      scoreImpact: -6,
    },
    {
      id: "flutter-error-passive",
      severity: "error",
      sectionId: "experience",
      title: "Достижение сформулировано как польза для кандидата",
      originalText: "Получил практический опыт Flutter-разработки полного цикла",
      problem:
        "Фраза говорит, чему кандидат научился, а не какую пользу принёс продукту или команде.",
      whyItMatters:
        "Для Middle+/Senior уровня ожидается вклад в продукт, качество, скорость разработки или стабильность.",
      replacementOptions: [
        {
          type: "safe_rewrite",
          isSafe: true,
          text: "Участвовал в полном цикле Flutter-разработки: реализовывал UI, бизнес-логику, сетевое взаимодействие, локальное хранение, тестирование, релизы и production-поддержку.",
        },
      ],
      blockId: "innim-experience",
      confidence: 0.9,
      scoreImpact: -12,
    },
    {
      id: "flutter-warning-cicd-tools",
      severity: "warning",
      sectionId: "skills",
      title: "CI/CD указан без конкретных инструментов",
      originalText: "CI/CD",
      problem:
        "Навык выглядит релевантно, но не раскрывает, чем именно кандидат пользовался: GitHub Actions, GitLab CI, Fastlane, Codemagic или внутренний pipeline.",
      whyItMatters:
        "Конкретные инструменты быстрее матчатся с вакансией и уменьшают вопросы на техническом интервью.",
      replacementOptions: [
        {
          type: "metric_template",
          isSafe: true,
          text: "CI/CD: [GitHub Actions / GitLab CI / Fastlane / Codemagic], сборки Android/iOS, TestFlight, Google Play, RuStore, App Store.",
        },
      ],
      blockId: "flutter-skills",
      confidence: 0.74,
      scoreImpact: -4,
    },
    {
      id: "flutter-recommend-keywords",
      severity: "recommend",
      sectionId: "experience",
      title: "Сильный технический фрагмент стоит сохранить",
      originalText: "offline-first синхронизацию",
      problem:
        "Это не ошибка: фрагмент хорошо показывает релевантный опыт для мобильной разработки со сложной сетевой логикой.",
      whyItMatters:
        "Такие термины усиливают и ATS, и ручную оценку, потому что сразу показывают уровень задач.",
      replacementOptions: [
        {
          type: "keep",
          isSafe: true,
          text: "Оставить формулировку и при возможности добавить метрику стабильности или пример пользовательского сценария.",
        },
      ],
      blockId: "boravto-offline",
      confidence: 0.96,
      scoreImpact: 0,
    },
  ],
});

const edgeCaseReview = buildReviewData({
  title: "Nina Kovalenko",
  role: "Operations Lead",
  contacts: ["Remote", "nina@example.com"],
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Career Snapshot",
      blocks: [
        {
          id: "edge-profile",
          kind: "paragraph",
          text: "Operations lead with experience in vendor onboarding, internal playbooks, service quality and cross-functional launches.",
        },
      ],
    },
    {
      id: "selected-projects",
      type: "projects",
      title: "Selected Projects",
      blocks: [
        {
          id: "edge-project-1",
          kind: "bullet",
          text: "Launched a vendor intake process and reduced manual follow-ups across support, sales and finance teams.",
        },
        {
          id: "edge-project-2",
          kind: "bullet",
          text: "Created internal SOPs for recurring escalations and improved handoff quality between shifts.",
        },
      ],
    },
  ],
  findings: [
    {
      id: "edge-warning-metric",
      severity: "warning",
      sectionId: "selected-projects",
      title: "Результат без масштаба",
      originalText: "reduced manual follow-ups",
      problem:
        "Фраза показывает направление улучшения, но не говорит, насколько изменился процесс.",
      whyItMatters:
        "Даже приблизительный масштаб помогает отличить операционный результат от обычной обязанности.",
      replacementOptions: [
        {
          type: "metric_template",
          isSafe: true,
          text: "Reduced manual follow-ups by [value]% across support, sales and finance by launching a structured vendor intake process.",
        },
      ],
      blockId: "edge-project-1",
      confidence: 0.79,
      scoreImpact: -5,
    },
    {
      id: "edge-recommend-links",
      severity: "recommend",
      sectionId: "profile",
      title: "Можно добавить ссылку на портфолио процессов",
      originalText: "",
      problem:
        "Это section-level рекомендация: в документе нет конкретного фрагмента, который можно подсветить.",
      whyItMatters:
        "Для нестандартных резюме полезно проверять, что UI корректно показывает замечания без anchor.",
      replacementOptions: [
        {
          type: "add_section",
          isSafe: true,
          text: "Portfolio: [link to playbooks, case studies or process documentation]",
        },
      ],
      confidence: 0.62,
      scoreImpact: 0,
    },
  ],
});

export const mockResumeReviewFixtures: ResumeReviewFixture[] = [
  {
    id: "product-manager",
    name: "PM demo",
    description: "Короткое резюме как на Astro-макете.",
    data: productManagerReview,
  },
  {
    id: "flutter-long",
    name: "Flutter long",
    description: "Длинное technical resume с опытом, навыками и достижениями.",
    data: flutterReview,
  },
  {
    id: "edge-case",
    name: "Edge case",
    description: "Нестандартные секции и section-level finding без подсветки.",
    data: edgeCaseReview,
  },
];
