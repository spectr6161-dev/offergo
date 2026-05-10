using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TutorOverlay.Client.Models;

namespace TutorOverlay.Client.Services;

public sealed class DesktopSessionStorageService
{
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private string StorageDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "offerGO");

    private string StoragePath => Path.Combine(StorageDirectory, "desktop-session.dat");

    public StoredDesktopSession? Load()
    {
        try
        {
            if (!File.Exists(StoragePath))
            {
                return null;
            }

            var protectedBytes = Convert.FromBase64String(File.ReadAllText(StoragePath, Encoding.UTF8));
            var bytes = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
            var json = Encoding.UTF8.GetString(bytes);
            return JsonSerializer.Deserialize<StoredDesktopSession>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            App.Log($"Desktop session load failed: {ex}");
            return null;
        }
    }

    public void Save(StoredDesktopSession session)
    {
        Directory.CreateDirectory(StorageDirectory);
        var json = JsonSerializer.Serialize(session, _jsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        var protectedBytes = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
        File.WriteAllText(StoragePath, Convert.ToBase64String(protectedBytes), Encoding.UTF8);
    }

    public void Clear()
    {
        try
        {
            if (File.Exists(StoragePath))
            {
                File.Delete(StoragePath);
            }
        }
        catch (Exception ex)
        {
            App.Log($"Desktop session clear failed: {ex}");
        }
    }
}
