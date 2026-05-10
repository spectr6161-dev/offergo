import { Inject, Injectable } from "@nestjs/common";
import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";
import { env } from "@offergo/shared";
import type { LiveChannel } from "./live-protocol";
import {
  LiveAiPromptService,
  WPF_LIVE_PROMPT_KEYS,
} from "./live-ai-prompt.service";

type LiveTranscriptionSession = {
  sendRealtimeInput(params: {
    audio?: { data: string; mimeType: string };
    audioStreamEnd?: boolean;
  }): void;
  close(): void;
};

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });
}

function mapThinkingLevel(level: string) {
  switch (level) {
    case "low":
      return ThinkingLevel.LOW;
    case "medium":
      return ThinkingLevel.MEDIUM;
    case "high":
      return ThinkingLevel.HIGH;
    case "minimal":
    default:
      return ThinkingLevel.MINIMAL;
  }
}

@Injectable()
export class GeminiLiveService {
  private readonly ai = getGeminiClient();

  constructor(
    @Inject(LiveAiPromptService)
    private readonly liveAiPromptService: LiveAiPromptService,
  ) {}

  async createTranscriptionSession(
    channel: LiveChannel,
    onTranscript: (text: string, isFinal: boolean) => void,
    onWarning: (message: string) => void,
  ): Promise<LiveTranscriptionSession | null> {
    if (!this.ai) {
      onWarning("Gemini transport is not configured. Live transcription is disabled.");
      return null;
    }

    try {
      const systemInstruction = await this.liveAiPromptService.getContent(
        channel === "call"
          ? WPF_LIVE_PROMPT_KEYS.transcriptionCallSystem
          : WPF_LIVE_PROMPT_KEYS.transcriptionMicSystem,
      );
      const session = await this.ai.live.connect({
        model: env.GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: mapThinkingLevel(env.GEMINI_LIVE_THINKING_LEVEL),
          },
        },
        callbacks: {
          onmessage: (message: unknown) => {
            const payload = message as {
              serverContent?: {
                inputTranscription?: {
                  text?: string;
                  finished?: boolean;
                };
              };
            };
            const transcription = payload.serverContent?.inputTranscription;

            if (transcription?.text) {
              onTranscript(transcription.text, Boolean(transcription.finished));
            }
          },
          onerror: (error: { message?: string }) => {
            onWarning(error.message ?? "Gemini live websocket error.");
          },
          onclose: (event: { reason?: string }) => {
            if (event.reason) {
              onWarning(event.reason);
            }
          },
        },
      });

      return {
        sendRealtimeInput: (params) => session.sendRealtimeInput(params),
        close: () => session.close(),
      };
    } catch (error) {
      onWarning(
        error instanceof Error
          ? error.message
          : "Gemini live session could not be created.",
      );
      return null;
    }
  }
}
