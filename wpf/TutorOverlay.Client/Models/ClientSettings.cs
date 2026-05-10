using System.Text.Json.Serialization;

namespace TutorOverlay.Client.Models;

public static class AudioCaptureModes
{
    public const string Device = "device";
    public const string Process = "process";
    public const string MicOnly = "micOnly";
}

public static class AnswerLengths
{
    public const string Short = "short";
    public const string Detailed = "detailed";
}

public static class AnswerProviders
{
    public const string Yandex = "yandex";
    public const string Gemini = "gemini";
}

public static class ScreenshotModes
{
    public const string Screen = "screen";
    public const string Region = "region";
}

public sealed class ClientSettings
{
    [JsonPropertyName("audioCaptureMode")]
    public string AudioCaptureMode { get; set; } = AudioCaptureModes.Device;

    [JsonPropertyName("micDeviceId")]
    public string MicDeviceId { get; set; } = "default-communications-mic";

    [JsonPropertyName("outputDeviceId")]
    public string OutputDeviceId { get; set; } = "default-output";

    [JsonPropertyName("selectedProcessId")]
    public int SelectedProcessId { get; set; }

    [JsonPropertyName("screenshotMode")]
    public string ScreenshotMode { get; set; } = ScreenshotModes.Screen;

    [JsonPropertyName("monitorIndex")]
    public int MonitorIndex { get; set; }

    [JsonPropertyName("answerLength")]
    public string AnswerLength { get; set; } = AnswerLengths.Short;

    [JsonPropertyName("answerProvider")]
    public string AnswerProvider { get; set; } = AnswerProviders.Yandex;

    [JsonPropertyName("autoAnswerEnabled")]
    public bool AutoAnswerEnabled { get; set; } = true;

    [JsonPropertyName("smartModelEnabled")]
    public bool SmartModelEnabled { get; set; } = true;

    [JsonPropertyName("windowOpacityPercent")]
    public int WindowOpacityPercent { get; set; } = 96;

    public static ClientSettings CreateDefault() => new();

    public void Normalize()
    {
        AudioCaptureMode = AudioCaptureMode is AudioCaptureModes.Device or AudioCaptureModes.Process or AudioCaptureModes.MicOnly
            ? AudioCaptureMode
            : AudioCaptureModes.Device;

        ScreenshotMode = ScreenshotMode is ScreenshotModes.Screen or ScreenshotModes.Region
            ? ScreenshotMode
            : ScreenshotModes.Screen;

        AnswerLength = AnswerLength is AnswerLengths.Short or AnswerLengths.Detailed
            ? AnswerLength
            : AnswerLengths.Short;

        AnswerProvider = AnswerProvider is AnswerProviders.Yandex or AnswerProviders.Gemini
            ? AnswerProvider
            : AnswerProviders.Yandex;

        if (string.IsNullOrWhiteSpace(MicDeviceId))
        {
            MicDeviceId = "default-communications-mic";
        }

        if (string.IsNullOrWhiteSpace(OutputDeviceId))
        {
            OutputDeviceId = "default-output";
        }

        if (SelectedProcessId < 0)
        {
            SelectedProcessId = 0;
        }

        if (MonitorIndex < 0)
        {
            MonitorIndex = 0;
        }

        WindowOpacityPercent = Math.Clamp(WindowOpacityPercent, 65, 100);
    }
}

public sealed record SettingChoice(string Id, string Label);

public sealed record AudioDeviceOption(string Id, string Name, bool IsDefault, string Kind)
{
    public string DisplayLabel => IsDefault ? $"{Name} · по умолчанию" : Name;
}

public sealed record ProcessAudioOption(int ProcessId, string ProcessName, string WindowTitle, bool IsRecommended)
{
    public string DisplayLabel
    {
        get
        {
            var title = string.IsNullOrWhiteSpace(WindowTitle) ? ProcessName : WindowTitle;
            return IsRecommended ? $"{title} · рекомендуется" : title;
        }
    }
}

public sealed record MonitorOption(int Index, string Label);
