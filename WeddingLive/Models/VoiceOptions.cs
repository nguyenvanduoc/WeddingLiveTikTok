namespace WeddingLive.Models;

/// <summary>
/// Cấu hình giọng đọc (MC ảo), mục "Voice" trong appsettings.json.
/// Các câu nói dùng biến: {bride} {groom} {name} {count} {gift} {names}.
/// </summary>
public class VoiceOptions
{
    public const string Section = "Voice";

    public bool Enabled { get; set; } = true;

    /// <summary>
    /// auto        = có AzureKey => Azure; có GoogleCloudKey => Google Cloud; không có key => Google Translate
    /// google      = Google Translate TTS (miễn phí, không cần key, 1 giọng nữ)
    /// azure       = Azure Speech (giọng AI tự nhiên HoaiMy/NamMinh, cần key, miễn phí 500k ký tự/tháng)
    /// googlecloud = Google Cloud Text-to-Speech (giọng Neural2/WaveNet, cần API key)
    /// browser     = giọng có sẵn của trình duyệt/Windows (không qua server)
    /// </summary>
    public string Provider { get; set; } = "auto";

    public string AzureKey { get; set; } = "";
    public string AzureRegion { get; set; } = "southeastasia";
    /// <summary>vi-VN-HoaiMyNeural (nữ) hoặc vi-VN-NamMinhNeural (nam).</summary>
    public string AzureVoice { get; set; } = "vi-VN-HoaiMyNeural";

    public string GoogleCloudKey { get; set; } = "";
    /// <summary>vi-VN-Neural2-A (nữ), vi-VN-Neural2-D (nam), vi-VN-Wavenet-A..D...</summary>
    public string GoogleCloudVoice { get; set; } = "vi-VN-Neural2-A";

    /// <summary>Tốc độ đọc: 1.0 = bình thường, 1.5 = nhanh 1,5 lần, 3.0 = nhanh gấp 3 (0.5 - 3.0). Áp dụng cho mọi giọng.</summary>
    public double Speed { get; set; } = 2.5;

    public double ClampedSpeed => Math.Clamp(Speed <= 0 ? 1 : Speed, 0.5, 3.0);

    /// <summary>Âm lượng 0.0 - 1.0.</summary>
    public double Volume { get; set; } = 1.0;

    /// <summary>Lặng bao nhiêu giây thì MC tự nói 1 câu dẫn (0 = tắt). Nhỏ = MC nói liên tục.</summary>
    public int AnnounceIntervalSeconds { get; set; } = 3;

    public bool ThankFollow { get; set; } = true;

    // Để trống (null) trong appsettings => dùng câu mặc định bên dưới. Câu dẫn có {top1} (người tặng
    // nhiều nhất) chỉ được đọc khi đã có người tặng quà.
    // (Không gán sẵn giá trị cho List vì config binder sẽ cộng dồn thay vì thay thế.)
    public List<string>? Announcements { get; set; }
    public List<string>? GiftThanks { get; set; }
    public List<string>? BigGiftThanks { get; set; }
    /// <summary>Đọc khi khách bắt đầu lên sân khấu tặng quà: tên người tặng + quà gì.</summary>
    public List<string>? GiftAnnounce { get; set; }
    public List<string>? FollowThanks { get; set; }

    /// <summary>Khích lệ khi thanh tình yêu được 50% / 80%. Biến: {points} {left} {next}.</summary>
    public List<string>? MeterCheer { get; set; }
    /// <summary>Đọc khi cô dâu chú rể ôm nhau + hôn nhẹ.</summary>
    public List<string>? HugLines { get; set; }
    /// <summary>Đọc khi cô dâu chú rể khiêu vũ.</summary>
    public List<string>? DanceLines { get; set; }

    /// <summary>Tên quà TikTok (tiếng Anh) -> cách đọc tiếng Việt.</summary>
    public Dictionary<string, string>? GiftNames { get; set; }

    // ------------------------- Câu mặc định -------------------------

    public static readonly string[] DefaultAnnouncements =
    {
        "Kính thưa quý vị, chào mừng quý vị đến với lễ thành hôn của cô dâu {bride} và chú rể {groom}.",
        "Hôm nay là ngày trọng đại của {bride} và {groom}. Xin chân thành cảm ơn quý vị đã đến chung vui.",
        "Tặng một bông hồng là được mời lên sân khấu chúc phúc cô dâu chú rể ngay nhé!",
        "Tình yêu của {bride} và {groom} đã đơm hoa kết trái. Xin mời quý vị gửi lời chúc tốt đẹp nhất tới đôi uyên ương.",
        "Xin mời quý vị cùng nâng ly, chúc cô dâu chú rể trăm năm hạnh phúc, đầu bạc răng long.",
        "Mỗi món quà là một lời chúc phúc quý giá dành cho {bride} và {groom}. Gia đình xin chân thành cảm ơn.",
        "Hiện tại người tặng quà nhiều nhất là {top1}. Xin cảm ơn {top1} rất nhiều!",
        "Ai sẽ vượt qua {top1} để dẫn đầu bảng tặng quà hôm nay đây?",
        "Năm mươi khách mời đang ngồi chờ quý vị đó. Tặng quà để mời một người lên chúc mừng cô dâu chú rể nhé!",
        "Đừng quên thả tim và theo dõi kênh để cùng chung vui trọn vẹn buổi lễ hôm nay.",
        "Cô dâu {bride} hôm nay thật xinh đẹp, chú rể {groom} thật bảnh bao. Quý vị thấy có đẹp đôi không nào?",
        "Bình luận lời chúc của bạn, khách mời sẽ đọc to lời chúc đó ngay trên màn hình!",
        "Quà càng lớn, pháo hoa càng rực rỡ. Cùng làm sáng bừng lễ cưới của {bride} và {groom} nhé!",
        "Chúc cho {bride} và {groom} luôn yêu thương, nhường nhịn và sớm có tin vui!",
        "Thanh tình yêu đang có {points} điểm. Còn {left} điểm nữa là {next}. Tặng quà để xem nhé!",
        "Quý vị muốn xem cô dâu chú rể ôm hôn và khiêu vũ không? Hãy tặng quà để làm đầy thanh tình yêu nào!"
    };

    public static readonly string[] DefaultGiftThanks =
    {
        "Cảm ơn {name} đã tặng {count} {gift} chúc mừng cô dâu chú rể!",
        "Xin cảm ơn {name} đã gửi {count} {gift}. Chúc bạn luôn vui vẻ và hạnh phúc!",
        "{name} vừa tặng {count} {gift} cho {bride} và {groom}. Cảm ơn bạn rất nhiều!",
        "Cô dâu chú rể xin cảm ơn {name} vì {count} {gift} thật dễ thương!"
    };

    public static readonly string[] DefaultBigGiftThanks =
    {
        "Ôi tuyệt vời quá! {name} đã tặng {count} {gift}! Cô dâu chú rể xin gửi lời cảm ơn chân thành nhất tới {name}!",
        "Xin một tràng pháo tay thật lớn cho {name} với món quà {gift} vô cùng ý nghĩa! Cảm ơn bạn rất nhiều!",
        "Wow! {count} {gift} từ {name}! {bride} và {groom} vô cùng cảm động. Chúc {name} luôn may mắn và hạnh phúc!"
    };

    public static readonly string[] DefaultGiftAnnounce =
    {
        "Mời {name} lên tặng {count} {gift}!",
        "{name} tặng {count} {gift} cho cô dâu chú rể!",
        "Xin mời {name} mang {count} {gift} lên chúc mừng {bride} và {groom}!",
        "Cảm ơn {name} đã tặng {count} {gift}!"
    };

    public static readonly string[] DefaultFollowThanks =
    {
        "Cảm ơn {name} đã theo dõi kênh!",
        "Chào mừng {name} đã đến chung vui cùng cô dâu chú rể!"
    };

    public static readonly string[] DefaultMeterCheer =
    {
        "Chỉ còn {left} điểm nữa là {next}! Tặng quà ngay nào quý vị ơi!",
        "Cố lên nào, thêm {left} điểm nữa thôi là {next}!",
        "Thanh tình yêu đã được {points} điểm rồi! Còn {left} điểm nữa là {next}. Ai giúp cô dâu chú rể nào?",
        "Một bông hồng là một điểm cho thanh tình yêu. Còn {left} điểm nữa là {next}!"
    };

    public static readonly string[] DefaultHugLines =
    {
        "Ôi ngọt ngào quá! Cô dâu chú rể đã ôm nhau và trao nhau nụ hôn nhẹ! Cảm ơn quý vị đã tặng quà!",
        "Thanh tình yêu đã đủ! {bride} và {groom} ôm nhau thật tình cảm! Thêm {left} điểm nữa là hai bạn sẽ khiêu vũ đó nha!"
    };

    public static readonly string[] DefaultDanceLines =
    {
        "Tuyệt vời! Thanh tình yêu đã đầy! Xin mời cô dâu {bride} và chú rể {groom} cùng nhảy điệu valse tình yêu!",
        "Âm nhạc lên nào! Cô dâu chú rể khiêu vũ rồi! Xin một tràng pháo tay thật lớn và cảm ơn tất cả quý vị đã tặng quà!"
    };

    public static readonly Dictionary<string, string> DefaultGiftNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Rose"] = "bông hồng",
        ["Heart Me"] = "trái tim",
        ["Finger Heart"] = "trái tim ngón tay",
        ["Hand Hearts"] = "trái tim bàn tay",
        ["Heart"] = "trái tim",
        ["Love you"] = "lời yêu thương",
        ["TikTok"] = "logo TikTok",
        ["Ice Cream Cone"] = "cây kem",
        ["Doughnut"] = "bánh donut",
        ["Cake Slice"] = "miếng bánh kem",
        ["Perfume"] = "chai nước hoa",
        ["GG"] = "GG",
        ["Rainbow"] = "cầu vồng",
        ["Confetti"] = "pháo giấy",
        ["Sunglasses"] = "kính râm",
        ["Corgi"] = "chú chó Corgi",
        ["Swan"] = "thiên nga",
        ["Money Gun"] = "súng bắn tiền",
        ["Galaxy"] = "dải ngân hà",
        ["Sports Car"] = "siêu xe",
        ["Rocket"] = "tên lửa",
        ["Lion"] = "chú sư tử",
        ["Universe"] = "vũ trụ",
        ["Ring"] = "nhẫn cưới",
        ["Crown"] = "vương miện"
    };
}
