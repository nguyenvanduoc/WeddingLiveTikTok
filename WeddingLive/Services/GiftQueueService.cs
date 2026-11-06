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
    private readonly IOptionsMonitor<WeddingOptions> _options;
    private readonly ILogger<GiftQueueService> _logger;

    public GiftQueueService(IHubContext<WeddingHub> hub, LeaderboardService leaderboard,
        IOptionsMonitor<WeddingOptions> options, ILogger<GiftQueueService> logger)
    {
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
                await _hub.Clients.All.SendAsync("GiftReceived", gift, stoppingToken);
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
