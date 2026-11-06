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

    /// <summary>
    /// Số khách ĐỨNG. Có bàn tiệc: đứng 2 bên sân khấu (0 - 12).
    /// Không có bàn (Tables = 0): đứng 2 bên lối đi (4 - 24).
    /// </summary>
    public int GuestCount { get; set; } = 6;

    /// <summary>Số bàn tròn (0 - 5). 0 = không có bàn.</summary>
    public int Tables { get; set; } = 5;

    /// <summary>Số khách ngồi mỗi bàn (4 - 12).</summary>
    public int GuestsPerTable { get; set; } = 10;

    /// <summary>
    /// Khóa bí mật mà bridge / TikFinity phải gửi trong header X-Api-Key (hoặc ?key=).
    /// Để trống = không kiểm tra (chỉ nên dùng khi chạy local).
    /// </summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Quà có tổng kim cương từ mức này trở lên sẽ bắn pháo hoa.</summary>
    public int BigGiftDiamonds { get; set; } = 99;

    /// <summary>Thanh tình yêu: đủ bao nhiêu điểm (kim cương) thì cô dâu chú rể ôm nhau + hôn nhẹ.</summary>
    public int HugAt { get; set; } = 100;

    /// <summary>Thanh tình yêu: đủ bao nhiêu điểm thì hai người khiêu vũ (rồi thanh về 0, vòng mới).</summary>
    public int DanceAt { get; set; } = 300;

    /// <summary>Khoảng cách tối thiểu (ms) giữa 2 khách lần lượt đứng dậy lên tặng quà. Lớn = thong thả hơn.</summary>
    public int GiftPacingMs { get; set; } = 1500;

    /// <summary>Tốc độ đi của khách (pixel/giây). Nhỏ = đi chậm hơn.</summary>
    public int WalkSpeed { get; set; } = 240;

    /// <summary>Thời gian giãn cách (ms) giữa 2 sự kiện quà gửi xuống trình duyệt.</summary>
    public int DispatchDelayMs { get; set; } = 250;
}
