using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using WeddingLive.Hubs;
using WeddingLive.Models;

namespace WeddingLive.Services;

/// <summary>
/// Hàng đợi quà chạy nền.
/// - Webhook / admin ghi quà vào Channel (producer).
/// - BackgroundService đọc lần lượt (consumer), cập nhật bảng xếp hạng
///   và đẩy xuống trình duyệt qua SignalR với nhịp giãn cách để animation không dồn cục.
/// </summary>
public class GiftQueueService : BackgroundService
{
    private readonly Channel<GiftEvent> _queue = Channel.CreateBounded<GiftEvent>(
        new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest, // bị spam quá nhiều thì bỏ quà cũ nhất
            SingleReader = true
        });

    private readonly IHubContext<WeddingHub> _hub;
    private readonly LeaderboardService _leaderboard;
    private readonly LoveMeterService _meter;
    private readonly IOptionsMonitor<WeddingOptions> _options;
    private readonly ILogger<GiftQueueService> _logger;

    public GiftQueueService(IHubContext<WeddingHub> hub, LeaderboardService leaderboard, LoveMeterService meter,
        IOptionsMonitor<WeddingOptions> options, ILogger<GiftQueueService> logger)
    {
        _meter = meter;
        _hub = hub;
        _leaderboard = leaderboard;
        _options = options;
        _logger = logger;
    }

    /// <summary>Số quà đang chờ trong hàng đợi.</summary>
    public int Pending => _queue.Reader.Count;

    public ValueTask EnqueueAsync(GiftEvent gift, CancellationToken ct = default) =>
        _queue.Writer.WriteAsync(gift, ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var gift in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                _leaderboard.Add(gift);
                var (meter, actions) = _meter.Add(gift.TotalDiamonds);
                // Gửi kèm thanh tình yêu sau quà này + màn diễn (hug/dance) để sân khấu diễn đúng lúc trao quà
                await _hub.Clients.All.SendAsync("GiftReceived", new
                {
                    gift.UserId, gift.Nickname, gift.AvatarUrl, gift.GiftName, gift.Count, gift.DiamondValue, gift.GiftImageUrl, gift.Demo,
                    Meter = meter,
                    Actions = actions
                }, stoppingToken);
                if (actions.Length > 0)
                    _logger.LogInformation("💞 Thanh tình yêu: {Actions}", string.Join(", ", actions));
                await _hub.Clients.All.SendAsync("Leaderboard", _leaderboard.Top(5), stoppingToken);
                _logger.LogInformation("🎁 {Nick} tặng {Count} x {Gift} ({Dia} 💎)",
                    gift.Nickname, gift.Count, gift.GiftName, gift.TotalDiamonds);

                await Task.Delay(_options.CurrentValue.DispatchDelayMs, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi phát sự kiện quà");
            }
        }
    }
}
