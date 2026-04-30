import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@offergo/shared";

import type { AiTextInput } from "./types";

const yandexBaseUrl = "https://ai.api.cloud.yandex.net/v1";

const yandexModelAliases: Record<string, string> = {
  "yandex/aliceai-llm": "aliceai-llm/latest",
  "yandex/yandexgpt-5.1": "yandexgpt-5.1",
  "yandex/yandexgpt-5-pro": "yandexgpt-5-pro",
  "yandex/yandexgpt-5-lite": "yandexgpt-5-lite",
  "yandex/deepseek-v32": "deepseek-v32",
  "yandex/qwen3-235b-a22b-fp8": "qwen3-235b-a22b-fp8",
  "yandex/gpt-oss-120b": "gpt-oss-120b",
  "yandex/gpt-oss-20b": "gpt-oss-20b",
};

export function isYandexTextModelId(modelId?: string) {
  return Boolean(
    modelId &&
      (modelId.startsWith("yandex/") || modelId.startsWith("gpt://")),
  );
}

export function getYandexTextModel(modelId?: AiTextInput["modelId"]) {
  const auth = getYandexAuthHeader();

  return createOpenAI({
    name: "yandex",
    baseURL: env.YANDEX_AI_STUDIO_BASE_URL || yandexBaseUrl,
    apiKey: auth.value,
    headers: {
      Authorization: `${auth.scheme} ${auth.value}`,
    },
  }).chat(resolveYandexModelUri(modelId));
}

function resolveYandexModelUri(modelId?: AiTextInput["modelId"]) {
  const selectedModel =
    modelId ||
    env.YANDEX_MODEL_TEXT ||
    env.YANDEX_CLOUD_MODEL ||
    "yandex/aliceai-llm";

  if (selectedModel?.startsWith("gpt://")) {
    return selectedModel;
  }

  const modelName = selectedModel
    ? yandexModelAliases[selectedModel] ?? selectedModel.replace(/^yandex\//, "")
    : yandexModelAliases["yandex/aliceai-llm"];

  const folderId = env.YANDEX_AI_STUDIO_FOLDER_ID || env.YANDEX_CLOUD_FOLDER;

  if (!folderId) {
    throw new Error(
      "YANDEX_AI_STUDIO_FOLDER_ID or YANDEX_CLOUD_FOLDER is required for Yandex AI Studio model aliases.",
    );
  }

  return `gpt://${folderId}/${modelName}`;
}

function getYandexAuthHeader() {
  if (env.YANDEX_AI_STUDIO_API_KEY) {
    return {
      scheme: "Api-Key",
      value: env.YANDEX_AI_STUDIO_API_KEY,
    };
  }

  if (env.YANDEX_AI_STUDIO_IAM_TOKEN) {
    return {
      scheme: "Bearer",
      value: env.YANDEX_AI_STUDIO_IAM_TOKEN,
    };
  }

  throw new Error(
    "YANDEX_AI_STUDIO_API_KEY or YANDEX_AI_STUDIO_IAM_TOKEN is not configured.",
  );
}
