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
    public double Speed { get; set; } = 2.0;

    public double ClampedSpeed => Math.Clamp(Speed <= 0 ? 1 : Speed, 0.5, 3.0);

    /// <summary>Âm lượng 0.0 - 1.0.</summary>
    public double Volume { get; set; } = 1.0;

    /// <summary>Lặng bao nhiêu giây thì MC tự nói 1 câu dẫn (0 = tắt). Nhỏ = MC nói liên tục.</summary>
    public int AnnounceIntervalSeconds { get; set; } = 3;

    public bool ThankFollow { get; set; } = true;

    /// <summary>MC chào nhanh người mới vào phòng live ("Hello {names}!").</summary>
    public bool GreetJoin { get; set; } = true;
    /// <summary>Mẫu câu chào người vào phòng. Biến: {names}.</summary>
    public List<string>? JoinGreetings { get; set; }

    /// <summary>MC ưu tiên đọc bình luận trên live (đọc trước câu dẫn và câu đọc tên người tặng quà).</summary>
    public bool ReadChat { get; set; } = true;
    /// <summary>Số bình luận chờ đọc tối đa; nhiều hơn thì bỏ bình luận cũ nhất (chống spam).</summary>
    public int MaxPendingChats { get; set; } = 4;
    /// <summary>Bình luận dài hơn thì cắt bớt.</summary>
    public int MaxChatLength { get; set; } = 100;
    /// <summary>Mẫu câu đọc bình luận. Biến: {name} {comment}.</summary>
    public List<string>? ChatTemplates { get; set; }
    /// <summary>Từ cấm: bình luận/tên có từ này thì không đọc, không hiện bong bóng.
    /// Từ ngắn (≤ 3 ký tự) so khớp nguyên từ, từ dài so khớp một phần; không phân biệt dấu.</summary>
    public List<string>? BannedWords { get; set; }

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
    /// <summary>MC mời gọi người xem khi sân khấu đang vắng (khách mời tự hoạt động).</summary>
    public List<string>? IdleLines { get; set; }
    /// <summary>MC đọc khi khách mời trong tiệc lên chúc mừng. Biến: {name} (tên vai) {offer} (quà).</summary>
    public List<string>? NpcLines { get; set; }
    /// <summary>MC giới thiệu trước khi phát nhạc cưới.</summary>
    public List<string>? MusicLines { get; set; }
    /// <summary>Câu chúc / câu nói hay về đám cưới: MC xen kẽ với câu dẫn, cả trong lúc có nhạc.</summary>
    public List<string>? WeddingQuotes { get; set; }

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

    public static readonly string[] DefaultIdleLines =
    {
        "Mọi người ơi, hãy tặng gì đó để chúc mừng cô dâu và chú rể đi nào!",
        "Cả nhà ơi, tặng một bông hồng để chúc mừng {bride} và {groom} đi mọi người!",
        "Sân khấu đang chờ quý vị đó! Hãy tặng gì đó để chúc mừng cô dâu chú rể nhé!",
        "Mỗi món quà là một lời chúc phúc. Mọi người tặng quà chúc mừng cô dâu chú rể đi nào!",
        "Khách mời đang lên chúc mừng cô dâu chú rể. Quý vị trên live tặng một bông hồng là cũng được mời lên sân khấu đó!",
        "Bà con cô bác đang chúc phúc rộn ràng! Bạn ơi, bình luận lời chúc của bạn để MC đọc to lên nhé!",
        "Không khí tiệc cưới đang rất vui! Thả tim cho cô dâu chú rể nào quý vị ơi!",
        "Ai vừa vào live thì bấm theo dõi và gửi lời chúc cho {bride} và {groom} nha!",
        "Các khách mời đã lên chúc phúc rồi, còn bạn thì sao? Tặng quà để tên bạn xuất hiện trên sân khấu nhé!"
    };

    public static readonly string[] DefaultNpcLines =
    {
        "{name} lên trao {offer} mừng cô dâu chú rể!",
        "{name} mang {offer} lên chúc phúc {bride} và {groom}!",
        "Cảm ơn {name} đã lên chúc mừng đôi uyên ương!"
    };

    public static readonly string[] DefaultJoinGreetings = { "Hello {names}!", "Chào {names}!", "Hello {names}, vào chung vui nha!", "Chào mừng {names}!" };

    public static readonly string[] DefaultMusicLines =
    {
        "Xin mời quý vị cùng thưởng thức một bản nhạc cưới thật lãng mạn!",
        "Âm nhạc lên nào! Chúc cho {bride} và {groom} trăm năm hạnh phúc!",
        "Cùng lắng nghe giai điệu tình yêu dành tặng cô dâu chú rể nhé!"
    };

    public static readonly string[] DefaultWeddingQuotes =
    {
        "Hôn nhân không phải là tìm được một người hoàn hảo, mà là cùng nhau vượt qua những điều chưa hoàn hảo.",
        "Chúc {bride} và {groom} mãi nắm tay nhau như ngày đầu tiên gặp gỡ.",
        "Hạnh phúc là mỗi sáng thức dậy, bên cạnh mình là người mình thương.",
        "Một chữ duyên để gặp gỡ, một chữ nợ để gắn bó. Chúc đôi uyên ương trọn vẹn cả duyên lẫn nợ.",
        "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng.",
        "Ông bà ta nói: thuận vợ thuận chồng, tát biển Đông cũng cạn.",
        "Chúc cô dâu chú rể chăn ấm nệm êm, nhà cửa lúc nào cũng đầy tiếng cười trẻ thơ.",
        "Gia đình là nơi yêu thương bắt đầu và không bao giờ có điểm kết thúc.",
        "Yêu nhau là cùng nhau lớn lên, cùng nhau già đi, và chưa bao giờ thôi thương nhau.",
        "Kính chúc hai bên gia đình nội ngoại thật nhiều sức khỏe, vui vầy bên con cháu.",
        "Trăm năm tình viên mãn, bạc đầu nghĩa phu thê.",
        "Chúc {bride} và {groom} luôn là nơi bình yên nhất của nhau.",
        "Hôn nhân hạnh phúc là khi mỗi ngày đều chọn yêu nhau thêm một lần nữa.",
        "Từ hôm nay, niềm vui sẽ được nhân đôi, còn nỗi buồn sẽ được chia một nửa.",
        "Cưới nhau là để có một người cùng mình đi qua tất cả những ngày bình thường.",
        "Chúc cho tổ ấm nhỏ của {bride} và {groom} luôn ngập tràn tiếng cười.",
        "Giữa hàng triệu người, tìm được nhau đã là may mắn, giữ được nhau là hạnh phúc.",
        "Một mái nhà, hai trái tim, trọn đời chung một lối đi.",
        "Chúc đôi bạn trẻ đầu bạc răng long, sớm có tin vui, làm ăn phát đạt.",
        "Tình yêu bắt đầu bằng ánh mắt, và được giữ gìn bằng sự thấu hiểu mỗi ngày.",
        "Cảm ơn quý vị đã cùng chứng kiến khoảnh khắc thiêng liêng này của {bride} và {groom}.",
        "Hạnh phúc không ở đâu xa, hạnh phúc là được nắm tay người mình yêu trong ngày hôm nay."
    };

    public static readonly string[] DefaultChatTemplates = { "{name} nói: {comment}", "{name} gửi lời chúc: {comment}", "Bạn {name} bình luận: {comment}" };

    public static readonly string[] DefaultBannedWords = { "địt", "đụ", "lồn", "cặc", "buồi", "đéo", "đếch", "đĩ", "vãi", "dm", "đm", "dmm", "đmm", "vcl", "vkl", "vl", "clm", "cc", "cmm", "đcm", "dcm", "fuck", "shit" };

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
