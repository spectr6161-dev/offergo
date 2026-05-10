using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Threading.Channels;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using TutorOverlay.Client.Infrastructure;
using TutorOverlay.Client.Models;
using TutorOverlay.Client.Services;
using Forms = System.Windows.Forms;

namespace TutorOverlay.Client;

public partial class MainWindow : Window
{
    private const string DefaultSessionTag = "general";
    private const string DefaultMicDeviceId = "default-communications-mic";
    private const string DefaultDeviceId = "windows-overlay-client";
    private const int DefaultSourceProcessId = 0;
    private const int IdleBarWidth = 500;
    private const int ActiveBarWidth = 612;
    private const int ChatWidth = 760;
    private const int SettingsPanelWidth = 430;
    private const int SettingsPanelHeight = 620;
    private const int SettingsPanelGap = 12;
    private const int AuthWindowWidth = 400;
    private const int AuthWindowHeight = 540;
    private const int ClosedWindowHeight = 88;
    private const int OpenWindowHeight = 660;
    private const int OpenWindowMinWidth = 640;
    private const int OpenWindowMinHeight = 460;
    private const string ForceAuthEnvironmentVariable = "OFFERGO_FORCE_AUTH";
    private const string DesignPreviewEnvironmentVariable = "OFFERGO_DESIGN_PREVIEW";
    private const string DefaultAssistanceMode = "default";
    private const string LiveCodingAssistanceMode = "liveCoding";

    private static readonly string DefaultChatPlaceholder = "\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u043e\u0442\u0432\u0435\u0442\u044b.";
    private static readonly string ActiveChatPlaceholder = "\u0421\u043b\u0443\u0448\u0430\u0435\u043c \u0438 \u0436\u0434\u0435\u043c \u0432\u043e\u043f\u0440\u043e\u0441.";
    private static readonly string ScreenshotChatPlaceholder = "\u0421\u043d\u0438\u043c\u043e\u043a \u043e\u0431\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442\u0441\u044f.";

    private readonly ApiClient _apiClient = new();
    private readonly LiveSocketClient _liveSocketClient = new();
    private readonly AudioCaptureService _audioCaptureService = new();
    private readonly ScreenCaptureService _screenCaptureService = new();
    private readonly ClientSettingsService _clientSettingsService = new();
    private readonly DesktopSessionStorageService _desktopSessionStorageService = new();
    private readonly ProcessDiscoveryService _processDiscoveryService = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ObservableCollection<ChatEntry> _chatEntries = new();
    private readonly Dictionary<string, StreamingAnswerState> _streamingAnswers = new();
    private readonly object _signalUpdateSync = new();
    private readonly string _apiBaseUrl = Environment.GetEnvironmentVariable("OFFERGO_API_BASE_URL") ?? "http://localhost:3001/api/v1/";
    private readonly string _webBaseUrl = Environment.GetEnvironmentVariable("OFFERGO_WEB_BASE_URL") ?? "http://localhost:3000";
    private readonly string _telegramChannelUrl = Environment.GetEnvironmentVariable("OFFERGO_TELEGRAM_URL") ?? "https://t.me/offer_go";
    private readonly DispatcherTimer _thinkingTimer;
    private readonly DispatcherTimer _typewriterTimer;

    private BootstrapResponse? _bootstrap;
    private ClientSettings _clientSettings = ClientSettings.CreateDefault();
    private string? _accessToken;
    private string? _sessionId;
    private string? _currentEmail;
    private string? _currentDisplayName;
    private string _chatPlaceholderText = DefaultChatPlaceholder;
    private MainUiState _mainUiState = MainUiState.Unauthorized;
    private PendingAnswerKind _pendingAnswerKind = PendingAnswerKind.None;
    private bool _isChatOpen;
    private bool _isClickThrough;
    private bool _isLiveSessionConnected;
    private bool _isSmartModelEnabled = true;
    private bool _isAutoModeEnabled = true;
    private bool _isLiveCodingModeEnabled;
    private bool _hasCustomAuthorizedPosition;
    private bool _hasCustomChatSize;
    private double _customChatWidth;
    private double _customChatHeight;
    private int _signalPercent;
    private DateTimeOffset? _sessionStartedAt;
    private TaskCompletionSource<bool>? _sessionReadySource;
    private HotKeyManager? _hotKeyManager;
    private HwndSource? _hwndSource;
    private bool _signalUpdateQueued;
    private int _pendingSignalLevel;
    private bool _isAnswerPending;
    private int _thinkingFrame;
    private CancellationTokenSource? _audioSendCts;
    private Channel<AudioOutboundFrame>? _audioFrameQueue;
    private Task? _audioSendTask;
    private CancellationTokenSource? _browserAuthCts;
    private bool _isFallbackLoginVisible;
    private bool _isScreenshotInProgress;
    private bool _isMicCaptureEnabled = true;

    public MainWindow()
    {
        App.Log("MainWindow ctor start");
        InitializeComponent();

        _thinkingTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(380),
        };
        _thinkingTimer.Tick += ThinkingTimer_OnTick;

        _typewriterTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(24),
        };
        _typewriterTimer.Tick += TypewriterTimer_OnTick;

        _clientSettings = _clientSettingsService.Load();
        _isSmartModelEnabled = _clientSettings.SmartModelEnabled;
        _isAutoModeEnabled = _clientSettings.AutoAnswerEnabled;

        _apiClient.Configure(_apiBaseUrl);
        VersionTextBlock.Text = GetVersionText();
        ChatListBox.ItemsSource = _chatEntries;

        Loaded += MainWindow_OnLoaded;
        Closing += MainWindow_OnClosing;
        SourceInitialized += MainWindow_OnSourceInitialized;

        _liveSocketClient.MessageReceived += LiveSocketClient_OnMessageReceived;
        _liveSocketClient.ConnectionClosed += LiveSocketClient_OnConnectionClosed;
        _audioCaptureService.AudioFrameReady += AudioCaptureService_OnAudioFrameReady;
        _audioCaptureService.Warning += (_, message) => App.Log($"Audio warning: {message}");
        _audioCaptureService.StatusChanged += (_, message) =>
        {
            App.Log($"Audio status: {message}");
            Dispatcher.BeginInvoke(() => SettingsStatusTextBlock.Text = message);
        };

        ApplyUnauthorizedLayout();
        App.Log("MainWindow ctor end");
    }

    private async void MainWindow_OnLoaded(object sender, RoutedEventArgs e)
    {
        PopulateSettingsOptions();
        ApplySettingsToControls();
        await BootstrapAsync();
        ApplyPreviewModeIfNeeded();

        if (_mainUiState == MainUiState.Unauthorized)
        {
            await TryRestoreDesktopSessionAsync();
        }
    }

    private void MainWindow_OnSourceInitialized(object? sender, EventArgs e)
    {
        var handle = new WindowInteropHelper(this).Handle;
        _hwndSource = HwndSource.FromHwnd(handle);
        _hwndSource?.AddHook(WndProc);
        _hotKeyManager = new HotKeyManager(handle, App.Log);
        _hotKeyManager.RegisterDefaults();

        var styles = NativeMethods.GetWindowLong(handle, NativeMethods.GwlExStyle);
        NativeMethods.SetWindowLong(handle, NativeMethods.GwlExStyle, styles | NativeMethods.WsExToolWindow);

        if (!NativeMethods.SetWindowDisplayAffinity(handle, NativeMethods.WdaExcludeFromCapture))
        {
            App.Log("Display affinity exclude-from-capture is not available.");
        }
    }

    private async void MainWindow_OnClosing(object? sender, CancelEventArgs e)
    {
        _browserAuthCts?.Cancel();

        try
        {
            if (_mainUiState == MainUiState.AuthorizedActive)
            {
                _audioCaptureService.Stop();
            }

            await StopAudioSendLoopAsync();

            if (_isLiveSessionConnected && !string.IsNullOrWhiteSpace(_sessionId))
            {
                await _liveSocketClient.SendAsync("session.stop", new { sessionId = _sessionId }, CancellationToken.None);
            }
        }
        catch
        {
        }

        try
        {
            await _liveSocketClient.DisconnectAsync(CancellationToken.None);
        }
        catch
        {
        }

        _hotKeyManager?.Dispose();
        _audioCaptureService.Dispose();
        await _liveSocketClient.DisposeAsync();
    }

    private async Task BootstrapAsync()
    {
        if (_bootstrap is not null)
        {
            return;
        }

        try
        {
            _bootstrap = await _apiClient.GetBootstrapAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            App.Log($"Bootstrap failed: {ex}");
            if (_mainUiState == MainUiState.Unauthorized)
            {
                AuthStatusTextBlock.Text = "\u041d\u0435\u0442 \u0441\u0432\u044f\u0437\u0438 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043e\u043c.";
            }
        }
    }

    private void ApplyPreviewModeIfNeeded()
    {
        var forceAuth = string.Equals(
            Environment.GetEnvironmentVariable(ForceAuthEnvironmentVariable),
            "1",
            StringComparison.Ordinal);

        var designPreview = string.Equals(
            Environment.GetEnvironmentVariable(DesignPreviewEnvironmentVariable),
            "1",
            StringComparison.Ordinal);

        if (!forceAuth && !designPreview)
        {
            return;
        }

        _accessToken = "preview-access-token";
        _apiClient.AccessToken = _accessToken;
        _currentEmail = "preview@offergo.local";
        _currentDisplayName = "Preview User";
        ApplyAuthorizedLayout(MainUiState.AuthorizedIdle, forceCenter: true);

        if (!designPreview)
        {
            return;
        }

        _sessionId = "preview-session";
        _sessionStartedAt = DateTimeOffset.Now.AddMinutes(-8);
        _mainUiState = MainUiState.AuthorizedActive;
        _isChatOpen = true;
        _chatEntries.Clear();
        _chatEntries.Add(new ChatEntry
        {
            Message = "\u0412 C# `async` \u043d\u0443\u0436\u0435\u043d \u0434\u043b\u044f \u0442\u043e\u0433\u043e, \u0447\u0442\u043e\u0431\u044b \u043c\u0435\u0442\u043e\u0434 \u043c\u043e\u0433 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c `await` \u0438 \u043d\u0435 \u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u0442\u044c UI \u043f\u043e\u0442\u043e\u043a.",
            TimeLabel = DateTime.Now.AddMinutes(-2).ToString("HH:mm"),
        });
        _chatEntries.Add(new ChatEntry
        {
            Message = "\u0414\u043b\u044f SQL \u0438\u043d\u0434\u0435\u043a\u0441\u0430 \u043a\u0440\u0430\u0442\u043a\u043e \u043e\u0431\u044a\u044f\u0441\u043d\u0438: \u043e\u043d \u0443\u0441\u043a\u043e\u0440\u044f\u0435\u0442 \u043f\u043e\u0438\u0441\u043a \u0438 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u0446\u0438\u044e, \u043d\u043e \u0443\u0432\u0435\u043b\u0438\u0447\u0438\u0432\u0430\u0435\u0442 \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c INSERT \u0438 UPDATE.",
            TimeLabel = DateTime.Now.ToString("HH:mm"),
        });
        _signalPercent = 64;
        RefreshUi(forceCenter: true);
    }

    private void ApplyUnauthorizedLayout()
    {
        _mainUiState = MainUiState.Unauthorized;
        _isChatOpen = false;
        _isMicCaptureEnabled = true;
        _hasCustomChatSize = false;
        _sessionId = null;
        _accessToken = null;
        _apiClient.AccessToken = null;
        _currentEmail = null;
        _currentDisplayName = null;
        _browserAuthCts?.Cancel();
        AuthStatusTextBlock.Text = string.Empty;
        FallbackLoginPanel.Visibility = Visibility.Collapsed;
        ToggleFallbackLoginButton.Content = "\u0412\u043e\u0439\u0442\u0438 \u043f\u0440\u044f\u043c\u043e \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438";
        _isFallbackLoginVisible = false;
        AuthView.Visibility = Visibility.Visible;
        OverlayView.Visibility = Visibility.Collapsed;
        Width = AuthWindowWidth;
        Height = AuthWindowHeight;
        MinWidth = 380;
        MinHeight = 500;
        ApplyWindowOpacity(_clientSettings.WindowOpacityPercent);
        CenterWindowOnPrimaryScreen();
    }

    private void ApplyAuthorizedLayout(MainUiState state, bool forceCenter)
    {
        _mainUiState = state;
        AuthView.Visibility = Visibility.Collapsed;
        OverlayView.Visibility = Visibility.Visible;
        UpdateAccountPanel();

        if (forceCenter)
        {
            _hasCustomAuthorizedPosition = false;
            _hasCustomChatSize = false;
        }

        RefreshUi(forceCenter);
        Show();
        Activate();
    }

    private void RefreshUi(bool forceCenter = false)
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        var isActive = _mainUiState == MainUiState.AuthorizedActive;
        var barWidth = isActive ? ActiveBarWidth : IdleBarWidth;
        var settingsOpen = SettingsBackdrop.Visibility == Visibility.Visible;
        var contentWidth = _isChatOpen ? Math.Max(barWidth, ChatWidth) : barWidth;
        var contentHeight = _isChatOpen ? OpenWindowHeight : ClosedWindowHeight;
        var overlayContentWidth = (double)contentWidth;
        var overlayContentHeight = (double)contentHeight;
        var accentBrush = (System.Windows.Media.Brush)FindResource("AccentGreenBrush");
        var stopBrush = (System.Windows.Media.Brush)FindResource("StopBrush");

        TopBarBorder.Width = barWidth;
        OverlayStackPanel.HorizontalAlignment = settingsOpen
            ? System.Windows.HorizontalAlignment.Left
            : System.Windows.HorizontalAlignment.Center;
        SettingsBackdrop.Width = SettingsPanelWidth;
        SettingsBackdrop.MaxHeight = SettingsPanelHeight;
        SessionToggleButton.Content = isActive
            ? "\u0421\u0442\u043e\u043f"
            : "\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e";
        SessionToggleButton.Background = isActive ? stopBrush : accentBrush;
        SessionToggleButton.BorderBrush = isActive ? stopBrush : accentBrush;
        ActivityIndicatorBorder.Visibility = isActive ? Visibility.Visible : Visibility.Collapsed;
        MicrophoneButton.Visibility = isActive ? Visibility.Visible : Visibility.Collapsed;
        ChatOverlayBorder.Visibility = _isChatOpen ? Visibility.Visible : Visibility.Collapsed;
        SmartModelToggleButton.IsChecked = _isSmartModelEnabled;
        AutoModeToggleButton.IsChecked = _isAutoModeEnabled;
        LiveCodingModeToggleButton.IsChecked = _isLiveCodingModeEnabled;
        UpdateMicrophoneButtonState();
        ApplyWindowOpacity(_clientSettings.WindowOpacityPercent);

        if (_isChatOpen)
        {
            var defaultWidth = contentWidth + 28;
            var defaultHeight = OpenWindowHeight;

            MinWidth = OpenWindowMinWidth;
            MinHeight = OpenWindowMinHeight;

            if (!_hasCustomChatSize || forceCenter)
            {
                Width = defaultWidth;
                Height = defaultHeight;
                _customChatWidth = Width;
                _customChatHeight = Height;
            }
            else
            {
                Width = Math.Max(OpenWindowMinWidth, _customChatWidth);
                Height = Math.Max(OpenWindowMinHeight, _customChatHeight);
            }

            overlayContentWidth = Math.Max(barWidth, Width - 28);
            overlayContentHeight = Math.Max(ClosedWindowHeight, Height - 28);
        }
        else
        {
            Width = contentWidth + 28;
            Height = ClosedWindowHeight;
            MinWidth = Width;
            MinHeight = Height;
        }

        if (settingsOpen)
        {
            var sideBySideWidth = contentWidth + SettingsPanelGap + SettingsPanelWidth + 28;
            var sideBySideHeight = Math.Max(contentHeight, SettingsPanelHeight + 28);
            Width = sideBySideWidth;
            Height = sideBySideHeight;
            MinWidth = sideBySideWidth;
            MinHeight = sideBySideHeight;
        }

        UpdateOverlayContentSize(overlayContentWidth, overlayContentHeight);

        if (!settingsOpen || forceCenter)
        {
            PositionAuthorizedWindow(forceCenter);
        }

        UpdateChatState();
        UpdateSignalLevel(isActive ? _signalPercent : 0);
    }

    private void UpdateOverlayContentSize(double width, double height)
    {
        OverlayStackPanel.Width = Math.Max(0, width);
        OverlayStackPanel.Height = Math.Max(ClosedWindowHeight, height);
    }

    private void ApplyWindowOpacity(int opacityPercent)
    {
        var opacity = Math.Clamp(opacityPercent, 65, 100) / 100d;
        AuthRootBorder.Opacity = opacity;
        TopBarBorder.Opacity = opacity;
        ChatOverlayBorder.Opacity = opacity;
        SettingsPanelBorder.Opacity = opacity;
    }

    private string CurrentAssistanceMode => _isLiveCodingModeEnabled
        ? LiveCodingAssistanceMode
        : DefaultAssistanceMode;

    private void UpdateMicrophoneButtonState()
    {
        MicrophoneButtonIcon.Kind = _isMicCaptureEnabled
            ? MaterialDesignThemes.Wpf.PackIconKind.MicrophoneOutline
            : MaterialDesignThemes.Wpf.PackIconKind.MicrophoneOff;

        MicrophoneButton.ToolTip = _isMicCaptureEnabled
            ? "\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d \u0432\u043a\u043b\u044e\u0447\u0451\u043d"
            : "\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d";

        MicrophoneButton.Background = _isMicCaptureEnabled
            ? (System.Windows.Media.Brush)FindResource("CardSurfaceAltBrush")
            : new SolidColorBrush(System.Windows.Media.Color.FromArgb(36, 239, 68, 68));
        MicrophoneButton.BorderBrush = _isMicCaptureEnabled
            ? (System.Windows.Media.Brush)FindResource("SoftStrokeBrush")
            : (System.Windows.Media.Brush)FindResource("StopBrush");
    }

    private void PositionAuthorizedWindow(bool forceCenter)
    {
        if (_hasCustomAuthorizedPosition && !forceCenter)
        {
            return;
        }

        var screen = Forms.Screen.PrimaryScreen;
        var workArea = screen?.WorkingArea ?? new System.Drawing.Rectangle(0, 0, 1600, 900);
        Left = workArea.Left + Math.Max(0, (workArea.Width - Width) / 2d);
        Top = workArea.Top + 18;
    }

    private void CenterWindowOnPrimaryScreen()
    {
        var screen = Forms.Screen.PrimaryScreen;
        var workArea = screen?.WorkingArea ?? new System.Drawing.Rectangle(0, 0, 1600, 900);
        Left = workArea.Left + Math.Max(0, (workArea.Width - Width) / 2d);
        Top = workArea.Top + Math.Max(0, (workArea.Height - Height) / 2d);
    }

    private void UpdateChatState()
    {
        var hasEntries = _chatEntries.Count > 0;
        ChatListBox.Visibility = hasEntries ? Visibility.Visible : Visibility.Collapsed;
        ChatEmptyStateTextBlock.Visibility = hasEntries ? Visibility.Collapsed : Visibility.Visible;
        ChatEmptyStateTextBlock.Text = _chatPlaceholderText;
        UpdateThinkingState();
    }

    private void SetAnswerPending(bool pending)
    {
        _isAnswerPending = pending;
        if (pending)
        {
            _thinkingFrame = 0;
        }

        UpdateThinkingState();
    }

    private void UpdateThinkingState()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            ThinkingTextBlock.Visibility = Visibility.Collapsed;
            _thinkingTimer.Stop();
            return;
        }

        ThinkingTextBlock.Visibility = _isAnswerPending ? Visibility.Visible : Visibility.Collapsed;
        if (_isAnswerPending)
        {
            UpdateThinkingText();
            if (!_thinkingTimer.IsEnabled)
            {
                _thinkingTimer.Start();
            }
        }
        else
        {
            _thinkingTimer.Stop();
        }
    }

    private void ThinkingTimer_OnTick(object? sender, EventArgs e)
    {
        _thinkingFrame = (_thinkingFrame + 1) % 4;
        UpdateThinkingText();
    }

    private void UpdateThinkingText()
    {
        var dots = new string('.', _thinkingFrame);
        ThinkingTextBlock.Text = dots.Length == 0
            ? "Думаю"
            : $"Думаю{dots}";
    }

    private void OpenChat(bool focusInput = false)
    {
        _isChatOpen = true;
        RefreshUi();

        if (focusInput)
        {
            Dispatcher.BeginInvoke(() =>
            {
                ManualPromptTextBox.Focus();
                ManualPromptTextBox.SelectAll();
            });
        }
    }

    private void CloseChat()
    {
        _isChatOpen = false;
        RefreshUi();
    }

    private void FocusNewMessage()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        OpenChat(focusInput: true);
    }

    private void ClearChat()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        _streamingAnswers.Clear();
        _chatEntries.Clear();
        _pendingAnswerKind = PendingAnswerKind.None;
        SetAnswerPending(false);
        ResetChatPlaceholder();
        OpenChat();
    }

    private void ScrollChatPage(int direction)
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        OpenChat();
        Dispatcher.BeginInvoke(() =>
        {
            var scrollViewer = FindVisualChild<ScrollViewer>(ChatListBox);
            if (scrollViewer is null)
            {
                return;
            }

            if (direction < 0)
            {
                scrollViewer.PageUp();
            }
            else
            {
                scrollViewer.PageDown();
            }
        });
    }

    private void ScrollChatTo(bool bottom)
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        OpenChat();
        Dispatcher.BeginInvoke(() =>
        {
            var scrollViewer = FindVisualChild<ScrollViewer>(ChatListBox);
            if (scrollViewer is null)
            {
                return;
            }

            if (bottom)
            {
                scrollViewer.ScrollToBottom();
            }
            else
            {
                scrollViewer.ScrollToTop();
            }
        });
    }

    private void ToggleWindowVisibility()
    {
        if (IsVisible)
        {
            Hide();
            return;
        }

        Show();
        Activate();
        Topmost = true;
    }

    private void ToggleChatVisibility()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            if (!IsVisible)
            {
                Show();
                Activate();
                Topmost = true;
            }

            return;
        }

        if (!IsVisible)
        {
            Show();
            Activate();
            Topmost = true;
            OpenChat();
            return;
        }

        if (_isChatOpen)
        {
            CloseChat();
            return;
        }

        OpenChat();
    }

    private static T? FindVisualChild<T>(DependencyObject parent)
        where T : DependencyObject
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T match)
            {
                return match;
            }

            var descendant = FindVisualChild<T>(child);
            if (descendant is not null)
            {
                return descendant;
            }
        }

        return null;
    }

    private void SetChatPlaceholder(string text)
    {
        _chatPlaceholderText = text;
        UpdateChatState();
    }

    private void ResetChatPlaceholder()
    {
        _chatPlaceholderText = _mainUiState == MainUiState.AuthorizedActive
            ? ActiveChatPlaceholder
            : DefaultChatPlaceholder;
        UpdateChatState();
    }

    private void PopulateSettingsOptions()
    {
        AudioCaptureModeComboBox.ItemsSource = new[]
        {
            new SettingChoice(AudioCaptureModes.Device, "Всё устройство"),
            new SettingChoice(AudioCaptureModes.Process, "Процесс"),
            new SettingChoice(AudioCaptureModes.MicOnly, "Только микрофон"),
        };

        ScreenshotModeComboBox.ItemsSource = new[]
        {
            new SettingChoice(ScreenshotModes.Screen, "Экран"),
            new SettingChoice(ScreenshotModes.Region, "Область"),
        };

        AnswerLengthComboBox.ItemsSource = new[]
        {
            new SettingChoice(AnswerLengths.Short, "Короткий"),
            new SettingChoice(AnswerLengths.Detailed, "Подробный"),
        };

        AnswerProviderComboBox.ItemsSource = new[]
        {
            new SettingChoice(AnswerProviders.Yandex, "Yandex GPT"),
            new SettingChoice(AnswerProviders.Gemini, "Gemini"),
        };

        RefreshSettingsOptions();
    }

    private void RefreshSettingsOptions()
    {
        var devices = _audioCaptureService.GetAudioDevices();
        MicDeviceComboBox.ItemsSource = devices.Where(device => device.Kind == "mic").ToList();
        OutputDeviceComboBox.ItemsSource = devices.Where(device => device.Kind == "output").ToList();

        var processes = new List<ProcessAudioOption>
        {
            new(0, string.Empty, "Не выбран", false),
        };
        processes.AddRange(_processDiscoveryService.GetProcessOptions());
        ProcessComboBox.ItemsSource = processes;

        var screens = Forms.Screen.AllScreens;
        MonitorComboBox.ItemsSource = screens
            .Select((screen, index) => new MonitorOption(index, $"Экран {index + 1} · {screen.Bounds.Width}x{screen.Bounds.Height}"))
            .ToList();
    }

    private void ApplySettingsToControls()
    {
        _clientSettings.Normalize();
        AudioCaptureModeComboBox.SelectedValue = _clientSettings.AudioCaptureMode;
        MicDeviceComboBox.SelectedValue = _clientSettings.MicDeviceId;
        OutputDeviceComboBox.SelectedValue = _clientSettings.OutputDeviceId;
        ProcessComboBox.SelectedValue = _clientSettings.SelectedProcessId;
        ScreenshotModeComboBox.SelectedValue = _clientSettings.ScreenshotMode;
        MonitorComboBox.SelectedValue = _clientSettings.MonitorIndex;
        AnswerLengthComboBox.SelectedValue = _clientSettings.AnswerLength;
        AnswerProviderComboBox.SelectedValue = _clientSettings.AnswerProvider;
        OverlayOpacitySlider.Value = _clientSettings.WindowOpacityPercent;
        OverlayOpacityValueTextBlock.Text = $"{_clientSettings.WindowOpacityPercent}%";
        ApplyWindowOpacity(_clientSettings.WindowOpacityPercent);
        UpdateAccountPanel();
        SettingsStatusTextBlock.Text = BuildSettingsStatusText();
    }

    private void ReadSettingsFromControls()
    {
        _clientSettings.AudioCaptureMode = AudioCaptureModeComboBox.SelectedValue as string ?? AudioCaptureModes.Device;
        _clientSettings.MicDeviceId = MicDeviceComboBox.SelectedValue as string ?? DefaultMicDeviceId;
        _clientSettings.OutputDeviceId = OutputDeviceComboBox.SelectedValue as string ?? "default-output";
        _clientSettings.SelectedProcessId = ProcessComboBox.SelectedValue is int processId ? processId : 0;
        _clientSettings.ScreenshotMode = ScreenshotModeComboBox.SelectedValue as string ?? ScreenshotModes.Screen;
        _clientSettings.MonitorIndex = MonitorComboBox.SelectedValue is int monitorIndex ? monitorIndex : 0;
        _clientSettings.AnswerLength = AnswerLengthComboBox.SelectedValue as string ?? AnswerLengths.Short;
        _clientSettings.AnswerProvider = AnswerProviderComboBox.SelectedValue as string ?? AnswerProviders.Yandex;
        _clientSettings.AutoAnswerEnabled = _isAutoModeEnabled;
        _clientSettings.SmartModelEnabled = _isSmartModelEnabled;
        _clientSettings.WindowOpacityPercent = (int)Math.Round(OverlayOpacitySlider.Value);
        _clientSettings.Normalize();
    }

    private string BuildSettingsStatusText()
    {
        var providerText = _clientSettings.AnswerProvider == AnswerProviders.Gemini ? "Gemini" : "Yandex GPT";
        var captureText = _clientSettings.AudioCaptureMode switch
        {
            AudioCaptureModes.Process when _clientSettings.SelectedProcessId <= 0 =>
                "\u0414\u043b\u044f \u0440\u0435\u0436\u0438\u043c\u0430 \u00ab\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u00bb \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0437\u0432\u043e\u043d\u043a\u0430. \u041f\u043e\u043a\u0430 \u0431\u0443\u0434\u0435\u0442 fallback \u043d\u0430 \u0432\u0441\u0451 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e.",
            AudioCaptureModes.Process =>
                "\u0420\u0435\u0436\u0438\u043c \u00ab\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u00bb \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 helper; \u0435\u0441\u043b\u0438 helper \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d, \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0441\u044f fallback.",
            AudioCaptureModes.MicOnly =>
                "\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u0439 \u0437\u0432\u0443\u043a \u043d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442\u0441\u044f, \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043a\u0440\u043e\u0444\u043e\u043d.",
            _ =>
                "\u0417\u0430\u0445\u0432\u0430\u0442 \u0438\u0434\u0451\u0442 \u0441\u043e \u0432\u0441\u0435\u0433\u043e \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0438 \u043c\u0438\u043a\u0440\u043e\u0444\u043e\u043d\u0430.",
        };

        return $"{captureText} Live: Gemini, \u043e\u0442\u0432\u0435\u0442\u044b: {providerText}.";
    }
    private void UpdateAccountPanel()
    {
        var hasAccount = !string.IsNullOrWhiteSpace(_currentEmail);
        SettingsAccountNameTextBlock.Text = string.IsNullOrWhiteSpace(_currentDisplayName)
            ? "Аккаунт не подключен"
            : _currentDisplayName;
        SettingsAccountEmailTextBlock.Text = hasAccount
            ? _currentEmail
            : "Войдите через браузер или резервный вход.";

        SettingsAccountStateTextBlock.Text = _mainUiState switch
        {
            MainUiState.AuthorizedActive => "Сессия активна. Можно открыть веб-аккаунт, переподключить авторизацию или выйти.",
            MainUiState.AuthorizedIdle when hasAccount => "Клиент подключен. Управление аккаунтом доступно прямо отсюда.",
            _ => "Авторизация не завершена.",
        };

        OpenWebAccountButton.IsEnabled = hasAccount;
        ReconnectAccountButton.IsEnabled = true;
        LogoutAccountButton.IsEnabled = hasAccount;
    }

    private void SettingsButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (SettingsBackdrop.Visibility == Visibility.Visible)
        {
            SettingsBackdrop.Visibility = Visibility.Collapsed;
            RefreshUi();
            return;
        }

        RefreshSettingsOptions();
        ApplySettingsToControls();
        SettingsBackdrop.Visibility = Visibility.Visible;
        RefreshUi();
    }

    private void CloseSettingsButton_OnClick(object sender, RoutedEventArgs e)
    {
        SettingsBackdrop.Visibility = Visibility.Collapsed;
        RefreshUi();
    }

    private void SettingsBackdrop_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource == SettingsBackdrop)
        {
            SettingsBackdrop.Visibility = Visibility.Collapsed;
            RefreshUi();
        }
    }

    private void SettingsPanel_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
    }

    private void RefreshSettingsButton_OnClick(object sender, RoutedEventArgs e)
    {
        RefreshSettingsOptions();
        ApplySettingsToControls();
        SettingsStatusTextBlock.Text = "Список устройств и процессов обновлён.";
    }

    private void TestAudioButton_OnClick(object sender, RoutedEventArgs e)
    {
        SettingsStatusTextBlock.Text = _mainUiState == MainUiState.AuthorizedActive
            ? $"Текущий уровень сигнала: {_signalPercent}%."
            : "Начните сессию, чтобы проверить live-уровень сигнала.";
    }

    private void SaveSettingsButton_OnClick(object sender, RoutedEventArgs e)
    {
        ReadSettingsFromControls();
        _isAutoModeEnabled = _clientSettings.AutoAnswerEnabled;
        _isSmartModelEnabled = _clientSettings.SmartModelEnabled;
        _clientSettingsService.Save(_clientSettings);
        SettingsStatusTextBlock.Text = "Настройки сохранены.";
        RefreshUi();
        _ = SyncAssistanceModeAsync();
    }

    private void OverlayOpacitySlider_OnValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (!IsLoaded)
        {
            return;
        }

        var opacityPercent = (int)Math.Round(e.NewValue);
        OverlayOpacityValueTextBlock.Text = $"{opacityPercent}%";
        ApplyWindowOpacity(opacityPercent);
    }

    private async Task TryRestoreDesktopSessionAsync()
    {
        var storedSession = _desktopSessionStorageService.Load();
        if (storedSession is null || string.IsNullOrWhiteSpace(storedSession.AccessToken))
        {
            return;
        }

        try
        {
            _accessToken = storedSession.AccessToken;
            _apiClient.AccessToken = storedSession.AccessToken;
            var me = await _apiClient.GetMeAsync(CancellationToken.None);
            CompleteAuthorization(storedSession.AccessToken, me, storedSession.ExpiresAt, persistSession: false);
        }
        catch (Exception ex)
        {
            App.Log($"Desktop session restore failed: {ex}");
            _desktopSessionStorageService.Clear();
            _accessToken = null;
            _apiClient.AccessToken = null;
        }
    }

    private async void BrowserAuthorizeButton_OnClick(object sender, RoutedEventArgs e)
    {
        await BeginBrowserAuthorizationAsync();
    }

    private async Task BeginBrowserAuthorizationAsync()
    {
        try
        {
            _browserAuthCts?.Cancel();
            _browserAuthCts = new CancellationTokenSource();

            AuthStatusTextBlock.Text = "\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u043c \u0431\u0440\u0430\u0443\u0437\u0435\u0440...";
            SettingsStatusTextBlock.Text = "Открываем браузер для авторизации.";
            var result = await _apiClient.StartBrowserLoginAsync(GetDeviceName(), _browserAuthCts.Token);
            AuthStatusTextBlock.Text = "\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u043d\u0430 \u0441\u0430\u0439\u0442 \u0438\u043b\u0438 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0432\u0445\u043e\u0434. \u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0436\u0434\u0451\u0442 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044e.";
            SettingsStatusTextBlock.Text = "Подтвердите вход в браузере. Клиент ждёт авторизацию.";

            Process.Start(new ProcessStartInfo(result.ApproveUrl)
            {
                UseShellExecute = true,
            });

            _ = PollBrowserAuthorizationAsync(result, _browserAuthCts.Token);
        }
        catch (Exception ex)
        {
            AuthStatusTextBlock.Text = ex.Message;
            SettingsStatusTextBlock.Text = ex.Message;
        }
    }

    private async Task PollBrowserAuthorizationAsync(BrowserLoginStartResponse start, CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var poll = await _apiClient.PollBrowserLoginAsync(start.RequestId, start.PollToken, cancellationToken);
                switch (poll.Status)
                {
                    case "pending":
                        await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, start.IntervalSeconds)), cancellationToken);
                        continue;
                    case "approved" when !string.IsNullOrWhiteSpace(poll.AccessToken) && poll.Employee is not null:
                        Dispatcher.Invoke(() =>
                        {
                            CompleteAuthorization(poll.AccessToken!, poll.Employee, poll.ExpiresAt ?? start.ExpiresAt, persistSession: true);
                            AuthStatusTextBlock.Text = string.Empty;
                            SettingsStatusTextBlock.Text = "Аккаунт подключен.";
                        });
                        return;
                    case "expired":
                        Dispatcher.Invoke(() =>
                        {
                            AuthStatusTextBlock.Text = "\u0412\u0440\u0435\u043c\u044f \u0432\u0445\u043e\u0434\u0430 \u0438\u0441\u0442\u0435\u043a\u043b\u043e. \u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0435\u0433\u043e \u0437\u0430\u043d\u043e\u0432\u043e.";
                            SettingsStatusTextBlock.Text = "Ссылка авторизации истекла.";
                        });
                        return;
                    case "cancelled":
                        Dispatcher.Invoke(() =>
                        {
                            AuthStatusTextBlock.Text = "\u0412\u0445\u043e\u0434 \u043e\u0442\u043c\u0435\u043d\u0451\u043d.";
                            SettingsStatusTextBlock.Text = "Авторизация отменена.";
                        });
                        return;
                    default:
                        Dispatcher.Invoke(() =>
                        {
                            AuthStatusTextBlock.Text = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0432\u0445\u043e\u0434.";
                            SettingsStatusTextBlock.Text = "Не удалось завершить авторизацию.";
                        });
                        return;
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            Dispatcher.Invoke(() =>
            {
                AuthStatusTextBlock.Text = ex.Message;
                SettingsStatusTextBlock.Text = ex.Message;
            });
        }
    }

    private void ToggleFallbackLoginButton_OnClick(object sender, RoutedEventArgs e)
    {
        _isFallbackLoginVisible = !_isFallbackLoginVisible;
        FallbackLoginPanel.Visibility = _isFallbackLoginVisible ? Visibility.Visible : Visibility.Collapsed;
        ToggleFallbackLoginButton.Content = _isFallbackLoginVisible
            ? "\u0421\u043a\u0440\u044b\u0442\u044c \u0432\u0445\u043e\u0434 \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438"
            : "\u0412\u043e\u0439\u0442\u0438 \u043f\u0440\u044f\u043c\u043e \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438";
    }

    private async void AppLoginButton_OnClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var email = FallbackEmailTextBox.Text.Trim();
            var password = FallbackPasswordBox.Password;
            var result = await _apiClient.AppLoginAsync(email, password, GetDeviceName(), CancellationToken.None);
            CompleteAuthorization(result.AccessToken, result.Employee, result.ExpiresAt, persistSession: true);
            AuthStatusTextBlock.Text = string.Empty;
        }
        catch (Exception ex)
        {
            AuthStatusTextBlock.Text = ex.Message;
        }
    }

    private void CompleteAuthorization(string accessToken, EmployeeDto employee, string expiresAt, bool persistSession)
    {
        _accessToken = accessToken;
        _apiClient.AccessToken = accessToken;
        _currentEmail = employee.Email;
        _currentDisplayName = employee.DisplayName;
        AuthStatusTextBlock.Text = string.Empty;
        UpdateAccountPanel();

        if (persistSession)
        {
            _desktopSessionStorageService.Save(new StoredDesktopSession(
                accessToken,
                expiresAt,
                employee,
                DateTimeOffset.Now.ToString("O")));
        }

        ApplyAuthorizedLayout(MainUiState.AuthorizedIdle, forceCenter: true);
        _ = RefreshBillingStatusAsync();
    }

    private async Task RefreshBillingStatusAsync()
    {
        if (string.IsNullOrWhiteSpace(_apiClient.AccessToken))
        {
            BillingStatusTextBlock.Text = string.Empty;
            return;
        }

        try
        {
            var subscription = await _apiClient.GetBillingSubscriptionAsync(CancellationToken.None);
            BillingStatusTextBlock.Text = BuildBillingStatusText(subscription);
        }
        catch (Exception ex)
        {
            App.Log($"Billing status refresh failed: {ex}");
            BillingStatusTextBlock.Text = "Не удалось загрузить лимиты подписки.";
        }
    }

    private static string BuildBillingStatusText(BillingSubscriptionResponse subscription)
    {
        var audio = subscription.Limits.FirstOrDefault(item => item.Feature == "wpf_audio_seconds");
        var screenshots = subscription.Limits.FirstOrDefault(item => item.Feature == "wpf_screenshot");
        var text = subscription.Limits.FirstOrDefault(item => item.Feature == "wpf_text_request");

        return $"Тариф: {subscription.CurrentPlan.Name}. " +
               $"Аудио: {FormatBillingLimit(audio)}; " +
               $"скриншоты: {FormatBillingLimit(screenshots)}; " +
               $"текст: {FormatBillingLimit(text)}.";
    }

    private static string FormatBillingLimit(BillingLimitDto? item)
    {
        if (item is null)
        {
            return "нет данных";
        }

        var used = item.Used + item.Reserved;
        if (item.Unlimited)
        {
            return $"{FormatBillingFeatureValue(item.Feature, used)} / безлимит";
        }

        return $"{FormatBillingFeatureValue(item.Feature, used)} / {FormatBillingFeatureValue(item.Feature, item.Limit ?? 0)}";
    }

    private static string FormatBillingFeatureValue(string feature, int value)
    {
        if (feature == "wpf_audio_seconds")
        {
            var minutes = value / 60;
            return $"{minutes} мин";
        }

        return value.ToString("N0", System.Globalization.CultureInfo.GetCultureInfo("ru-RU"));
    }

    private static string GetDeviceName()
    {
        return $"{Environment.MachineName} / Windows";
    }

    private void OpenWebAccountButton_OnClick(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo(new Uri(new Uri(_webBaseUrl), "/account").ToString())
            {
                UseShellExecute = true,
            });
            SettingsStatusTextBlock.Text = "Открыли аккаунт в браузере.";
        }
        catch (Exception ex)
        {
            SettingsStatusTextBlock.Text = ex.Message;
        }
    }

    private async void ReconnectAccountButton_OnClick(object sender, RoutedEventArgs e)
    {
        await BeginBrowserAuthorizationAsync();
    }

    private async void LogoutAccountButton_OnClick(object sender, RoutedEventArgs e)
    {
        await LogoutAccountAsync();
    }

    private async Task LogoutAccountAsync()
    {
        SettingsStatusTextBlock.Text = "Выходим из аккаунта...";

        try
        {
            if (_mainUiState == MainUiState.AuthorizedActive)
            {
                await StopListeningAsync();
            }
            else
            {
                _audioCaptureService.Stop();
                await StopAudioSendLoopAsync();

                if (_isLiveSessionConnected && !string.IsNullOrWhiteSpace(_sessionId))
                {
                    try
                    {
                        await _liveSocketClient.SendAsync("session.stop", new { sessionId = _sessionId }, CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        App.Log($"Session stop during logout failed: {ex}");
                    }
                }

                try
                {
                    await _liveSocketClient.DisconnectAsync(CancellationToken.None);
                }
                catch (Exception ex)
                {
                    App.Log($"Socket disconnect during logout failed: {ex}");
                }

                _isLiveSessionConnected = false;
                _sessionReadySource = null;
                _sessionId = null;
                _sessionStartedAt = null;
            }

            if (!string.IsNullOrWhiteSpace(_accessToken))
            {
                try
                {
                    await _apiClient.LogoutAppAsync(CancellationToken.None);
                }
                catch (Exception ex)
                {
                    App.Log($"App logout request failed: {ex}");
                }
            }
        }
        finally
        {
            _browserAuthCts?.Cancel();
            _desktopSessionStorageService.Clear();
            _streamingAnswers.Clear();
            _chatEntries.Clear();
            _typewriterTimer.Stop();
            SetAnswerPending(false);
            _pendingAnswerKind = PendingAnswerKind.None;
            _signalPercent = 0;
            SettingsBackdrop.Visibility = Visibility.Collapsed;
            ApplyUnauthorizedLayout();
        }
    }

    private async void SessionToggleButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (_mainUiState == MainUiState.AuthorizedActive)
        {
            await StopListeningAsync();
            return;
        }

        await StartListeningAsync();
    }

    private async Task StartListeningAsync()
    {
        try
        {
            EnsureAuthenticated();
            await EnsureLiveSessionAsync(CancellationToken.None);
            _isMicCaptureEnabled = true;
            StartAudioSendLoop();
            _audioCaptureService.Start(_clientSettings);
            _sessionStartedAt = DateTimeOffset.Now;
            _mainUiState = MainUiState.AuthorizedActive;
            ResetChatPlaceholder();
            RefreshUi();
        }
        catch (Exception ex)
        {
            ShowAuthorizedError(ex.Message, openChat: false);
        }
    }

    private async Task StopListeningAsync()
    {
        try
        {
            _audioCaptureService.Stop();
            await StopAudioSendLoopAsync();

            if (_isLiveSessionConnected && !string.IsNullOrWhiteSpace(_sessionId))
            {
                await _liveSocketClient.SendAsync("session.stop", new { sessionId = _sessionId }, CancellationToken.None);
            }

            await _liveSocketClient.DisconnectAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            App.Log($"StopListeningAsync failed: {ex}");
        }

        _isLiveSessionConnected = false;
        _sessionReadySource = null;
        _sessionId = null;
        _sessionStartedAt = null;
        _signalPercent = 0;
        _pendingAnswerKind = PendingAnswerKind.None;
        _isMicCaptureEnabled = true;
        SetAnswerPending(false);
        _mainUiState = MainUiState.AuthorizedIdle;
        ResetChatPlaceholder();
        RefreshUi();
    }

    private void OpenAnswerButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (_isChatOpen)
        {
            CloseChat();
            return;
        }

        OpenChat(focusInput: true);
    }

    private void CloseChatButton_OnClick(object sender, RoutedEventArgs e)
    {
        CloseChat();
    }

    private async void TopScreenshotButton_OnClick(object sender, RoutedEventArgs e)
    {
        await HandleScreenshotAsync();
    }

    private async Task HandleScreenshotAsync()
    {
        if (_isScreenshotInProgress)
        {
            return;
        }

        _isScreenshotInProgress = true;
        ScreenshotButton.IsEnabled = false;

        try
        {
            EnsureAuthenticated();
            OpenChat();
            _pendingAnswerKind = PendingAnswerKind.Screenshot;
            SetAnswerPending(true);
            SetChatPlaceholder(ScreenshotChatPlaceholder);

            var shouldHideWindow = string.Equals(_clientSettings.ScreenshotMode, ScreenshotModes.Region, StringComparison.OrdinalIgnoreCase);
            if (shouldHideWindow)
            {
                Hide();
                await Task.Delay(120);
            }

            var bytes = await _screenCaptureService.CaptureAsync(this, _clientSettings.ScreenshotMode, _clientSettings.MonitorIndex);
            if (shouldHideWindow)
            {
                Show();
                Activate();
            }

            if (bytes is null)
            {
                _pendingAnswerKind = PendingAnswerKind.None;
                ResetChatPlaceholder();
                return;
            }

            await EnsureBackendSessionAsync(CancellationToken.None);
            AppendSystemMessage("\u0421\u043a\u0440\u0438\u043d\u0448\u043e\u0442 \u0441\u0434\u0435\u043b\u0430\u043d \u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043d\u0430 \u0430\u043d\u0430\u043b\u0438\u0437.");
            var result = await _apiClient.UploadScreenshotAsync(_sessionId!, bytes, "capture.png", _clientSettings.AnswerLength, CurrentAssistanceMode, _clientSettings.AnswerProvider, CancellationToken.None);
            AppendAnswer(result.Answer.ShortAnswer, result.Answer.Details);
            _ = RefreshBillingStatusAsync();
            _pendingAnswerKind = PendingAnswerKind.None;
        }
        catch (Exception ex)
        {
            ShowAuthorizedError(ex.Message, openChat: true);
            _ = RefreshBillingStatusAsync();
        }
        finally
        {
            if (!IsVisible)
            {
                Show();
            }

            Activate();
            Topmost = true;
            SetAnswerPending(false);
            ResetChatPlaceholder();
            ScreenshotButton.IsEnabled = true;
            _isScreenshotInProgress = false;
        }
    }

    private async void ManualPromptTextBox_OnKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CloseChat();
            return;
        }

        if (e.Key != Key.Enter)
        {
            return;
        }

        e.Handled = true;
        await SendManualPromptAsync();
    }

    private async Task SendManualPromptAsync()
    {
        var text = ManualPromptTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        try
        {
            EnsureAuthenticated();
            OpenChat();
            await EnsureLiveSessionAsync(CancellationToken.None);
            _pendingAnswerKind = PendingAnswerKind.Manual;
            SetAnswerPending(true);
            await _liveSocketClient.SendAsync(
                "manual.prompt",
                new
                {
                    sessionId = _sessionId,
                    text,
                    answerLength = _clientSettings.AnswerLength,
                    assistanceMode = CurrentAssistanceMode,
                    answerProvider = _clientSettings.AnswerProvider,
                },
                CancellationToken.None);
            ManualPromptTextBox.Clear();
            ResetChatPlaceholder();
        }
        catch (Exception ex)
        {
            ShowAuthorizedError(ex.Message, openChat: true);
            _ = RefreshBillingStatusAsync();
        }
    }

    private async void SendManualPromptButton_OnClick(object sender, RoutedEventArgs e)
    {
        await SendManualPromptAsync();
    }

    private void MicrophoneButton_OnClick(object sender, RoutedEventArgs e)
    {
        ToggleMicrophoneCapture();
    }

    private void ToggleMicrophoneCapture()
    {
        _isMicCaptureEnabled = !_isMicCaptureEnabled;
        UpdateMicrophoneButtonState();
        SettingsStatusTextBlock.Text = _isMicCaptureEnabled
            ? "\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d \u0434\u043b\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0432\u043a\u043b\u044e\u0447\u0451\u043d."
            : "\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d \u0434\u043b\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d.";
    }
    private void HelpButton_OnClick(object sender, RoutedEventArgs e)
    {
        const string message =
            "\u0413\u043e\u0440\u044f\u0447\u0438\u0435 \u043a\u043b\u0430\u0432\u0438\u0448\u0438:\n" +
            "Ctrl+Shift+L - \u0441\u0442\u0430\u0440\u0442/\u0441\u0442\u043e\u043f \u0441\u0435\u0441\u0441\u0438\u0438\n" +
            "Ctrl+Shift+S - \u0441\u043a\u0440\u0438\u043d\u0448\u043e\u0442\n" +
            "Ctrl+Shift+N \u0438\u043b\u0438 M - \u043d\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\n" +
            "Ctrl+Shift+C - \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0447\u0430\u0442\n" +
            "Ctrl+Shift+Up/Down - \u043f\u0440\u043e\u043a\u0440\u0443\u0442\u043a\u0430 \u0447\u0430\u0442\u0430\n" +
            "Ctrl+Shift+Home/End - \u043d\u0430\u0447\u0430\u043b\u043e/\u043a\u043e\u043d\u0435\u0446 \u0447\u0430\u0442\u0430\n" +
            "Ctrl+Shift+P - \u043c\u0438\u043a\u0440\u043e\u0444\u043e\u043d\n" +
            "Ctrl+Shift+A - \u0430\u0432\u0442\u043e\u0440\u0435\u0436\u0438\u043c\n" +
            "Ctrl+Shift+K - live-coding\n" +
            "Ctrl+Shift+D - \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439/\u043f\u043e\u0434\u0440\u043e\u0431\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442\n" +
            "Ctrl+Shift+T - \u0441\u043a\u0440\u044b\u0442\u044c/\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0447\u0430\u0442\n" +
            "Ctrl+Shift+H - \u0441\u043a\u0440\u044b\u0442\u044c/\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043e\u043a\u043d\u043e\n" +
            "Ctrl+Shift+O - \u043a\u043b\u0438\u043a-\u0441\u043a\u0432\u043e\u0437\u044c \u043e\u0432\u0435\u0440\u043b\u0435\u0439";

        System.Windows.MessageBox.Show(this, message, "offerGO", MessageBoxButton.OK, MessageBoxImage.Information);
    }
    private void SmartModelToggleButton_OnClick(object sender, RoutedEventArgs e)
    {
        _isSmartModelEnabled = SmartModelToggleButton.IsChecked == true;
        _clientSettings.SmartModelEnabled = _isSmartModelEnabled;
        _clientSettingsService.Save(_clientSettings);
    }

    private void AutoModeToggleButton_OnClick(object sender, RoutedEventArgs e)
    {
        SetAutoMode(AutoModeToggleButton.IsChecked == true);
    }

    private void LiveCodingModeToggleButton_OnClick(object sender, RoutedEventArgs e)
    {
        SetLiveCodingMode(LiveCodingModeToggleButton.IsChecked == true, notifyBackend: true);
    }

    private void ToggleAutoMode()
    {
        SetAutoMode(!_isAutoModeEnabled);
    }

    private void SetAutoMode(bool enabled)
    {
        _isAutoModeEnabled = enabled;
        _clientSettings.AutoAnswerEnabled = _isAutoModeEnabled;
        AutoModeToggleButton.IsChecked = _isAutoModeEnabled;
        _clientSettingsService.Save(_clientSettings);
    }

    private void ToggleLiveCodingMode()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        if (!IsVisible)
        {
            Show();
            Activate();
            Topmost = true;
        }

        OpenChat();
        SetLiveCodingMode(!_isLiveCodingModeEnabled, notifyBackend: true);
    }

    private void SetLiveCodingMode(bool enabled, bool notifyBackend)
    {
        _isLiveCodingModeEnabled = enabled;
        LiveCodingModeToggleButton.IsChecked = _isLiveCodingModeEnabled;

        if (_isLiveCodingModeEnabled)
        {
            SetAutoMode(true);
        }

        if (notifyBackend)
        {
            _ = SyncAssistanceModeAsync();
        }
    }

    private async Task SyncAssistanceModeAsync()
    {
        try
        {
            if (!_isLiveSessionConnected ||
                string.IsNullOrWhiteSpace(_sessionId) ||
                _liveSocketClient.State != System.Net.WebSockets.WebSocketState.Open)
            {
                return;
            }

            await _liveSocketClient.SendAsync(
                "session.configure",
                new
                {
                    sessionId = _sessionId,
                    assistanceMode = CurrentAssistanceMode,
                    answerProvider = _clientSettings.AnswerProvider,
                },
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            App.Log($"Live coding mode sync failed: {ex}");
        }
    }

    private void ToggleAnswerLength()
    {
        if (_mainUiState == MainUiState.Unauthorized)
        {
            return;
        }

        _clientSettings.AnswerLength = _clientSettings.AnswerLength == AnswerLengths.Detailed
            ? AnswerLengths.Short
            : AnswerLengths.Detailed;
        AnswerLengthComboBox.SelectedValue = _clientSettings.AnswerLength;
        _clientSettingsService.Save(_clientSettings);
    }
    private async Task EnsureBackendSessionAsync(CancellationToken cancellationToken)
    {
        EnsureAuthenticated();

        if (!string.IsNullOrWhiteSpace(_sessionId))
        {
            return;
        }

        var session = await _apiClient.CreateSessionAsync(
            DefaultDeviceId,
            _clientSettings.SelectedProcessId,
            _clientSettings.MicDeviceId,
            DefaultSessionTag,
            _clientSettings.AudioCaptureMode,
            _clientSettings.AnswerLength,
            CurrentAssistanceMode,
            _clientSettings.AnswerProvider,
            cancellationToken);

        _sessionId = session.Id;
    }

    private async Task EnsureLiveSessionAsync(CancellationToken cancellationToken)
    {
        EnsureAuthenticated();
        await BootstrapAsync();
        await EnsureBackendSessionAsync(cancellationToken);

        if (_liveSocketClient.State == System.Net.WebSockets.WebSocketState.Open && _isLiveSessionConnected)
        {
            return;
        }

        _sessionReadySource = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        await _liveSocketClient.ConnectAsync(BuildWebSocketUri(), cancellationToken);
        await _liveSocketClient.SendAsync(
            "session.start",
            new
            {
                sessionId = _sessionId,
                deviceId = DefaultDeviceId,
                sourceProcessId = _clientSettings.SelectedProcessId,
                micDeviceId = _clientSettings.MicDeviceId,
                subjectTag = DefaultSessionTag,
                audioCaptureMode = _clientSettings.AudioCaptureMode,
                answerLength = _clientSettings.AnswerLength,
                assistanceMode = CurrentAssistanceMode,
                answerProvider = _clientSettings.AnswerProvider,
            },
            cancellationToken);

        await _sessionReadySource.Task.WaitAsync(TimeSpan.FromSeconds(6), cancellationToken);
    }

    private Uri BuildWebSocketUri()
    {
        var websocketPath = _bootstrap?.WebsocketPath ?? "/ws/live";
        var baseUri = new Uri(_apiBaseUrl.EndsWith('/') ? _apiBaseUrl : $"{_apiBaseUrl}/");
        var builder = new UriBuilder(baseUri)
        {
            Scheme = baseUri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) ? "wss" : "ws",
            Path = websocketPath.StartsWith("/", StringComparison.Ordinal)
                ? websocketPath
                : $"/{websocketPath.TrimStart('/')}",
            Query = $"token={Uri.EscapeDataString(_accessToken ?? string.Empty)}",
        };

        return builder.Uri;
    }

    private void LiveSocketClient_OnMessageReceived(object? sender, JsonElement message)
    {
        Dispatcher.BeginInvoke(() =>
        {
            var type = message.GetProperty("type").GetString() ?? string.Empty;
            var payload = message.GetProperty("payload");

            switch (type)
            {
                case "session.ready":
                {
                    var ready = payload.Deserialize<SessionReadyPayload>(_jsonOptions);
                    if (ready is null)
                    {
                        return;
                    }

                    _sessionId = ready.SessionId;
                    _isLiveSessionConnected = true;
                    _sessionReadySource?.TrySetResult(true);
                    break;
                }
                case "answer.started":
                {
                    if (!ShouldAcceptLiveAnswer())
                    {
                        return;
                    }

                    var started = payload.Deserialize<AnswerStartedPayload>(_jsonOptions);
                    if (started is null)
                    {
                        return;
                    }

                    BeginStreamingAnswer(started.AnswerId);
                    break;
                }
                case "answer.partial":
                {
                    if (!ShouldAcceptLiveAnswer())
                    {
                        return;
                    }

                    var partial = payload.Deserialize<AnswerPartialPayload>(_jsonOptions);
                    if (partial is null)
                    {
                        return;
                    }

                    UpsertStreamingAnswer(partial.AnswerId, partial.Text, isCompleted: false);
                    break;
                }
                case "answer.final":
                {
                    var answer = payload.Deserialize<AnswerPayload>(_jsonOptions);
                    if (answer is null)
                    {
                        return;
                    }

                    if (!ShouldAcceptLiveAnswer())
                    {
                        return;
                    }

                    UpsertStreamingAnswer(answer.AnswerId, ComposeAnswerText(answer.ShortAnswer, answer.Details), isCompleted: true);
                    _pendingAnswerKind = PendingAnswerKind.None;
                    _ = RefreshBillingStatusAsync();
                    break;
                }
                case "warning":
                {
                    var warning = payload.Deserialize<WarningPayload>(_jsonOptions);
                    if (warning is not null)
                    {
                        App.Log($"Backend warning [{warning.Code}]: {warning.Message}");
                    }
                    break;
                }
                case "quota.exceeded":
                {
                    var quota = payload.Deserialize<QuotaExceededPayload>(_jsonOptions);
                    if (quota is not null)
                    {
                        var message = string.IsNullOrWhiteSpace(quota.Message)
                            ? "Лимит подписки исчерпан. Откройте страницу подписки для оплаты."
                            : quota.Message;
                        SettingsStatusTextBlock.Text = message;
                        ShowAuthorizedError(message, openChat: true);
                        _ = RefreshBillingStatusAsync();
                    }
                    break;
                }
            }
        });
    }

    private void LiveSocketClient_OnConnectionClosed(object? sender, string message)
    {
        Dispatcher.BeginInvoke(() =>
        {
            _isLiveSessionConnected = false;
            _sessionReadySource?.TrySetException(new InvalidOperationException(message));
            SettingsStatusTextBlock.Text = $"Live-соединение закрыто: {message}";
        });
    }

    private bool ShouldAcceptLiveAnswer()
    {
        return _pendingAnswerKind != PendingAnswerKind.Screenshot &&
            (_pendingAnswerKind != PendingAnswerKind.None || _isAutoModeEnabled);
    }

    private void AudioCaptureService_OnAudioFrameReady(object? sender, AudioFrameReadyEventArgs e)
    {
        QueueSignalUpdate(CalculateSignalPercentage(e.Pcm16Data));

        if (_mainUiState != MainUiState.AuthorizedActive ||
            string.IsNullOrWhiteSpace(_sessionId) ||
            _liveSocketClient.State != System.Net.WebSockets.WebSocketState.Open)
        {
            return;
        }

        if (!_isMicCaptureEnabled && string.Equals(e.Channel, "mic", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        _audioFrameQueue?.Writer.TryWrite(new AudioOutboundFrame(
            _sessionId,
            e.Channel,
            Convert.ToBase64String(e.Pcm16Data),
            e.SampleRate,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
    }

    private void StartAudioSendLoop()
    {
        _audioSendCts?.Cancel();
        _audioSendCts?.Dispose();

        _audioSendCts = new CancellationTokenSource();
        _audioFrameQueue = Channel.CreateBounded<AudioOutboundFrame>(new BoundedChannelOptions(96)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        _audioSendTask = Task.Run(() => AudioSendLoopAsync(_audioSendCts.Token));
    }

    private async Task StopAudioSendLoopAsync()
    {
        var cts = _audioSendCts;
        var task = _audioSendTask;
        _audioFrameQueue?.Writer.TryComplete();
        cts?.Cancel();

        if (task is not null)
        {
            try
            {
                await task.WaitAsync(TimeSpan.FromSeconds(2));
            }
            catch
            {
            }
        }

        cts?.Dispose();
        _audioSendCts = null;
        _audioSendTask = null;
        _audioFrameQueue = null;
    }

    private async Task AudioSendLoopAsync(CancellationToken cancellationToken)
    {
        var reader = _audioFrameQueue?.Reader;
        if (reader is null)
        {
            return;
        }

        try
        {
            await foreach (var frame in reader.ReadAllAsync(cancellationToken))
            {
                if (_liveSocketClient.State != System.Net.WebSockets.WebSocketState.Open)
                {
                    continue;
                }

                await _liveSocketClient.SendAsync(
                    "audio.frame",
                    new
                    {
                        sessionId = frame.SessionId,
                        channel = frame.Channel,
                        pcm16Base64 = frame.Pcm16Base64,
                        sampleRate = frame.SampleRate,
                        timestampMs = frame.TimestampMs,
                    },
                    cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            App.Log($"Audio frame send failed: {ex}");
            _ = Dispatcher.BeginInvoke(() => SettingsStatusTextBlock.Text = "Ошибка отправки аудио. Переподключите сессию.");
        }
    }

    private void QueueSignalUpdate(int level)
    {
        lock (_signalUpdateSync)
        {
            _pendingSignalLevel = level;
            if (_signalUpdateQueued)
            {
                return;
            }

            _signalUpdateQueued = true;
        }

        Dispatcher.BeginInvoke(() =>
        {
            int latestLevel;
            lock (_signalUpdateSync)
            {
                latestLevel = _pendingSignalLevel;
                _signalUpdateQueued = false;
            }

            UpdateSignalLevel(latestLevel);
        });
    }

    private void AppendAnswer(string shortAnswer, string details)
    {
        var answerId = $"local-{Guid.NewGuid():N}";
        UpsertStreamingAnswer(answerId, ComposeAnswerText(shortAnswer, details), isCompleted: true);
    }

    private void AppendSystemMessage(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        var entry = new ChatEntry
        {
            Message = message.Trim(),
            TimeLabel = DateTime.Now.ToString("HH:mm"),
        };

        _chatEntries.Add(entry);
        UpdateChatState();
        ChatListBox.ScrollIntoView(entry);
    }

    private static string ComposeAnswerText(string shortAnswer, string details)
    {
        return string.IsNullOrWhiteSpace(details)
            ? shortAnswer.Trim()
            : $"{shortAnswer.Trim()}{Environment.NewLine}{Environment.NewLine}{details.Trim()}".Trim();
    }

    private void BeginStreamingAnswer(string answerId)
    {
        if (string.IsNullOrWhiteSpace(answerId))
        {
            return;
        }

        SetAnswerPending(true);
        OpenChat();
        ResetChatPlaceholder();
    }

    private void UpsertStreamingAnswer(string answerId, string text, bool isCompleted)
    {
        if (string.IsNullOrWhiteSpace(answerId))
        {
            return;
        }

        var normalizedText = text?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedText) && !isCompleted)
        {
            BeginStreamingAnswer(answerId);
            return;
        }

        if (!_streamingAnswers.TryGetValue(answerId, out var state))
        {
            var entry = new ChatEntry
            {
                Message = string.Empty,
                TimeLabel = DateTime.Now.ToString("HH:mm"),
            };

            _chatEntries.Add(entry);
            state = new StreamingAnswerState(entry);
            _streamingAnswers[answerId] = state;
        }

        state.TargetText = normalizedText;
        state.IsCompleted = isCompleted;
        SetAnswerPending(false);
        ResetChatPlaceholder();
        OpenChat();

        if (isCompleted)
        {
            state.Entry.Message = normalizedText;
            _streamingAnswers.Remove(answerId);
            ChatListBox.ScrollIntoView(state.Entry);
            return;
        }

        if (!_typewriterTimer.IsEnabled)
        {
            _typewriterTimer.Start();
        }

        ChatListBox.ScrollIntoView(state.Entry);
    }

    private void TypewriterTimer_OnTick(object? sender, EventArgs e)
    {
        if (_streamingAnswers.Count == 0)
        {
            _typewriterTimer.Stop();
            return;
        }

        List<string>? completedIds = null;
        foreach (var pair in _streamingAnswers.ToArray())
        {
            var state = pair.Value;
            var currentText = state.Entry.Message;
            if (currentText.Length < state.TargetText.Length)
            {
                var remaining = state.TargetText.Length - currentText.Length;
                var step = remaining > 96 ? 7 : remaining > 40 ? 4 : 2;
                var nextLength = Math.Min(state.TargetText.Length, currentText.Length + step);
                state.Entry.Message = state.TargetText[..nextLength];
                ChatListBox.ScrollIntoView(state.Entry);
            }

            if (state.IsCompleted && state.Entry.Message.Length >= state.TargetText.Length)
            {
                completedIds ??= new List<string>();
                completedIds.Add(pair.Key);
            }
        }

        if (completedIds is null)
        {
            return;
        }

        foreach (var answerId in completedIds)
        {
            _streamingAnswers.Remove(answerId);
        }

        if (_streamingAnswers.Count == 0)
        {
            _typewriterTimer.Stop();
        }
    }

    private void ShowAuthorizedError(string message, bool openChat)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        App.Log($"UI error: {message}");
        SetAnswerPending(false);
        _pendingAnswerKind = PendingAnswerKind.None;
        if (openChat)
        {
            OpenChat();
        }

        var entry = new ChatEntry
        {
            Message = $"\u041e\u0448\u0438\u0431\u043a\u0430: {message.Trim()}",
            TimeLabel = DateTime.Now.ToString("HH:mm"),
        };

        _chatEntries.Add(entry);
        ResetChatPlaceholder();
        ChatListBox.ScrollIntoView(entry);
    }

    private void EnsureAuthenticated()
    {
        if (string.IsNullOrWhiteSpace(_accessToken))
        {
            throw new InvalidOperationException("\u041d\u0443\u0436\u043d\u043e \u0432\u043e\u0439\u0442\u0438 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442.");
        }
    }

    private void UpdateSignalLevel(int level)
    {
        _signalPercent = _mainUiState == MainUiState.AuthorizedActive
            ? Math.Clamp(level, 0, 100)
            : 0;

        SignalPercentTextBlock.Text = $"{_signalPercent}%";
        UpdateSignalBars(_signalPercent);
    }

    private void UpdateSignalBars(int percent)
    {
        ApplySignalBar(SignalBar1, percent, 8, 0);
        ApplySignalBar(SignalBar2, percent, 11, 18);
        ApplySignalBar(SignalBar3, percent, 14, 42);
        ApplySignalBar(SignalBar4, percent, 17, 68);
    }

    private static void ApplySignalBar(System.Windows.Shapes.Rectangle bar, int percent, double baseHeight, int threshold)
    {
        var clamped = Math.Clamp(percent - threshold, 0, 32);
        bar.Height = baseHeight + (clamped / 32d * 8d);
        bar.Opacity = percent >= threshold ? 1d : 0.3d;
    }

    private static int CalculateSignalPercentage(byte[] pcm16Data)
    {
        if (pcm16Data.Length < 2)
        {
            return 0;
        }

        var peak = 0;
        for (var index = 0; index < pcm16Data.Length - 1; index += 2)
        {
            var sample = BitConverter.ToInt16(pcm16Data, index);
            var amplitude = Math.Abs((int)sample);
            if (amplitude > peak)
            {
                peak = amplitude;
            }
        }

        return (int)Math.Round(peak / (double)short.MaxValue * 100d);
    }
    private void TitleBar_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (_isClickThrough || e.ButtonState != MouseButtonState.Pressed)
        {
            return;
        }

        if (IsInteractiveSource(e.OriginalSource as DependencyObject))
        {
            return;
        }

        if (_mainUiState != MainUiState.Unauthorized)
        {
            _hasCustomAuthorizedPosition = true;
        }

        DragMove();
    }

    private static bool IsInteractiveSource(DependencyObject? source)
    {
        while (source is not null)
        {
            if (source is System.Windows.Controls.Primitives.ButtonBase ||
                source is System.Windows.Controls.Primitives.TextBoxBase ||
                source is ToggleButton ||
                source is System.Windows.Controls.Primitives.ScrollBar)
            {
                return true;
            }

            source = VisualTreeHelper.GetParent(source);
        }

        return false;
    }

    private void ResizeThumb_OnDragDelta(object sender, DragDeltaEventArgs e)
    {
        if (_isClickThrough || sender is not Thumb thumb || thumb.Tag is not string direction)
        {
            return;
        }

        var currentWidth = double.IsNaN(Width) ? ActualWidth : Width;
        var currentHeight = double.IsNaN(Height) ? ActualHeight : Height;
        var minWidth = MinWidth > 0 ? MinWidth : 320;
        var minHeight = MinHeight > 0 ? MinHeight : 240;

        switch (direction)
        {
            case "Left":
                ResizeFromLeft(e.HorizontalChange, currentWidth, minWidth);
                break;
            case "Right":
                Width = Math.Max(minWidth, currentWidth + e.HorizontalChange);
                break;
            case "Top":
                ResizeFromTop(e.VerticalChange, currentHeight, minHeight);
                break;
            case "Bottom":
                Height = Math.Max(minHeight, currentHeight + e.VerticalChange);
                break;
            case "TopLeft":
                ResizeFromLeft(e.HorizontalChange, currentWidth, minWidth);
                ResizeFromTop(e.VerticalChange, currentHeight, minHeight);
                break;
            case "TopRight":
                Width = Math.Max(minWidth, currentWidth + e.HorizontalChange);
                ResizeFromTop(e.VerticalChange, currentHeight, minHeight);
                break;
            case "BottomLeft":
                ResizeFromLeft(e.HorizontalChange, currentWidth, minWidth);
                Height = Math.Max(minHeight, currentHeight + e.VerticalChange);
                break;
            case "BottomRight":
                Width = Math.Max(minWidth, currentWidth + e.HorizontalChange);
                Height = Math.Max(minHeight, currentHeight + e.VerticalChange);
                break;
        }

        if (_mainUiState != MainUiState.Unauthorized && _isChatOpen && SettingsBackdrop.Visibility != Visibility.Visible)
        {
            _hasCustomChatSize = true;
            _hasCustomAuthorizedPosition = true;
            _customChatWidth = Width;
            _customChatHeight = Height;
            UpdateOverlayContentSize(Math.Max(0, Width - 28), Math.Max(ClosedWindowHeight, Height - 28));
        }
    }

    private void ResizeFromLeft(double horizontalChange, double currentWidth, double minWidth)
    {
        var newWidth = Math.Max(minWidth, currentWidth - horizontalChange);
        var delta = currentWidth - newWidth;
        Width = newWidth;
        Left += delta;
    }

    private void ResizeFromTop(double verticalChange, double currentHeight, double minHeight)
    {
        var newHeight = Math.Max(minHeight, currentHeight - verticalChange);
        var delta = currentHeight - newHeight;
        Height = newHeight;
        Top += delta;
    }

    private void SetClickThrough(bool enabled)
    {
        var handle = new WindowInteropHelper(this).Handle;
        var styles = NativeMethods.GetWindowLong(handle, NativeMethods.GwlExStyle);
        styles = enabled
            ? styles | NativeMethods.WsExTransparent
            : styles & ~NativeMethods.WsExTransparent;

        NativeMethods.SetWindowLong(handle, NativeMethods.GwlExStyle, styles);
        _isClickThrough = enabled;
    }

    private void TelegramButton_OnClick(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo(_telegramChannelUrl)
            {
                UseShellExecute = true,
            });
        }
        catch (Exception ex)
        {
            AuthStatusTextBlock.Text = ex.Message;
        }
    }

    private void CloseWindowButton_OnClick(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private string GetVersionText()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version;
        if (version is null)
        {
            return "v0.0.0";
        }

        return $"v{version.Major}.{Math.Max(version.Minor, 0)}.{Math.Max(version.Build, 0)}";
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg != NativeMethods.WmHotKey)
        {
            return IntPtr.Zero;
        }

        switch (wParam.ToInt32())
        {
            case HotKeyManager.ToggleListeningId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    _ = _mainUiState == MainUiState.AuthorizedActive
                        ? StopListeningAsync()
                        : StartListeningAsync();
                }
                handled = true;
                break;
            case HotKeyManager.ScreenshotId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    _ = HandleScreenshotAsync();
                }
                handled = true;
                break;
            case HotKeyManager.ManualPromptId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    FocusNewMessage();
                }
                handled = true;
                break;
            case HotKeyManager.ToggleOverlayId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    SetClickThrough(!_isClickThrough);
                }
                handled = true;
                break;
            case HotKeyManager.NewMessageId:
                FocusNewMessage();
                handled = true;
                break;
            case HotKeyManager.ClearChatId:
                ClearChat();
                handled = true;
                break;
            case HotKeyManager.ScrollChatUpId:
                ScrollChatPage(-1);
                handled = true;
                break;
            case HotKeyManager.ScrollChatDownId:
                ScrollChatPage(1);
                handled = true;
                break;
            case HotKeyManager.ScrollChatTopId:
                ScrollChatTo(bottom: false);
                handled = true;
                break;
            case HotKeyManager.ScrollChatBottomId:
                ScrollChatTo(bottom: true);
                handled = true;
                break;
            case HotKeyManager.ToggleMicrophoneId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    ToggleMicrophoneCapture();
                }
                handled = true;
                break;
            case HotKeyManager.ToggleAutoModeId:
                if (_mainUiState != MainUiState.Unauthorized)
                {
                    ToggleAutoMode();
                }
                handled = true;
                break;
            case HotKeyManager.ToggleAnswerLengthId:
                ToggleAnswerLength();
                handled = true;
                break;
            case HotKeyManager.ToggleWindowVisibilityId:
                ToggleWindowVisibility();
                handled = true;
                break;
            case HotKeyManager.ToggleChatVisibilityId:
                ToggleChatVisibility();
                handled = true;
                break;
            case HotKeyManager.ToggleLiveCodingModeId:
                ToggleLiveCodingMode();
                handled = true;
                break;
        }

        return IntPtr.Zero;
    }

    private sealed class ChatEntry : INotifyPropertyChanged
    {
        private string _message = string.Empty;
        private string _timeLabel = string.Empty;

        public string Message
        {
            get => _message;
            set
            {
                if (_message == value)
                {
                    return;
                }

                _message = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Message)));
            }
        }

        public string TimeLabel
        {
            get => _timeLabel;
            set
            {
                if (_timeLabel == value)
                {
                    return;
                }

                _timeLabel = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(TimeLabel)));
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
    }

    private sealed class StreamingAnswerState
    {
        public StreamingAnswerState(ChatEntry entry)
        {
            Entry = entry;
        }

        public ChatEntry Entry { get; }
        public string TargetText { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
    }

    private sealed record AudioOutboundFrame(
        string SessionId,
        string Channel,
        string Pcm16Base64,
        int SampleRate,
        long TimestampMs);

    private enum MainUiState
    {
        Unauthorized,
        AuthorizedIdle,
        AuthorizedActive,
    }

    private enum PendingAnswerKind
    {
        None,
        Manual,
        Screenshot,
    }
}
