using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using TutorOverlay.Client.Models;

namespace TutorOverlay.Client.Services;

public sealed class ApiClient
{
    private readonly HttpClient _httpClient = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public Uri BaseUri { get; private set; } = new("http://localhost:3001/api/v1/");
    public string? AccessToken { get; set; }

    public void Configure(string baseUrl, string? accessToken = null)
    {
        BaseUri = new Uri(baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/");
        AccessToken = accessToken;
        _httpClient.BaseAddress = BaseUri;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<AppLoginResponse> AppLoginAsync(string email, string password, string deviceName, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/app/login", new { email, password, deviceName }, _jsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        var result = (await response.Content.ReadFromJsonAsync<AppLoginResponse>(_jsonOptions, cancellationToken))!;
        AccessToken = result.AccessToken;
        return result;
    }

    public async Task<BrowserLoginStartResponse> StartBrowserLoginAsync(string deviceName, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/app/browser/start", new { deviceName }, _jsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<BrowserLoginStartResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task<BrowserLoginPollResponse> PollBrowserLoginAsync(string requestId, string pollToken, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/app/browser/poll", new { requestId, pollToken }, _jsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        var result = (await response.Content.ReadFromJsonAsync<BrowserLoginPollResponse>(_jsonOptions, cancellationToken))!;
        if (!string.IsNullOrWhiteSpace(result.AccessToken))
        {
            AccessToken = result.AccessToken;
        }

        return result;
    }

    public async Task<BootstrapResponse> GetBootstrapAsync(CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync("settings/bootstrap", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<BootstrapResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task<EmployeeDto> GetMeAsync(CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, "me");
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<EmployeeDto>(_jsonOptions, cancellationToken))!;
    }

    public async Task<BillingSubscriptionResponse> GetBillingSubscriptionAsync(CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, "billing/subscription");
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<BillingSubscriptionResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task LogoutAppAsync(CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, "auth/app/logout");
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        AccessToken = null;
    }

    public async Task<SessionResponse> CreateSessionAsync(
        string deviceId,
        int sourceProcessId,
        string micDeviceId,
        string subjectTag,
        string audioCaptureMode,
        string answerLength,
        string assistanceMode,
        string answerProvider,
        CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, "sessions");
        request.Content = JsonContent.Create(new
        {
            deviceId,
            sourceProcessId,
            micDeviceId,
            subjectTag,
            audioCaptureMode,
            answerLength,
            assistanceMode,
            answerProvider,
        });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<SessionResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task<EmployeePromptResponse> GetPromptAsync(CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, "employees/me/prompt");
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<EmployeePromptResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task<EmployeePromptResponse> UpdatePromptAsync(string prompt, string answerProvider, CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "employees/me/prompt");
        request.Content = JsonContent.Create(new { prompt, answerProvider });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<EmployeePromptResponse>(_jsonOptions, cancellationToken))!;
    }

    public async Task<ScreenshotResponse> UploadScreenshotAsync(
        string sessionId,
        byte[] imageBytes,
        string fileName,
        string answerLength,
        string assistanceMode,
        string answerProvider,
        CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"sessions/{sessionId}/screenshot");
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(imageBytes)
        {
            Headers =
            {
                ContentType = new MediaTypeHeaderValue("image/png"),
            },
        }, "file", fileName);
        content.Add(new StringContent(answerLength), "answerLength");
        content.Add(new StringContent(assistanceMode), "assistanceMode");
        content.Add(new StringContent(answerProvider), "answerProvider");
        request.Content = content;

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync<ScreenshotResponse>(_jsonOptions, cancellationToken))!;
    }

    private HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        if (!string.IsNullOrWhiteSpace(AccessToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
        }

        return request;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var quotaMessage = TryExtractQuotaMessage(body);
        if (!string.IsNullOrWhiteSpace(quotaMessage))
        {
            throw new HttpRequestException(quotaMessage);
        }

        throw new HttpRequestException($"{(int)response.StatusCode} {response.ReasonPhrase}: {body}");
    }

    private static string? TryExtractQuotaMessage(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var error = root.TryGetProperty("error", out var nestedError)
                ? nestedError
                : root;

            if (error.TryGetProperty("code", out var code) &&
                string.Equals(code.GetString(), "quota_exceeded", StringComparison.OrdinalIgnoreCase) &&
                error.TryGetProperty("message", out var message))
            {
                return message.GetString();
            }
        }
        catch
        {
            return null;
        }

        return null;
    }
}
