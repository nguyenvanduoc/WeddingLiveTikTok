# 💍 Đám Cưới Online – TikTok Live

Game đám cưới chạy trên web (ASP.NET Core 8 + Phaser 3 + SignalR), kết nối với **TikTok Live**:

- Cô dâu chú rể đứng trên sân khấu, **5 bàn tròn × 10 khách ngồi** + **6 khách đứng** hai bên sân khấu (đều chỉnh được).
- Có người **tặng quà** trên live → 1 khách **đổi tên theo người tặng**, cầm quà đi lên tặng cô dâu chú rể rồi về chỗ.
- Quà lớn (≥ 99💎) → pháo hoa, chớp sáng, cô dâu chú rể nhảy lên.
- **Bình luận** → khách nói bong bóng chat. **Thả tim** → tim bay. **Follow/Share** → thông báo.
- Bảng **Top tặng quà**, hàng đợi khi đông, combo (Rose x15) được gộp thành 1 lượt.
- **MC ảo đọc tiếng Việt**: tự giới thiệu đám cưới khi sân khấu yên lặng, cảm ơn từng người tặng quà / follow, admin gõ câu cho MC đọc.

![Sân khấu](docs/stage.png)

## Kiến trúc

```
TikTok Live ──► tiktok-bridge (Node.js) ──HTTP POST──► WeddingLive (.NET) ──SignalR──► Trang sân khấu (Phaser)
                TikFinity / Streamer.bot ──webhook──┘                         └──────► Trang admin
                                                                     OBS / TikTok LIVE Studio quay trang sân khấu
```

| Thư mục | Nội dung |
|---|---|
| `WeddingLive/` | Server ASP.NET Core: API nhận sự kiện, hàng đợi quà, SignalR hub, web tĩnh |
| `WeddingLive/wwwroot/index.html` | Sân khấu game (dùng làm Browser Source) |
| `WeddingLive/wwwroot/admin.html` | Bảng điều khiển: giả lập quà, xem trạng thái bridge |
| `tiktok-bridge/` | Script Node.js đọc TikTok Live bằng `tiktok-live-connector` |

## ⚡ Chạy nhanh trên Windows

| File (bấm đúp ở thư mục gốc) | Làm gì |
|---|---|
| `start.bat` | Tắt server cũ → chạy server .NET + TikTok bridge (2 cửa sổ) → mở trang điều khiển. Lần đầu tự `npm install` và mở `.env` để điền tên TikTok |
| `start-server.bat` | Chỉ chạy server (test bằng trang admin, không cần live) |

Hoặc gõ lệnh **ở thư mục gốc** `WeddingLiveTikTok`:

| Lệnh | Tương đương |
|---|---|
| `npm run server` | tắt server cũ rồi `dotnet run --project WeddingLive` |
| `npm run setup` | `npm install` trong `tiktok-bridge` (chạy 1 lần) |
| `npm start` | chạy TikTok bridge (tự cài thư viện; chưa điền tên TikTok thì chạy DEMO) |

### 🧪 Chế độ DEMO (test không cần live)

Chưa điền `TIKTOK_USERNAME` trong `tiktok-bridge/.env` (file tự tạo lần đầu chạy) → bridge tự tạo **quà, bình luận, tim, follow giả**
khoảng mỗi 5 giây, gửi vào server y như dữ liệu thật. Điền tên TikTok vào `.env` là chuyển sang live thật.
Đặt `DEMO=true` để luôn chạy demo, `DEMO_INTERVAL_MS` để chỉnh nhịp.

## Chạy thử (không cần live)

Yêu cầu: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

```bash
cd WeddingLive
dotnet run
```

- Sân khấu: http://localhost:5000
- Điều khiển: http://localhost:5000/admin.html → bấm **10 quà ngẫu nhiên** để xem khách đi lên tặng quà.

Hoặc mở `WeddingLive.sln` bằng Visual Studio rồi F5.

## Kết nối TikTok Live thật

### Cách 1 – tiktok-bridge (khuyên dùng)

Yêu cầu Node.js 18+.

```bash
cd tiktok-bridge
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

Sửa `.env`: `TIKTOK_USERNAME` = tên TikTok đang live, `SERVER_URL` = địa chỉ server .NET.
Nên đăng ký `EULER_API_KEY` miễn phí ở https://www.eulerstream.com (dịch vụ ký request mà thư viện dùng, không có key dễ bị giới hạn).

```bash
npm start
```

Bắt đầu live trên TikTok trước, bridge sẽ tự kết nối lại mỗi 5s → 60s cho đến khi bạn lên sóng.
Trang admin hiện 🟢 khi đã kết nối.

### Cách 2 – TikFinity / Streamer.bot

Tạo action "Webhook" (GET) khi nhận quà, gọi:

```
http://localhost:5000/api/events/webhook/gift?key=API_KEY&username={username}&nickname={nickname}&gift={giftname}&count={repeatcount}&coins={coins}
```

(tên placeholder `{...}` tùy phần mềm, xem tài liệu của TikFinity/Streamer.bot).

## Đưa lên live (OBS / TikTok LIVE Studio)

1. Thêm nguồn **Browser Source**, URL `http://localhost:5000`, kích thước **1280 × 720**.
2. Muốn nền trong suốt để chồng lên camera: `http://localhost:5000/?bg=0`.
3. Live dọc 9:16: đặt Browser Source 1280×720 rồi crop/scale theo ý, hoặc sửa `W, H` trong `wwwroot/js/game.js`.

## 🎙️ MC ảo (giọng đọc)

- Cứ **60 giây yên lặng** MC đọc 1 câu giới thiệu (lần lượt các câu trong `Voice:Announcements`).
- Khách trao quà xong → MC **cảm ơn** người tặng ("Cảm ơn Lan Phương đã tặng 15 bông hồng…").
  Quà lớn có câu riêng; nhiều quà dồn dập được gộp: "Cảm ơn Bảo, Mai, Hân và 2 bạn khác…".
- Follow → "Cảm ơn … đã theo dõi kênh!".
- Trang admin: gõ câu bất kỳ → **📢 Đọc trên sân khấu**, hoặc **🎧 Nghe thử ở đây**.

Giọng đọc (`Voice:Provider`):

| Giá trị | Mô tả |
|---|---|
| `auto` (mặc định) | Có `AzureKey` thì dùng Azure, không thì Google |
| `google` | Google Translate TTS – miễn phí, không cần key (dịch vụ không chính thức) |
| `azure` | Azure Speech – giọng AI tự nhiên `vi-VN-HoaiMyNeural` (nữ) / `vi-VN-NamMinhNeural` (nam). Tạo resource **Speech** trên portal.azure.com (gói F0 miễn phí 500.000 ký tự/tháng), điền `AzureKey` + `AzureRegion` |
| `googlecloud` | Google Cloud Text-to-Speech – giọng `vi-VN-Neural2-A` (nữ) / `vi-VN-Neural2-D` (nam), `vi-VN-Wavenet-A..D`. Cần API key (console.cloud.google.com → bật *Cloud Text-to-Speech API* → Credentials → API key), điền `GoogleCloudKey` |
| `browser` | Giọng có sẵn của Windows/trình duyệt (OBS không thu riêng được, phải thu Desktop Audio) |

**Tốc độ đọc:** `Voice:Speed` (mặc định `1.2` = nhanh hơn 20%; `1.0` bình thường; `1.4` rất nhanh). Azure/Google Cloud chỉnh tốc độ ngay khi tạo giọng;
giọng Google miễn phí thì trình duyệt phát nhanh hơn mà vẫn giữ cao độ.
Giọng có key bị lỗi (sai key, hết hạn mức) → server tự dùng tạm giọng Google miễn phí, trang admin hiện lý do.

**Để giọng MC lên live:**
- OBS: Browser Source → tick **Control audio via OBS** (tiếng đi vào mixer của OBS).
- TikTok LIVE Studio (Window capture Chrome): thêm nguồn âm thanh hệ thống / Desktop audio.
- Chrome thường chặn tự phát âm thanh → trên sân khấu hiện nút **🔊 Bấm để bật giọng MC**, bấm 1 lần là được.
- Khung xem trước trong admin đã tắt tiếng (`?voice=0`) để không phát trùng.

**Không nghe thấy giọng?** Vào trang admin → mục 🎙️ MC ảo → bấm **🩺 Kiểm tra giọng**. Hay gặp nhất:

1. Chỉ mở trang admin: khung xem trước ở admin **mặc định tắt tiếng**. Mở `http://localhost:5000/` ở tab khác (hoặc OBS), hoặc tick **🔊 Bật tiếng khung xem trước này**.
2. OBS đã tick *Control audio via OBS* → tiếng vào luồng live nhưng **không ra loa máy bạn**. Audio Mixer → ⚙ *Advanced Audio Properties* → *Audio Monitoring* = **Monitor and Output**.
3. Chrome chặn tự phát → bấm nút **🔊 Bấm để bật giọng MC** trên trang sân khấu.
4. Server không lấy được giọng → xem dòng `TTS (...) lỗi` trong cửa sổ `dotnet run`.

Sửa câu nói trong `appsettings.json` → mục `Voice` (biến: `{bride}` `{groom}` `{name}` `{count}` `{gift}` `{names}`),
cách đọc tên quà ở `Voice:GiftNames` (ví dụ `"Rose": "bông hồng"`).

## Cấu hình – `WeddingLive/appsettings.json`

```json
"Wedding": {
  "Title": "Đám Cưới Online",
  "BrideName": "Ngọc Anh",
  "GroomName": "Minh Đức",
  "GuestCount": 6,           // khách đứng: 0 - 12 hai bên sân khấu (nếu Tables = 0 thì 4 - 24 hai bên lối đi)
  "Tables": 5,               // số bàn tròn 0 - 5
  "GuestsPerTable": 10,      // khách ngồi mỗi bàn 4 - 12
  "ApiKey": "",              // đặt khóa bí mật khi chạy trên server public
  "BigGiftDiamonds": 99,     // từ mức này trở lên bắn pháo hoa
  "DispatchDelayMs": 250     // giãn cách giữa 2 quà
}
```

Sửa file khi app đang chạy là có hiệu lực ngay (F5 trang sân khấu để đổi tên/số khách).

## API

Tất cả `/api/events/*` yêu cầu header `X-Api-Key` (hoặc `?key=`) nếu `ApiKey` khác rỗng.

| Method | URL | Body |
|---|---|---|
| POST | `/api/events/gift` | `{ userId, nickname, avatarUrl?, giftName, count, diamondValue }` |
| POST | `/api/events/chat` | `{ userId, nickname, comment }` |
| POST | `/api/events/like` | `{ userId, nickname, likeCount }` |
| POST | `/api/events/social` | `{ userId, nickname, action: "follow" \| "share" \| "join" }` |
| POST | `/api/events/status` | `{ connected, username, message }` (bridge báo trạng thái) |
| POST | `/api/events/reset` | xóa bảng xếp hạng + tên khách |
| GET | `/api/events/webhook/gift` | query `username, nickname, gift, count, coins` |
| GET | `/api/config` | cấu hình cho sân khấu |
| GET | `/api/voice/config` | cấu hình giọng đọc + câu nói |
| GET | `/api/tts?text=...` | trả file MP3 đọc câu đó |
| POST | `/api/events/speak` | `{ text }` – MC đọc ngay trên sân khấu |
| WS | `/hub/wedding` | SignalR: `GiftReceived`, `ChatReceived`, `LikeReceived`, `SocialReceived`, `Leaderboard`, `BridgeStatus`, `ResetStage`, `Speak` |

Test nhanh bằng curl:

```bash
curl -X POST http://localhost:5000/api/events/gift -H "Content-Type: application/json" -d '{"userId":"lan","nickname":"Lan","giftName":"Rose","count":10,"diamondValue":1}'
```

## Tùy biến

- **Hình nhân vật**: đang vẽ bằng code trong `wwwroot/js/characters.js`. Muốn dùng ảnh/sprite riêng, thay phần vẽ trong `makePerson()` bằng `scene.add.sprite(...)`.
- **Emoji quà**: bảng `GIFT_EMOJI` trong `wwwroot/js/game.js`.
- **Lưu ý**: `tiktok-live-connector` là thư viện không chính thức, TikTok đổi giao thức thì cần `npm update`.
