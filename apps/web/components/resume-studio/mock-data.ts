import type { ResumeStudioData } from "./types"

const revenueClaim =
  "увеличил выручку в 3 раза за 2 месяца"
const teamClaim = "Управлял командой из 5 человек"
const responsibilityClaim =
  "Отвечал за growth-направление, подписки и монетизацию корпоративного продукта."
const weakResultClaim =
  "Получил опыт запуска экспериментов и улучшения продуктовой аналитики."
const broadSkillsClaim = "аналитика, growth, коммуникация, гипотезы, roadmap"

export const mockResumeStudioData: ResumeStudioData = {
  document: {
    title: "Алексей Смирнов",
    subtitle: "Senior Product Manager",
    meta: ["Москва", "alexey.smirnov@email.com", "Telegram: @alex_pm_best"],
    initialValue: [
      {
        id: "header_name",
        type: "h1",
        children: [{ text: "Алексей Смирнов" }],
      },
      {
        id: "header_role",
        type: "h3",
        children: [{ text: "Senior Product Manager" }],
      },
      {
        id: "header_contacts",
        type: "p",
        children: [
          {
            text: "Москва • alexey.smirnov@email.com • Telegram: @alex_pm_best",
          },
        ],
      },
      {
        id: "section_summary",
        type: "h2",
        children: [{ text: "О СЕБЕ" }],
      },
      {
        id: "summary_1",
        type: "p",
        children: [
          {
            text: "Product Manager с 6-летним опытом в B2B SaaS. Запускал новые воронки, улучшал onboarding и ",
          },
          {
            issueId: "issue_revenue_claim",
            severity: "error",
            text: revenueClaim,
          },
          {
            text: ". Сфокусирован на monetization, activation и развитии продуктовой аналитики.",
          },
        ],
      },
      {
        id: "section_experience",
        type: "h2",
        children: [{ text: "ОПЫТ РАБОТЫ" }],
      },
      {
        id: "job_1_header",
        type: "h3",
        children: [
          {
            text: "ООО «SaaSFlow» — Senior Product Manager | 2022 — наст. время",
          },
        ],
      },
      {
        id: "job_1_description",
        type: "p",
        children: [
          {
            issueId: "issue_responsibility_claim",
            severity: "warning",
            text: responsibilityClaim,
          },
        ],
      },
      {
        id: "job_1_team",
        type: "p",
        children: [
          { text: "• " },
          {
            issueId: "issue_team_claim",
            severity: "warning",
            text: teamClaim,
          },
          {
            text: ", запускал эксперименты и синхронизировал roadmap с sales и support.",
          },
        ],
      },
      {
        id: "job_1_result",
        type: "p",
        children: [
          { text: "• " },
          {
            issueId: "issue_weak_result",
            severity: "recommend",
            text: weakResultClaim,
          },
        ],
      },
      {
        id: "section_skills",
        type: "h2",
        children: [{ text: "НАВЫКИ" }],
      },
      {
        id: "skills_1",
        type: "p",
        children: [
          {
            text: "Product analytics, SQL, Amplitude, A/B testing, JTBD, ",
          },
          {
            issueId: "issue_broad_skills",
            severity: "recommend",
            text: broadSkillsClaim,
          },
        ],
      },
    ],
  },
  issues: [
    {
      id: "issue_revenue_claim",
      severity: "error",
      status: "open",
      sectionTitle: "О себе",
      title: "Слишком сильное достижение без доказательства",
      quote: revenueClaim,
      description:
        "Формулировка звучит как крупный бизнес-результат, но в тексте нет базы сравнения, метрики продукта и механики, которая привела к росту.",
      whyItMatters:
        "Рекрутер и hiring manager могут воспринять такой claim как недостоверный. Лучше показать механизм роста и безопасно обозначить измеримый результат.",
      articleLinks: [
        {
          title: "Как писать impact bullets в резюме",
          href: "https://www.indeed.com/career-advice/resumes-cover-letters/resume-accomplishments",
        },
        {
          title: "STAR-подход для достижений",
          href: "https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/",
        },
      ],
      replacementOptions: [
        {
          id: "revenue_safe",
          label: "Безопасная замена",
          text: "увеличил выручку продуктового направления за счёт пересборки onboarding-воронки и запуска серии paywall-экспериментов",
          isSafe: true,
        },
        {
          id: "revenue_metric",
          label: "С метрикой",
          text: "увеличил выручку продуктового направления на [значение]% за [период] за счёт пересборки onboarding-воронки и paywall-экспериментов",
          isSafe: true,
        },
      ],
      anchor: {
        blockId: "summary_1",
        path: [4, 1],
        fromOffset: 0,
        toOffset: revenueClaim.length,
      },
      confidence: 0.94,
      scoreImpact: -12,
    },
    {
      id: "issue_responsibility_claim",
      severity: "warning",
      status: "open",
      sectionTitle: "Опыт работы",
      title: "Описание роли звучит как зона ответственности",
      quote: responsibilityClaim,
      description:
        "Фраза объясняет, за что кандидат отвечал, но не показывает масштаб, решения и эффект для продукта.",
      whyItMatters:
        "Для senior-level PM важен не только ownership, но и доказательство влияния: какие решения приняты, какие метрики улучшены, какие ограничения сняты.",
      articleLinks: [
        {
          title: "Resume bullets: action + scope + impact",
          href: "https://www.themuse.com/advice/185-powerful-verbs-that-will-make-your-resume-awesome",
        },
      ],
      replacementOptions: [
        {
          id: "responsibility_rewrite",
          label: "Переписать как impact",
          text: "Вёл growth-направление: приоритизировал гипотезы монетизации, запускал эксперименты в подписочной модели и синхронизировал roadmap с продажами и поддержкой.",
          isSafe: true,
        },
      ],
      anchor: {
        blockId: "job_1_description",
        path: [7, 0],
        fromOffset: 0,
        toOffset: responsibilityClaim.length,
      },
      confidence: 0.86,
      scoreImpact: -6,
    },
    {
      id: "issue_team_claim",
      severity: "warning",
      status: "open",
      sectionTitle: "Опыт работы",
      title: "Команда указана, но не раскрыт формат лидерства",
      quote: teamClaim,
      description:
        "В резюме есть размер команды, но не видно, что именно входило в управление: people management, delivery, discovery, синхронизация или постановка целей.",
      whyItMatters:
        "Для senior/head трека работодатель смотрит на управленческий контекст: размер команды, роль кандидата, тип решений и ответственность за результат.",
      articleLinks: [
        {
          title: "Leadership bullets in product resumes",
          href: "https://www.productalliance.com/blog/product-manager-resume",
        },
      ],
      replacementOptions: [
        {
          id: "team_context",
          label: "Добавить контекст",
          text: "Синхронизировал команду из 5 человек: формировал roadmap, ставил цели по экспериментам и согласовывал приоритеты с sales/support.",
          isSafe: true,
        },
      ],
      anchor: {
        blockId: "job_1_team",
        path: [8, 1],
        fromOffset: 0,
        toOffset: teamClaim.length,
      },
      confidence: 0.82,
      scoreImpact: -5,
    },
    {
      id: "issue_weak_result",
      severity: "recommend",
      status: "open",
      sectionTitle: "Опыт работы",
      title: "Результат сформулирован как польза для кандидата",
      quote: weakResultClaim,
      description:
        "Фраза говорит, какой опыт получил кандидат, но не показывает ценность для компании или продукта.",
      whyItMatters:
        "В сильном резюме bullet отвечает на вопрос работодателя: что изменилось после работы кандидата.",
      articleLinks: [
        {
          title: "Accomplishment statements",
          href: "https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/",
        },
      ],
      replacementOptions: [
        {
          id: "weak_result_rewrite",
          label: "Сместить фокус на продукт",
          text: "Запускал продуктовые эксперименты и улучшал аналитику воронки, чтобы быстрее находить узкие места onboarding и монетизации.",
          isSafe: true,
        },
      ],
      anchor: {
        blockId: "job_1_result",
        path: [9, 1],
        fromOffset: 0,
        toOffset: weakResultClaim.length,
      },
      confidence: 0.9,
      scoreImpact: -3,
    },
    {
      id: "issue_broad_skills",
      severity: "recommend",
      status: "open",
      sectionTitle: "Навыки",
      title: "Навыки смешаны без уровня и инструментов",
      quote: broadSkillsClaim,
      description:
        "Часть навыков слишком общая. Их стоит разделить на инструменты, методы и управленческие компетенции.",
      whyItMatters:
        "ATS и рекрутеру проще считать профиль, когда hard skills и product methods разнесены по группам.",
      articleLinks: [
        {
          title: "How to list skills on a resume",
          href: "https://www.indeed.com/career-advice/resumes-cover-letters/best-resume-skills",
        },
      ],
      replacementOptions: [
        {
          id: "skills_grouped",
          label: "Сгруппировать",
          text: "Product analytics: Amplitude, SQL, A/B testing; Growth: activation, paywall, onboarding; Management: roadmap, stakeholder alignment, discovery",
          isSafe: true,
        },
      ],
      anchor: {
        blockId: "skills_1",
        path: [11, 1],
        fromOffset: 0,
        toOffset: broadSkillsClaim.length,
      },
      confidence: 0.8,
      scoreImpact: -2,
    },
    {
      id: "issue_missing_portfolio",
      severity: "recommend",
      status: "open",
      sectionTitle: "Шапка",
      title: "Нет ссылок на LinkedIn или портфолио",
      quote: "Контакты без профессиональных ссылок",
      description:
        "В шапке есть email и Telegram, но нет публичного профиля, кейсов или portfolio links.",
      whyItMatters:
        "Для product role ссылки на кейсы, LinkedIn или публичные материалы ускоряют первичную проверку профиля.",
      articleLinks: [
        {
          title: "Resume contact information best practices",
          href: "https://www.indeed.com/career-advice/resumes-cover-letters/contact-information-on-resume",
        },
      ],
      replacementOptions: [
        {
          id: "portfolio_add",
          label: "Добавить строку",
          text: "LinkedIn: [ссылка] • Portfolio: [ссылка на кейсы]",
          isSafe: true,
        },
      ],
      anchor: null,
      confidence: 0.76,
      scoreImpact: -2,
    },
  ],
  score: {
    overall: 74,
    label: "Предварительная оценка",
  },
}

mockResumeStudioData.document.pages = [
  {
    id: "page_1",
    title: "Page 1",
    initialValue: mockResumeStudioData.document.initialValue.slice(0, 9),
  },
  {
    id: "page_2",
    title: "Page 2",
    initialValue: mockResumeStudioData.document.initialValue.slice(9),
  },
]

const mockAnchorPageUpdates: Record<
  string,
  {
    pageId: string
    path?: number[]
  }
> = {
  issue_revenue_claim: {
    pageId: "page_1",
    path: [4, 1],
  },
  issue_responsibility_claim: {
    pageId: "page_1",
    path: [7, 0],
  },
  issue_team_claim: {
    pageId: "page_1",
    path: [8, 1],
  },
  issue_weak_result: {
    pageId: "page_2",
    path: [0, 1],
  },
  issue_broad_skills: {
    pageId: "page_2",
    path: [2, 1],
  },
}

for (const issue of mockResumeStudioData.issues) {
  const update = mockAnchorPageUpdates[issue.id]

  if (!issue.anchor || !update) continue

  issue.anchor.pageId = update.pageId

  if (update.path) {
    issue.anchor.path = update.path
  }
}
