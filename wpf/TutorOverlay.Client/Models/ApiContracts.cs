using System.Text.Json.Serialization;

namespace TutorOverlay.Client.Models;

public sealed record EmployeeDto(
    [property: JsonPropertyName("employeeId")] string EmployeeId,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("displayName")] string DisplayName
);

public sealed record AppLoginResponse(
    [property: JsonPropertyName("accessToken")] string AccessToken,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("employee")] EmployeeDto Employee
);

public sealed record BrowserLoginStartResponse(
    [property: JsonPropertyName("requestId")] string RequestId,
    [property: JsonPropertyName("pollToken")] string PollToken,
    [property: JsonPropertyName("displayCode")] string DisplayCode,
    [property: JsonPropertyName("approveUrl")] string ApproveUrl,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("intervalSeconds")] int IntervalSeconds
);

public sealed record BrowserLoginPollResponse(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("accessToken")] string? AccessToken,
    [property: JsonPropertyName("expiresAt")] string? ExpiresAt,
    [property: JsonPropertyName("employee")] EmployeeDto? Employee
);

public sealed record BootstrapResponse(
    [property: JsonPropertyName("websocketPath")] string WebsocketPath,
    [property: JsonPropertyName("retentionDays")] int RetentionDays,
    [property: JsonPropertyName("screenshotMaxMb")] int ScreenshotMaxMb,
    [property: JsonPropertyName("models")] BootstrapModels Models,
    [property: JsonPropertyName("answerProviders")] IReadOnlyList<BootstrapAnswerProvider>? AnswerProviders
);

public sealed record BootstrapModels(
    [property: JsonPropertyName("live")] string Live,
    [property: JsonPropertyName("generate")] string Generate,
    [property: JsonPropertyName("geminiText")] string? GeminiText,
    [property: JsonPropertyName("yandexText")] string? YandexText
);

public sealed record BootstrapAnswerProvider(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("note")] string? Note
);

public sealed record BillingSubscriptionResponse(
    [property: JsonPropertyName("currentPlan")] BillingPlanDto CurrentPlan,
    [property: JsonPropertyName("periodStart")] string PeriodStart,
    [property: JsonPropertyName("periodEnd")] string PeriodEnd,
    [property: JsonPropertyName("limits")] IReadOnlyList<BillingLimitDto> Limits
);

public sealed record BillingPlanDto(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("priceRub")] int PriceRub,
    [property: JsonPropertyName("subscriptionType")] string SubscriptionType
);

public sealed record BillingLimitDto(
    [property: JsonPropertyName("feature")] string Feature,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("used")] int Used,
    [property: JsonPropertyName("reserved")] int Reserved,
    [property: JsonPropertyName("limit")] int? Limit,
    [property: JsonPropertyName("fairUseLimit")] int? FairUseLimit,
    [property: JsonPropertyName("unlimited")] bool Unlimited,
    [property: JsonPropertyName("resetAt")] string ResetAt
);

public sealed record SessionResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("employeeId")] string EmployeeId,
    [property: JsonPropertyName("deviceId")] string DeviceId,
    [property: JsonPropertyName("sourceProcessId")] int SourceProcessId,
    [property: JsonPropertyName("micDeviceId")] string MicDeviceId,
    [property: JsonPropertyName("subjectTag")] string SubjectTag,
    [property: JsonPropertyName("audioCaptureMode")] string? AudioCaptureMode,
    [property: JsonPropertyName("answerLength")] string? AnswerLength,
    [property: JsonPropertyName("answerProvider")] string? AnswerProvider
);

public sealed record EmployeePromptResponse(
    [property: JsonPropertyName("employeeId")] string EmployeeId,
    [property: JsonPropertyName("prompt")] string Prompt,
    [property: JsonPropertyName("answerProvider")] string? AnswerProvider,
    [property: JsonPropertyName("updatedAt")] string UpdatedAt
);

public sealed record AnswerDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("shortAnswer")] string ShortAnswer,
    [property: JsonPropertyName("details")] string Details,
    [property: JsonPropertyName("confidence")] double Confidence,
    [property: JsonPropertyName("sourceTurns")] IReadOnlyList<string> SourceTurns
);

public sealed record ScreenshotResponse(
    [property: JsonPropertyName("screenshotId")] string ScreenshotId,
    [property: JsonPropertyName("answer")] AnswerDto Answer
);

public sealed record StoredDesktopSession(
    [property: JsonPropertyName("accessToken")] string AccessToken,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("employee")] EmployeeDto Employee,
    [property: JsonPropertyName("lastLoginAt")] string LastLoginAt
);
