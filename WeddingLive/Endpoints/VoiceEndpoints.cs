using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using WeddingLive.Hubs;
using WeddingLive.Models;
using WeddingLive.Services;

namespace WeddingLive.Endpoints;

/// <summary>
/// API giọng đọc:
/// - GET  /api/voice/config  : cấu hình + câu nói cho trang sân khấu (không lộ AzureKey)
/// - GET  /api/tts?text=...   : trả file MP3 đọc câu đó
/// - POST /api/events/speak   : admin gõ câu cho MC đọc ngay trên sân khấu
/// </summary>
public static class VoiceEndpoints
{
    public const int MaxTextLength = 400;

    public static IEndpointRouteBuilder MapVoiceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/voice/config", (IOptionsMonitor<VoiceOptions> opt, TtsService tts) =>
        {
            var o = opt.CurrentValue;
            static List<string> Or(List<string>? list, string[] fallback) =>
                list is { Count: > 0 } ? list : fallback.ToList();

            var giftNames = new Dictionary<string, string>(VoiceOptions.DefaultGiftNames, StringComparer.OrdinalIgnoreCase);
            if (o.GiftNames is not null)
                foreach (var (k, v) in o.GiftNames) giftNames[k] = v;   // cấu hình riêng ghi đè mặc định

            return Results.Ok(new
            {
                o.Enabled,
                Provider = tts.ResolveProvider(),
                Volume = Math.Clamp(o.Volume, 0, 1),
                Speed = o.ClampedSpeed,
                // Trình duyệt tự tăng tốc khi phát nếu giọng không tự chỉnh được tốc độ
                ClientSpeed = tts.ClientSpeed(o.ClampedSpeed),
                AnnounceIntervalSeconds = Math.Max(0, o.AnnounceIntervalSeconds),
                o.ThankFollow,
                Announcements = Or(o.Announcements, VoiceOptions.DefaultAnnouncements),
                GiftThanks = Or(o.GiftThanks, VoiceOptions.DefaultGiftThanks),
                BigGiftThanks = Or(o.BigGiftThanks, VoiceOptions.DefaultBigGiftThanks),
                GiftAnnounce = Or(o.GiftAnnounce, VoiceOptions.DefaultGiftAnnounce),
                FollowThanks = Or(o.FollowThanks, VoiceOptions.DefaultFollowThanks),
                o.ReadChat,
                MaxPendingChats = Math.Clamp(o.MaxPendingChats, 1, 20),
                MaxChatLength = Math.Clamp(o.MaxChatLength, 20, 300),
                ChatTemplates = Or(o.ChatTemplates, VoiceOptions.DefaultChatTemplates),
                BannedWords = o.BannedWords ?? VoiceOptions.DefaultBannedWords.ToList(),
                MeterCheer = Or(o.MeterCheer, VoiceOptions.DefaultMeterCheer),
                HugLines = Or(o.HugLines, VoiceOptions.DefaultHugLines),
                DanceLines = Or(o.DanceLines, VoiceOptions.DefaultDanceLines),
                IdleLines = Or(o.IdleLines, VoiceOptions.DefaultIdleLines),
                NpcLines = Or(o.NpcLines, VoiceOptions.DefaultNpcLines),
                GiftNames = giftNames
            });
        });

        // Chẩn đoán cho trang admin: giọng nào, lỗi gần nhất, các trang sân khấu đang mở
        app.MapGet("/api/voice/status", (IOptionsMonitor<VoiceOptions> opt, TtsService tts, StageRegistry stages) => Results.Ok(new
        {
            opt.CurrentValue.Enabled,
            Provider = tts.ResolveProvider(),
            Speed = opt.CurrentValue.ClampedSpeed,
            tts.LastError,
            tts.LastErrorAt,
            Stages = stages.All().Select(s => new { s.VoiceOn, s.State, s.UserAgent, s.Since })
        }));

        app.MapGet("/api/tts", async (string? text, TtsService tts, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(text) || text.Length > MaxTextLength)
                return Results.BadRequest("text rỗng hoặc quá dài");

            var audio = await tts.SynthesizeAsync(text, ct);
            return audio is null
                ? Results.StatusCode(StatusCodes.Status502BadGateway)   // trang sân khấu sẽ chuyển sang giọng trình duyệt
                : Results.File(audio, "audio/mpeg");
        });

        // Admin chỉnh tốc độ / nhịp MC => lưu vào appsettings.Local.json (tự nạp lại, không cần chạy lại server)
        app.MapPost("/api/voice/settings", async (VoiceSettingsRequest req, IWebHostEnvironment env) =>
        {
            var path = Path.Combine(env.ContentRootPath, "appsettings.Local.json");
            var root = File.Exists(path)
                ? (System.Text.Json.Nodes.JsonNode.Parse(await File.ReadAllTextAsync(path)) as System.Text.Json.Nodes.JsonObject) ?? new()
                : new System.Text.Json.Nodes.JsonObject();
            if (root["Voice"] is not System.Text.Json.Nodes.JsonObject voice) root["Voice"] = voice = new();
            if (req.Speed is double sp) voice["Speed"] = Math.Round(Math.Clamp(sp, 0.5, 3.0), 2);
            if (req.AnnounceIntervalSeconds is int iv) voice["AnnounceIntervalSeconds"] = Math.Clamp(iv, 0, 600);
            await File.WriteAllTextAsync(path, root.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
            return Results.Ok(new { saved = path });
        }).AddEndpointFilter<ApiKeyFilter>();

        app.MapPost("/api/events/speak", async (SpeakRequest req, IHubContext<WeddingHub> hub) =>
        {
            var text = req.Text?.Trim() ?? "";
            if (text.Length == 0 || text.Length > MaxTextLength) return Results.BadRequest();
            await hub.Clients.All.SendAsync("Speak", new { text });
            return Results.Ok();
        }).AddEndpointFilter<ApiKeyFilter>();

        return app;
    }

    public record SpeakRequest(string? Text);
    public record VoiceSettingsRequest(double? Speed, int? AnnounceIntervalSeconds);
}
