using System.IO;
using System.Text;
using System.Windows;

namespace TutorOverlay.Client;

public partial class App : System.Windows.Application
{
    internal static readonly string LogFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "TutorOverlay.Client",
        "runtime.log");

    protected override void OnStartup(StartupEventArgs e)
    {
        Log("App startup");

        DispatcherUnhandledException += (_, args) =>
        {
            Log($"DispatcherUnhandledException: {args.Exception}");
            System.Windows.MessageBox.Show(args.Exception.Message, "Unhandled error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };

        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
        {
            Log($"AppDomainUnhandledException: {args.ExceptionObject}");
        };

        TaskScheduler.UnobservedTaskException += (_, args) =>
        {
            Log($"UnobservedTaskException: {args.Exception}");
            args.SetObserved();
        };

        base.OnStartup(e);
    }

    internal static void Log(string message)
    {
        try
        {
            var directory = Path.GetDirectoryName(LogFilePath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.AppendAllText(
                LogFilePath,
                $"[{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}",
                Encoding.UTF8);
        }
        catch
        {
            // Ignore logging failures.
        }
    }
}
