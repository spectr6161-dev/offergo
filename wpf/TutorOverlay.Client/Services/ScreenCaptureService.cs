using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Windows;
using TutorOverlay.Client.Views;
using Forms = System.Windows.Forms;

namespace TutorOverlay.Client.Services;

public sealed class ScreenCaptureService
{
    public async Task<byte[]?> CaptureAsync(Window owner, string mode, int monitorIndex)
    {
        return string.Equals(mode, "screen", StringComparison.OrdinalIgnoreCase)
            ? await CaptureScreenAsync(monitorIndex)
            : await CaptureRegionAsync(owner);
    }

    public async Task<byte[]?> CaptureRegionAsync(Window owner)
    {
        var selector = new ScreenSelectionWindow
        {
            Owner = owner,
        };

        var result = selector.ShowDialog();
        if (result != true || selector.Selection.Width < 4 || selector.Selection.Height < 4)
        {
            return null;
        }

        using var bitmap = new Bitmap((int)selector.Selection.Width, (int)selector.Selection.Height);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen((int)selector.Selection.X, (int)selector.Selection.Y, 0, 0, bitmap.Size);
        }

        await using var stream = new MemoryStream();
        bitmap.Save(stream, ImageFormat.Png);
        return stream.ToArray();
    }

    public async Task<byte[]?> CaptureScreenAsync(int monitorIndex)
    {
        var screens = Forms.Screen.AllScreens;
        var screen = monitorIndex >= 0 && monitorIndex < screens.Length
            ? screens[monitorIndex]
            : Forms.Screen.PrimaryScreen;

        if (screen is null)
        {
            return null;
        }

        using var bitmap = new Bitmap(screen.Bounds.Width, screen.Bounds.Height);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(screen.Bounds.Left, screen.Bounds.Top, 0, 0, bitmap.Size);
        }

        await using var stream = new MemoryStream();
        bitmap.Save(stream, ImageFormat.Png);
        return stream.ToArray();
    }
}
