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
            MusicVolume = Math.Clamp(o.CurrentValue.MusicVolume, 0, 1),
            MusicMaxSeconds = Math.Clamp(o.CurrentValue.MusicMaxSeconds, 10, 600)
        }));

        var api = app.MapGroup("/api/events").AddEndpointFilter<ApiKeyFilter>();

        // ---- Quà ----
        api.MapPost("/gift", async (GiftEvent gift, GiftQueueService queue) =>
        {
            gift = Normalize(gift);
            await queue.EnqueueAsync(gift);
            return Results.Accepted(value: new { queued = true, pending = queue.Pending });
        });

        // ---- Bình luận / tim / follow: không cần xếp hàng, đẩy thẳng ----
        api.MapPost("/chat", async (ChatEvent e, IHubContext<WeddingHub> hub) =>
        {
            if (string.IsNullOrWhiteSpace(e.Comment)) return Results.BadRequest();
            e = e with { Nickname = Clean(e.Nickname, e.UserId), Comment = Truncate(e.Comment.Trim(), 80) };
            await hub.Clients.All.SendAsync("ChatReceived", e);
            return Results.Ok();
        });

        api.MapPost("/like", async (LikeEvent e, IHubContext<WeddingHub> hub) =>
        {
            e = e with { Nickname = Clean(e.Nickname, e.UserId), LikeCount = Math.Clamp(e.LikeCount, 1, 50) };
            await hub.Clients.All.SendAsync("LikeReceived", e);
            return Results.Ok();
        });

        api.MapPost("/social", async (SocialEvent e, IHubContext<WeddingHub> hub) =>
        {
            e = e with { Nickname = Clean(e.Nickname, e.UserId) };
            await hub.Clients.All.SendAsync("SocialReceived", e);
            return Results.Ok();
        });

        // ---- Bridge báo trạng thái kết nối TikTok ----
        api.MapPost("/status", async (BridgeStatus s, BridgeStatusStore store, IHubContext<WeddingHub> hub) =>
        {
            store.Current = s;
            await hub.Clients.All.SendAsync("BridgeStatus", s);
            return Results.Ok();
        });

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
