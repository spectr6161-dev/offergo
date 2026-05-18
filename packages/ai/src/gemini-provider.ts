import {
  convertToModelMessages,
  generateText as generateSdkText,
  Output,
  streamText as streamSdkText,
} from "ai";
import { env } from "@offergo/shared";
import { z } from "zod";

import { serializeAiError } from "./errors";
import {
  AI_PLAYGROUND_DEFAULT_IMAGE_MODEL,
  YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL,
} from "./model-catalog";
import type {
  AiAudioTranscriptionInput,
  AiChatInput,
  AiImageInput,
  AiObjectInput,
  AiSpeechInput,
  AiTextInput,
} from "./types";
import { getYandexTextModel, isYandexTextModelId } from "./yandex-provider";

/**
 * Gemini provider layer.
 *
 * Правила для агентов:
 * - Это единственное место пакета, где создаётся Google provider и выполняются вызовы Gemini.
 * - Text/chat/object/image идут через Vercel AI SDK (`ai` + `@ai-sdk/google`).
 * - Structured output в AI SDK v6 делается через `generateText` + `Output.object`.
 * - TTS пока идёт через Gemini REST здесь, потому что provider-specific детали не должны
 *   утекать в `apps/*`.
 */

const playgroundChatSystemPrompt = [
  "You are a normal conversational AI assistant inside an admin-only development playground.",
  "Answer the user's message directly.",
  "Do not roleplay as a terminal, session manager, command router, or admin console.",
  "If the user greets you, greet them naturally and offer to help test the model.",
  "Use Russian by default unless the user asks for another language.",
].join(" ");

const aiSdkGenerationTimeoutMs = 120 * 1000;

function assertYandexOnlyProvider(feature: string, modelId?: string): never {
  throw new Error(
    `${feature} через Google/Gemini отключён: проект настроен на использование российских AI-провайдеров без запросов к зарубежным серверам.${
      modelId ? ` Запрошенная модель: ${modelId}.` : ""
    }`,
  );
}

function getTextModel(modelId?: AiTextInput["modelId"]) {
  const selectedModel =
    modelId ?? env.YANDEX_MODEL_TEXT ?? YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;

  if (isYandexTextModelId(selectedModel)) {
    return getYandexTextModel(selectedModel);
  }

  return assertYandexOnlyProvider("Генерация текста", selectedModel);
}

function getImageModel(modelId?: AiImageInput["modelId"]) {
  return assertYandexOnlyProvider(
    "Генерация изображений",
    modelId ?? AI_PLAYGROUND_DEFAULT_IMAGE_MODEL,
  );
}

function normalizeTextInput(input: string | AiTextInput): AiTextInput {
  return typeof input === "string" ? { prompt: input } : input;
}

export async function generateAiTextResult(input: string | AiTextInput) {
  const normalized = normalizeTextInput(input);
  const modelId =
    normalized.modelId ??
    env.YANDEX_MODEL_TEXT ??
    YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;
  const result = await generateSdkText({
    model: getTextModel(modelId),
    prompt: normalized.prompt,
    system: normalized.system,
    temperature: normalized.temperature,
    maxOutputTokens: normalized.maxOutputTokens,
    timeout: aiSdkGenerationTimeoutMs,
  });

  return {
    text: result.text,
    modelId,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  };
}

export async function generateAiText(input: string | AiTextInput) {
  const result = await generateAiTextResult(input);
  return result.text;
}

export async function streamAiText(input: AiChatInput) {
  const messages = await convertToModelMessages(input.messages);

  return streamSdkText({
    model: getTextModel(input.modelId),
    messages,
    system: input.system ?? playgroundChatSystemPrompt,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    timeout: aiSdkGenerationTimeoutMs,
    onError: ({ error }) => {
      throw new Error(serializeAiError(error));
    },
  });
}

export async function generateAiObject<Schema extends z.ZodType>(
  input: AiObjectInput<Schema>,
) {
  const modelId =
    input.modelId ??
    env.YANDEX_MODEL_TEXT ??
    YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;

  if (isYandexTextModelId(modelId)) {
    const result = await generateSdkText({
      model: getTextModel(modelId),
      prompt: buildYandexJsonPrompt(input.prompt, input.schema),
      system: appendJsonSystemInstruction(input.system),
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      timeout: aiSdkGenerationTimeoutMs,
    });
    const object = await parseAndValidateYandexObject(result.text, input.schema);

    return {
      object,
      modelId,
      finishReason: result.finishReason,
      usage: result.usage,
      warnings: [
        ...(result.warnings ?? []),
        {
          type: "yandex_json_text_mode",
          message:
            "Yandex AI Studio rejects optional JSON Schema fields, so structured output was generated as JSON text and validated locally.",
        },
      ],
    };
  }

  const result = await generateSdkText({
    model: getTextModel(modelId),
    output: Output.object({
      schema: input.schema,
    }),
    prompt: input.prompt,
    system: input.system,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    timeout: aiSdkGenerationTimeoutMs,
  });

  return {
    object: result.output as z.infer<Schema>,
    modelId,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  };
}

function appendJsonSystemInstruction(system?: string) {
  const instruction = [
    "Return only valid JSON.",
    "Do not wrap JSON in markdown.",
    "Do not include explanations before or after the JSON.",
  ].join(" ");

  return system ? `${system}\n\n${instruction}` : instruction;
}

function buildYandexJsonPrompt<Schema extends z.ZodType>(
  prompt: string,
  schema: Schema,
) {
  const jsonSchema = z.toJSONSchema(schema);
  const { $schema: _schema, ...schemaWithoutMeta } = jsonSchema as Record<
    string,
    unknown
  >;

  return [
    prompt,
    "",
    "Return a JSON value that validates against this JSON Schema.",
    "Important: output JSON only, no markdown, no prose, no code fences.",
    "",
    "JSON Schema:",
    JSON.stringify(schemaWithoutMeta),
  ].join("\n");
}

async function parseAndValidateYandexObject<Schema extends z.ZodType>(
  text: string,
  schema: Schema,
) {
  const jsonText = extractJsonText(text);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Yandex structured output returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }. Raw response: ${text.slice(0, 500)}`,
    );
  }

  const validation = await schema.safeParseAsync(sanitizeStructuredJson(parsed));

  if (!validation.success) {
    throw new Error(
      `Yandex structured output did not match schema: ${validation.error.message}`,
    );
  }

  return validation.data as z.infer<Schema>;
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue with extraction below.
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : -1;

  if (start < 0) {
    return trimmed;
  }

  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(close);

  return end > start ? trimmed.slice(start, end + 1).trim() : trimmed;
}

function sanitizeStructuredJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeStructuredJson(item))
      .filter((item) => {
        if (typeof item === "string") {
          return item.trim().length > 0;
        }

        if (item && typeof item === "object" && !Array.isArray(item)) {
          const record = item as Record<string, unknown>;

          if ("text" in record && typeof record.text === "string") {
            return record.text.trim().length > 0;
          }

          if ("value" in record && typeof record.value === "string") {
            return record.value.trim().length > 0;
          }
        }

        return item !== null && item !== undefined;
      });
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        typeof item === "string" ? item.trim() : sanitizeStructuredJson(item),
      ]),
    );
  }

  return value;
}

export async function generateAiImage(input: AiImageInput) {
  const modelId = input.modelId ?? AI_PLAYGROUND_DEFAULT_IMAGE_MODEL;
  return getImageModel(modelId);
}

export async function transcribeAiAudio(input: AiAudioTranscriptionInput) {
  const modelId =
    input.modelId ??
    env.YANDEX_MODEL_TEXT ??
    YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;

  return assertYandexOnlyProvider(
    "Аудиотранскрибация через Gemini",
    modelId,
  );
}

export async function generateAiSpeech(input: AiSpeechInput) {
  return assertYandexOnlyProvider("Озвучивание через Gemini", input.modelId);
}

function pcmBase64ToWavBase64(
  pcmBase64: string,
  sampleRate = 24_000,
  channels = 1,
  bitsPerSample = 16,
) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}
