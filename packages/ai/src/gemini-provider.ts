import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  generateImage as generateSdkImage,
  generateObject as generateSdkObject,
  generateText as generateSdkText,
  streamText as streamSdkText,
} from "ai";
import { env } from "@offergo/shared";
import type { z } from "zod";

import { serializeAiError } from "./errors";
import {
  AI_PLAYGROUND_DEFAULT_IMAGE_MODEL,
  AI_PLAYGROUND_DEFAULT_TEXT_MODEL,
  AI_PLAYGROUND_DEFAULT_TTS_MODEL,
} from "./model-catalog";
import type {
  AiAudioTranscriptionInput,
  AiChatInput,
  AiImageInput,
  AiObjectInput,
  AiSpeechInput,
  AiTextInput,
} from "./types";

/**
 * Gemini provider layer.
 *
 * Быстрая документация для агентов:
 * - Это единственное место пакета, где создаётся Google provider и выполняются
 *   вызовы Gemini.
 * - Text/chat/object/image идут через Vercel AI SDK (`ai` + `@ai-sdk/google`).
 * - STT реализован через multimodal `generateText` с audio/file part, потому что
 *   Gemini audio understanding покрывается language model API.
 * - TTS пока не покрыт `@ai-sdk/google` как SpeechModel factory, поэтому REST
 *   вызов Gemini TTS допустим только здесь, внутри provider-specific слоя.
 * - Приложения (`apps/web`, `apps/api`, `apps/worker`) не должны импортировать
 *   `@ai-sdk/google`, `ai` provider helpers или прямой Gemini REST.
 */

const playgroundChatSystemPrompt = [
  "You are a normal conversational AI assistant inside an admin-only development playground.",
  "Answer the user's message directly.",
  "Do not roleplay as a terminal, session manager, command router, or admin console.",
  "If the user greets you, greet them naturally and offer to help test the model.",
  "Use Russian by default unless the user asks for another language.",
].join(" ");

const geminiRestTimeoutMs = 30 * 1000;

async function fetchGeminiRest(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geminiRestTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Gemini REST request timeout after ${geminiRestTimeoutMs}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getGoogleProvider() {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return createGoogleGenerativeAI({
    apiKey: env.GEMINI_API_KEY,
  });
}

function getTextModel(modelId?: AiTextInput["modelId"]) {
  return getGoogleProvider()(modelId ?? env.GEMINI_MODEL_TEXT);
}

function getImageModel(modelId?: AiImageInput["modelId"]) {
  return getGoogleProvider().image(
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
    env.GEMINI_MODEL_TEXT ??
    AI_PLAYGROUND_DEFAULT_TEXT_MODEL;
  const result = await generateSdkText({
    model: getTextModel(modelId),
    prompt: normalized.prompt,
    system: normalized.system,
    temperature: normalized.temperature,
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
    onError: ({ error }) => {
      throw new Error(serializeAiError(error));
    },
  });
}

export async function generateAiObject<Schema extends z.ZodType>(
  input: AiObjectInput<Schema>,
) {
  const modelId =
    input.modelId ?? env.GEMINI_MODEL_TEXT ?? AI_PLAYGROUND_DEFAULT_TEXT_MODEL;
  const result = await generateSdkObject({
    model: getTextModel(modelId),
    prompt: input.prompt,
    schema: input.schema,
    system: input.system,
    temperature: input.temperature,
  });

  return {
    object: result.object as z.infer<Schema>,
    modelId,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  };
}

export async function generateAiImage(input: AiImageInput) {
  const modelId = input.modelId ?? AI_PLAYGROUND_DEFAULT_IMAGE_MODEL;
  const result = await generateSdkImage({
    model: getImageModel(modelId),
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
  });

  return {
    imageBase64: result.image.base64,
    mediaType: result.image.mediaType,
    dataUrl: `data:${result.image.mediaType};base64,${result.image.base64}`,
    modelId,
    warnings: result.warnings,
    responses: result.responses,
  };
}

export async function transcribeAiAudio(input: AiAudioTranscriptionInput) {
  const modelId =
    input.modelId ?? env.GEMINI_MODEL_TEXT ?? AI_PLAYGROUND_DEFAULT_TEXT_MODEL;
  const result = await generateSdkText({
    model: getTextModel(modelId),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              input.prompt ??
              "Transcribe this audio. Return only the transcript text.",
          },
          {
            type: "file",
            mediaType: input.mediaType,
            data: input.audio,
          },
        ],
      },
    ],
  });

  return {
    text: result.text,
    modelId,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  };
}

export async function generateAiSpeech(input: AiSpeechInput) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const modelId = input.modelId ?? AI_PLAYGROUND_DEFAULT_TTS_MODEL;
  const voiceName = input.voice ?? "Kore";
  const response = await fetchGeminiRest(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: input.text,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
        model: modelId,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Gemini TTS request failed: ${response.status} ${message.slice(0, 500)}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            data?: string;
            mimeType?: string;
          };
        }>;
      };
    }>;
  };
  const audioBase64 =
    payload.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error("Gemini TTS response did not include audio data.");
  }

  const wav = pcmBase64ToWavBase64(audioBase64);

  return {
    audioBase64: wav,
    mediaType: "audio/wav",
    dataUrl: `data:audio/wav;base64,${wav}`,
    modelId,
    voice: voiceName,
  };
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
