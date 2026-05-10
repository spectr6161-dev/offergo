using System.IO;
using System.Text.Json;
using TutorOverlay.Client.Models;

namespace TutorOverlay.Client.Services;

public sealed class ClientSettingsService
{
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private string SettingsDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "offerGO");

    private string SettingsPath => Path.Combine(SettingsDirectory, "client-settings.json");

    public ClientSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                return ClientSettings.CreateDefault();
            }

            var json = File.ReadAllText(SettingsPath);
            var settings = JsonSerializer.Deserialize<ClientSettings>(json, _jsonOptions) ?? ClientSettings.CreateDefault();
            settings.Normalize();
            return settings;
        }
        catch (Exception ex)
        {
            App.Log($"Client settings load failed: {ex}");
            return ClientSettings.CreateDefault();
        }
    }

    public void Save(ClientSettings settings)
    {
        settings.Normalize();
        Directory.CreateDirectory(SettingsDirectory);
        var json = JsonSerializer.Serialize(settings, _jsonOptions);
        File.WriteAllText(SettingsPath, json);
    }
}
