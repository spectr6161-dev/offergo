// Captures loopback audio for one process tree and writes PCM frames to stdout.
//
// IPC frame protocol:
//   uint32 little-endian PCM byte length
//   uint32 little-endian sample rate
//   PCM16 mono payload

#ifndef WINVER
#define WINVER 0x0A00
#endif

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <cstdint>
#include <fcntl.h>
#include <iostream>
#include <io.h>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

namespace
{
constexpr DWORD kCaptureSampleRate = 16000;
constexpr WORD kCaptureChannels = 1;
constexpr WORD kCaptureBitsPerSample = 16;

HANDLE g_stopEvent = nullptr;

BOOL WINAPI ConsoleControlHandler(DWORD controlType)
{
    switch (controlType)
    {
    case CTRL_C_EVENT:
    case CTRL_BREAK_EVENT:
    case CTRL_CLOSE_EVENT:
    case CTRL_LOGOFF_EVENT:
    case CTRL_SHUTDOWN_EVENT:
        if (g_stopEvent != nullptr)
        {
            SetEvent(g_stopEvent);
        }

        return TRUE;
    default:
        return FALSE;
    }
}

int Fail(HRESULT hr, const wchar_t* message)
{
    std::wcerr << L"ProcessLoopbackCaptureHelper: " << message << L" failed, hr=0x"
               << std::hex << static_cast<unsigned long>(hr) << std::endl;
    return 10;
}

bool TryParseProcessId(int argc, wchar_t* argv[], DWORD& processId)
{
    for (int index = 1; index + 1 < argc; ++index)
    {
        if (std::wstring(argv[index]) == L"--pid")
        {
            try
            {
                processId = static_cast<DWORD>(std::stoul(argv[index + 1]));
                return processId > 0;
            }
            catch (...)
            {
                return false;
            }
        }
    }

    return false;
}

bool WriteFrame(const BYTE* payload, UINT32 byteLength)
{
    if (byteLength == 0)
    {
        return true;
    }

    const uint32_t length = byteLength;
    const uint32_t sampleRate = kCaptureSampleRate;
    return std::fwrite(&length, sizeof(length), 1, stdout) == 1 &&
           std::fwrite(&sampleRate, sizeof(sampleRate), 1, stdout) == 1 &&
           std::fwrite(payload, 1, byteLength, stdout) == byteLength &&
           std::fflush(stdout) == 0;
}

class ActivationCompletionHandler final :
    public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase, IActivateAudioInterfaceCompletionHandler>
{
public:
    explicit ActivationCompletionHandler(HANDLE completedEvent) : _completedEvent(completedEvent)
    {
    }

    HRESULT STDMETHODCALLTYPE ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override
    {
        ComPtr<IUnknown> activatedInterface;
        HRESULT activateResult = E_UNEXPECTED;
        const HRESULT hr = operation->GetActivateResult(&activateResult, &activatedInterface);

        _activationResult = FAILED(hr) ? hr : activateResult;
        _activatedInterface = activatedInterface;
        SetEvent(_completedEvent);
        return S_OK;
    }

    HRESULT GetAudioClient(IAudioClient** audioClient)
    {
        if (FAILED(_activationResult))
        {
            return _activationResult;
        }

        if (!_activatedInterface)
        {
            return E_POINTER;
        }

        return _activatedInterface->QueryInterface(__uuidof(IAudioClient), reinterpret_cast<void**>(audioClient));
    }

private:
    HANDLE _completedEvent = nullptr;
    HRESULT _activationResult = E_UNEXPECTED;
    ComPtr<IUnknown> _activatedInterface;
};

HRESULT ActivateProcessLoopbackClient(DWORD processId, IAudioClient** audioClient)
{
    AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
    activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    activationParams.ProcessLoopbackParams.TargetProcessId = processId;
    activationParams.ProcessLoopbackParams.ProcessLoopbackMode =
        PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT propVariant = {};
    propVariant.vt = VT_BLOB;
    propVariant.blob.cbSize = sizeof(activationParams);
    propVariant.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

    const HANDLE completedEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (completedEvent == nullptr)
    {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    ComPtr<ActivationCompletionHandler> completionHandler = Make<ActivationCompletionHandler>(completedEvent);
    if (!completionHandler)
    {
        CloseHandle(completedEvent);
        return E_OUTOFMEMORY;
    }

    ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
    HRESULT hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &propVariant,
        completionHandler.Get(),
        &operation);

    if (SUCCEEDED(hr))
    {
        const DWORD waitResult = WaitForSingleObject(completedEvent, 10000);
        if (waitResult == WAIT_OBJECT_0)
        {
            hr = completionHandler->GetAudioClient(audioClient);
        }
        else
        {
            hr = waitResult == WAIT_TIMEOUT ? HRESULT_FROM_WIN32(WAIT_TIMEOUT) : HRESULT_FROM_WIN32(GetLastError());
        }
    }

    CloseHandle(completedEvent);
    return hr;
}

WAVEFORMATEX BuildCaptureFormat()
{
    WAVEFORMATEX format = {};
    format.wFormatTag = WAVE_FORMAT_PCM;
    format.nChannels = kCaptureChannels;
    format.nSamplesPerSec = kCaptureSampleRate;
    format.wBitsPerSample = kCaptureBitsPerSample;
    format.nBlockAlign = static_cast<WORD>((format.nChannels * format.wBitsPerSample) / 8);
    format.nAvgBytesPerSec = format.nSamplesPerSec * format.nBlockAlign;
    format.cbSize = 0;
    return format;
}

HRESULT DrainCapturePackets(IAudioCaptureClient* captureClient, UINT32 blockAlign)
{
    UINT32 nextPacketFrames = 0;
    HRESULT hr = captureClient->GetNextPacketSize(&nextPacketFrames);

    while (SUCCEEDED(hr) && nextPacketFrames > 0)
    {
        BYTE* data = nullptr;
        UINT32 frameCount = 0;
        DWORD flags = 0;
        hr = captureClient->GetBuffer(&data, &frameCount, &flags, nullptr, nullptr);
        if (FAILED(hr))
        {
            return hr;
        }

        const UINT32 byteLength = frameCount * blockAlign;
        if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0)
        {
            std::vector<BYTE> silence(byteLength);
            if (!WriteFrame(silence.data(), byteLength))
            {
                captureClient->ReleaseBuffer(frameCount);
                return HRESULT_FROM_WIN32(ERROR_BROKEN_PIPE);
            }
        }
        else if (data != nullptr && !WriteFrame(data, byteLength))
        {
            captureClient->ReleaseBuffer(frameCount);
            return HRESULT_FROM_WIN32(ERROR_BROKEN_PIPE);
        }

        hr = captureClient->ReleaseBuffer(frameCount);
        if (FAILED(hr))
        {
            return hr;
        }

        hr = captureClient->GetNextPacketSize(&nextPacketFrames);
    }

    return hr;
}
}

int wmain(int argc, wchar_t* argv[])
{
    _setmode(_fileno(stdout), _O_BINARY);

    DWORD processId = 0;
    if (!TryParseProcessId(argc, argv, processId))
    {
        std::wcerr << L"ProcessLoopbackCaptureHelper: --pid <processId> is required" << std::endl;
        return 2;
    }

    g_stopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    if (g_stopEvent == nullptr)
    {
        return Fail(HRESULT_FROM_WIN32(GetLastError()), L"CreateEvent(stop)");
    }

    SetConsoleCtrlHandler(ConsoleControlHandler, TRUE);

    const HRESULT coInit = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(coInit))
    {
        CloseHandle(g_stopEvent);
        return Fail(coInit, L"CoInitializeEx");
    }

    ComPtr<IAudioClient> audioClient;
    HRESULT hr = ActivateProcessLoopbackClient(processId, &audioClient);
    if (FAILED(hr))
    {
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(hr, L"ActivateAudioInterfaceAsync");
    }

    WAVEFORMATEX captureFormat = BuildCaptureFormat();
    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK |
            AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
            AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
            AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
        0,
        0,
        &captureFormat,
        nullptr);
    if (FAILED(hr))
    {
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(hr, L"IAudioClient::Initialize");
    }

    const HANDLE sampleReadyEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (sampleReadyEvent == nullptr)
    {
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(HRESULT_FROM_WIN32(GetLastError()), L"CreateEvent(sample)");
    }

    hr = audioClient->SetEventHandle(sampleReadyEvent);
    if (FAILED(hr))
    {
        CloseHandle(sampleReadyEvent);
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(hr, L"IAudioClient::SetEventHandle");
    }

    ComPtr<IAudioCaptureClient> captureClient;
    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), &captureClient);
    if (FAILED(hr))
    {
        CloseHandle(sampleReadyEvent);
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(hr, L"IAudioClient::GetService");
    }

    hr = audioClient->Start();
    if (FAILED(hr))
    {
        CloseHandle(sampleReadyEvent);
        CoUninitialize();
        CloseHandle(g_stopEvent);
        return Fail(hr, L"IAudioClient::Start");
    }

    HANDLE waitHandles[] = { sampleReadyEvent, g_stopEvent };
    bool running = true;
    while (running)
    {
        const DWORD waitResult = WaitForMultipleObjects(2, waitHandles, FALSE, 2000);
        switch (waitResult)
        {
        case WAIT_OBJECT_0:
            hr = DrainCapturePackets(captureClient.Get(), captureFormat.nBlockAlign);
            if (FAILED(hr))
            {
                running = false;
            }

            break;
        case WAIT_OBJECT_0 + 1:
            running = false;
            break;
        case WAIT_TIMEOUT:
            break;
        default:
            hr = HRESULT_FROM_WIN32(GetLastError());
            running = false;
            break;
        }
    }

    audioClient->Stop();
    CloseHandle(sampleReadyEvent);
    CoUninitialize();
    CloseHandle(g_stopEvent);
    g_stopEvent = nullptr;

    if (FAILED(hr))
    {
        return Fail(hr, L"capture loop");
    }

    return 0;
}
