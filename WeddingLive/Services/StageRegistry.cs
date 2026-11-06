using System.Collections.Concurrent;

namespace WeddingLive.Services;

/// <summary>
/// Theo dõi các trang sân khấu đang mở (OBS, tab Chrome, khung xem trước trong admin)
/// và trạng thái giọng đọc của từng trang, để trang admin chẩn đoán "vì sao không nghe tiếng".
/// </summary>
public class StageRegistry
{
    public record StageInfo(string ConnectionId, bool VoiceOn, string State, string? UserAgent, DateTime Since, string Music = "waiting");

    private readonly ConcurrentDictionary<string, StageInfo> _stages = new();

    public void Add(string id, bool voiceOn, string? userAgent) =>
        _stages[id] = new StageInfo(id, voiceOn, voiceOn ? "waiting" : "muted", userAgent, DateTime.Now);

    public void Remove(string id) => _stages.TryRemove(id, out _);

    public void SetState(string id, string state)
    {
        if (_stages.TryGetValue(id, out var s)) _stages[id] = s with { State = state };
    }

    public void SetMusic(string id, string music)
    {
        if (_stages.TryGetValue(id, out var s)) _stages[id] = s with { Music = music };
    }

    public IReadOnlyList<StageInfo> All() => _stages.Values.OrderBy(s => s.Since).ToList();
}
