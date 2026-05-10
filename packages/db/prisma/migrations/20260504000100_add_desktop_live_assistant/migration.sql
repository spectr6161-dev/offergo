CREATE TYPE "DesktopAuthRequestStatus" AS ENUM ('pending', 'approved', 'denied', 'expired');
CREATE TYPE "LiveTranscriptChannel" AS ENUM ('call', 'mic');
CREATE TYPE "LiveAudioCaptureMode" AS ENUM ('device', 'process', 'micOnly');
CREATE TYPE "LiveAnswerLength" AS ENUM ('short', 'detailed');
CREATE TYPE "LiveAssistanceMode" AS ENUM ('default', 'liveCoding');
CREATE TYPE "LiveAnswerKind" AS ENUM ('auto', 'manual', 'screenshot');

CREATE TABLE "DesktopDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesktopAuthRequest" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "pollTokenHash" TEXT NOT NULL,
  "displayCode" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "status" "DesktopAuthRequestStatus" NOT NULL DEFAULT 'pending',
  "userId" TEXT,
  "deviceId" TEXT,
  "sessionId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "deniedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DesktopAuthRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveAssistantSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL DEFAULT 'Отвечай кратко и по делу. Помогай как ассистент на live-звонке: выделяй готовую формулировку ответа, избегай длинной теории и не выдумывай контекст.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveAssistantSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "desktopDeviceId" TEXT,
  "deviceId" TEXT NOT NULL,
  "sourceProcessId" INTEGER NOT NULL,
  "micDeviceId" TEXT NOT NULL,
  "subjectTag" TEXT NOT NULL,
  "audioCaptureMode" "LiveAudioCaptureMode" NOT NULL DEFAULT 'device',
  "answerLength" "LiveAnswerLength" NOT NULL DEFAULT 'short',
  "assistanceMode" "LiveAssistanceMode" NOT NULL DEFAULT 'default',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveTranscriptSegment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "channel" "LiveTranscriptChannel" NOT NULL,
  "text" TEXT NOT NULL,
  "isFinal" BOOLEAN NOT NULL DEFAULT false,
  "timestampMs" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveTranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveAnswerEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "kind" "LiveAnswerKind" NOT NULL,
  "shortAnswer" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "sourceTurns" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveAnswerEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveScreenshotArtifact" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveScreenshotArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesktopAuthRequest_requestId_key" ON "DesktopAuthRequest"("requestId");
CREATE UNIQUE INDEX "DesktopAuthRequest_displayCode_key" ON "DesktopAuthRequest"("displayCode");
CREATE INDEX "DesktopDevice_userId_revokedAt_idx" ON "DesktopDevice"("userId", "revokedAt");
CREATE INDEX "DesktopAuthRequest_status_expiresAt_idx" ON "DesktopAuthRequest"("status", "expiresAt");
CREATE UNIQUE INDEX "LiveAssistantSettings_userId_key" ON "LiveAssistantSettings"("userId");
CREATE INDEX "LiveSession_userId_startedAt_idx" ON "LiveSession"("userId", "startedAt");
CREATE INDEX "LiveTranscriptSegment_sessionId_createdAt_idx" ON "LiveTranscriptSegment"("sessionId", "createdAt");
CREATE INDEX "LiveAnswerEvent_sessionId_createdAt_idx" ON "LiveAnswerEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX "LiveScreenshotArtifact_fileAssetId_key" ON "LiveScreenshotArtifact"("fileAssetId");
CREATE INDEX "LiveScreenshotArtifact_sessionId_createdAt_idx" ON "LiveScreenshotArtifact"("sessionId", "createdAt");

ALTER TABLE "DesktopDevice"
ADD CONSTRAINT "DesktopDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesktopAuthRequest"
ADD CONSTRAINT "DesktopAuthRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesktopAuthRequest"
ADD CONSTRAINT "DesktopAuthRequest_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DesktopAuthRequest"
ADD CONSTRAINT "DesktopAuthRequest_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveAssistantSettings"
ADD CONSTRAINT "LiveAssistantSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_desktopDeviceId_fkey"
FOREIGN KEY ("desktopDeviceId") REFERENCES "DesktopDevice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveTranscriptSegment"
ADD CONSTRAINT "LiveTranscriptSegment_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveAnswerEvent"
ADD CONSTRAINT "LiveAnswerEvent_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveScreenshotArtifact"
ADD CONSTRAINT "LiveScreenshotArtifact_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveScreenshotArtifact"
ADD CONSTRAINT "LiveScreenshotArtifact_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
