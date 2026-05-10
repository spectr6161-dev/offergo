import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { consumeQuota, QuotaExceededError } from "@offergo/billing";
import type {
  AnswerLength,
  AnswerVisibilityPayload,
  AssistanceMode,
  AudioFlushPayload,
  AudioFramePayload,
  LiveAnswerProvider,
  LiveChannel,
  ManualPromptPayload,
  SessionConfigurePayload,
  SessionStartPayload,
} from "./live-protocol";
import { GeminiLiveService } from "./gemini-live.service";
import { LiveAnswerGenerationService } from "./live-answer-generation.service";
import { LiveSessionService } from "./live-session.service";

export type LiveClientConnection = {
  user: AuthenticatedAppUser;
  send: (type: string, payload: unknown) => void;
};

type RuntimeSession = {
  sessionId: string;
  userId: string;
  subjectTag: string;
  answerLength: AnswerLength;
  assistanceMode: AssistanceMode;
  answerProvider: LiveAnswerProvider;
  channels: Partial<
    Record<
      LiveChannel,
      Awaited<ReturnType<GeminiLiveService["createTranscriptionSession"]>>
    >
  >;
  lastAutoAnswerAt?: number;
  lastQuestionKey?: string;
  audioLastCommitAt: number;
  audioQuotaInterval?: ReturnType<typeof setInterval>;
  audioQuotaExceeded?: boolean;
};

@Injectable()
export class LiveSessionCoordinator {
  private readonly runtimeSessions = new Map<string, RuntimeSession>();

  constructor(
    @Inject(LiveSessionService)
    private readonly liveSessionService: LiveSessionService,
    @Inject(GeminiLiveService)
    private readonly geminiLiveService: GeminiLiveService,
    @Inject(LiveAnswerGenerationService)
    private readonly liveAnswerGenerationService: LiveAnswerGenerationService,
  ) {}

  async start(connection: LiveClientConnection, payload: SessionStartPayload) {
    const session = payload.sessionId
      ? await this.liveSessionService.getOwnedSession(
          connection.user.id,
          payload.sessionId,
        )
      : await this.liveSessionService.create(connection.user.id, payload);
    const assistanceMode = this.normalizeAssistanceMode(
      payload.assistanceMode ?? session.assistanceMode,
    );
    const answerProvider = this.normalizeAnswerProvider(
      payload.answerProvider ?? session.answerProvider,
    );

    if (session.assistanceMode !== assistanceMode) {
      await this.liveSessionService.configureAssistanceMode(
        session.id,
        assistanceMode,
      );
    }

    if (session.answerProvider !== answerProvider) {
      await this.liveSessionService.configureAnswerProvider(
        session.id,
        answerProvider,
      );
    }

    const runtime: RuntimeSession = {
      sessionId: session.id,
      userId: connection.user.id,
      subjectTag: session.subjectTag,
      answerLength: this.normalizeAnswerLength(
        payload.answerLength ?? session.answerLength,
      ),
      assistanceMode,
      answerProvider,
      channels: {},
      audioLastCommitAt: Date.now(),
    };

    runtime.audioQuotaInterval = setInterval(() => {
      void this.commitAudioDuration(connection, runtime, "interval");
    }, 10_000);

    for (const channel of ["call", "mic"] as const) {
      runtime.channels[channel] =
        await this.geminiLiveService.createTranscriptionSession(
          channel,
          async (text, isFinal) => {
            await this.handleTranscript(
              connection,
              runtime,
              channel,
              text,
              isFinal,
            );
          },
          (message) => {
            connection.send("warning", {
              code: "gemini_live",
              message,
            });
          },
        );
    }

    this.runtimeSessions.set(session.id, runtime);
    connection.send("session.ready", {
      sessionId: session.id,
      captureMode: "best-effort-exclusion",
      visibilityMode: "topmost-overlay",
      answerProvider: runtime.answerProvider,
    });
  }

  async configure(
    connection: LiveClientConnection,
    payload: SessionConfigurePayload,
  ) {
    const runtime = this.requireRuntime(connection.user.id, payload.sessionId);
    runtime.assistanceMode = this.normalizeAssistanceMode(payload.assistanceMode);

    if (payload.answerProvider !== undefined) {
      runtime.answerProvider = this.normalizeAnswerProvider(payload.answerProvider);
      await this.liveSessionService.configureAnswerProvider(
        runtime.sessionId,
        runtime.answerProvider,
      );
    }

    await this.liveSessionService.configureAssistanceMode(
      runtime.sessionId,
      runtime.assistanceMode,
    );
  }

  async onAudioFrame(
    connection: LiveClientConnection,
    payload: AudioFramePayload,
  ) {
    if (!this.isValidAudioFrame(payload)) {
      connection.send("warning", {
        code: "audio_frame_invalid",
        message: "Audio frame was ignored because payload is invalid.",
      });
      return;
    }

    const runtime = this.requireRuntime(connection.user.id, payload.sessionId);
    if (runtime.audioQuotaExceeded) {
      return;
    }

    runtime.channels[payload.channel]?.sendRealtimeInput({
      audio: {
        data: payload.pcm16Base64,
        mimeType: `audio/pcm;rate=${payload.sampleRate}`,
      },
    });
  }

  onAudioFlush(connection: LiveClientConnection, payload: AudioFlushPayload) {
    const runtime = this.requireRuntime(connection.user.id, payload.sessionId);
    runtime.channels[payload.channel]?.sendRealtimeInput({
      audioStreamEnd: true,
    });
  }

  async onManualPrompt(
    connection: LiveClientConnection,
    payload: ManualPromptPayload,
  ) {
    const runtime = this.requireRuntime(connection.user.id, payload.sessionId);
    const assistanceMode =
      payload.assistanceMode === undefined
        ? runtime.assistanceMode
        : this.normalizeAssistanceMode(payload.assistanceMode);
    const answerProvider =
      payload.answerProvider === undefined
        ? runtime.answerProvider
        : this.normalizeAnswerProvider(payload.answerProvider);

    if (payload.assistanceMode !== undefined) {
      runtime.assistanceMode = assistanceMode;
      await this.liveSessionService.configureAssistanceMode(
        runtime.sessionId,
        assistanceMode,
      );
    }

    if (payload.answerProvider !== undefined) {
      runtime.answerProvider = answerProvider;
      await this.liveSessionService.configureAnswerProvider(
        runtime.sessionId,
        answerProvider,
      );
    }

    try {
      await consumeQuota(connection.user.id, "wpf_text_request", 1, {
        sessionId: runtime.sessionId,
      });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        connection.send("quota.exceeded", error.toResponse());
        return;
      }

      throw error;
    }

    await this.generateAndSendAnswer({
      connection,
      sessionId: payload.sessionId,
      mode: "manual",
      manualText: payload.text,
      answerLength: this.normalizeAnswerLength(
        payload.answerLength ?? runtime.answerLength,
      ),
      assistanceMode,
      answerProvider,
    });
  }

  onAnswerVisibility(
    _connection: LiveClientConnection,
    _payload: AnswerVisibilityPayload,
  ) {
    return;
  }

  async stop(connection: LiveClientConnection, sessionId: string) {
    const runtime = this.requireRuntime(connection.user.id, sessionId);
    await this.commitAudioDuration(connection, runtime, "stop");
    this.clearAudioQuotaTimer(runtime);
    this.closeRuntimeChannels(runtime);
    await this.liveSessionService.stop(sessionId);
    this.runtimeSessions.delete(sessionId);
  }

  async answerFromScreenshot(input: {
    sessionId: string;
    user: AuthenticatedAppUser;
    screenshot: { bytes: Buffer; mimeType: string };
    answerLength?: string;
    assistanceMode?: string;
    answerProvider?: string;
  }) {
    await this.liveSessionService.getOwnedSession(input.user.id, input.sessionId);
    const runtime = this.runtimeSessions.get(input.sessionId);
    const assistanceMode = this.normalizeAssistanceMode(
      input.assistanceMode ?? runtime?.assistanceMode,
    );
    const answerProvider = this.normalizeAnswerProvider(
      input.answerProvider ?? runtime?.answerProvider,
    );

    return this.buildAndStoreAnswer({
      userId: input.user.id,
      sessionId: input.sessionId,
      mode: "screenshot",
      screenshot: input.screenshot,
      answerLength: this.normalizeAnswerLength(input.answerLength),
      assistanceMode,
      answerProvider,
    });
  }

  closeAllForUser(userId: string) {
    for (const [sessionId, runtime] of this.runtimeSessions.entries()) {
      if (runtime.userId !== userId) {
        continue;
      }

      this.clearAudioQuotaTimer(runtime);
      this.closeRuntimeChannels(runtime);
      this.runtimeSessions.delete(sessionId);
    }
  }

  private requireRuntime(userId: string, sessionId: string) {
    const runtime = this.runtimeSessions.get(sessionId);

    if (!runtime || runtime.userId !== userId) {
      throw new Error(`Runtime session ${sessionId} is not active.`);
    }

    return runtime;
  }

  private async handleTranscript(
    connection: LiveClientConnection,
    runtime: RuntimeSession,
    channel: LiveChannel,
    text: string,
    isFinal: boolean,
  ) {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    const timestampMs = Date.now();
    await this.liveSessionService.addTranscript(
      runtime.sessionId,
      channel,
      trimmed,
      isFinal,
      timestampMs,
    );

    connection.send(isFinal ? "transcript.final" : "transcript.partial", {
      channel,
      text: trimmed,
      timestampMs,
      startMs: timestampMs,
      endMs: timestampMs,
    });

    if (this.shouldAutoAnswer(runtime, channel, trimmed, isFinal)) {
      await this.generateAndSendAnswer({
        connection,
        sessionId: runtime.sessionId,
        mode: "auto",
        answerLength: runtime.answerLength,
        assistanceMode: runtime.assistanceMode,
        answerProvider: runtime.answerProvider,
      });
    }
  }

  private async generateAndSendAnswer(input: {
    connection: LiveClientConnection;
    sessionId: string;
    mode: "auto" | "manual" | "screenshot";
    manualText?: string;
    screenshot?: { bytes: Buffer; mimeType: string };
    answerLength: AnswerLength;
    assistanceMode: AssistanceMode;
    answerProvider: LiveAnswerProvider;
  }) {
    const answer = await this.buildAndStoreAnswer({
      userId: input.connection.user.id,
      sessionId: input.sessionId,
      mode: input.mode,
      manualText: input.manualText,
      screenshot: input.screenshot,
      answerLength: input.answerLength,
      assistanceMode: input.assistanceMode,
      answerProvider: input.answerProvider,
      callbacks: {
        onStart: (answerId) => {
          input.connection.send("answer.started", { answerId });
        },
        onPartial: (answerId, text) => {
          input.connection.send("answer.partial", { answerId, text });
        },
      },
    });

    input.connection.send("answer.final", {
      answerId: answer.id,
      shortAnswer: answer.shortAnswer,
      details: answer.details,
      confidence: answer.confidence,
      sourceTurns: answer.sourceTurns,
    });
  }

  private async buildAndStoreAnswer(input: {
    userId: string;
    sessionId: string;
    mode: "auto" | "manual" | "screenshot";
    manualText?: string;
    screenshot?: { bytes: Buffer; mimeType: string };
    answerLength: AnswerLength;
    assistanceMode: AssistanceMode;
    answerProvider: LiveAnswerProvider;
    callbacks?: {
      onStart?: (answerId: string) => void | Promise<void>;
      onPartial?: (answerId: string, text: string) => void | Promise<void>;
    };
  }) {
    const isLiveCoding = input.assistanceMode === "liveCoding";
    const session = await this.liveSessionService.getOwnedSession(
      input.userId,
      input.sessionId,
    );
    const transcriptContext =
      input.mode === "screenshot" && !isLiveCoding
        ? []
        : await this.liveSessionService.recentContext(
            input.sessionId,
            isLiveCoding ? 12 : 6,
          );
    const answerContext = isLiveCoding
      ? await this.liveSessionService.recentAnswers(input.sessionId, 3)
      : [];
    const settings = await this.liveSessionService.getSettings(input.userId);
    const generated = await this.liveAnswerGenerationService.generateAnswer(
      {
        provider: input.answerProvider ?? settings.answerProvider,
        subjectTag: session.subjectTag,
        mode: input.mode,
        transcriptContext,
        manualText: input.manualText,
        screenshot: input.screenshot,
        answerLength: input.answerLength,
        assistanceMode: input.assistanceMode,
        answerContext,
      },
      input.callbacks,
    );

    return this.liveSessionService.addAnswer({
      sessionId: input.sessionId,
      kind: input.mode,
      answerId: generated.answerId,
      shortAnswer: generated.shortAnswer,
      details: generated.details,
      confidence: generated.confidence,
      sourceTurns: generated.sourceTurns,
    });
  }

  private shouldAutoAnswer(
    runtime: RuntimeSession,
    channel: LiveChannel,
    text: string,
    isFinal: boolean,
  ) {
    const isLiveCoding = runtime.assistanceMode === "liveCoding";
    const hasAnswerTrigger =
      this.looksLikeQuestion(text) ||
      (isLiveCoding && this.looksLikeLiveCodingSignal(text));

    if (!hasAnswerTrigger) {
      return false;
    }

    if (
      !isFinal &&
      !this.hasExplicitQuestionMark(text) &&
      !this.hasStrongAnswerIntent(text) &&
      !this.hasQuestionWord(text) &&
      !(isLiveCoding && this.looksLikeLiveCodingSignal(text))
    ) {
      return false;
    }

    const normalized = this.normalizeQuestion(text);
    const now = Date.now();
    const lastAutoAnswerAt = runtime.lastAutoAnswerAt ?? 0;
    const questionKey = `${channel}:${normalized}`;
    const duplicateWindowMs = isLiveCoding ? 10_000 : 15_000;
    const cooldownMs = isLiveCoding ? 2_500 : 4_000;

    if (
      runtime.lastQuestionKey === questionKey &&
      now - lastAutoAnswerAt < duplicateWindowMs
    ) {
      return false;
    }

    if (now - lastAutoAnswerAt < cooldownMs) {
      return false;
    }

    runtime.lastQuestionKey = questionKey;
    runtime.lastAutoAnswerAt = now;
    return true;
  }

  private looksLikeQuestion(text: string) {
    const normalized = text.trim().toLowerCase();
    return (
      this.hasExplicitQuestionMark(normalized) ||
      this.hasStrongAnswerIntent(normalized) ||
      this.hasQuestionWord(normalized)
    );
  }

  private hasStrongAnswerIntent(text: string) {
    const normalized = text.trim().toLowerCase();
    return (
      /(?:^|\s)(?:объясни|объясните|поясни|поясните|расскажи|расскажите|опиши|опишите|разбери|разберите|покажи|покажите|реши|решите|назови|назовите|дай|дайте)(?:\s|$|[?？!.:,;])/u.test(
        normalized,
      ) ||
      /(?:что|чего)\s+(?:ты|вы)?\s*(?:знаешь|знаете|можешь|можете)\s+(?:про|о|об)(?:\s|$|[?？!.:,;])/u.test(
        normalized,
      ) ||
      /(?:что|чего)\s+(?:такое|это)(?:\s|$|[?？!.:,;])/u.test(normalized) ||
      /(?:можешь|можете)\s+(?:рассказать|объяснить|пояснить|описать)(?:\s|$|[?？!.:,;])/u.test(
        normalized,
      ) ||
      /(?:расскаж(?:и|ите)|объясн(?:и|ите)|поясн(?:и|ите)).{0,80}(?:^|\s)(?:про|о|об|как|почему|зачем)(?:\s|$|[?？!.:,;])/u.test(
        normalized,
      )
    );
  }

  private hasQuestionWord(text: string) {
    const normalized = text.trim().toLowerCase();
    return /(?:почему|зачем|как|что|кто|где|куда|откуда|когда|сколько|какой|какая|какие|каков|можно ли|нужно ли|стоит ли|в чем разница|чем отличается|what is|how does|why does|difference between)/u.test(
      normalized,
    );
  }

  private looksLikeLiveCodingSignal(text: string) {
    const normalized = text.trim().toLowerCase();
    return /(?:на вход|на выход|вернуть|нужно вернуть|надо вернуть|требуется|дано|дан массив|дана строка|пример входа|пример выхода|ограничени[ея]|сложность|реализ(?:уй|уем|овать)|напиш(?:и|ем|ите)|исправ(?:ь|им|ьте)|доработа(?:й|ем|йте)|оптимизир(?:уй|уем|уйте)|алгоритм|функци[яю]|метод|класс|код|ошибк[аиу]|тест(?:ы|ами)?|стек|очередь|массив|строк[ауи]|дерево|граф|хэш|динамическ|бинарн|сортировк|рекурси|итераци|event loop|input|output|return|array|string|function|method|class|algorithm|complexity|implement|fix|bug|error|exception|stack trace|test case|leetcode|runtime|compile)/u.test(
      normalized,
    );
  }

  private hasExplicitQuestionMark(text: string) {
    return /[?？]\s*$/u.test(text.trim());
  }

  private normalizeQuestion(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[?？!.:,;]+/gu, " ")
      .replace(/\s+/gu, " ")
      .slice(0, 180);
  }

  private normalizeAnswerLength(value?: string): AnswerLength {
    return value === "detailed" ? "detailed" : "short";
  }

  private normalizeAssistanceMode(value?: string): AssistanceMode {
    return value === "liveCoding" ? "liveCoding" : "default";
  }

  private normalizeAnswerProvider(value?: string): LiveAnswerProvider {
    return value === "gemini" ? "gemini" : "yandex";
  }

  private isValidAudioFrame(payload: AudioFramePayload) {
    return (
      (payload.channel === "call" || payload.channel === "mic") &&
      payload.sampleRate >= 8_000 &&
      payload.sampleRate <= 96_000 &&
      payload.pcm16Base64.length > 0 &&
      payload.pcm16Base64.length <= 512_000
    );
  }

  private async commitAudioDuration(
    connection: LiveClientConnection,
    runtime: RuntimeSession,
    reason: "interval" | "stop",
  ) {
    if (runtime.audioQuotaExceeded) {
      return;
    }

    const now = Date.now();
    const secondsToCommit = Math.floor((now - runtime.audioLastCommitAt) / 1000);

    if (secondsToCommit <= 0) {
      return;
    }

    try {
      await consumeQuota(connection.user.id, "wpf_audio_seconds", secondsToCommit, {
        reason,
        sessionId: runtime.sessionId,
      });
      runtime.audioLastCommitAt += secondsToCommit * 1000;
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        runtime.audioQuotaExceeded = true;
        this.clearAudioQuotaTimer(runtime);
        this.closeRuntimeChannels(runtime);
        connection.send("quota.exceeded", error.toResponse());
        return;
      }

      connection.send("warning", {
        code: "audio_quota",
        message: "Failed to update audio quota usage.",
      });
    }
  }

  private clearAudioQuotaTimer(runtime: RuntimeSession) {
    if (!runtime.audioQuotaInterval) {
      return;
    }

    clearInterval(runtime.audioQuotaInterval);
    runtime.audioQuotaInterval = undefined;
  }

  private closeRuntimeChannels(runtime: RuntimeSession) {
    runtime.channels.call?.close();
    runtime.channels.mic?.close();
  }
}
