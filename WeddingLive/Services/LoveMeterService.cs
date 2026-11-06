using Microsoft.Extensions.Options;
using WeddingLive.Models;

namespace WeddingLive.Services;

/// <summary>
/// "Thanh tình yêu": cộng điểm theo kim cương của quà (Rose = 1 điểm).
/// - Đạt HugAt   => cô dâu chú rể ôm nhau + hôn nhẹ ("hug")
/// - Đạt DanceAt => hai người khiêu vũ ("dance"), sau đó thanh về 0 và bắt đầu vòng mới
/// Lưu trên server để mọi trang sân khấu (OBS, xem trước) khớp nhau, F5 không mất điểm.
/// </summary>
public class LoveMeterService
{
    private readonly object _lock = new();
    private readonly IOptionsMonitor<WeddingOptions> _options;
    private long _points, _seq;
    private bool _hugged;
    private int _rounds;

    public LoveMeterService(IOptionsMonitor<WeddingOptions> options) => _options = options;

    /// <summary>Ảnh chụp trạng thái thanh tình yêu gửi cho trình duyệt. Seq tăng dần để bỏ bản cũ.</summary>
    public record Snapshot(long Points, int HugAt, int DanceAt, bool Hugged, int Rounds, long Seq);

    private (int hugAt, int danceAt) Thresholds()
    {
        var o = _options.CurrentValue;
        var dance = Math.Max(2, o.DanceAt);
        return (Math.Clamp(o.HugAt, 1, dance - 1), dance);
    }

    /// <summary>Cộng điểm cho 1 lượt quà, trả về trạng thái mới + các màn diễn vừa đạt được.</summary>
    public (Snapshot meter, string[] actions) Add(long diamonds)
    {
        lock (_lock)
        {
            var (hugAt, danceAt) = Thresholds();
            var actions = new List<string>();
            _points += Math.Max(0, diamonds);
            if (!_hugged && _points >= hugAt) { _hugged = true; actions.Add("hug"); }
            if (_points >= danceAt)
            {
                actions.Add("dance");
                _points = 0;             // đầy thanh => khiêu vũ rồi bắt đầu vòng mới
                _hugged = false;
                _rounds++;
            }
            _seq++;
            return (new Snapshot(_points, hugAt, danceAt, _hugged, _rounds, _seq), actions.ToArray());
        }
    }

    public Snapshot Current()
    {
        lock (_lock)
        {
            var (hugAt, danceAt) = Thresholds();
            return new Snapshot(_points, hugAt, danceAt, _hugged, _rounds, _seq);
        }
    }

    public Snapshot Reset()
    {
        lock (_lock) { _points = 0; _hugged = false; _rounds = 0; _seq++; }
        return Current();
    }
}
