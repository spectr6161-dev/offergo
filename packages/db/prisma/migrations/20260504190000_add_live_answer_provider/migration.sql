CREATE TYPE "LiveAnswerProvider" AS ENUM ('yandex', 'gemini');

ALTER TABLE "LiveAssistantSettings"
ADD COLUMN "answerProvider" "LiveAnswerProvider" NOT NULL DEFAULT 'yandex';

ALTER TABLE "LiveSession"
ADD COLUMN "answerProvider" "LiveAnswerProvider" NOT NULL DEFAULT 'yandex';

ALTER TABLE "LiveAssistantSettings"
ALTER COLUMN "prompt" SET DEFAULT 'Отвечай кратко и по делу. Помогай как ассистент на live-звонке: выделяй готовую формулировку ответа, избегай длинной теории и не выдумывай контекст.';
