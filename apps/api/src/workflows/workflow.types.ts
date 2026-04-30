export const RESUME_ANALYSIS_WORKFLOW_TYPE = "resume_analysis_v1" as const;

export type WorkflowNodeKind = "deterministic" | "llm";

export type WorkflowNodePromptDefinition = {
  system: string;
  userTemplate: string;
  outputSchemaName: string;
  modelPolicy: "selected_model" | "cheap" | "pro";
  temperature?: number;
};

export type WorkflowNodeDefinition = {
  key: string;
  label: string;
  kind: WorkflowNodeKind;
  description: string;
  goal: string;
  reads: string[];
  writes: string[];
  prompt?: WorkflowNodePromptDefinition;
  expectedOutput: string;
  debugHints: string[];
};

export type WorkflowNodeDebug = {
  kind: WorkflowNodeKind;
  description: string;
  goal: string;
  reads: string[];
  writes: string[];
  prompt?: {
    system: string;
    user: string;
    userTemplate?: string;
    modelId: string;
    temperature?: number;
    outputSchemaName: string;
    modelPolicy: WorkflowNodePromptDefinition["modelPolicy"];
  };
  expectedOutput: string;
  debugHints: string[];
};

const systemPrompt = [
  "Ты эксперт по анализу резюме, ATS, найму и карьерному позиционированию.",
  "Работай только с предоставленными raw blocks, semantic chunks, structure и workflow state.",
  "Не выдумывай метрики, компании, инструменты, должности и достижения.",
  "Если данных не хватает, указывай это как проблему или используй placeholders: [метрика], [значение], [период], [действие].",
  "Анализ выполняется на дату {{analysisDate}}. Не считай даты раньше или равные этой дате будущими.",
  "Возраст, пол, дата рождения и гражданство нельзя использовать как причину снижения score или seniority.",
  "Возвращай только JSON, который соответствует Zod-схеме. Никакого markdown, prose и code fences.",
  "Пиши на русском языке.",
].join(" ");

function promptTemplate(task: string) {
  return [
    task,
    "",
    "Дата анализа: {{analysisDate}}",
    "",
    "Чистый текст резюме:",
    "{{cleanText}}",
    "",
    "Raw blocks с offsets:",
    "{{rawBlocksSummary}}",
    "",
    "Resume structure:",
    "{{structureSummary}}",
    "",
    "Semantic chunks:",
    "{{chunksSummary}}",
    "",
    "Target profile:",
    "{{targetProfileSummary}}",
    "",
    "Benchmark/rubric:",
    "{{benchmarkSummary}}",
    "",
    "Текущий workflow state:",
    "{{stateSummary}}",
  ].join("\n");
}

function llmPrompt(task: string, outputSchemaName: string) {
  return {
    system: systemPrompt,
    userTemplate: promptTemplate(task),
    outputSchemaName,
    modelPolicy: "selected_model" as const,
    temperature: 0.15,
  };
}

export const workflowNodeDefinitions = [
  {
    key: "resume_intake",
    label: "Resume intake",
    kind: "deterministic",
    description:
      "Проверяет входной текст резюме, источник, размер и базовую пригодность для анализа.",
    goal: "Не запускать дорогой анализ по пустому или явно сломанному input.",
    reads: ["WorkflowRun.input.text", "WorkflowRun.input.source"],
    writes: ["state.intake"],
    expectedOutput:
      "JSON с source, chars, language, status и техническими warnings.",
    debugHints: [
      "Если chars мало, анализ будет слабым.",
      "Если language unknown, следующие ноды могут хуже классифицировать секции.",
    ],
  },
  {
    key: "text_extraction",
    label: "Text extraction",
    kind: "deterministic",
    description:
      "В v1 принимает admin text как уже извлечённый plain text и нормализует переносы строк без потери кириллицы.",
    goal: "Получить исходный plain text для cleanup и дальнейшего block segmentation.",
    reads: ["state.source.text", "state.intake"],
    writes: ["state.extraction"],
    expectedOutput: "JSON с plainText, chars, lines, encoding=utf-8.",
    debugHints: [
      "Если текст здесь уже битый, проблема не в LLM.",
      "Реальный PDF/DOCX parser будет добавлен в эту ноду позже.",
    ],
  },
  {
    key: "document_cleanup",
    label: "Document cleanup",
    kind: "deterministic",
    description:
      "Удаляет экспортные артефакты HH/header/footer вроде строк 'Резюме обновлено...', повторных колонтитулов и служебных дублей.",
    goal: "Не отдавать аналитическим нодам мусор, который они ошибочно посчитают проблемой резюме.",
    reads: ["state.extraction.plainText"],
    writes: ["state.cleanup"],
    expectedOutput:
      "JSON с cleanText, removedArtifacts, charsBefore, charsAfter и warnings.",
    debugHints: [
      "Нода не должна удалять email, телефон, город, ссылки и полезные поля.",
      "Если false positive по дате обновления снова появляется, сначала проверь removedArtifacts.",
    ],
  },
  {
    key: "document_quality_check",
    label: "Document quality check",
    kind: "deterministic",
    description:
      "Проверяет мусорные символы, длинные строки, признаки сломанного извлечения и ATS-риск уже после cleanup.",
    goal: "Понять, насколько документ технически пригоден для ATS и анализа.",
    reads: ["state.cleanup.cleanText"],
    writes: ["state.documentQuality"],
    expectedOutput: "JSON с qualityScore, atsRiskFlags и warnings.",
    debugHints: [
      "Много replacement characters или очень длинные строки указывают на плохой PDF parsing.",
    ],
  },
  {
    key: "raw_block_segmentation",
    label: "Raw block segmentation",
    kind: "deterministic",
    description:
      "Режет clean text на безопасные raw blocks с offsets без попытки угадать job/skills/header.",
    goal: "Дать LLM стабильные block candidates, на которые можно ссылаться в ResumeStructure.",
    reads: ["state.cleanup.cleanText"],
    writes: ["state.rawBlocks"],
    expectedOutput: "RawResumeBlock[] с id, text, charStart, charEnd.",
    debugHints: [
      "Эта нода не классифицирует смысл, только сохраняет атомарные блоки и offsets.",
      "Если блоки слишком крупные, LLM будет хуже ссылаться на точные элементы.",
    ],
  },
  {
    key: "lossless_document_map",
    label: "Lossless document map",
    kind: "deterministic",
    description:
      "Builds displayBlocks directly from cleanText and rawBlocks. This is the source of truth for the UI document.",
    goal: "Guarantee that final report rendering can reconstruct 100% of cleanText with stable offsets.",
    reads: ["state.cleanup.cleanText", "state.rawBlocks"],
    writes: ["state.displayBlocks", "state.displayCoverage"],
    expectedOutput:
      "DisplayBlock[] with source='cleanText', charStart, charEnd and displayCoverage.",
    debugHints: [
      "If /resume shows a shortened document, inspect this node first.",
      "displayCoverage must be 1 for normal text input.",
    ],
  },
  {
    key: "document_outline",
    label: "Document outline",
    kind: "deterministic",
    description:
      "Builds a coarse section/range outline from all raw blocks without treating HH as the only supported resume format.",
    goal: "Give structure_extraction complete ranges so the LLM does not lose tail sections such as achievements, skills, education, and about.",
    reads: ["state.rawBlocks", "state.cleanup.cleanText"],
    writes: ["state.documentOutline"],
    expectedOutput:
      "DocumentOutlineRange[] with kind, label, rawBlockStartId, rawBlockEndId, rawBlockIds, confidence.",
    debugHints: [
      "If structure_extraction misses sections, verify this node contains ranges for the missing raw blocks.",
      "Unknown ranges are allowed; dropping raw blocks is not allowed.",
    ],
  },
  {
    key: "structure_extraction",
    label: "Structure extraction",
    kind: "llm",
    description:
      "LLM strict JSON parser, который строит ResumeStructure по raw blocks: header, targetRole, experience.jobs[], education, skills, about.",
    goal: "Понять произвольную структуру резюме там, где rule-based parser ломается.",
    reads: ["state.rawBlocks", "state.documentOutline", "state.cleanup.cleanText"],
    writes: ["state.resumeStructureDraft"],
    prompt: llmPrompt(
      "Построй ResumeStructure из raw blocks. Каждый смысловой элемент должен ссылаться на sourceBlockIds из raw blocks. Если видишь 'Опыт работы', даты, компании и должности — обязательно собери experience.jobs[]. Если видишь 'Желаемая должность' — обязательно собери targetRole. Не используй возраст, пол или гражданство для оценки.",
      "ResumeStructure",
    ),
    expectedOutput: "Strict JSON ResumeStructure.",
    debugHints: [
      "Если jobs пустые при наличии опыта, эта нода должна быть retry с validation errors.",
      "Не допускай ссылок на несуществующие rawBlockId.",
    ],
  },
  {
    key: "structure_repair",
    label: "Structure repair",
    kind: "deterministic",
    description:
      "Repairs the LLM ResumeStructure with deterministic documentOutline ranges: attaches duties/results/stack to the right work entries, restores sourceBlockIds, and merges wrapped bullets.",
    goal: "Prevent a partially structured resume from losing achievements, responsibilities, offsets, or tail coverage before validation and chunking.",
    reads: [
      "state.resumeStructureDraft",
      "state.documentOutline",
      "state.rawBlocks",
      "state.cleanup.cleanText",
    ],
    writes: ["state.resumeStructureRepaired", "state.structureRepair"],
    expectedOutput:
      "StructureRepairResult with repaired ResumeStructure, repairs[], coverageBefore, coverageAfter, and warnings.",
    debugHints: [
      "If achievements exist as outline ranges but jobs[].achievements is empty, this node should attach merged items to jobs.",
      "If a work entry has empty sourceBlockIds, this node should populate them from its outline span.",
      "The node must not assume a fixed number of jobs.",
    ],
  },
  {
    key: "structure_validation",
    label: "Structure validation",
    kind: "deterministic",
    description:
      "Проверяет ResumeStructure: ссылки на rawBlockId, наличие targetRole/experience при явных признаках и warnings.",
    goal: "Не позволить LLM тихо потерять опыт, целевую роль или крупные секции.",
    reads: [
      "state.resumeStructureRepaired",
      "state.rawBlocks",
      "state.cleanup.cleanText",
    ],
    writes: ["state.resumeStructure"],
    expectedOutput:
      "Validated ResumeStructure с validation errors/warnings и флагом isUsable.",
    debugHints: [
      "Если experience.jobs=[] при наличии дат и должностей, это критичный warning.",
      "Если targetRole=null при наличии 'Желаемая должность', это критичный warning.",
    ],
  },
  {
    key: "resume_chunking",
    label: "Resume chunking",
    kind: "deterministic",
    description:
      "Создаёт UI-facing semantic chunks из validated ResumeStructure, а не из line heuristics.",
    goal: "Получить стабильные sourceBlockId для подсветки, findings и replacements.",
    reads: ["state.resumeStructure", "state.rawBlocks"],
    writes: ["state.chunks"],
    expectedOutput:
      "Массив chunks с id, type, section, text, charStart, charEnd, parentId и meta.",
    debugHints: [
      "Ожидаемые типы: target_role, job_header, job_description, responsibility_bullet, achievement_bullet, job_stack, skill_item, education_item, about_paragraph.",
      "Если нет job_header/responsibility/achievement chunks, проблема в structure_extraction или validation.",
    ],
  },
  {
    key: "resume_normalization",
    label: "Resume normalization",
    kind: "llm",
    description:
      "Извлекает структурированную модель кандидата из validated ResumeStructure.",
    goal: "Дать аналитическим нодам normalized resume вместо сырого текста.",
    reads: ["state.resumeStructure", "state.chunks"],
    writes: ["state.normalizedResume"],
    prompt: llmPrompt(
      "Верни NormalizedResume strict JSON: candidateName, candidateTitle, totalYearsExperience, experience, skills, education, projects, summary. Используй только validated ResumeStructure.",
      "NormalizedResume",
    ),
    expectedOutput: "Strict JSON NormalizedResume.",
    debugHints: [
      "Если роль или опыт определены неверно, проверь structure_extraction и structure_validation.",
    ],
  },
  {
    key: "target_profile",
    label: "Target profile",
    kind: "llm",
    description:
      "Определяет целевую роль, уровень, рынок и ожидаемые ключевые навыки.",
    goal: "Сравнивать резюме относительно конкретной роли, а не абстрактно.",
    reads: ["state.normalizedResume", "state.resumeStructure"],
    writes: ["state.targetProfile"],
    prompt: llmPrompt(
      "Верни TargetProfile strict JSON: targetRole, seniority, marketDomain, expectedSkills, importantKeywords, confidence, missingContext. Не используй возраст/пол/гражданство как сигнал seniority.",
      "TargetProfile",
    ),
    expectedOutput: "Strict JSON TargetProfile.",
    debugHints: [
      "Если роль выбрана неверно, проверь targetRole в ResumeStructure.",
    ],
  },
  {
    key: "benchmark_context",
    label: "Benchmark context",
    kind: "llm",
    description:
      "Формирует benchmark сильного резюме под найденный target profile.",
    goal: "Сделать критерии анализа явными до поиска проблем.",
    reads: ["state.targetProfile", "state.normalizedResume"],
    writes: ["state.benchmark"],
    prompt: llmPrompt(
      "Верни BenchmarkContext strict JSON: requiredElements, strongSignals, weakSignals, expectedEvidence, keywords, scoringNotes для target profile.",
      "BenchmarkContext",
    ),
    expectedOutput: "Strict JSON BenchmarkContext.",
    debugHints: [
      "Если benchmark слишком общий, targetProfile недостаточно конкретный.",
    ],
  },
  {
    key: "scoring_rubric",
    label: "Scoring rubric",
    kind: "deterministic",
    description:
      "Создаёт фиксированные веса и правила скоринга до аналитических нод.",
    goal: "Считать итоговый score по прозрачным правилам после typed findings.",
    reads: ["state.targetProfile", "state.documentQuality"],
    writes: ["state.rubric"],
    expectedOutput:
      "JSON с категориями ATS, structure, experience, skills, keywords, marketFit, readability, credibility.",
    debugHints: [
      "Rubric deterministic; ошибки обычно в весах или category mapping.",
    ],
  },
  {
    key: "analysis_task_planner",
    label: "Analysis task planner",
    kind: "deterministic",
    description:
      "Splits the full lossless document map into range-based analysis tasks so audit nodes cover the whole resume.",
    goal: "Prevent analysis from depending only on incomplete semantic structure or chunks.",
    reads: ["state.displayBlocks", "state.cleanup.cleanText"],
    writes: ["state.analysisTasks"],
    expectedOutput:
      "AnalysisTask[] with category, sectionHint, charStart, charEnd, text and expectedFindingTypes.",
    debugHints: [
      "Every major part of cleanText should be covered by at least one analysis task.",
      "Long sections may be split into multiple tasks; truncating the tail is not allowed.",
    ],
  },
  {
    key: "ats_format_analysis",
    label: "ATS analysis",
    kind: "llm",
    description:
      "Ищет только ATS-проблемы, нестандартные заголовки, keyword gaps и проблемы машинного чтения.",
    goal: "Найти то, что мешает пройти автоматические системы отбора.",
    reads: ["state.resumeStructure", "state.chunks", "state.targetProfile"],
    writes: ["state.atsFindings"],
    prompt: llmPrompt(
      "Верни только JSON { findings }. Найди только ATS и keyword-проблемы. Каждый finding должен иметь severity, category, sourceBlockId, originalFragment, title, problem, whyItMatters, replacementStrategy, confidence.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: ["Не оценивай стиль и опыт вне ATS-контекста."],
  },
  {
    key: "structure_completeness_analysis",
    label: "Structure completeness",
    kind: "llm",
    description:
      "Анализирует структуру, header, позиционирование, summary и completeness.",
    goal: "Понять, насколько быстро рекрутер понимает, кто кандидат и под какую роль он подходит.",
    reads: ["state.resumeStructure", "state.chunks", "state.targetProfile"],
    writes: ["state.structureFindings"],
    prompt: llmPrompt(
      "Верни только JSON { findings }. Найди проблемы структуры, header, positioning, summary, порядка секций и completeness.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Section-level issue допустим только если нет конкретного sourceBlockId.",
    ],
  },
  {
    key: "positioning_summary_analysis",
    label: "Positioning summary",
    kind: "llm",
    description:
      "Audits target role, seniority positioning, summary, profile pitch and duplicated intro content using exact quotes from analysis tasks.",
    goal: "Find issues that prevent a recruiter from quickly understanding who the candidate is and why they fit the target role.",
    reads: ["state.analysisTasks", "state.resumeStructure", "state.targetProfile"],
    writes: ["state.positioningFindings"],
    prompt: llmPrompt(
      "Return only JSON { findings }. Audit positioning, summary, target role and seniority clarity. Every finding must include exactQuote copied from provided text.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Do not create a finding without an exact quote from the provided task text.",
    ],
  },
  {
    key: "experience_bullet_analysis",
    label: "Experience bullet analysis",
    kind: "llm",
    description:
      "Анализирует опыт, bullet points, метрики, вклад и доказательность достижений.",
    goal: "Отделить обязанности от результатов и найти слабые/недостоверные достижения.",
    reads: ["state.normalizedResume", "state.chunks", "state.targetProfile"],
    writes: ["state.experienceFindings"],
    prompt: llmPrompt(
      "Верни только JSON { findings }. Найди проблемы опыта, bullet quality, metrics evidence и credibility. Не выдумывай точные цифры; если их нет, replacementStrategy должен требовать placeholders.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Если finding добавляет новую метрику как факт, это ошибка и должна быть отловлена validation-нодой.",
    ],
  },
  {
    key: "metrics_evidence_analysis",
    label: "Metrics evidence analysis",
    kind: "llm",
    description:
      "Audits measurable evidence, overclaiming, missing baseline/context and risky impact claims using exact quotes.",
    goal: "Find resume statements that need metrics, safer wording, or proof of impact.",
    reads: ["state.analysisTasks", "state.resumeStructure", "state.targetProfile"],
    writes: ["state.metricsFindings"],
    prompt: llmPrompt(
      "Return only JSON { findings }. Audit metrics gaps, evidence gaps and overclaiming. Every finding must include exactQuote copied from provided text.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Do not invent missing metrics; request placeholders or safer wording.",
    ],
  },
  {
    key: "skills_keywords_analysis",
    label: "Skills keywords analysis",
    kind: "llm",
    description:
      "Анализирует навыки, keyword gaps, seniority и соответствие рынку.",
    goal: "Понять, подтверждает ли резюме целевую роль и уровень.",
    reads: [
      "state.normalizedResume",
      "state.targetProfile",
      "state.benchmark",
      "state.chunks",
    ],
    writes: ["state.skillsMarketFindings"],
    prompt: llmPrompt(
      "Верни только JSON { findings }. Найди проблемы skills, keyword coverage, seniority и market fit. Проверяй, подтверждены ли навыки опытом. Не используй возраст/пол/гражданство как evidence.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Soft skills без подтверждения обычно weak/green или warning.",
    ],
  },
  {
    key: "language_readability_analysis",
    label: "Language readability",
    kind: "llm",
    description:
      "Анализирует язык, ясность, читаемость, форматирование и consistency.",
    goal: "Найти слабые формулировки, клише, длинные предложения, повторы и противоречия.",
    reads: ["state.resumeStructure", "state.chunks", "state.normalizedResume"],
    writes: ["state.languageFindings"],
    prompt: llmPrompt(
      "Верни только JSON { findings }. Найди проблемы языка, clarity, readability, formatting и consistency. Не ругай дату обновления резюме, если она не позже даты анализа.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Эта нода не должна менять смысл резюме, только качество подачи.",
    ],
  },
  {
    key: "credibility_consistency_analysis",
    label: "Credibility consistency analysis",
    kind: "llm",
    description:
      "Audits consistency, unsupported claims, date/context contradictions and credibility risks using exact quotes.",
    goal: "Find claims that could look unreliable to a recruiter or hiring manager.",
    reads: ["state.analysisTasks", "state.resumeStructure", "state.targetProfile"],
    writes: ["state.credibilityFindings"],
    prompt: llmPrompt(
      "Return only JSON { findings }. Audit credibility, consistency and unsupported claims. Every finding must include exactQuote copied from provided text.",
      "AnalysisFindings",
    ),
    expectedOutput: "Strict JSON { findings: TypedFinding[] }.",
    debugHints: [
      "Do not use protected attributes as negative findings.",
      "Dates equal to or earlier than analysisDate are not future-date problems.",
    ],
  },
  {
    key: "findings_normalization",
    label: "Findings normalization",
    kind: "deterministic",
    description:
      "Собирает typed findings из всех analytical nodes, дедуплицирует повторы и нормализует severity/category.",
    goal: "Получить центральный массив findings, который станет ядром продукта.",
    reads: [
      "state.atsFindings",
      "state.structureFindings",
      "state.experienceFindings",
      "state.skillsMarketFindings",
      "state.languageFindings",
    ],
    writes: ["state.findings"],
    expectedOutput: "TypedFinding[] с нормальными id finding_001...",
    debugHints: [
      "Ожидаемый порядок величины для тестового резюме: 12-18 качественных findings, не 28 дублей.",
    ],
  },
  {
    key: "issue_coverage_gate",
    label: "Issue coverage gate",
    kind: "deterministic",
    description:
      "Checks whether the audit found enough anchored issues across the full cleanText and adds deterministic gap findings when the LLM under-reports.",
    goal: "Avoid final reports with only a few findings on a full resume.",
    reads: ["state.findings", "state.displayBlocks", "state.cleanup.cleanText"],
    writes: ["state.coverageFindings"],
    expectedOutput:
      "TypedFinding[] after coverage gate, targetMin/targetMax and warnings.",
    debugHints: [
      "Normal full resumes should usually produce 20-40 findings after dedupe.",
      "Every added finding must still have exactQuote from cleanText.",
    ],
  },
  {
    key: "fragment_anchoring",
    label: "Fragment anchoring",
    kind: "deterministic",
    description:
      "Связывает каждый finding с chunk/sourceBlockId и charStart/charEnd для будущей подсветки.",
    goal: "Сделать findings пригодными для UI: левая панель -> подсветка в тексте -> правая панель.",
    reads: ["state.findings", "state.chunks"],
    writes: ["state.anchoredFindings"],
    expectedOutput:
      "ValidatedFinding[] без replacements, но с charStart/charEnd и anchorStatus.",
    debugHints: [
      "Минимум 80% findings должны иметь sourceBlockId и charStart/charEnd.",
    ],
  },
  {
    key: "replacement_generation_validation",
    label: "Replacement validation",
    kind: "llm",
    description:
      "Генерирует и валидирует replacements строго по findingId, запрещая выдуманные факты и метрики.",
    goal: "Дать пользователю безопасные конкретные замены вместо общих советов.",
    reads: ["state.anchoredFindings", "state.chunks", "state.normalizedResume"],
    writes: ["state.replacements", "state.validatedFindings"],
    prompt: llmPrompt(
      "Верни только JSON { replacements }. Для каждого findingId из anchoredFindings предложи 1-3 replacementOptions. Первый вариант должен быть safe_rewrite без выдуманных фактов; второй может быть template с placeholders.",
      "ReplacementValidation",
    ),
    expectedOutput: "Strict JSON { replacements: FindingReplacement[] }.",
    debugHints: [
      "Каждый replacement должен иметь существующий findingId и isSafe.",
      "Если LLM вернула chunk id вместо finding id, результат должен быть отклонён и повторён.",
    ],
  },
  {
    key: "score_calculation",
    label: "Score calculation",
    kind: "deterministic",
    description:
      "Считает overall и category scores только после typed/anchored findings.",
    goal: "Score должен зависеть от red/warning/green, ATS risks, completeness, evidence, keywords и credibility.",
    reads: ["state.validatedFindings", "state.rubric", "state.documentQuality"],
    writes: ["state.scores", "state.priorities"],
    expectedOutput: "JSON scores + priorities + recommendations.",
    debugHints: [
      "Green не должен снижать score.",
      "Возраст/пол/гражданство не должны попадать в score penalty.",
    ],
  },
  {
    key: "final_report_assembly",
    label: "Final report assembly",
    kind: "deterministic",
    description:
      "Собирает финальный ResumeAnalysisReport из chunks, sections, findings, scores, priorities и recommendations.",
    goal: "Получить единый UI-ready объект для результата анализа резюме.",
    reads: [
      "state.chunks",
      "state.resumeStructure",
      "state.validatedFindings",
      "state.scores",
    ],
    writes: ["WorkflowRun.finalResult", "WorkflowRun.output"],
    expectedOutput:
      "ResumeAnalysisReport: version, runId, analysisDate, chunks, sections, findings, scores, priorities, recommendations.",
    debugHints: [
      "Если final report бедный, проверяй structure_extraction/validation и typed findings, а не UI.",
    ],
  },
] satisfies readonly WorkflowNodeDefinition[];

export type WorkflowNodeKey = (typeof workflowNodeDefinitions)[number]["key"];

export type WorkflowRunSnapshot = {
  id: string;
  type: typeof RESUME_ANALYSIS_WORKFLOW_TYPE;
  status: "pending" | "running" | "success" | "error";
  input: unknown;
  output?: unknown;
  error?: string | null;
  currentNodeKey?: WorkflowNodeKey | null;
  nextNodeKey?: WorkflowNodeKey | null;
  finalResult?: unknown;
  savedAnalysisId?: string | null;
  derivedResumeId?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  nodes: WorkflowNodeSnapshot[];
};

export type WorkflowNodeSnapshot = {
  key: WorkflowNodeKey;
  label: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  input?: unknown;
  output?: unknown;
  debug?: WorkflowNodeDebug;
  error?: string | null;
  order: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
};

export type WorkflowSseEvent = {
  type: "snapshot" | "run_update" | "node_update" | "done" | "error";
  data: WorkflowRunSnapshot;
};
