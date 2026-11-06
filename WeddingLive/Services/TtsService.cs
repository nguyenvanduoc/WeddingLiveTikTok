using System.Collections.Concurrent;
using System.Security;
using System.Text;
using Microsoft.Extensions.Options;
using WeddingLive.Models;

namespace WeddingLive.Services;

/// <summary>
/// Chuyển chữ thành giọng nói (MP3). Hỗ trợ:
/// - Google Translate TTS: miễn phí, không cần key (dịch vụ không chính thức, mỗi đoạn tối đa ~200 ký tự)
/// - Azure Speech: giọng AI tự nhiên (vi-VN-HoaiMyNeural / NamMinhNeural), cần key
/// Có bộ nhớ đệm để câu lặp lại (lời chào, mời tặng quà) không phải tải lại.
/// </summary>
public class TtsService
{
    private const int MaxCacheItems = 300;
    public const string HttpClientName = "tts";
    private readonly IHttpClientFactory _httpFactory;
    private readonly IOptionsMonitor<VoiceOptions> _options;
    private readonly ILogger<TtsService> _logger;
    private readonly ConcurrentDictionary<string, byte[]> _cache = new();
    private readonly SemaphoreSlim _gate = new(2);   // tối đa 2 request TTS cùng lúc

    public TtsService(IHttpClientFactory httpFactory, IOptionsMonitor<VoiceOptions> options, ILogger<TtsService> logger)
    {
        _httpFactory = httpFactory;
        _options = options;
        _logger = logger;
    }

    private HttpClient Http => _httpFactory.CreateClient(HttpClientName);

    /// <summary>Nhà cung cấp thực tế sẽ dùng: "google" | "azure" | "browser".</summary>
    public string ResolveProvider()
    {
        var o = _options.CurrentValue;
        var p = (o.Provider ?? "auto").Trim().ToLowerInvariant();
        if (p == "auto") return string.IsNullOrWhiteSpace(o.AzureKey) ? "google" : "azure";
        return p is "google" or "azure" or "browser" ? p : "google";
    }

    public async Task<byte[]?> SynthesizeAsync(string text, CancellationToken ct)
    {
        text = text.Trim();
        var provider = ResolveProvider();
        if (provider == "browser") return null;

        var o = _options.CurrentValue;
        var key = provider == "azure" ? $"azure|{o.AzureVoice}|{o.AzureRate}|{text}" : $"google|{text}";
        if (_cache.TryGetValue(key, out var cached)) return cached;

        await _gate.WaitAsync(ct);
        try
        {
            var audio = provider == "azure" ? await AzureAsync(text, o, ct) : await GoogleAsync(text, ct);
            if (_cache.Count >= MaxCacheItems) _cache.Clear();
            _cache[key] = audio;
            return audio;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning("TTS ({Provider}) lỗi: {Message}", provider, ex.Message);
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    // ---------------- Google Translate TTS ----------------
    private async Task<byte[]> GoogleAsync(string text, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        foreach (var chunk in SplitText(text, 180))
        {
            var url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q="
                      + Uri.EscapeDataString(chunk);
            var bytes = await Http.GetByteArrayAsync(url, ct);
            ms.Write(bytes);   // MP3 nối tiếp nhau vẫn phát liền mạch
        }
        return ms.ToArray();
    }

    // ---------------- Azure Speech ----------------
    private async Task<byte[]> AzureAsync(string text, VoiceOptions o, CancellationToken ct)
    {
        var ssml = $"""
            <speak version="1.0" xml:lang="vi-VN">
              <voice name="{SecurityElement.Escape(o.AzureVoice)}">
                <prosody rate="{SecurityElement.Escape(o.AzureRate)}">{SecurityElement.Escape(text)}</prosody>
              </voice>
            </speak>
            """;
        using var req = new HttpRequestMessage(HttpMethod.Post,
            $"https://{o.AzureRegion}.tts.speech.microsoft.com/cognitiveservices/v1")
        {
            Content = new StringContent(ssml, Encoding.UTF8, "application/ssml+xml")
        };
        req.Headers.Add("Ocp-Apim-Subscription-Key", o.AzureKey);
        req.Headers.Add("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3");

        using var res = await Http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Azure trả về HTTP {(int)res.StatusCode} (kiểm tra AzureKey / AzureRegion)");
        return await res.Content.ReadAsByteArrayAsync(ct);
    }

    /// <summary>Cắt câu dài thành đoạn ≤ max ký tự, ưu tiên cắt ở dấu câu rồi tới khoảng trắng.</summary>
    internal static IEnumerable<string> SplitText(string text, int max)
    {
        var rest = text.Trim();
        while (rest.Length > max)
        {
            var cut = rest.LastIndexOfAny(new[] { '.', '!', '?', ',', ';', ':' }, max - 1);
            if (cut < max / 3) cut = rest.LastIndexOf(' ', max - 1);
            if (cut <= 0) cut = max - 1;
            yield return rest[..(cut + 1)].Trim();
            rest = rest[(cut + 1)..].Trim();
        }
        if (rest.Length > 0) yield return rest;
    }
}
