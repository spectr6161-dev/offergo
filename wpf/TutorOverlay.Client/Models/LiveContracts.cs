using System.Text.Json.Serialization;

namespace TutorOverlay.Client.Models;

public sealed record SessionReadyPayload(
    [property: JsonPropertyName("sessionId")] string SessionId,
    [property: JsonPropertyName("captureMode")] string CaptureMode,
    [property: JsonPropertyName("visibilityMode")] string VisibilityMode
);

public sealed record TranscriptPayload(
    [property: JsonPropertyName("channel")] string Channel,
    [property: JsonPropertyName("text")] string Text,
    [property: JsonPropertyName("timestampMs")] long TimestampMs,
    [property: JsonPropertyName("startMs")] long StartMs,
    [property: JsonPropertyName("endMs")] long EndMs
);

public sealed record AnswerStartedPayload(
    [property: JsonPropertyName("answerId")] string AnswerId
);

public sealed record AnswerPartialPayload(
    [property: JsonPropertyName("answerId")] string AnswerId,
    [property: JsonPropertyName("text")] string Text
);

public sealed record AnswerPayload(
    [property: JsonPropertyName("answerId")] string AnswerId,
    [property: JsonPropertyName("shortAnswer")] string ShortAnswer,
    [property: JsonPropertyName("details")] string Details,
    [property: JsonPropertyName("confidence")] double Confidence,
    [property: JsonPropertyName("sourceTurns")] IReadOnlyList<string> SourceTurns
);

public sealed record WarningPayload(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string Message
);

public sealed record QuotaExceededPayload(
    [property: JsonPropertyName("feature")] string Feature,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("used")] int Used,
    [property: JsonPropertyName("limit")] int? Limit,
    [property: JsonPropertyName("fairUseLimit")] int? FairUseLimit,
    [property: JsonPropertyName("resetAt")] string ResetAt,
    [property: JsonPropertyName("upgradeUrl")] string UpgradeUrl
);

public sealed record AudioCaptureStatusPayload(
    [property: JsonPropertyName("mode")] string Mode,
    [property: JsonPropertyName("degraded")] bool Degraded,
    [property: JsonPropertyName("message")] string Message
);

public sealed record ProcessOption(int Id, string Label);
