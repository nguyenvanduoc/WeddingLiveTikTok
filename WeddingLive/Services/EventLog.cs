using System.Collections.Concurrent;

namespace WeddingLive.Services;

/// <summary>
/// Nhật ký sự kiện server đã nhận (để trang admin chẩn đoán "vì sao không đọc được bình luận"):
/// đếm theo loại, 20 sự kiện gần nhất, lần cuối bridge liên lạc.
/// </summary>
public class EventLog
{
    public record Entry(DateTime At, string Type, string Who, string Text);

    private readonly ConcurrentQueue<Entry> _recent = new();
    private readonly ConcurrentDictionary<string, int> _counts = new();
    private readonly ConcurrentDictionary<string, DateTime> _last = new();

    public DateTime? BridgeLastSeen { get; private set; }
    public string? BridgeMode { get; private set; }

    public void Add(string type, string? who, string? text, bool demo = false)
    {
        if (demo)
        {
            _counts.AddOrUpdate("demo", 1, (_, n) => n + 1);   // sự kiện giả từ bridge DEMO
            _last["demo"] = DateTime.Now;
            text = "[DEMO] " + text;
        }
        _counts.AddOrUpdate(type, 1, (_, n) => n + 1);
        _last[type] = DateTime.Now;
        _recent.Enqueue(new Entry(DateTime.Now, type, who ?? "", text ?? ""));
        while (_recent.Count > 20) _recent.TryDequeue(out _);
    }

    public void BridgeSeen(string? mode)
    {
        BridgeLastSeen = DateTime.Now;
        if (!string.IsNullOrEmpty(mode)) BridgeMode = mode;
    }

    public IReadOnlyDictionary<string, int> Counts => _counts;
    public IReadOnlyDictionary<string, DateTime> Last => _last;
    public IEnumerable<Entry> Recent => _recent.Reverse();
}
