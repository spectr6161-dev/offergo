import { auth } from "@offergo/auth/core";
import { env } from "@offergo/shared";
import { prisma } from "../src/client";

async function ensureAdmin() {
  const adminEmail = env.SEED_ADMIN_EMAIL;
  const adminPassword = env.SEED_ADMIN_PASSWORD;

  if (!adminEmail && !adminPassword) {
    console.info("SEED_ADMIN_EMAIL/PASSWORD are not set. Admin seed skipped.");
    return;
  }

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided together.",
    );
  }

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const response = await auth.api.signUpEmail({
      body: {
        name: "Offergo Admin",
        email: adminEmail,
        password: adminPassword,
      },
    });

    if (!response?.user?.id) {
      throw new Error("Failed to create seeded admin user");
    }
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
  });

  await prisma.roleAssignment.upsert({
    where: {
      userId_role: {
        userId: user.id,
        role: "admin",
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: "admin",
    },
  });
}

type SeedLimit = {
  feature:
    | "wpf_audio_seconds"
    | "wpf_screenshot"
    | "wpf_text_request"
    | "resume_slot"
    | "resume_analysis"
    | "individual_response";
  limit: number | null;
  fairUseLimit: number | null;
};

const planLimits: Record<string, SeedLimit[]> = {
  free: [
    { feature: "wpf_audio_seconds", limit: 900, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 3, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 25, fairUseLimit: null },
    { feature: "resume_slot", limit: 1, fairUseLimit: null },
    { feature: "resume_analysis", limit: 0, fairUseLimit: null },
    { feature: "individual_response", limit: 3, fairUseLimit: null },
  ],
  "basic-monthly": [
    { feature: "wpf_audio_seconds", limit: 10_800, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 25, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 500, fairUseLimit: null },
    { feature: "resume_slot", limit: 5, fairUseLimit: null },
    { feature: "resume_analysis", limit: 2, fairUseLimit: null },
    { feature: "individual_response", limit: 50, fairUseLimit: null },
  ],
  "comfort-monthly": [
    { feature: "wpf_audio_seconds", limit: 36_000, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 150, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 2_000, fairUseLimit: null },
    { feature: "resume_slot", limit: 15, fairUseLimit: null },
    { feature: "resume_analysis", limit: 7, fairUseLimit: null },
    { feature: "individual_response", limit: 200, fairUseLimit: null },
  ],
  "unlimited-monthly": [
    { feature: "wpf_audio_seconds", limit: null, fairUseLimit: 180_000 },
    { feature: "wpf_screenshot", limit: null, fairUseLimit: 1_000 },
    { feature: "wpf_text_request", limit: null, fairUseLimit: 10_000 },
    { feature: "resume_slot", limit: null, fairUseLimit: 100 },
    { feature: "resume_analysis", limit: 20, fairUseLimit: null },
    { feature: "individual_response", limit: null, fairUseLimit: 2_000 },
  ],
};

const legalDocumentVersion = "2026-05-06";

function operatorDetails() {
  return {
    name: env.LEGAL_OPERATOR_NAME,
    inn: env.LEGAL_OPERATOR_INN,
    ogrn: env.LEGAL_OPERATOR_OGRNIP_OR_OGRN,
    address: env.LEGAL_OPERATOR_ADDRESS,
    email: env.LEGAL_OPERATOR_EMAIL,
    responsible: env.LEGAL_RESPONSIBLE_PERSON,
  };
}

function buildLegalDocuments() {
  const operator = operatorDetails();
  const commonOperatorBlock = `Оператор: ${operator.name}
ИНН: ${operator.inn}
ОГРН/ОГРНИП: ${operator.ogrn}
Адрес: ${operator.address}
Контакт по вопросам персональных данных: ${operator.email}
Ответственный за организацию обработки персональных данных: ${operator.responsible}`;

  return [
    {
      kind: "privacy_policy" as const,
      slug: "privacy-policy",
      title: "Политика обработки персональных данных",
      summary:
        "Описание того, какие персональные данные обрабатывает OfferGO, для каких целей и как пользователь может реализовать свои права.",
      content: `# Политика обработки персональных данных

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

${commonOperatorBlock}

## 1. Общие положения
Настоящая Политика определяет порядок обработки и защиты персональных данных пользователей сервиса OfferGO. Политика подготовлена с учетом Федерального закона № 152-ФЗ "О персональных данных" и применяется ко всем функциям web-приложения, WPF-приложения, браузерного расширения и API OfferGO.

## 2. Какие данные обрабатываются
Оператор может обрабатывать: имя, email, данные авторизации, технические данные сессии, IP-адрес, user agent, данные профиля, резюме, фото, контакты, город, гражданство, образование, опыт, навыки, желаемую зарплату, условия работы, тексты вакансий, индивидуальные отклики, результаты ИИ-анализа, аудио- и текстовые фрагменты live-сессий, скриншоты, данные подписки, платежные идентификаторы, историю использования лимитов и обращения пользователя.

## 3. Цели обработки
Данные обрабатываются для регистрации и входа, предоставления функций создания резюме, анализа резюме, подготовки откликов, работы live-помощника, хранения пользовательских файлов, поддержки подписки и оплаты, защиты сервиса от злоупотреблений, исполнения требований закона, рассмотрения обращений и улучшения качества сервиса.

## 4. Правовые основания
Обработка выполняется на основании согласия пользователя, необходимости исполнения пользовательского соглашения и оферты, требований законодательства, а также законного интереса оператора по обеспечению безопасности сервиса и предотвращению злоупотреблений.

## 5. AI-обработка
Для функций ИИ публично заявленным обработчиком пользовательских данных является Yandex AI. В документы не включаются иные AI-провайдеры. Пользовательские данные используются только для формирования ответа по выбранной функции и не должны применяться для самостоятельного принятия юридически значимых решений.

## 6. Передача третьим лицам
Данные могут передаваться обработчикам, необходимым для работы сервиса: хостинг и база данных на территории Российской Федерации, S3-совместимое файловое хранилище, платежный провайдер Platega, Yandex AI, сервисы авторизации и уведомлений при их использовании пользователем. Передача выполняется в объеме, необходимом для конкретной функции.

## 7. Локализация
Первичная запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан Российской Федерации выполняются с использованием баз данных, расположенных на территории Российской Федерации.

## 8. Сроки хранения
Аккаунт и связанные пользовательские данные хранятся до удаления аккаунта или до достижения целей обработки. Платежные данные и документы хранятся в сроки, установленные законодательством. Удаленные файлы, скриншоты и live-артефакты удаляются или обезличиваются по регламенту хранения. Audit logs и сведения о согласиях хранятся для подтверждения соблюдения закона.

## 9. Права пользователя
Пользователь вправе запросить сведения об обработке, уточнение, блокирование, удаление данных, отзыв согласия и ограничение обработки. Обращение направляется на ${operator.email}. Оператор рассматривает обращения в сроки, установленные законодательством.

## 10. Защита данных
Оператор применяет организационные и технические меры защиты: разграничение доступа, аутентификацию, хранение файлов в приватном хранилище, учет действий, ограничение доступа администраторов, защиту API и удаление данных по регламенту.

## 11. Изменение Политики
Оператор может обновлять Политику. При существенных изменениях пользователь должен принять новую редакцию до продолжения использования сервиса.`,
    },
    {
      kind: "terms" as const,
      slug: "terms",
      title: "Пользовательское соглашение",
      summary: "Правила использования OfferGO, аккаунта и платных функций.",
      content: `# Пользовательское соглашение

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

${commonOperatorBlock}

## 1. Предмет
OfferGO предоставляет пользователю инструменты для создания резюме, анализа резюме, подготовки индивидуальных откликов, работы live-помощника и управления подпиской.

## 2. Аккаунт
Пользователь обязуется указывать достоверные данные, не передавать доступ к аккаунту третьим лицам и самостоятельно отвечать за действия, выполненные через его аккаунт.

## 3. Пользовательский контент
Пользователь самостоятельно загружает резюме, фото, тексты вакансий, скриншоты, аудио и иные материалы. Пользователь подтверждает, что имеет право использовать такие материалы и передавать их в сервис.

## 4. ИИ-функции
Результаты ИИ являются вспомогательными рекомендациями. Пользователь самостоятельно проверяет содержание резюме, откликов, ответов live-помощника и несет ответственность за их дальнейшее использование.

## 5. Запрещенные действия
Запрещено нарушать закон, загружать вредоносные файлы, обходить лимиты, пытаться получить доступ к данным других пользователей, использовать сервис для массового спама или автоматизированных действий без контроля пользователя.

## 6. Платные функции
Доступ к платным функциям предоставляется по тарифам, опубликованным в сервисе. Лимиты и стоимость отображаются до оплаты. Оплата выполняется через платежного провайдера.

## 7. Ответственность
Сервис предоставляется в пределах доступной функциональности. Оператор не гарантирует трудоустройство, приглашение на собеседование или конкретный результат использования рекомендаций.

## 8. Изменения
Оператор вправе обновлять условия. Существенные изменения требуют повторного принятия пользователем.`,
    },
    {
      kind: "personal_data_consent" as const,
      slug: "personal-data-consent",
      title: "Согласие на обработку персональных данных",
      summary:
        "Согласие пользователя на обработку персональных данных для работы сервиса.",
      content: `# Согласие на обработку персональных данных

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

Я даю согласие ${operator.name} на обработку моих персональных данных в целях регистрации, предоставления функций сервиса OfferGO, создания и хранения резюме, анализа резюме, подготовки откликов, работы live-помощника, обработки платежей, поддержки пользователей и обеспечения безопасности сервиса.

Согласие распространяется на данные аккаунта, контакты, резюме, фото, сведения об образовании и опыте, навыки, желаемую зарплату, тексты вакансий, отклики, скриншоты, аудио и транскрипты live-сессий, результаты ИИ-обработки, платежные и технические данные.

Разрешенные действия: сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, передача обработчикам, обезличивание, блокирование, удаление и уничтожение данных.

Согласие действует до его отзыва или до удаления аккаунта, если иные сроки хранения не установлены законом. Отзыв согласия направляется на ${operator.email}.`,
    },
    {
      kind: "offer" as const,
      slug: "offer",
      title: "Публичная оферта",
      summary:
        "Условия покупки подписки, тарифов, оплаты, лимитов и предоставления доступа.",
      content: `# Публичная оферта

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

${commonOperatorBlock}

## 1. Предмет оферты
Оператор предлагает пользователю платный доступ к функциям OfferGO по тарифам, опубликованным на странице оплаты.

## 2. Тарифы и лимиты
Стоимость, состав функций и лимиты тарифа отображаются до оплаты. Лимиты действуют в течение расчетного периода. Безлимитные функции могут иметь fair-use ограничения для защиты сервиса от злоупотреблений.

## 3. Оплата
Оплата выполняется через платежного провайдера Platega. Доступ активируется после подтверждения платежа. Оператор обеспечивает фискализацию расчетов в порядке, предусмотренном законодательством Российской Федерации.

## 4. Срок доступа
Подписка предоставляется на период, указанный в тарифе и интерфейсе оплаты. Автоматическое продление не применяется, если явно не указано иное в интерфейсе оплаты.

## 5. Возвраты
Порядок возврата описан в Политике возвратов. Пользователь может направить обращение на ${operator.email}.

## 6. Ограничения
Оператор не гарантирует трудоустройство, приглашение на собеседование, успешный отклик или иной внешний результат.`,
    },
    {
      kind: "refund_policy" as const,
      slug: "refund-policy",
      title: "Политика возвратов",
      summary: "Порядок обращения за возвратом оплаты.",
      content: `# Политика возвратов

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

Пользователь может направить обращение о возврате на ${operator.email}. В обращении необходимо указать email аккаунта, дату платежа, тариф и причину обращения.

Возврат рассматривается индивидуально с учетом факта предоставления доступа, объема использованных функций, технических ошибок и требований законодательства о защите прав потребителей.

Если услуга не была предоставлена по технической причине на стороне сервиса, оператор возвращает оплату либо предоставляет эквивалентный доступ после устранения ошибки.

Сроки и способ возврата зависят от платежного провайдера и банка пользователя.`,
    },
    {
      kind: "cookie_policy" as const,
      slug: "cookie-policy",
      title: "Политика cookie",
      summary:
        "Описание использования cookie, localStorage и технических идентификаторов.",
      content: `# Политика cookie

Дата публикации: 06.05.2026
Версия: ${legalDocumentVersion}

OfferGO использует cookie и аналогичные технологии для входа в аккаунт, хранения сессии, защиты от несанкционированного доступа, сохранения темы интерфейса, работы WPF/extension авторизации и корректной работы платежного сценария.

Обязательные cookie необходимы для работы сервиса и не отключаются средствами интерфейса. Пользователь может ограничить cookie настройками браузера, но часть функций может перестать работать.

Если в будущем будут подключены аналитические или рекламные cookie, сервис должен запросить отдельное согласие или обновить условия обработки.`,
    },
  ];
}

async function ensureLegalDocuments() {
  const documents = buildLegalDocuments();

  for (const document of documents) {
    await prisma.legalDocumentVersion.updateMany({
      where: {
        kind: document.kind,
        active: true,
        version: {
          not: legalDocumentVersion,
        },
      },
      data: {
        active: false,
      },
    });

    await prisma.legalDocumentVersion.upsert({
      where: {
        kind_version: {
          kind: document.kind,
          version: legalDocumentVersion,
        },
      },
      update: {
        slug: document.slug,
        title: document.title,
        summary: document.summary,
        content: document.content,
        active: true,
      },
      create: {
        ...document,
        version: legalDocumentVersion,
        active: true,
      },
    });
  }
}

async function ensurePlans() {
  const plans = [
    {
      code: "free",
      name: "Бесплатный",
      description: "Стартовый доступ с базовыми лимитами.",
      priceRub: 0,
      subscriptionType: "free",
      durationDays: 30,
      rank: 0,
      displayOrder: 10,
      checkoutEnabled: false,
    },
    {
      code: "basic-monthly",
      name: "Базовый",
      description: "Для регулярной работы с резюме, откликами и WPF-помощником.",
      priceRub: 599,
      subscriptionType: "basic",
      durationDays: 30,
      rank: 10,
      displayOrder: 20,
      checkoutEnabled: true,
    },
    {
      code: "comfort-monthly",
      name: "Комфортный",
      description:
        "Больше лимитов для активного поиска работы и длительных live-сессий.",
      priceRub: 1199,
      subscriptionType: "comfort",
      durationDays: 30,
      rank: 20,
      displayOrder: 30,
      checkoutEnabled: true,
    },
    {
      code: "unlimited-monthly",
      name: "Безлимитный",
      description: "Максимальные возможности с fair-use защитой от злоупотреблений.",
      priceRub: 2999,
      subscriptionType: "unlimited",
      durationDays: 30,
      rank: 30,
      displayOrder: 40,
      checkoutEnabled: true,
    },
  ];

  for (const plan of plans) {
    const savedPlan = await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });

    for (const limit of planLimits[plan.code] ?? []) {
      await prisma.planLimit.upsert({
        where: {
          planId_feature: {
            planId: savedPlan.id,
            feature: limit.feature,
          },
        },
        update: {
          limit: limit.limit,
          fairUseLimit: limit.fairUseLimit,
        },
        create: {
          planId: savedPlan.id,
          feature: limit.feature,
          limit: limit.limit,
          fairUseLimit: limit.fairUseLimit,
        },
      });
    }
  }
}

async function ensureQuestions() {
  const tags = [
    { slug: "javascript", name: "JavaScript" },
    { slug: "system-design", name: "System Design" },
    { slug: "behavioral", name: "Behavioral" },
  ];

  for (const tag of tags) {
    await prisma.questionTag.upsert({
      where: { slug: tag.slug },
      update: tag,
      create: tag,
    });
  }

  await prisma.question.upsert({
    where: { slug: "javascript-event-loop" },
    update: {},
    create: {
      slug: "javascript-event-loop",
      title: "Explain the JavaScript event loop and microtask queue.",
      difficulty: "mid",
      answer: {
        outline: [
          "Execution stack and task queue",
          "Microtasks before macrotasks",
          "Typical interview pitfalls",
        ],
      },
      tags: {
        connect: [{ slug: "javascript" }],
      },
    },
  });

  await prisma.question.upsert({
    where: { slug: "service-boundaries" },
    update: {},
    create: {
      slug: "service-boundaries",
      title: "How do you decide service boundaries in a growing product?",
      difficulty: "senior",
      answer: {
        outline: [
          "Team ownership and coupling",
          "Deployment and scaling constraints",
          "Data boundaries and failure modes",
        ],
      },
      tags: {
        connect: [{ slug: "system-design" }],
      },
    },
  });
}

async function main() {
  if (env.RUN_DEMO_SEED || env.NODE_ENV !== "production") {
    await ensureLegalDocuments();
    await ensurePlans();
    await ensureQuestions();
  } else {
    await ensureLegalDocuments();
    console.info("RUN_DEMO_SEED is not enabled. Demo seed skipped.");
  }

  await ensureAdmin();
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
