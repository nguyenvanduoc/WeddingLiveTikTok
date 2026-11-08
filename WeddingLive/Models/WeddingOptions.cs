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
    public int GiftGapMs { get; set; } = 10000;   // mọi lượt khách đi lên tặng quà cách nhau 10 giây

    /// <summary>Tốc độ đi của khách (pixel/giây). Nhỏ = đi chậm hơn.</summary>
    public int WalkSpeed { get; set; } = 200;

    /// <summary>
    /// Sân khấu tự sinh động khi vắng: khách mời (NPC, tên "Khách N") tự lên chúc mừng, nói chuyện, tim bay.
    /// KHÔNG tạo quà/người xem giả, không tính bảng xếp hạng / thanh tình yêu. Có quà/bình luận thật là dừng ngay.
    /// </summary>
    public bool IdleActivity { get; set; } = true;

    /// <summary>Bao nhiêu giây không có quà/bình luận thật thì khách mời bắt đầu tự hoạt động.</summary>
    public int IdleAfterSeconds { get; set; } = 6;

    /// <summary>Khoảng cách trung bình (giây) giữa 2 hoạt động của khách mời.</summary>
    public int IdleEverySeconds { get; set; } = 20;
    /// <summary>Khoảng mỗi N giây có 1 khách ảo (nhãn tím) lên tặng quà. 0 = tắt. Có quà thật thì khách ảo nhường.</summary>
    public int NpcGiftEverySeconds { get; set; } = 20;

    /// <summary>Phát nhạc cưới khi vắng quà thật.</summary>
    public bool MusicEnabled { get; set; } = true;
    /// <summary>Hết 1 bài thì sau chừng này giây phát bài tiếp (phát liên tục, kể cả khi có quà).</summary>
    public int MusicEverySeconds { get; set; } = 15;
    /// <summary>true = có quà thật thì tắt nhạc; false (mặc định) = nhạc vẫn chạy, MC đọc quà thì nhạc nhỏ lại.</summary>
    public bool MusicStopOnGift { get; set; } = false;
    /// <summary>Thanh tình yêu đầy => phát nhạc cho cô dâu chú rể khiêu vũ trong chừng này giây.</summary>
    public int DanceMusicSeconds { get; set; } = 60;
    /// <summary>Âm lượng nhạc 0 - 1 (MC nói thì nhạc tự nhỏ lại).</summary>
    public double MusicVolume { get; set; } = 0.25;
    /// <summary>Khi MC nói, nhạc giảm còn tỉ lệ này của âm lượng nhạc (0.12 = còn 12%) để giọng MC rõ.</summary>
    public double MusicDuck { get; set; } = 0.12;
    /// <summary>Bài (file) dài hơn thì nhỏ dần rồi dừng sau chừng này giây.</summary>
    public int MusicMaxSeconds { get; set; } = 90;

    /// <summary>Thời gian giãn cách (ms) giữa 2 sự kiện quà gửi xuống trình duyệt.</summary>
    public int DispatchDelayMs { get; set; } = 250;
}
