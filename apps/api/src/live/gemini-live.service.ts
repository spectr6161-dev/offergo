import { Inject, Injectable } from "@nestjs/common";
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

@Injectable()
export class GeminiLiveService {
  constructor(
    @Inject(LiveAiPromptService)
    private readonly liveAiPromptService: LiveAiPromptService,
  ) {}

  async createTranscriptionSession(
    channel: LiveChannel,
    onTranscript: (text: string, isFinal: boolean) => void,
    onWarning: (message: string) => void,
  ): Promise<LiveTranscriptionSession | null> {
    void channel;
    void onTranscript;
    void this.liveAiPromptService;
    void WPF_LIVE_PROMPT_KEYS;

    onWarning(
      "Live-транскрибация через Gemini отключена: проект не выполняет запросы к зарубежным AI-провайдерам.",
    );
    return null;
  }
}
