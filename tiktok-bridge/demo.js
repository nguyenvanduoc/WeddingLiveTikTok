// =====================================================================
//  CHẾ ĐỘ DEMO – không cần live TikTok
//  Tự tạo quà / bình luận / tim / follow giả và gửi sang server .NET
//  giống hệt dữ liệu thật, để test sân khấu + giọng MC + bảng xếp hạng.
//  Bật khi: TIKTOK_USERNAME để trống / còn là "ten_tiktok_cua_ban", hoặc DEMO=true
// =====================================================================

// ---- Tên người tặng: ghép ngẫu nhiên => hàng trăm tên khác nhau, không lặp trong 20 lượt gần nhất ----
const GIVEN = ['Lan Phương', 'Tuấn Anh', 'Mai Chi', 'Quốc Bảo', 'Thu Trang', 'Đức Huy', 'Ngọc Hân', 'Minh Khang',
  'Bảo Ngọc', 'Gia Hưng', 'Khánh Linh', 'Văn Toàn', 'Thảo Vy', 'Hải Đăng', 'Phương Anh', 'Hoàng Nam', 'Thanh Tâm',
  'Kim Ngân', 'Trung Kiên', 'Yến Nhi', 'Minh Thư', 'Đăng Khoa', 'Bích Ngọc', 'Hữu Phước', 'Tường Vi', 'Anh Thư',
  'Quang Huy', 'Như Ý', 'Thùy Dung', 'Công Danh', 'Mỹ Linh', 'Tấn Phát', 'Hồng Nhung', 'Gia Bảo', 'Tú Anh', 'Văn Hậu'];
const SURNAME = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const NICK = ['bé', 'chị', 'anh', 'em', 'cô', 'mẹ', 'bố'];
const DECOR = ['🌸', '💕', '✨', '🍀', '🌷', '⭐', '🦋', '🐰'];
const recentNames = [];

function randomName() {
  for (let i = 0; i < 20; i++) {
    const g = rnd(GIVEN), first = g.split(' ').pop();
    const r = Math.random();
    const name = r < 0.35 ? g
      : r < 0.55 ? `${rnd(SURNAME)} ${g}`
      : r < 0.7 ? `${rnd(NICK)} ${first} ${rnd(DECOR)}`
      : r < 0.85 ? `${slug(g)}${between(1, 9999)}`                       // kiểu tên @ TikTok
      : `${rnd(DECOR)} ${first} ${rnd(['xinh', 'cute', 'iu', 'bùi', 'nè', 'đây'])}`;
    if (!recentNames.includes(name)) {
      recentNames.push(name);
      if (recentNames.length > 20) recentNames.shift();
      return name;
    }
  }
  return rnd(GIVEN) + ' ' + between(10, 99);
}

// ---- Quà: [tên quà TikTok, kim cương/cái, trọng số] — nhiều loại, Rose bớt dày đặc ----
const GIFTS = [
  ['Rose', 1, 14], ['Heart Me', 1, 8], ['Finger Heart', 5, 8], ['TikTok', 1, 6], ['Ice Cream Cone', 1, 5],
  ['GG', 1, 4], ['Love you', 1, 4], ['Cake Slice', 1, 4], ['Doughnut', 30, 4], ['Perfume', 20, 4],
  ['Sunglasses', 199, 2], ['Hand Hearts', 100, 2], ['Confetti', 100, 2], ['Corgi', 299, 1.5], ['Rainbow', 199, 1.5],
  ['Money Gun', 500, 1], ['Swan', 699, 1], ['Galaxy', 1000, 0.6], ['Sports Car', 7000, 0.3], ['Lion', 29999, 0.15]
];
const COUNTABLE = ['Rose', 'Heart Me', 'TikTok', 'Ice Cream Cone', 'GG', 'Love you', 'Cake Slice', 'Finger Heart'];

const COMMENTS = ['Chúc mừng hạnh phúc! 🥰', 'Cô dâu xinh quá 😍', 'Trăm năm hạnh phúc nha', 'Chú rể đẹp trai ghê',
  'Sớm có em bé nha 👶', 'Đẹp đôi quá trời', 'Hạnh phúc mãi mãi nhé ❤️', 'Chúc hai bạn bên nhau trọn đời'];

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]/gi, '').toLowerCase();

const recentGifts = [];
function weightedGift() {
  const total = GIFTS.reduce((t, g) => t + g[2], 0);
  for (let i = 0; i < 10; i++) {
    let r = Math.random() * total, pick = GIFTS[0];
    for (const g of GIFTS) { if ((r -= g[2]) <= 0) { pick = g; break; } }
    // không ra 1 món quá 2 lần liên tiếp
    if (!(recentGifts.length >= 2 && recentGifts.slice(-2).every(n => n === pick[0]))) {
      recentGifts.push(pick[0]);
      if (recentGifts.length > 5) recentGifts.shift();
      return pick;
    }
  }
  return GIFTS[between(0, 9)];
}

export function runDemo({ post, server, intervalMs = 15000 }) {
  console.log('==================================================');
  console.log('🧪 CHẾ ĐỘ DEMO – chưa điền TIKTOK_USERNAME trong tiktok-bridge/.env');
  console.log(`   Tự tạo quà/bình luận giả khoảng mỗi ${intervalMs / 1000}s và gửi tới ${server}`);
  console.log('   Muốn kết nối live thật: điền TIKTOK_USERNAME trong .env rồi chạy lại.');
  console.log('   Bấm Ctrl+C để dừng.');
  console.log('==================================================');

  const status = (connected, message) => post('status', { connected, username: 'DEMO', message });
  status(true, 'Chế độ DEMO (quà giả)');

  function tick() {
    const user = randomName();
    const base = { userId: slug(user), nickname: user };
    const r = Math.random();

    if (r < 0.65) {
      const [giftName, diamondValue] = weightedGift();
      const count = COUNTABLE.includes(giftName) ? rnd([1, 1, 1, 2, 3, 5, 5, 10, 15, 20, 30]) : 1;
      console.log(`🎁 [DEMO] ${user} tặng ${count} x ${giftName}`);
      post('gift', { ...base, giftName, count, diamondValue });
    } else if (r < 0.8) {
      const comment = rnd(COMMENTS);
      console.log(`💬 [DEMO] ${user}: ${comment}`);
      post('chat', { ...base, comment });
    } else if (r < 0.93) {
      console.log(`👋 [DEMO] ${user} vào xem live`);
      post('social', { ...base, action: 'join' });
    } else {
      console.log(`⭐ [DEMO] ${user} theo dõi`);
      post('social', { ...base, action: 'follow' });
    }
    // nhịp ngẫu nhiên 60% - 140% của intervalMs cho tự nhiên
    setTimeout(tick, intervalMs * (0.6 + Math.random() * 0.8));
  }

  setTimeout(tick, 1500);
  setInterval(() => post('like', { userId: '', nickname: randomName(), likeCount: between(3, 15) }), 2500);

  process.on('SIGINT', async () => {
    console.log('\n👋 Dừng DEMO');
    await status(false, 'Bridge đã dừng');
    process.exit(0);
  });
}
