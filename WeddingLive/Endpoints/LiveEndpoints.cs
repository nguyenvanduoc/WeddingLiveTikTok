using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using WeddingLive.Hubs;
using WeddingLive.Models;
using WeddingLive.Services;

namespace WeddingLive.Endpoints;

/// <summary>
/// Các API nhận sự kiện từ bên ngoài:
/// - tiktok-bridge (Node.js) gửi POST JSON
/// - TikFinity / Streamer.bot gọi webhook GET có query string
/// - trang admin.html bấm nút giả lập quà
/// </summary>
public static class LiveEndpoints
{
    public static IEndpointRouteBuilder MapLiveEndpoints(this IEndpointRouteBuilder app)
    {
        // Cấu hình cho trang sân khấu (không cần key, không có thông tin bí mật)
        app.MapGet("/api/config", (IOptionsMonitor<WeddingOptions> o) => Results.Ok(new
        {
            o.CurrentValue.BrideName,
            o.CurrentValue.GroomName,
            o.CurrentValue.Title,
            GuestCount = Math.Clamp(o.CurrentValue.GuestCount, 0, 24),
            Tables = Math.Clamp(o.CurrentValue.Tables, 0, 5),
            GuestsPerTable = Math.Clamp(o.CurrentValue.GuestsPerTable, 4, 12),
            o.CurrentValue.BigGiftDiamonds,
            GiftPacingMs = Math.Clamp(o.CurrentValue.GiftPacingMs, 0, 10000),
            WalkSpeed = Math.Clamp(o.CurrentValue.WalkSpeed, 80, 600),
            o.CurrentValue.IdleActivity,
            IdleAfterSeconds = Math.Clamp(o.CurrentValue.IdleAfterSeconds, 2, 600),
            IdleEverySeconds = Math.Clamp(o.CurrentValue.IdleEverySeconds, 2, 120),
            o.CurrentValue.MusicEnabled,
            MusicEverySeconds = Math.Clamp(o.CurrentValue.MusicEverySeconds, 5, 3600),
            o.CurrentValue.MusicStopOnGift,
            DanceMusicSeconds = Math.Clamp(o.CurrentValue.DanceMusicSeconds, 10, 300),
            MusicVolume = Math.Clamp(o.CurrentValue.MusicVolume, 0, 1),
            MusicDuck = Math.Clamp(o.CurrentValue.MusicDuck, 0, 1),
            MusicMaxSeconds = Math.Clamp(o.CurrentValue.MusicMaxSeconds, 10, 600)
        }));

        var api = app.MapGroup("/api/events").AddEndpointFilter<ApiKeyFilter>();

        // ---- Quà ----
        api.MapPost("/gift", async (GiftEvent gift, GiftQueueService queue, EventLog log) =>
        {
            gift = Normalize(gift);
            log.Add("gift", gift.Nickname, $"{gift.Count} x {gift.GiftName}");
            await queue.EnqueueAsync(gift);
            return Results.Accepted(value: new { queued = true, pending = queue.Pending });
        });

        // ---- Bình luận / tim / follow: không cần xếp hàng, đẩy thẳng ----
        api.MapPost("/chat", async (ChatEvent e, IHubContext<WeddingHub> hub, EventLog log) =>
        {
            if (string.IsNullOrWhiteSpace(e.Comment)) return Results.BadRequest();
            e = e with { Nickname = Clean(e.Nickname, e.UserId), Comment = Truncate(e.Comment.Trim(), 80) };
            log.Add("chat", e.Nickname, e.Comment);
            await hub.Clients.All.SendAsync("ChatReceived", e);
            return Results.Ok();
        });

        api.MapPost("/like", async (LikeEvent e, IHubContext<WeddingHub> hub, EventLog log) =>
        {
            log.Add("like", e.Nickname, $"+{e.LikeCount} tim");
            e = e with { Nickname = Clean(e.Nickname, e.UserId), LikeCount = Math.Clamp(e.LikeCount, 1, 50) };
            await hub.Clients.All.SendAsync("LikeReceived", e);
            return Results.Ok();
        });

        api.MapPost("/social", async (SocialEvent e, IHubContext<WeddingHub> hub, EventLog log) =>
        {
            e = e with { Nickname = Clean(e.Nickname, e.UserId) };
            log.Add(e.Action, e.Nickname, e.Action == "join" ? "vào xem" : e.Action);
            await hub.Clients.All.SendAsync("SocialReceived", e);
            return Results.Ok();
        });

        // ---- Bridge báo trạng thái kết nối TikTok ----
        api.MapPost("/status", async (BridgeStatus s, BridgeStatusStore store, IHubContext<WeddingHub> hub, EventLog log) =>
        {
            store.Current = s;
            log.BridgeSeen(s.Mode);
            await hub.Clients.All.SendAsync("BridgeStatus", s);
            return Results.Ok();
        });

        // ---- Chẩn đoán cho trang admin: bridge, sự kiện đã nhận, sân khấu có tiếng ----
        app.MapGet("/api/diag", (BridgeStatusStore status, EventLog log, StageRegistry stages) => Results.Ok(new
        {
            Bridge = status.Current,
            BridgeMode = log.BridgeMode,
            BridgeLastSeenSeconds = log.BridgeLastSeen is DateTime t ? (int)(DateTime.Now - t).TotalSeconds : (int?)null,
            Counts = log.Counts,
            LastSeconds = log.Last.ToDictionary(kv => kv.Key, kv => (int)(DateTime.Now - kv.Value).TotalSeconds),
            Recent = log.Recent.Take(10).Select(e => new { e.Type, e.Who, e.Text, Ago = (int)(DateTime.Now - e.At).TotalSeconds }),
            StagesWithVoice = stages.All().Count(s => s.VoiceOn),
            StagesPlaying = stages.All().Count(s => s.VoiceOn && s.State == "ok"),
            Music = stages.All().Where(s => s.VoiceOn).Select(s => s.Music),
            StageStats = stages.All().Where(s => s.VoiceOn).Select(s => s.Stats),
            NowMs = DateTimeOffset.Now.ToUnixTimeMilliseconds()
        }));

        // ---- Webhook dạng GET cho TikFinity / Streamer.bot ----
        // Ví dụ: /api/events/webhook/gift?key=XXX&username={username}&nickname={nickname}&gift={giftname}&count={repeatcount}&coins={coins}
        api.MapGet("/webhook/gift", async (string? username, string? nickname, string? gift,
            int? count, int? coins, GiftQueueService queue) =>
        {
            var g = Normalize(new GiftEvent
            {
                UserId = username ?? "",
                Nickname = nickname ?? "",
                GiftName = gift ?? "Gift",
                Count = count ?? 1,
                DiamondValue = coins ?? 1
            });
            await queue.EnqueueAsync(g);
            return Results.Ok(new { queued = true });
        });

        // ---- Nhạc: danh sách file trong wwwroot/music + admin bấm phát / dừng ----
        app.MapGet("/api/music", (IWebHostEnvironment env) =>
        {
            var dir = Path.Combine(env.WebRootPath, "music");
            if (!Directory.Exists(dir)) return Results.Ok(Array.Empty<string>());
            var ext = new[] { ".mp3", ".ogg", ".m4a", ".wav" };
            return Results.Ok(Directory.EnumerateFiles(dir)
                .Where(f => ext.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .Select(Path.GetFileName).OrderBy(f => f).ToArray());
        });
        // ---- Tải bài hát lên / xóa bài (từ trang admin) ----
        var musicExt = new[] { ".mp3", ".ogg", ".m4a", ".wav" };
        app.MapPost("/api/music/upload", async (HttpRequest request, IWebHostEnvironment env, IHubContext<WeddingHub> hub) =>
        {
            if (!request.HasFormContentType) return Results.BadRequest("Cần gửi file dạng form");
            var form = await request.ReadFormAsync();
            var dir = Path.Combine(env.WebRootPath, "music");
            Directory.CreateDirectory(dir);
            var saved = new List<string>();
            foreach (var file in form.Files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!musicExt.Contains(ext) || file.Length == 0 || file.Length > 50 * 1024 * 1024) continue;
                // Tên file an toàn: bỏ đường dẫn + ký tự lạ, giữ chữ (kể cả tiếng Việt), số, khoảng trắng, - _ ( )
                var name = System.Text.RegularExpressions.Regex.Replace(Path.GetFileNameWithoutExtension(file.FileName), @"[^\p{L}\p{N} _\-()]", "").Trim();
                if (name.Length == 0) name = "bai-hat";
                var path = Path.Combine(dir, name + ext);
                await using (var fs = File.Create(path)) await file.CopyToAsync(fs);
                saved.Add(name + ext);
            }
            if (saved.Count > 0) await hub.Clients.All.SendAsync("MusicLibraryChanged");
            return Results.Ok(new { saved });
        }).AddEndpointFilter<ApiKeyFilter>().DisableAntiforgery()
          .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(200L * 1024 * 1024));

        app.MapDelete("/api/music/{name}", async (string name, IWebHostEnvironment env, IHubContext<WeddingHub> hub) =>
        {
            var file = Path.GetFileName(name);                    // chặn ../ đường dẫn
            var path = Path.Combine(env.WebRootPath, "music", file);
            if (!musicExt.Contains(Path.GetExtension(file).ToLowerInvariant()) || !File.Exists(path)) return Results.NotFound();
            File.Delete(path);
            await hub.Clients.All.SendAsync("MusicLibraryChanged");
            return Results.Ok();
        }).AddEndpointFilter<ApiKeyFilter>();

        api.MapPost("/music", async (MusicRequest req, IHubContext<WeddingHub> hub) =>
        {
            if (req.Action is not ("play" or "stop")) return Results.BadRequest("action = play | stop");
            await hub.Clients.All.SendAsync("Music", new { action = req.Action });
            return Results.Ok();
        });

        // ---- Admin: thử màn ôm hôn / khiêu vũ của cô dâu chú rể ----
        api.MapPost("/couple", async (CoupleRequest req, IHubContext<WeddingHub> hub) =>
        {
            if (req.Action is not ("hug" or "dance")) return Results.BadRequest("action = hug | dance");
            await hub.Clients.All.SendAsync("CoupleAction", new { action = req.Action });
            return Results.Ok();
        });

        // ---- Admin: xóa bảng xếp hạng + reset tên khách ----
        api.MapPost("/reset", async (LeaderboardService lb, LoveMeterService meter, IHubContext<WeddingHub> hub) =>
        {
            lb.Clear();
            await hub.Clients.All.SendAsync("ResetStage");
            await hub.Clients.All.SendAsync("LoveMeter", meter.Reset());
            await hub.Clients.All.SendAsync("Leaderboard", lb.Top(5));
            return Results.Ok();
        });

        return app;
    }

    public record CoupleRequest(string? Action);
    public record MusicRequest(string? Action);

    private static GiftEvent Normalize(GiftEvent g) => g with
    {
        Nickname = Clean(g.Nickname, g.UserId),
        GiftName = string.IsNullOrWhiteSpace(g.GiftName) ? "Gift" : Truncate(g.GiftName.Trim(), 30),
        Count = Math.Clamp(g.Count, 1, 9999),
        DiamondValue = Math.Max(0, g.DiamondValue),
        // Chỉ nhận ảnh https từ máy chủ ảnh của TikTok
        GiftImageUrl = Uri.TryCreate(g.GiftImageUrl, UriKind.Absolute, out var u) && u.Scheme == "https"
                       && (u.Host.EndsWith(".tiktokcdn.com") || u.Host.EndsWith(".tiktokcdn-us.com") || u.Host.EndsWith(".tiktokcdn-eu.com") || u.Host.EndsWith(".ibyteimg.com"))
            ? g.GiftImageUrl : null
    };

    private static string Clean(string? nickname, string? userId)
    {
        var name = string.IsNullOrWhiteSpace(nickname) ? userId : nickname;
        return Truncate((name ?? "Khách").Trim(), 24);
    }

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s[..max] + "…";
}

/// <summary>
/// Kiểm tra khóa bí mật: header "X-Api-Key" hoặc query "?key=".
/// Nếu Wedding:ApiKey để trống thì cho qua (tiện test local).
/// </summary>
public class ApiKeyFilter : IEndpointFilter
{
    private readonly IOptionsMonitor<WeddingOptions> _options;
    public ApiKeyFilter(IOptionsMonitor<WeddingOptions> options) => _options = options;

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var expected = _options.CurrentValue.ApiKey;
        if (!string.IsNullOrEmpty(expected))
        {
            var req = ctx.HttpContext.Request;
            var provided = req.Headers["X-Api-Key"].FirstOrDefault() ?? req.Query["key"].FirstOrDefault();
            if (!string.Equals(provided, expected, StringComparison.Ordinal))
                return Results.Unauthorized();
        }
        return await next(ctx);
    }
}
