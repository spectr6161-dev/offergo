using System.Runtime.InteropServices;
using TutorOverlay.Client.Infrastructure;

namespace TutorOverlay.Client.Services;

public sealed class HotKeyManager : IDisposable
{
    public const int ToggleListeningId = 1;
    public const int ScreenshotId = 2;
    public const int ManualPromptId = 3;
    public const int ToggleOverlayId = 4;
    public const int NewMessageId = 5;
    public const int ClearChatId = 6;
    public const int ScrollChatUpId = 7;
    public const int ScrollChatDownId = 8;
    public const int ScrollChatTopId = 9;
    public const int ScrollChatBottomId = 10;
    public const int ToggleMicrophoneId = 11;
    public const int ToggleAutoModeId = 12;
    public const int ToggleAnswerLengthId = 13;
    public const int ToggleWindowVisibilityId = 14;
    public const int ToggleChatVisibilityId = 15;
    public const int ToggleLiveCodingModeId = 16;

    private readonly IntPtr _handle;
    private readonly Action<string> _log;

    public HotKeyManager(IntPtr handle, Action<string>? log = null)
    {
        _handle = handle;
        _log = log ?? (_ => { });
    }

    public void RegisterDefaults()
    {
        Register(ToggleListeningId, System.Windows.Forms.Keys.L, "Ctrl+Shift+L");
        Register(ScreenshotId, System.Windows.Forms.Keys.S, "Ctrl+Shift+S");
        Register(ManualPromptId, System.Windows.Forms.Keys.M, "Ctrl+Shift+M");
        Register(ToggleOverlayId, System.Windows.Forms.Keys.O, "Ctrl+Shift+O");
        Register(NewMessageId, System.Windows.Forms.Keys.N, "Ctrl+Shift+N");
        Register(ClearChatId, System.Windows.Forms.Keys.C, "Ctrl+Shift+C");
        Register(ScrollChatUpId, System.Windows.Forms.Keys.Up, "Ctrl+Shift+Up");
        Register(ScrollChatDownId, System.Windows.Forms.Keys.Down, "Ctrl+Shift+Down");
        Register(ScrollChatTopId, System.Windows.Forms.Keys.Home, "Ctrl+Shift+Home");
        Register(ScrollChatBottomId, System.Windows.Forms.Keys.End, "Ctrl+Shift+End");
        Register(ToggleMicrophoneId, System.Windows.Forms.Keys.P, "Ctrl+Shift+P");
        Register(ToggleAutoModeId, System.Windows.Forms.Keys.A, "Ctrl+Shift+A");
        Register(ToggleAnswerLengthId, System.Windows.Forms.Keys.D, "Ctrl+Shift+D");
        Register(ToggleWindowVisibilityId, System.Windows.Forms.Keys.H, "Ctrl+Shift+H");
        Register(ToggleChatVisibilityId, System.Windows.Forms.Keys.T, "Ctrl+Shift+T");
        Register(ToggleLiveCodingModeId, System.Windows.Forms.Keys.K, "Ctrl+Shift+K");
    }

    public void Dispose()
    {
        NativeMethods.UnregisterHotKey(_handle, ToggleListeningId);
        NativeMethods.UnregisterHotKey(_handle, ScreenshotId);
        NativeMethods.UnregisterHotKey(_handle, ManualPromptId);
        NativeMethods.UnregisterHotKey(_handle, ToggleOverlayId);
        NativeMethods.UnregisterHotKey(_handle, NewMessageId);
        NativeMethods.UnregisterHotKey(_handle, ClearChatId);
        NativeMethods.UnregisterHotKey(_handle, ScrollChatUpId);
        NativeMethods.UnregisterHotKey(_handle, ScrollChatDownId);
        NativeMethods.UnregisterHotKey(_handle, ScrollChatTopId);
        NativeMethods.UnregisterHotKey(_handle, ScrollChatBottomId);
        NativeMethods.UnregisterHotKey(_handle, ToggleMicrophoneId);
        NativeMethods.UnregisterHotKey(_handle, ToggleAutoModeId);
        NativeMethods.UnregisterHotKey(_handle, ToggleAnswerLengthId);
        NativeMethods.UnregisterHotKey(_handle, ToggleWindowVisibilityId);
        NativeMethods.UnregisterHotKey(_handle, ToggleChatVisibilityId);
        NativeMethods.UnregisterHotKey(_handle, ToggleLiveCodingModeId);
    }

    private void Register(int id, System.Windows.Forms.Keys key, string label)
    {
        if (NativeMethods.RegisterHotKey(_handle, id, NativeMethods.ModControl | NativeMethods.ModShift, (uint)key))
        {
            return;
        }

        _log($"Hotkey {label} registration failed: {Marshal.GetLastWin32Error()}");
    }
}
