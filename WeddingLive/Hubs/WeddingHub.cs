using Microsoft.AspNetCore.SignalR;
using WeddingLive.Services;

namespace WeddingLive.Hubs;

/// <summary>
/// Hub SignalR: trình duyệt (sân khấu / admin) kết nối vào đây để nhận sự kiện realtime.
/// Server đẩy xuống các hàm: GiftReceived, ChatReceived, LikeReceived, SocialReceived,
/// Leaderboard, BridgeStatus, ResetStage.
/// </summary>
public class WeddingHub : Hub
{
    private readonly LeaderboardService _leaderboard;
    private readonly BridgeStatusStore _status;

    public WeddingHub(LeaderboardService leaderboard, BridgeStatusStore status)
    {
        _leaderboard = leaderboard;
        _status = status;
    }

    /// <summary>Khi một trình duyệt vừa kết nối: gửi ngay bảng xếp hạng + trạng thái bridge hiện tại.</summary>
    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync("Leaderboard", _leaderboard.Top(5));
        await Clients.Caller.SendAsync("BridgeStatus", _status.Current);
        await base.OnConnectedAsync();
    }
}
