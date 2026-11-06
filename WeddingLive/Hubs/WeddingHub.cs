using Microsoft.AspNetCore.SignalR;
using WeddingLive.Services;

namespace WeddingLive.Hubs;

/// <summary>
/// Hub SignalR: trình duyệt (sân khấu / admin) kết nối vào đây để nhận sự kiện realtime.
/// Server đẩy xuống các hàm: GiftReceived, ChatReceived, LikeReceived, SocialReceived,
/// Leaderboard, BridgeStatus, ResetStage, Speak.
/// Trang sân khấu kết nối với ?role=stage&voice=1|0 và báo trạng thái giọng qua ReportVoiceState.
/// </summary>
public class WeddingHub : Hub
{
    private readonly LeaderboardService _leaderboard;
    private readonly BridgeStatusStore _status;
    private readonly StageRegistry _stages;
    private readonly LoveMeterService _meter;

    public WeddingHub(LeaderboardService leaderboard, BridgeStatusStore status, StageRegistry stages, LoveMeterService meter)
    {
        _meter = meter;
        _leaderboard = leaderboard;
        _status = status;
        _stages = stages;
    }

    /// <summary>Khi một trình duyệt vừa kết nối: gửi ngay bảng xếp hạng + trạng thái bridge hiện tại.</summary>
    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        if (http is not null && http.Request.Query["role"].ToString() == "stage")
        {
            var voiceOn = http.Request.Query["voice"].ToString() != "0";
            _stages.Add(Context.ConnectionId, voiceOn, http.Request.Headers.UserAgent.ToString());
        }

        await Clients.Caller.SendAsync("Leaderboard", _leaderboard.Top(5));
        await Clients.Caller.SendAsync("BridgeStatus", _status.Current);
        await Clients.Caller.SendAsync("LoveMeter", _meter.Current());
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _stages.Remove(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Trang sân khấu báo trạng thái giọng: ok | blocked | fallback | error | disabled | waiting.
    /// </summary>
    public void ReportVoiceState(string state)
    {
        if (state.Length <= 40) _stages.SetState(Context.ConnectionId, state);
    }
}
