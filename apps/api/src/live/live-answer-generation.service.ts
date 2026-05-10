import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import {
  generateAiText,
  YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL,
} from "@offergo/ai";
import { env } from "@offergo/shared";
import type {
  AnswerLength,
  AssistanceMode,
  LiveAnswerProvider,
  LiveChannel,
} from "./live-protocol";
import {
  LiveAiPromptService,
  WPF_LIVE_PROMPT_KEYS,
} from "./live-ai-prompt.service";

type LiveTranscriptSegment = {
  id: string;
  channel: LiveChannel;
  text: string;
};

type LiveAnswerEvent = {
  kind: string;
  shortAnswer: string;
  details: string;
};

type GeneratedAnswer = {
  answerId: string;
  shortAnswer: string;
  details: string;
  confidence: number;
  sourceTurns: string[];
};

type GenerateAnswerCallbacks = {
  onStart?: (answerId: string) => void | Promise<void>;
  onPartial?: (answerId: string, text: string) => void | Promise<void>;
};

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });
}

function geminiModelList() {
  return [
    env.GEMINI_MODEL_TEXT,
    ...env.GEMINI_GENERATE_FALLBACK_MODELS.split(","),
  ]
    .map((model) => model.trim())
    .filter(Boolean)
    .filter((model, index, list) => list.indexOf(model) === index);
}

function yandexModelId() {
  return env.YANDEX_MODEL_TEXT || YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;
}

function renderTemplate(
  template: string,
  values: Record<string, string | undefined>,
) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
}

function buildUnavailableAnswer(provider: LiveAnswerProvider, error: unknown) {
  const reason =
    error instanceof Error ? error.message : "model returned empty text.";
  const providerName = provider === "gemini" ? "Gemini" : "Yandex GPT";

  return [
    `Сейчас не удалось получить ответ от ${providerName}. Попробуйте повторить запрос через несколько секунд.`,
    `Техническая причина: ${reason}`,
  ].join("\n\n");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

@Injectable()
export class LiveAnswerGenerationService {
  private readonly ai = getGeminiClient();

  constructor(
    @Inject(LiveAiPromptService)
    private readonly liveAiPromptService: LiveAiPromptService,
  ) {}

  async generateAnswer(
    input: {
      provider: LiveAnswerProvider;
      subjectTag: string;
      mode: "auto" | "manual" | "screenshot";
      transcriptContext: LiveTranscriptSegment[];
      manualText?: string;
      screenshot?: { bytes: Buffer; mimeType: string };
      answerLength: AnswerLength;
      assistanceMode: AssistanceMode;
      answerContext?: LiveAnswerEvent[];
    },
    callbacks?: GenerateAnswerCallbacks,
  ): Promise<GeneratedAnswer> {
    const answerId = randomUUID();
    await callbacks?.onStart?.(answerId);

    const prompt = await this.buildAnswerPrompt(input);
    const effectiveProvider =
      input.provider === "yandex" && input.screenshot ? "gemini" : input.provider;
    const combined =
      effectiveProvider === "yandex"
        ? await this.generateWithYandex(prompt)
        : await this.generateWithGemini(prompt, input.screenshot);

    await callbacks?.onPartial?.(answerId, combined);

    const lines = combined
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      answerId,
      shortAnswer: lines[0] ?? combined,
      details: lines.slice(1).join("\n"),
      confidence: input.mode === "auto" ? 0.82 : 0.9,
      sourceTurns: input.transcriptContext.slice(-8).map((segment) => segment.id),
    };
  }

  private async buildAnswerPrompt(input: {
    subjectTag: string;
    mode: "auto" | "manual" | "screenshot";
    transcriptContext: LiveTranscriptSegment[];
    manualText?: string;
    answerLength: AnswerLength;
    assistanceMode: AssistanceMode;
    answerContext?: LiveAnswerEvent[];
  }) {
    const modeKey =
      input.mode === "screenshot"
        ? WPF_LIVE_PROMPT_KEYS.answerModeScreenshot
        : input.mode === "manual"
          ? WPF_LIVE_PROMPT_KEYS.answerModeManual
          : WPF_LIVE_PROMPT_KEYS.answerModeAuto;
    const lengthKey =
      input.answerLength === "detailed"
        ? WPF_LIVE_PROMPT_KEYS.answerLengthDetailed
        : WPF_LIVE_PROMPT_KEYS.answerLengthShort;
    const promptMap = await this.liveAiPromptService.getContentMap([
      WPF_LIVE_PROMPT_KEYS.answerEmployeeInstruction,
      WPF_LIVE_PROMPT_KEYS.answerTemplate,
      WPF_LIVE_PROMPT_KEYS.answerContextEmpty,
      WPF_LIVE_PROMPT_KEYS.answerPreviousAnswersSection,
      WPF_LIVE_PROMPT_KEYS.answerLiveCoding,
      lengthKey,
      modeKey,
    ]);
    const transcriptContext =
      input.transcriptContext
        .map((segment) => `[${segment.channel}] ${segment.text}`)
        .join("\n") ||
      promptMap.get(WPF_LIVE_PROMPT_KEYS.answerContextEmpty) ||
      "";
    const answerContext =
      input.answerContext
        ?.map((answer) =>
          `[${answer.kind}] ${[answer.shortAnswer, answer.details]
            .filter(Boolean)
            .join("\n")
            .slice(0, 1200)}`,
        )
        .join("\n\n") || "";
    const previousAnswersSection = answerContext
      ? promptMap.get(WPF_LIVE_PROMPT_KEYS.answerPreviousAnswersSection)
      : "";
    const modeInstruction = renderTemplate(promptMap.get(modeKey) || "", {
      manualText: input.manualText ?? "",
    });

    return renderTemplate(
      promptMap.get(WPF_LIVE_PROMPT_KEYS.answerTemplate) || "",
      {
        employeePrompt:
          promptMap.get(WPF_LIVE_PROMPT_KEYS.answerEmployeeInstruction) || "",
        subjectTag: input.subjectTag,
        manualText: input.manualText ?? "",
        transcriptContext,
        answerContext,
        previousAnswersSection,
        lengthInstruction: promptMap.get(lengthKey) || "",
        modeInstruction,
        liveCodingInstruction:
          input.assistanceMode === "liveCoding"
            ? promptMap.get(WPF_LIVE_PROMPT_KEYS.answerLiveCoding) || ""
            : "",
      },
    );
  }

  private async generateWithYandex(prompt: string) {
    try {
      const text = await withTimeout(
        generateAiText({
          modelId: yandexModelId(),
          prompt,
          temperature: 0.35,
        }),
        20_000,
        "Yandex Alice AI live answer",
      );
      const trimmed = text.trim();

      if (trimmed) {
        return trimmed;
      }

      throw new Error("Yandex GPT returned empty text.");
    } catch (error) {
      return buildUnavailableAnswer("yandex", error);
    }
  }

  private async generateWithGemini(
    prompt: string,
    screenshot?: { bytes: Buffer; mimeType: string },
  ) {
    if (!this.ai) {
      return buildUnavailableAnswer(
        "gemini",
        new Error("GEMINI_API_KEY is not configured."),
      );
    }

    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    let lastError: unknown;

    if (screenshot) {
      parts.push({
        inlineData: {
          mimeType: screenshot.mimeType,
          data: screenshot.bytes.toString("base64"),
        },
      });
    }

    for (const model of geminiModelList()) {
      try {
        const response = await withTimeout(
          this.ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts,
              },
            ],
            config: {
              temperature: 0.35,
            },
          }),
          15_000,
          `Gemini model ${model}`,
        );
        const text = response.text?.trim() || "";

        if (text) {
          return text;
        }
      } catch (error) {
        lastError = error;
      }
    }

    return buildUnavailableAnswer("gemini", lastError);
  }
}
