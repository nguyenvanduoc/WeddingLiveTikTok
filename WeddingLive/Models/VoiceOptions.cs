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

    /// <summary>Tốc độ đọc: 1.0 = bình thường, 1.2 = nhanh hơn 20% (0.5 - 2.0). Áp dụng cho mọi giọng.</summary>
    public double Speed { get; set; } = 1.2;

    public double ClampedSpeed => Math.Clamp(Speed <= 0 ? 1 : Speed, 0.5, 2.0);

    /// <summary>Âm lượng 0.0 - 1.0.</summary>
    public double Volume { get; set; } = 1.0;

    /// <summary>Lặng bao nhiêu giây thì MC đọc 1 câu giới thiệu (0 = tắt).</summary>
    public int AnnounceIntervalSeconds { get; set; } = 60;

    public bool ThankFollow { get; set; } = true;

    // Để trống (null) trong appsettings => dùng câu mặc định bên dưới.
    // (Không gán sẵn giá trị cho List vì config binder sẽ cộng dồn thay vì thay thế.)
    public List<string>? Announcements { get; set; }
    public List<string>? GiftThanks { get; set; }
    public List<string>? BigGiftThanks { get; set; }
    public List<string>? GroupThanks { get; set; }
    public List<string>? FollowThanks { get; set; }

    /// <summary>Tên quà TikTok (tiếng Anh) -> cách đọc tiếng Việt.</summary>
    public Dictionary<string, string>? GiftNames { get; set; }

    // ------------------------- Câu mặc định -------------------------

    public static readonly string[] DefaultAnnouncements =
    {
        "Kính thưa quý vị, chào mừng quý vị đến với lễ thành hôn của cô dâu {bride} và chú rể {groom}.",
        "Hôm nay là ngày trọng đại của {bride} và {groom}. Xin chân thành cảm ơn quý vị đã dành thời gian đến chung vui cùng hai bạn.",
        "Quý vị hãy tặng một bông hồng để được mời lên sân khấu, gửi lời chúc phúc tới cô dâu chú rể nhé.",
        "Tình yêu của {bride} và {groom} đã đơm hoa kết trái. Xin mời quý vị cùng gửi những lời chúc tốt đẹp nhất tới đôi uyên ương.",
        "Xin mời quý vị cùng nâng ly, chúc cho cô dâu chú rể trăm năm hạnh phúc, đầu bạc răng long.",
        "Mỗi món quà của quý vị là một lời chúc phúc quý giá dành cho {bride} và {groom}. Gia đình xin chân thành cảm ơn.",
        "Đừng quên thả tim và theo dõi kênh để cùng chung vui trọn vẹn buổi lễ hôm nay nhé."
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

    public static readonly string[] DefaultGroupThanks =
    {
        "Cảm ơn {names} đã gửi quà chúc mừng cô dâu chú rể!",
        "Xin cảm ơn {names}. Những món quà của các bạn làm buổi lễ thêm ấm áp!"
    };

    public static readonly string[] DefaultFollowThanks =
    {
        "Cảm ơn {name} đã theo dõi kênh!",
        "Chào mừng {name} đã đến chung vui cùng cô dâu chú rể!"
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
