export type LiveChannel = "call" | "mic";
export type AudioCaptureMode = "device" | "process" | "micOnly";
export type AnswerLength = "short" | "detailed";
export type AssistanceMode = "default" | "liveCoding";
export type LiveAnswerProvider = "yandex" | "gemini";

export interface SessionStartPayload {
  sessionId?: string;
  deviceId: string;
  employeeId?: string;
  sourceProcessId: number;
  micDeviceId: string;
  subjectTag: string;
  audioCaptureMode?: AudioCaptureMode;
  answerLength?: AnswerLength;
  assistanceMode?: AssistanceMode;
  answerProvider?: LiveAnswerProvider;
}

export interface AudioFramePayload {
  sessionId: string;
  channel: LiveChannel;
  pcm16Base64: string;
  sampleRate: number;
  timestampMs: number;
}

export interface AudioFlushPayload {
  sessionId: string;
  channel: LiveChannel;
}

export interface ManualPromptPayload {
  sessionId: string;
  text: string;
  answerLength?: AnswerLength;
  assistanceMode?: AssistanceMode;
  answerProvider?: LiveAnswerProvider;
}

export interface SessionConfigurePayload {
  sessionId: string;
  assistanceMode: AssistanceMode;
  answerProvider?: LiveAnswerProvider;
}

export interface AnswerVisibilityPayload {
  sessionId: string;
  answerId: string;
}

export interface StopSessionPayload {
  sessionId: string;
}

export type ClientEnvelope =
  | { type: "session.start"; payload: SessionStartPayload }
  | { type: "audio.frame"; payload: AudioFramePayload }
  | { type: "audio.flush"; payload: AudioFlushPayload }
  | { type: "session.configure"; payload: SessionConfigurePayload }
  | { type: "manual.prompt"; payload: ManualPromptPayload }
  | { type: "answer.show"; payload: AnswerVisibilityPayload }
  | { type: "answer.dismiss"; payload: AnswerVisibilityPayload }
  | { type: "session.stop"; payload: StopSessionPayload };

export type AnswerDto = {
  id: string;
  shortAnswer: string;
  details: string;
  confidence: number;
  sourceTurns: string[];
};
