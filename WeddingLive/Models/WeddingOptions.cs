namespace WeddingLive.Models;

/// <summary>
/// Cấu hình đọc từ appsettings.json, mục "Wedding".
/// </summary>
public class WeddingOptions
{
    public const string Section = "Wedding";

    public string BrideName { get; set; } = "Cô Dâu";
    public string GroomName { get; set; } = "Chú Rể";
    public string Title { get; set; } = "Đám Cưới Online";

    /// <summary>Số khách ngồi ở dưới (tối thiểu 4, tối đa 24).</summary>
    public int GuestCount { get; set; } = 12;

    /// <summary>Số người ngồi ở bàn tiệc cuối thảm đỏ (0 = không có bàn, tối đa 12).</summary>
    public int TableGuests { get; set; } = 10;

    /// <summary>
    /// Khóa bí mật mà bridge / TikFinity phải gửi trong header X-Api-Key (hoặc ?key=).
    /// Để trống = không kiểm tra (chỉ nên dùng khi chạy local).
    /// </summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Quà có tổng kim cương từ mức này trở lên sẽ bắn pháo hoa.</summary>
    public int BigGiftDiamonds { get; set; } = 99;

    /// <summary>Thời gian giãn cách (ms) giữa 2 sự kiện quà gửi xuống trình duyệt.</summary>
    public int DispatchDelayMs { get; set; } = 250;
}
