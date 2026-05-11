using System.Diagnostics;
using System.IO;
using System.Reflection;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using TutorOverlay.Client.Models;

namespace TutorOverlay.Client.Services;

public sealed class AudioFrameReadyEventArgs : EventArgs
{
    public required string Channel { get; init; }
    public required byte[] Pcm16Data { get; init; }
    public required int SampleRate { get; init; }
}

public sealed class AudioCaptureService : IDisposable
{
    private IAudioCaptureAdapter? _adapter;

    public event EventHandler<AudioFrameReadyEventArgs>? AudioFrameReady;
    public event EventHandler<string>? Warning;
    public event EventHandler<string>? StatusChanged;

    public void Start(ClientSettings settings)
    {
        Stop();
        settings.Normalize();

        _adapter = CreateAdapter(settings);
        _adapter.AudioFrameReady += Adapter_OnAudioFrameReady;
        _adapter.Warning += Adapter_OnWarning;
        _adapter.StatusChanged += Adapter_OnStatusChanged;
        _adapter.Start(settings);
    }

    public void Stop()
    {
        if (_adapter is null)
        {
            return;
        }

        _adapter.AudioFrameReady -= Adapter_OnAudioFrameReady;
        _adapter.Warning -= Adapter_OnWarning;
        _adapter.StatusChanged -= Adapter_OnStatusChanged;
        _adapter.Dispose();
        _adapter = null;
    }

    public IReadOnlyList<AudioDeviceOption> GetAudioDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        var result = new List<AudioDeviceOption>();
        AddDefaultDevice(result, enumerator, DataFlow.Capture, Role.Communications, "mic", "default-communications-mic");
        AddDefaultDevice(result, enumerator, DataFlow.Render, Role.Multimedia, "output", "default-output");

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
        {
            result.Add(new AudioDeviceOption(device.ID, device.FriendlyName, false, "mic"));
        }

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            result.Add(new AudioDeviceOption(device.ID, device.FriendlyName, false, "output"));
        }

        return result;
    }

    public void Dispose()
    {
        Stop();
    }

    private IAudioCaptureAdapter CreateAdapter(ClientSettings settings)
    {
        return settings.AudioCaptureMode switch
        {
            AudioCaptureModes.Process => new ProcessLoopbackAudioCaptureAdapter(() => new DeviceLoopbackAudioCaptureAdapter()),
            AudioCaptureModes.MicOnly => new MicOnlyAudioCaptureAdapter(),
            _ => new DeviceLoopbackAudioCaptureAdapter(),
        };
    }

    private void Adapter_OnAudioFrameReady(object? sender, AudioFrameReadyEventArgs e)
    {
        AudioFrameReady?.Invoke(this, e);
    }

    private void Adapter_OnWarning(object? sender, string message)
    {
        Warning?.Invoke(this, message);
    }

    private void Adapter_OnStatusChanged(object? sender, string message)
    {
        StatusChanged?.Invoke(this, message);
    }

    private static void AddDefaultDevice(
        ICollection<AudioDeviceOption> result,
        MMDeviceEnumerator enumerator,
        DataFlow dataFlow,
        Role role,
        string kind,
        string id)
    {
        try
        {
            var device = enumerator.GetDefaultAudioEndpoint(dataFlow, role);
            result.Add(new AudioDeviceOption(id, device.FriendlyName, true, kind));
        }
        catch
        {
            result.Add(new AudioDeviceOption(id, kind == "mic" ? "Микрофон по умолчанию" : "Вывод по умолчанию", true, kind));
        }
    }

    internal static byte[] ConvertToMonoPcm16(WaveFormat format, byte[] buffer, int bytesRecorded)
    {
        if (bytesRecorded <= 0)
        {
            return Array.Empty<byte>();
        }

        var channels = Math.Max(1, format.Channels);
        if (format.Encoding == WaveFormatEncoding.IeeeFloat && format.BitsPerSample == 32)
        {
            var sampleCount = bytesRecorded / 4;
            var frameCount = sampleCount / channels;
            var output = new byte[frameCount * 2];

            for (var frame = 0; frame < frameCount; frame++)
            {
                float sum = 0;
                for (var channelIndex = 0; channelIndex < channels; channelIndex++)
                {
                    var offset = (frame * channels + channelIndex) * 4;
                    sum += BitConverter.ToSingle(buffer, offset);
                }

                var mono = Math.Clamp(sum / channels, -1f, 1f);
                var value = (short)(mono * short.MaxValue);
                BitConverter.GetBytes(value).CopyTo(output, frame * 2);
            }

            return output;
        }

        if (format.Encoding == WaveFormatEncoding.Pcm && format.BitsPerSample == 16)
        {
            var frameCount = bytesRecorded / (2 * channels);
            var output = new byte[frameCount * 2];
            for (var frame = 0; frame < frameCount; frame++)
            {
                int sum = 0;
                for (var channelIndex = 0; channelIndex < channels; channelIndex++)
                {
                    var offset = (frame * channels + channelIndex) * 2;
                    sum += BitConverter.ToInt16(buffer, offset);
                }

                var value = (short)(sum / channels);
                BitConverter.GetBytes(value).CopyTo(output, frame * 2);
            }

            return output;
        }

        return Array.Empty<byte>();
    }
}

internal interface IAudioCaptureAdapter : IDisposable
{
    event EventHandler<AudioFrameReadyEventArgs>? AudioFrameReady;
    event EventHandler<string>? Warning;
    event EventHandler<string>? StatusChanged;
    void Start(ClientSettings settings);
}

internal abstract class AudioCaptureAdapterBase : IAudioCaptureAdapter
{
    public event EventHandler<AudioFrameReadyEventArgs>? AudioFrameReady;
    public event EventHandler<string>? Warning;
    public event EventHandler<string>? StatusChanged;

    public abstract void Start(ClientSettings settings);
    public abstract void Dispose();

    protected void Emit(string channel, WaveFormat waveFormat, byte[] buffer, int bytesRecorded)
    {
        var pcm16 = AudioCaptureService.ConvertToMonoPcm16(waveFormat, buffer, bytesRecorded);
        if (pcm16.Length == 0)
        {
            return;
        }

        AudioFrameReady?.Invoke(this, new AudioFrameReadyEventArgs
        {
            Channel = channel,
            Pcm16Data = pcm16,
            SampleRate = waveFormat.SampleRate,
        });
    }

    protected void EmitPcm16(string channel, byte[] pcm16, int sampleRate)
    {
        if (pcm16.Length == 0)
        {
            return;
        }

        AudioFrameReady?.Invoke(this, new AudioFrameReadyEventArgs
        {
            Channel = channel,
            Pcm16Data = pcm16,
            SampleRate = sampleRate,
        });
    }

    protected void EmitWarning(string message) => Warning?.Invoke(this, message);
    protected void EmitStatus(string message) => StatusChanged?.Invoke(this, message);

    protected static MMDevice ResolveDevice(MMDeviceEnumerator enumerator, DataFlow dataFlow, Role defaultRole, string deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId) ||
            deviceId is "default-output" or "default-communications-mic")
        {
            return enumerator.GetDefaultAudioEndpoint(dataFlow, defaultRole);
        }

        try
        {
            return enumerator.GetDevice(deviceId);
        }
        catch
        {
            return enumerator.GetDefaultAudioEndpoint(dataFlow, defaultRole);
        }
    }
}

internal sealed class DeviceLoopbackAudioCaptureAdapter : AudioCaptureAdapterBase
{
    private WasapiLoopbackCapture? _callCapture;
    private WasapiCapture? _micCapture;

    public override void Start(ClientSettings settings)
    {
        var enumerator = new MMDeviceEnumerator();
        var callDevice = ResolveDevice(enumerator, DataFlow.Render, Role.Multimedia, settings.OutputDeviceId);
        var micDevice = ResolveDevice(enumerator, DataFlow.Capture, Role.Communications, settings.MicDeviceId);

        _callCapture = new WasapiLoopbackCapture(callDevice);
        _callCapture.DataAvailable += (_, args) => Emit("call", _callCapture.WaveFormat, args.Buffer, args.BytesRecorded);
        _callCapture.StartRecording();

        _micCapture = new WasapiCapture(micDevice);
        _micCapture.DataAvailable += (_, args) => Emit("mic", _micCapture.WaveFormat, args.Buffer, args.BytesRecorded);
        _micCapture.StartRecording();

        EmitStatus("Захват: всё устройство");
    }

    public override void Dispose()
    {
        _callCapture?.StopRecording();
        _callCapture?.Dispose();
        _callCapture = null;

        _micCapture?.StopRecording();
        _micCapture?.Dispose();
        _micCapture = null;
    }
}

internal sealed class MicOnlyAudioCaptureAdapter : AudioCaptureAdapterBase
{
    private WasapiCapture? _micCapture;

    public override void Start(ClientSettings settings)
    {
        var enumerator = new MMDeviceEnumerator();
        var micDevice = ResolveDevice(enumerator, DataFlow.Capture, Role.Communications, settings.MicDeviceId);

        _micCapture = new WasapiCapture(micDevice);
        _micCapture.DataAvailable += (_, args) => Emit("mic", _micCapture.WaveFormat, args.Buffer, args.BytesRecorded);
        _micCapture.StartRecording();

        EmitStatus("Захват: только микрофон");
    }

    public override void Dispose()
    {
        _micCapture?.StopRecording();
        _micCapture?.Dispose();
        _micCapture = null;
    }
}

internal sealed class ProcessLoopbackAudioCaptureAdapter : AudioCaptureAdapterBase
{
    private readonly Func<IAudioCaptureAdapter> _fallbackFactory;
    private IAudioCaptureAdapter? _fallback;
    private Process? _helperProcess;
    private CancellationTokenSource? _helperCts;
    private WasapiCapture? _micCapture;

    public ProcessLoopbackAudioCaptureAdapter(Func<IAudioCaptureAdapter> fallbackFactory)
    {
        _fallbackFactory = fallbackFactory;
    }

    public override void Start(ClientSettings settings)
    {
        if (settings.SelectedProcessId <= 0)
        {
            StartFallback(settings, "Процесс не выбран. Включён захват всего устройства.");
            return;
        }

        var helperPath = ResolveHelperPath();
        if (!File.Exists(helperPath))
        {
            StartFallback(settings, "Process loopback helper пока не собран. Включён захват всего устройства.");
            return;
        }

        try
        {
            StartMic(settings);
            StartHelper(helperPath, settings.SelectedProcessId);
            EmitStatus("Захват: процесс");
        }
        catch (Exception ex)
        {
            EmitWarning($"Не удалось включить захват процесса: {ex.Message}");
            Dispose();
            StartFallback(settings, "Захват процесса недоступен. Включён захват всего устройства.");
        }
    }

    public override void Dispose()
    {
        _fallback?.Dispose();
        _fallback = null;

        _helperCts?.Cancel();
        _helperCts?.Dispose();
        _helperCts = null;

        if (_helperProcess is not null)
        {
            try
            {
                if (!_helperProcess.HasExited)
                {
                    _helperProcess.Kill(entireProcessTree: true);
                }
            }
            catch
            {
            }

            _helperProcess.Dispose();
            _helperProcess = null;
        }

        _micCapture?.StopRecording();
        _micCapture?.Dispose();
        _micCapture = null;
    }

    private void StartFallback(ClientSettings settings, string reason)
    {
        EmitWarning(reason);
        EmitStatus("Захват fallback: всё устройство");
        _fallback = _fallbackFactory();
        _fallback.AudioFrameReady += (_, args) => EmitPcm16(args.Channel, args.Pcm16Data, args.SampleRate);
        _fallback.Warning += (_, message) => EmitWarning(message);
        _fallback.StatusChanged += (_, message) => EmitStatus($"Fallback: {message}");
        _fallback.Start(settings);
    }

    private void StartMic(ClientSettings settings)
    {
        var enumerator = new MMDeviceEnumerator();
        var micDevice = ResolveDevice(enumerator, DataFlow.Capture, Role.Communications, settings.MicDeviceId);
        _micCapture = new WasapiCapture(micDevice);
        _micCapture.DataAvailable += (_, args) => Emit("mic", _micCapture.WaveFormat, args.Buffer, args.BytesRecorded);
        _micCapture.StartRecording();
    }

    private void StartHelper(string helperPath, int processId)
    {
        _helperCts = new CancellationTokenSource();
        _helperProcess = new Process
        {
            StartInfo = new ProcessStartInfo(helperPath, $"--pid {processId}")
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            },
            EnableRaisingEvents = true,
        };

        _helperProcess.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
            {
                EmitWarning(args.Data);
            }
        };
        _helperProcess.Exited += (_, _) =>
        {
            if (_helperCts?.IsCancellationRequested == true)
            {
                return;
            }

            try
            {
                EmitWarning($"Process loopback helper stopped with exit code {_helperProcess.ExitCode}.");
            }
            catch
            {
                EmitWarning("Process loopback helper stopped.");
            }
        };

        if (!_helperProcess.Start())
        {
            throw new InvalidOperationException("helper process failed to start");
        }

        _helperProcess.BeginErrorReadLine();
        if (_helperProcess.WaitForExit(600))
        {
            throw new InvalidOperationException($"helper exited with code {_helperProcess.ExitCode}");
        }

        _ = Task.Run(() => ReadHelperFramesAsync(_helperProcess.StandardOutput.BaseStream, _helperCts.Token));
    }

    private async Task ReadHelperFramesAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[8];
        while (!cancellationToken.IsCancellationRequested)
        {
            if (!await ReadExactAsync(stream, header, cancellationToken))
            {
                return;
            }

            var length = BitConverter.ToInt32(header, 0);
            var sampleRate = BitConverter.ToInt32(header, 4);
            if (length <= 0 || length > 256 * 1024)
            {
                EmitWarning("Process loopback helper returned an invalid frame.");
                return;
            }

            if (sampleRate < 8000 || sampleRate > 192000)
            {
                EmitWarning("Process loopback helper returned an invalid sample rate.");
                return;
            }

            var buffer = new byte[length];
            if (!await ReadExactAsync(stream, buffer, cancellationToken))
            {
                return;
            }

            EmitPcm16("call", buffer, sampleRate);
        }
    }

    private static async Task<bool> ReadExactAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset), cancellationToken);
            if (read == 0)
            {
                return false;
            }

            offset += read;
        }

        return true;
    }

    private static string ResolveHelperPath()
    {
        var baseDirectory = AppContext.BaseDirectory;
        var bundledPath = Path.Combine(baseDirectory, "ProcessLoopbackCaptureHelper.exe");

        if (File.Exists(bundledPath))
        {
            return bundledPath;
        }

        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "OfferGO",
            "ProcessLoopbackCaptureHelper.exe");

        if (File.Exists(appDataPath))
        {
            return appDataPath;
        }

        Directory.CreateDirectory(Path.GetDirectoryName(appDataPath)!);

        using var resource = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("ProcessLoopbackCaptureHelper.exe");

        if (resource is null)
        {
            return bundledPath;
        }

        using var output = File.Create(appDataPath);
        resource.CopyTo(output);

        return appDataPath;
    }
}
