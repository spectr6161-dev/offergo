import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@offergo/db";
import type {
  AnswerLength,
  AssistanceMode,
  AudioCaptureMode,
  LiveAnswerProvider,
  LiveChannel,
} from "./live-protocol";

type CreateSessionInput = {
  deviceId: string;
  sourceProcessId: number;
  micDeviceId: string;
  subjectTag: string;
  audioCaptureMode?: string;
  answerLength?: string;
  assistanceMode?: string;
  answerProvider?: string;
};

function normalizeCaptureMode(value?: string): AudioCaptureMode {
  return value === "process" || value === "micOnly" ? value : "device";
}

function normalizeAnswerLength(value?: string): AnswerLength {
  return value === "detailed" ? "detailed" : "short";
}

function normalizeAssistanceMode(value?: string): AssistanceMode {
  return value === "liveCoding" ? "liveCoding" : "default";
}

function normalizeAnswerProvider(value?: string): LiveAnswerProvider {
  return value === "gemini" ? "gemini" : "yandex";
}

@Injectable()
export class LiveSessionService {
  async create(userId: string, input: CreateSessionInput) {
    const latestDevice = await prisma.desktopDevice.findFirst({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: {
        lastSeenAt: "desc",
      },
      select: {
        id: true,
      },
    });

    return prisma.liveSession.create({
      data: {
        userId,
        desktopDeviceId: latestDevice?.id,
        deviceId: input.deviceId || "windows-overlay-client",
        sourceProcessId: Number.isFinite(input.sourceProcessId)
          ? input.sourceProcessId
          : 0,
        micDeviceId: input.micDeviceId || "default",
        subjectTag: input.subjectTag || "general",
        audioCaptureMode: normalizeCaptureMode(input.audioCaptureMode),
        answerLength: normalizeAnswerLength(input.answerLength),
        assistanceMode: normalizeAssistanceMode(input.assistanceMode),
        answerProvider: normalizeAnswerProvider(input.answerProvider),
      },
    });
  }

  async getOwnedSession(userId: string, sessionId: string) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException("Live session was not found.");
    }

    return session;
  }

  async configureAssistanceMode(sessionId: string, assistanceMode: AssistanceMode) {
    return prisma.liveSession.update({
      where: { id: sessionId },
      data: { assistanceMode },
    });
  }

  async configureAnswerProvider(
    sessionId: string,
    answerProvider: LiveAnswerProvider,
  ) {
    return prisma.liveSession.update({
      where: { id: sessionId },
      data: { answerProvider },
    });
  }

  async stop(sessionId: string) {
    await prisma.liveSession.updateMany({
      where: {
        id: sessionId,
        stoppedAt: null,
      },
      data: {
        stoppedAt: new Date(),
      },
    });
  }

  async addTranscript(
    sessionId: string,
    channel: LiveChannel,
    text: string,
    isFinal: boolean,
    timestampMs: number,
  ) {
    return prisma.liveTranscriptSegment.create({
      data: {
        sessionId,
        channel,
        text,
        isFinal,
        timestampMs,
      },
    });
  }

  async recentContext(sessionId: string, take: number) {
    const rows = await prisma.liveTranscriptSegment.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take,
    });

    return rows.reverse();
  }

  async recentAnswers(sessionId: string, take: number) {
    const rows = await prisma.liveAnswerEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take,
    });

    return rows.reverse();
  }

  async addAnswer(input: {
    sessionId: string;
    kind: "auto" | "manual" | "screenshot";
    answerId?: string;
    shortAnswer: string;
    details: string;
    confidence: number;
    sourceTurns: string[];
  }) {
    return prisma.liveAnswerEvent.create({
      data: {
        id: input.answerId,
        sessionId: input.sessionId,
        kind: input.kind,
        shortAnswer: input.shortAnswer,
        details: input.details,
        confidence: input.confidence,
        sourceTurns: input.sourceTurns,
      },
    });
  }

  async getSettings(userId: string) {
    return prisma.liveAssistantSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}

export {
  normalizeAnswerLength,
  normalizeAnswerProvider,
  normalizeAssistanceMode,
  normalizeCaptureMode,
};
