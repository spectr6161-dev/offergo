using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.IO;

namespace TutorOverlay.Client.Services;

public sealed class LiveSocketClient : IAsyncDisposable
{
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private ClientWebSocket? _socket;
    private CancellationTokenSource? _receiveCts;

    public event EventHandler<JsonElement>? MessageReceived;
    public event EventHandler<string>? ConnectionClosed;

    public WebSocketState State => _socket?.State ?? WebSocketState.None;

    public async Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
    {
        if (_socket?.State == WebSocketState.Open)
        {
            return;
        }

        _socket?.Dispose();
        _socket = new ClientWebSocket();
        _receiveCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        await _socket.ConnectAsync(uri, cancellationToken);
        _ = Task.Run(() => ReceiveLoopAsync(_socket, _receiveCts.Token), _receiveCts.Token);
    }

    public async Task SendAsync<TPayload>(string type, TPayload payload, CancellationToken cancellationToken)
    {
        if (_socket is null || _socket.State != WebSocketState.Open)
        {
            return;
        }

        var bytes = JsonSerializer.SerializeToUtf8Bytes(new { type, payload }, _jsonOptions);
        await _sendLock.WaitAsync(cancellationToken);
        try
        {
            await _socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
        }
        finally
        {
            _sendLock.Release();
        }
    }

    public async Task DisconnectAsync(CancellationToken cancellationToken)
    {
        _receiveCts?.Cancel();
        if (_socket is not null && (_socket.State == WebSocketState.Open || _socket.State == WebSocketState.CloseReceived))
        {
            await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "client_shutdown", cancellationToken);
        }
    }

    public async ValueTask DisposeAsync()
    {
        _receiveCts?.Cancel();
        _socket?.Dispose();
        _receiveCts?.Dispose();
        _sendLock.Dispose();
        await Task.CompletedTask;
    }

    private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[32 * 1024];
        try
        {
            while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
            {
                using var stream = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(buffer, cancellationToken);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        ConnectionClosed?.Invoke(this, "Сервер закрыл live-соединение.");
                        return;
                    }

                    stream.Write(buffer, 0, result.Count);
                }
                while (!result.EndOfMessage);

                var text = Encoding.UTF8.GetString(stream.ToArray());
                using var document = JsonDocument.Parse(text);
                MessageReceived?.Invoke(this, document.RootElement.Clone());
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            App.Log($"Live socket receive failed: {ex}");
            ConnectionClosed?.Invoke(this, ex.Message);
        }
    }
}
