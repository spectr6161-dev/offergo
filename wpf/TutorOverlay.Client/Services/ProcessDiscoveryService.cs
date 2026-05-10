using System.Diagnostics;
using TutorOverlay.Client.Models;

namespace TutorOverlay.Client.Services;

public sealed class ProcessDiscoveryService
{
    private static readonly string[] RecommendedProcessNames =
    [
        "chrome",
        "msedge",
        "firefox",
        "zoom",
        "teams",
        "telegram",
        "yandex",
        "browser",
    ];

    public IReadOnlyList<ProcessAudioOption> GetProcessOptions()
    {
        var options = new List<ProcessAudioOption>();
        foreach (var process in Process.GetProcesses())
        {
            try
            {
                var name = process.ProcessName;
                var title = process.MainWindowTitle?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(title) && !IsRecommended(name))
                {
                    continue;
                }

                options.Add(new ProcessAudioOption(
                    process.Id,
                    name,
                    string.IsNullOrWhiteSpace(title) ? name : title,
                    IsRecommended(name)));
            }
            catch
            {
            }
            finally
            {
                process.Dispose();
            }
        }

        return options
            .OrderByDescending(option => option.IsRecommended)
            .ThenBy(option => option.DisplayLabel, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static bool IsRecommended(string processName)
    {
        return RecommendedProcessNames.Any(name =>
            processName.Contains(name, StringComparison.OrdinalIgnoreCase));
    }
}
