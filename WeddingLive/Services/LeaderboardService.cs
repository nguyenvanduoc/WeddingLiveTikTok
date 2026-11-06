using System.Collections.Concurrent;
using WeddingLive.Models;

namespace WeddingLive.Services;

/// <summary>
/// Cộng dồn kim cương theo người tặng (lưu trong RAM, mất khi tắt app).
/// </summary>
public class LeaderboardService
{
    private readonly ConcurrentDictionary<string, TopGifter> _data = new();

    public void Add(GiftEvent gift)
    {
        var key = string.IsNullOrWhiteSpace(gift.UserId) ? gift.Nickname : gift.UserId;
        _data.AddOrUpdate(key,
            _ => new TopGifter(key, gift.Nickname, gift.TotalDiamonds, gift.Count),
            (_, old) => old with
            {
                Nickname = gift.Nickname,
                Diamonds = old.Diamonds + gift.TotalDiamonds,
                Gifts = old.Gifts + gift.Count
            });
    }

    public IReadOnlyList<TopGifter> Top(int n) =>
        _data.Values.OrderByDescending(x => x.Diamonds).ThenByDescending(x => x.Gifts).Take(n).ToList();

    public void Clear() => _data.Clear();
}
