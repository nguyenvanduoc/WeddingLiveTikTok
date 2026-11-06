// =====================================================================
//  CHẾ ĐỘ DEMO – không cần live TikTok
//  Tự tạo quà / bình luận / tim / follow giả và gửi sang server .NET
//  giống hệt dữ liệu thật, để test sân khấu + giọng MC + bảng xếp hạng.
//  Bật khi: TIKTOK_USERNAME để trống / còn là "ten_tiktok_cua_ban", hoặc DEMO=true
// =====================================================================

const NAMES = ['Lan Phương', 'Tuấn Anh', 'Bé Na 🌸', 'Hoàng Long', 'Mai Chi', 'Quốc Bảo', 'Thu Trang',
  'Đức Huy', 'Ngọc Hân', 'Minh Khang', 'Bảo Ngọc', 'Gia Hưng', 'Khánh Linh', 'Văn Toàn', 'Thảo Vy', 'Hải Đăng'];

// [tên quà TikTok, kim cương/cái, trọng số xuất hiện]
const GIFTS = [
  ['Rose', 1, 30], ['Heart Me', 1, 15], ['Finger Heart', 5, 12], ['TikTok', 1, 8],
  ['Perfume', 20, 6], ['Doughnut', 30, 5], ['Hand Hearts', 100, 3], ['Rainbow', 199, 2],
  ['Galaxy', 1000, 1], ['Lion', 29999, 0.3]
];

const COMMENTS = ['Chúc mừng hạnh phúc! 🥰', 'Cô dâu xinh quá 😍', 'Trăm năm hạnh phúc nha', 'Chú rể đẹp trai ghê',
  'Sớm có em bé nha 👶', 'Đẹp đôi quá trời', 'Hạnh phúc mãi mãi nhé ❤️', 'Chúc hai bạn bên nhau trọn đời'];

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]/gi, '').toLowerCase();

function weightedGift() {
  const total = GIFTS.reduce((s, g) => s + g[2], 0);
  let r = Math.random() * total;
  for (const g of GIFTS) { if ((r -= g[2]) <= 0) return g; }
  return GIFTS[0];
}

export function runDemo({ post, server, intervalMs = 9000 }) {
  console.log('==================================================');
  console.log('🧪 CHẾ ĐỘ DEMO – chưa điền TIKTOK_USERNAME trong tiktok-bridge/.env');
  console.log(`   Tự tạo quà/bình luận giả khoảng mỗi ${intervalMs / 1000}s và gửi tới ${server}`);
  console.log('   Muốn kết nối live thật: điền TIKTOK_USERNAME trong .env rồi chạy lại.');
  console.log('   Bấm Ctrl+C để dừng.');
  console.log('==================================================');

  const status = (connected, message) => post('status', { connected, username: 'DEMO', message });
  status(true, 'Chế độ DEMO (quà giả)');

  function tick() {
    const user = rnd(NAMES);
    const base = { userId: slug(user), nickname: user };
    const r = Math.random();

    if (r < 0.65) {
      const [giftName, diamondValue] = weightedGift();
      const count = giftName === 'Rose' || giftName === 'Heart Me' ? between(1, 20) : 1;
      console.log(`🎁 [DEMO] ${user} tặng ${count} x ${giftName}`);
      post('gift', { ...base, giftName, count, diamondValue });
    } else if (r < 0.88) {
      const comment = rnd(COMMENTS);
      console.log(`💬 [DEMO] ${user}: ${comment}`);
      post('chat', { ...base, comment });
    } else {
      console.log(`⭐ [DEMO] ${user} theo dõi`);
      post('social', { ...base, action: 'follow' });
    }
    // nhịp ngẫu nhiên 60% - 140% của intervalMs cho tự nhiên
    setTimeout(tick, intervalMs * (0.6 + Math.random() * 0.8));
  }

  setTimeout(tick, 1500);
  setInterval(() => post('like', { userId: '', nickname: rnd(NAMES), likeCount: between(3, 15) }), 2500);

  process.on('SIGINT', async () => {
    console.log('\n👋 Dừng DEMO');
    await status(false, 'Bridge đã dừng');
    process.exit(0);
  });
}
