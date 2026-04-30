import type { UIMessage } from "ai";
import type { z } from "zod";

import type {
  AiImageModelId,
  AiSpeechModelId,
  AiTextModelId,
  AiTtsVoice,
} from "./model-catalog";

export type AiTextInput = {
  prompt: string;
  modelId?: AiTextModelId;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiChatInput = {
  messages: UIMessage[];
  modelId?: AiTextModelId;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiObjectInput<Schema extends z.ZodType> = AiTextInput & {
  schema: Schema;
};

export type AiImageInput = {
  prompt: string;
  modelId?: AiImageModelId;
  aspectRatio?: `${number}:${number}`;
};

export type AiSpeechInput = {
  text: string;
  modelId?: AiSpeechModelId;
  voice?: AiTtsVoice;
};

export type AiAudioTranscriptionInput = {
  audio: Uint8Array;
  mediaType: string;
  modelId?: AiTextModelId;
  prompt?: string;
};
