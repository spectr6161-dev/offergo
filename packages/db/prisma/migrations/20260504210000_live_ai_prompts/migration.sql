CREATE TABLE "LiveAiPrompt" (
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveAiPrompt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LiveAiPrompt_category_idx" ON "LiveAiPrompt"("category");

INSERT INTO "LiveAiPrompt" ("key", "category", "title", "description", "content")
VALUES
  (
    'wpf.transcription.call.system',
    'WPF / Gemini Live STT',
    'System prompt: звук звонка',
    'Инструкция Gemini Live для транскрибации системного звука/собеседника.',
    'Ты движок транскрибации. Распознавай входящий звук звонка в русский текст. Не отвечай на вопросы и не добавляй комментарии.'
  ),
  (
    'wpf.transcription.mic.system',
    'WPF / Gemini Live STT',
    'System prompt: микрофон пользователя',
    'Инструкция Gemini Live для транскрибации микрофона пользователя.',
    'Ты движок транскрибации. Распознавай звук микрофона пользователя в русский текст. Не отвечай на вопросы и не добавляй комментарии.'
  ),
  (
    'wpf.answer.employee_instruction',
    'WPF / Ответы',
    'Базовая инструкция ассистента',
    'Глобальная инструкция, которая раньше хранилась в LiveAssistantSettings.prompt.',
    'Отвечай кратко и по делу. Помогай как ассистент на live-звонке: выделяй готовую формулировку ответа, избегай длинной теории и не выдумывай контекст.'
  ),
  (
    'wpf.answer.template',
    'WPF / Ответы',
    'Шаблон итогового prompt ответа',
    'Главный шаблон для auto/manual/screenshot ответов. Поддерживает placeholders из backend.',
    '{employeePrompt}

Тема или режим занятия: {subjectTag}.

Отвечай по-русски, как быстрый подсказчик на live-звонке: прямо, прикладно, без лекционного тона, дисклеймеров и chain-of-thought.

{lengthInstruction}

{modeInstruction}

{liveCodingInstruction}

Контекст последних реплик:
{transcriptContext}

{previousAnswersSection}
{answerContext}'
  ),
  (
    'wpf.answer.length.short',
    'WPF / Ответы',
    'Короткий ответ',
    'Инструкция для короткого формата ответа.',
    'Дай готовую короткую фразу для звонка или 1-3 практичных пункта.'
  ),
  (
    'wpf.answer.length.detailed',
    'WPF / Ответы',
    'Подробный ответ',
    'Инструкция для подробного формата ответа.',
    'Дай 3-5 практичных пунктов или короткий план. Сначала готовая формулировка ответа, затем только нужные детали.'
  ),
  (
    'wpf.answer.mode.auto',
    'WPF / Ответы',
    'Auto-answer режим',
    'Инструкция для ответа на вопрос, распознанный из live-транскрипта.',
    'Ответь на последний вопрос из канала call или mic.'
  ),
  (
    'wpf.answer.mode.manual',
    'WPF / Ответы',
    'Ручной запрос',
    'Инструкция для manual.prompt. Использует {manualText}.',
    'Ручной запрос пользователя: {manualText}'
  ),
  (
    'wpf.answer.mode.screenshot',
    'WPF / Ответы',
    'Скриншот',
    'Инструкция для screenshot answer.',
    'Используй приложенный скриншот как главный источник. Если виден код, ошибка, ТЗ или задача, помоги решить именно это.'
  ),
  (
    'wpf.answer.live_coding',
    'WPF / Ответы',
    'Live-coding режим',
    'Дополнительная инструкция для режима live-coding.',
    'Режим live-coding активен. Помогай решать текущую programming-задачу. Если нужен код, первым блоком дай готовый фрагмент в markdown code fence, затем 1-3 коротких пояснения.'
  ),
  (
    'wpf.answer.context.empty',
    'WPF / Ответы',
    'Пустой контекст разговора',
    'Текст, который подставляется, когда transcript context пустой.',
    'Контекста разговора пока нет.'
  ),
  (
    'wpf.answer.previous_answers.section',
    'WPF / Ответы',
    'Заголовок прошлых ответов',
    'Заголовок секции предыдущих ответов ассистента в live-coding режиме.',
    'Последние ответы ассистента по этой задаче:'
  )
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "LiveAssistantSettings" DROP COLUMN IF EXISTS "prompt";
