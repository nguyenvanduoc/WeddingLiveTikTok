namespace WeddingLive.Models;

/// <summary>
/// Một lượt tặng quà trên live (đã gộp combo: Rose x15 => Count = 15).
/// </summary>
public record GiftEvent
{
    public string UserId { get; init; } = "";       // uniqueId TikTok (@abc)
    public string Nickname { get; init; } = "";     // tên hiển thị
    public string? AvatarUrl { get; init; }
    public string GiftName { get; init; } = "Gift"; // "Rose", "Heart Me", "Galaxy"...
    public int Count { get; init; } = 1;            // số lượng (repeatCount)
    public int DiamondValue { get; init; }          // giá kim cương của 1 món quà
    public string? GiftImageUrl { get; init; }      // ảnh món quà trên máy chủ TikTok (để sân khấu hiện đúng hình quà)
    public long TotalDiamonds => (long)DiamondValue * Math.Max(1, Count);
    /// <summary>true = quà giả do bridge chế độ DEMO tạo ra (không phải người thật trên TikTok).</summary>
    public bool Demo { get; init; }
}

/// <summary>Bình luận trên live.</summary>
public record ChatEvent
{
    public string UserId { get; init; } = "";
    public string Nickname { get; init; } = "";
    public string Comment { get; init; } = "";
    public bool Demo { get; init; }
}

/// <summary>Thả tim.</summary>
public record LikeEvent
{
    public string UserId { get; init; } = "";
    public string Nickname { get; init; } = "";
    public int LikeCount { get; init; } = 1;
}

/// <summary>Theo dõi / chia sẻ / vào phòng.</summary>
public record SocialEvent
{
    public string UserId { get; init; } = "";
    public string Nickname { get; init; } = "";
    public string Action { get; init; } = "follow"; // follow | share | join
    public bool Demo { get; init; }
}

/// <summary>Một dòng trên bảng xếp hạng người tặng.</summary>
public record TopGifter(string UserId, string Nickname, long Diamonds, int Gifts);

/// <summary>Trạng thái kết nối của bridge TikTok, hiện trên trang admin.</summary>
public record BridgeStatus
{
    public bool Connected { get; init; }
    public string? Username { get; init; }
    public string? Message { get; init; }
    /// <summary>"live" = đang đọc live thật, "demo" = quà giả để test.</summary>
    public string? Mode { get; init; }
}
