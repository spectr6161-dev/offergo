/**
 * Внутренний AI SDK проекта.
 *
 * Правила для людей и агентов:
 * - любой код, который обращается к LLM, image, TTS, STT или другим AI API,
 *   сначала добавляется сюда, а не в `apps/*`;
 * - `apps/web`, `apps/api`, `apps/worker` импортируют только публичные функции
 *   из `@offergo/ai`;
 * - provider-specific детали лежат в `gemini-provider.ts`;
 * - каталог актуальных моделей лежит в `model-catalog.ts`;
 * - продуктовые use-case функции лежат отдельно в `use-cases.ts`.
 *
 * Текущее состояние:
 * - Vercel AI SDK используется для text/chat/object/image;
 * - Gemini TTS пока идёт через REST Gemini API внутри provider слоя, потому что
 *   актуальный `@ai-sdk/google` не отдаёт SpeechModel factory для Gemini TTS;
 * - Live audio/realtime не реализован в v1.
 */

export * from "./gemini-provider";
export * from "./yandex-provider";
export * from "./errors";
export * from "./model-catalog";
export * from "./types";
export * from "./use-cases";
