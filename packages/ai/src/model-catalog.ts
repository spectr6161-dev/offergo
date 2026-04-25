/**
 * Каталог моделей для внутреннего AI SDK.
 *
 * Быстрая навигация для агентов:
 * - text models используются в generateAiText/streamAiText/generateAiObject/STT;
 * - image models используются в generateAiImage;
 * - speech models используются в generateAiSpeech через Gemini TTS REST внутри gemini-provider;
 * - preview-модели можно тестировать в playground, но для production лучше явно выбирать stable.
 *
 * Актуальность сверена 2026-04-25:
 * - Vercel AI SDK 6: `ai@6.0.168`, `@ai-sdk/google@3.0.64`;
 * - Google Gemini docs: Gemini 3.1 Pro, Gemini 3 Flash, Gemini 3.1 Flash-Lite,
 *   Nano Banana 2 (`gemini-3.1-flash-image-preview`), Gemini 3.1 Flash TTS.
 */

export const AI_PLAYGROUND_DEFAULT_TEXT_MODEL = "gemini-3.1-pro-preview";
export const AI_PLAYGROUND_FAST_TEXT_MODEL = "gemini-3-flash-preview";
export const AI_PLAYGROUND_CHEAP_TEXT_MODEL = "gemini-3.1-flash-lite-preview";
export const AI_PLAYGROUND_DEFAULT_IMAGE_MODEL =
  "gemini-3.1-flash-image-preview";
export const AI_PLAYGROUND_DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";

export type AiModelTier = "preview" | "stable" | "deprecated";

export type AiModelDefinition = {
  id: string;
  name: string;
  description: string;
  tier: AiModelTier;
};

export const aiTextModels = [
  {
    id: AI_PLAYGROUND_DEFAULT_TEXT_MODEL,
    name: "Gemini 3.1 Pro Preview",
    description: "Основная preview-модель для сложных задач и агентной логики.",
    tier: "preview",
  },
  {
    id: AI_PLAYGROUND_FAST_TEXT_MODEL,
    name: "Gemini 3 Flash Preview",
    description: "Быстрый preview-вариант для интерактивного чата.",
    tier: "preview",
  },
  {
    id: AI_PLAYGROUND_CHEAP_TEXT_MODEL,
    name: "Gemini 3.1 Flash-Lite Preview",
    description: "Дешёвый preview-вариант для массовых smoke-тестов.",
    tier: "preview",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Production-safe быстрый вариант.",
    tier: "stable",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Production-safe pro-вариант.",
    tier: "stable",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    description: "Production-safe дешёвый вариант.",
    tier: "stable",
  },
] as const satisfies readonly AiModelDefinition[];

export const aiImageModels = [
  {
    id: AI_PLAYGROUND_DEFAULT_IMAGE_MODEL,
    name: "Gemini 3.1 Flash Image Preview",
    description: "Nano Banana 2, быстрый preview image model.",
    tier: "preview",
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image Preview",
    description: "Nano Banana Pro, preview image model для сложной генерации.",
    tier: "preview",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    description: "Стабильный Gemini image model.",
    tier: "stable",
  },
  {
    id: "imagen-4.0-generate-001",
    name: "Imagen 4",
    description: "Стабильная text-to-image модель Imagen.",
    tier: "stable",
  },
  {
    id: "imagen-4.0-fast-generate-001",
    name: "Imagen 4 Fast",
    description: "Быстрая стабильная text-to-image модель Imagen.",
    tier: "stable",
  },
  {
    id: "imagen-4.0-ultra-generate-001",
    name: "Imagen 4 Ultra",
    description: "Ultra-вариант Imagen для качества.",
    tier: "stable",
  },
] as const satisfies readonly AiModelDefinition[];

export const aiSpeechModels = [
  {
    id: AI_PLAYGROUND_DEFAULT_TTS_MODEL,
    name: "Gemini 3.1 Flash TTS Preview",
    description: "Актуальная Gemini TTS preview-модель.",
    tier: "preview",
  },
  {
    id: "gemini-2.5-flash-preview-tts",
    name: "Gemini 2.5 Flash Preview TTS",
    description: "Быстрая TTS preview-модель предыдущего поколения.",
    tier: "preview",
  },
  {
    id: "gemini-2.5-pro-preview-tts",
    name: "Gemini 2.5 Pro Preview TTS",
    description: "Качественная TTS preview-модель предыдущего поколения.",
    tier: "preview",
  },
] as const satisfies readonly AiModelDefinition[];

export const aiTtsVoices = [
  "Kore",
  "Puck",
  "Zephyr",
  "Charon",
  "Fenrir",
  "Aoede",
  "Orus",
  "Leda",
  "Achird",
  "Sulafat",
] as const;

export type AiTextModelId = (typeof aiTextModels)[number]["id"] | (string & {});
export type AiImageModelId =
  | (typeof aiImageModels)[number]["id"]
  | (string & {});
export type AiSpeechModelId =
  | (typeof aiSpeechModels)[number]["id"]
  | (string & {});
export type AiTtsVoice = (typeof aiTtsVoices)[number] | (string & {});
