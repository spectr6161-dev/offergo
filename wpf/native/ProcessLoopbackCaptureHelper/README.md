# ProcessLoopbackCaptureHelper

Native helper for Windows per-process loopback capture.

The WPF client expects `ProcessLoopbackCaptureHelper.exe` next to `TutorOverlay.Client.exe`.

Runtime contract:

- args: `--pid <processId>`
- stdout: repeated binary frames
- frame format: little-endian `uint32 byteLength`, `uint32 sampleRate`, then raw `PCM16 mono`
- stderr: human-readable warnings

Implementation is based on Windows Application Loopback using `ActivateAudioInterfaceAsync`
with `AUDIOCLIENT_ACTIVATION_PARAMS` and `VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK`.

Build locally:

```powershell
.\wpf\native\ProcessLoopbackCaptureHelper\build.ps1
dotnet build .\wpf\TutorOverlay.Client\TutorOverlay.Client.csproj -c Debug
```

The client project copies `wpf/native/ProcessLoopbackCaptureHelper/out/ProcessLoopbackCaptureHelper.exe`
to its output folder when the helper is present. If the executable is absent or cannot start,
the WPF client falls back to full device loopback capture and shows a degraded capture status.
