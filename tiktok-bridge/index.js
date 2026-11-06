// =====================================================================
//  TikTok Live -> WeddingLive (.NET) bridge
//  Nghe sự kiện của 1 phòng live TikTok và POST sang server .NET:
//    gift   -> /api/events/gift
//    chat   -> /api/events/chat
//    like   -> /api/events/like
//    follow/share -> /api/events/social
//    trạng thái kết nối -> /api/events/status
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { runDemo } from './demo.js';

// Lần đầu chạy: chưa có .env thì tự tạo từ .env.example
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(HERE, '.env');
if (!fs.existsSync(ENV_PATH) && fs.existsSync(path.join(HERE, '.env.example'))) {
  fs.copyFileSync(path.join(HERE, '.env.example'), ENV_PATH);
  console.log(`📝 Đã tạo file cấu hình mặc định: ${ENV_PATH}`);
}
dotenv.config({ path: ENV_PATH });

const USERNAME = (process.env.TIKTOK_USERNAME || '').trim()
  .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');   // chấp nhận cả link tiktok.com/@ten/live
const SERVER = (process.env.SERVER_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_KEY = process.env.API_KEY || '';
const EULER_KEY = process.env.EULER_API_KEY || undefined;
// Gửi sự kiện người vào phòng để MC chào "Hello ...". Mặc định BẬT (GREET_JOIN=false để tắt).
const SEND_JOIN = process.env.GREET_JOIN !== 'false';

// Chưa điền tên TikTok (hoặc DEMO=true) => chạy chế độ DEMO: tự tạo quà/bình luận giả để test
const PLACEHOLDER = ['', 'ten_tiktok_cua_ban'];
const DEMO = process.env.DEMO === 'true' || PLACEHOLDER.includes(USERNAME.toLowerCase());

// ---------- Gửi sự kiện sang server .NET ----------
async function post(path, body) {
  try {
    const res = await fetch(`${SERVER}/api/events/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
      body: JSON.stringify(body)
    });
    if (!res.ok) console.warn(`⚠️  ${path}: HTTP ${res.status}${res.status === 401 ? ' (sai API_KEY)' : ''}`);
  } catch (err) {
    // Nhắc tối đa 1 lần / 30 giây để không tràn màn hình
    if (Date.now() - (post.lastWarn || 0) > 30000) {
      post.lastWarn = Date.now();
      console.warn(`⚠️  Không gửi được tới server ${SERVER}: ${err.message}`);
      console.warn('   👉 Server .NET chưa chạy? Bấm đúp start.bat (hoặc npm run server) rồi để cửa sổ server mở.');
    }
  }
}

// Báo trạng thái cho server (kèm chế độ live/demo). Gửi lại mỗi 15s để admin biết bridge còn sống.
let lastStatus = { connected: false, message: 'Đang khởi động' };
const status = (connected, message) => {
  lastStatus = { connected, message };
  return post('status', { connected, username: USERNAME, message, mode: DEMO ? 'demo' : 'live' });
};
if (!DEMO) setInterval(() => status(lastStatus.connected, lastStatus.message), 15000);

// ---------- Đọc field an toàn (tên field khác nhau giữa các version proto) ----------
const first = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

function mapUser(u = {}) {
  const userId = String(first(u.uniqueId, u.displayId, u.userId, u.id, 'unknown'));
  return {
    userId,
    nickname: first(u.nickname, userId),
    avatarUrl: first(u.profilePictureUrl, u.profilePicture?.urls?.[0], u.avatarThumb?.urlList?.[0]) ?? null
  };
}

function giftInfo(d) {
  return {
    name: first(d.giftDetails?.giftName, d.gift?.name, d.extendedGiftInfo?.name, `Gift#${d.giftId}`),
    type: Number(first(d.giftDetails?.giftType, d.gift?.type, 0)),
    diamonds: Number(first(d.giftDetails?.diamondCount, d.gift?.diamondCount, d.extendedGiftInfo?.diamond_count, 1)),
    count: Number(first(d.repeatCount, d.comboCount, 1)) || 1,
    imageUrl: giftImage(d)
  };
}

// Link ảnh món quà trên máy chủ TikTok (ưu tiên .png). Tên field khác nhau giữa các version => thử lần lượt.
function giftImage(d) {
  const lists = [d.gift?.image?.urlList, d.gift?.icon?.urlList, d.giftDetails?.giftImage?.urlList,
    d.extendedGiftInfo?.image?.url_list, d.extendedGiftInfo?.icon?.url_list].filter(l => Array.isArray(l) && l.length);
  for (const l of lists) {
    const png = l.find(u => /\.png(\?|$)/i.test(u));
    if (png || l[0]) return png || l[0];
  }
  return first(d.giftDetails?.giftImage?.giftPictureUrl, d.gift?.image?.url) ?? null;
}

// =====================================================================
//  CHẾ ĐỘ LIVE THẬT
// =====================================================================
function startLive() {
  // ---------- Kết nối TikTok ----------
  const connection = new TikTokLiveConnection(USERNAME, {
    signApiKey: EULER_KEY,
    enableExtendedGiftInfo: false   // true cần gói trả phí Euler Stream ("Business plan"); tên quà + giá đã có sẵn trong sự kiện quà
  });

  // QUÀ: quà combo (giftType = 1, vd Rose) bắn nhiều event khi đang combo,
  // chỉ xử lý khi repeatEnd = true để có tổng số lượng cuối cùng.
  // TikTok hay gửi trùng 1 sự kiện nhiều lần (dữ liệu ban đầu + websocket) => bỏ bản trùng theo msgId
  const seen = new Map();
  const isDuplicate = (d, fallbackKey) => {
    const id = first(d.common?.msgId, d.event?.msgId, d.msgId) ?? fallbackKey;
    if (!id) return false;
    const now = Date.now();
    if (seen.has(id) && now - seen.get(id) < 60000) return true;
    seen.set(id, now);
    if (seen.size > 2000) for (const [k, t] of seen) { if (now - t > 60000) seen.delete(k); }
    return false;
  };

  connection.on(WebcastEvent.GIFT, (d) => {
    if (isDuplicate(d, null)) return;
    const g = giftInfo(d);
    if (g.type === 1 && !d.repeatEnd) return;
    const user = mapUser(d.user);
    console.log(`🎁 ${user.nickname} tặng ${g.count} x ${g.name} (${g.diamonds}💎/cái)${g.imageUrl ? ' 🖼️' : ''}`);
    post('gift', { ...user, giftName: g.name, count: g.count, diamondValue: g.diamonds, giftImageUrl: g.imageUrl });
  });

  connection.on(WebcastEvent.CHAT, (d) => {
    const comment = first(d.comment, d.content, '');
    if (!comment) return;
    const user = mapUser(d.user);
    if (isDuplicate(d, null)) return;
    console.log(`💬 ${user.nickname}: ${comment}`);
    post('chat', { userId: user.userId, nickname: user.nickname, comment });
  });

  // Tim đến rất dày => gom lại, 1.5 giây gửi 1 lần
  let likeBuffer = 0, lastLiker = '';
  connection.on(WebcastEvent.LIKE, (d) => {
    likeBuffer += Number(first(d.likeCount, d.count, 1)) || 1;
    lastLiker = mapUser(d.user).nickname;
  });
  setInterval(() => {
    if (likeBuffer > 0) {
      console.log(`❤️  +${likeBuffer} tim (${lastLiker})`);
      post('like', { userId: '', nickname: lastLiker, likeCount: likeBuffer });
      likeBuffer = 0;
    }
  }, 1500);

  connection.on(WebcastEvent.FOLLOW, (d) => {
    const u = mapUser(d.user);
    post('social', { userId: u.userId, nickname: u.nickname, action: 'follow' });
  });
  connection.on(WebcastEvent.SHARE, (d) => {
    const u = mapUser(d.user);
    post('social', { userId: u.userId, nickname: u.nickname, action: 'share' });
  });
  connection.on(WebcastEvent.MEMBER, (d) => {
    const u = mapUser(d.user);
    console.log(`👋 ${u.nickname} vào xem live`);
    if (SEND_JOIN) post('social', { userId: u.userId, nickname: u.nickname, action: 'join' });
  });
  connection.on(WebcastEvent.FOLLOW, (d) => console.log(`⭐ ${mapUser(d.user).nickname} theo dõi`));

  connection.on(WebcastEvent.STREAM_END, () => {
    console.log('📴 Live đã kết thúc');
    status(false, 'Live đã kết thúc');
  });

  // ---------- Tự kết nối lại ----------
  let retryMs = 5000;
  let reconnectTimer = null;

  function scheduleReconnect(reason) {
    if (reconnectTimer) return;
    console.log(`🔁 Thử kết nối lại sau ${retryMs / 1000}s`);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, retryMs);
    retryMs = Math.min(retryMs * 2, 15000);   // tối đa 15s: vừa Go LIVE là bắt được nhanh
  }

  connection.on(ControlEvent.DISCONNECTED, ({ code, reason } = {}) => {
    console.log(`🔌 Mất kết nối (${code ?? ''} ${reason ?? ''})`);
    status(false, 'Mất kết nối, đang thử lại…');
    scheduleReconnect('disconnected');
  });

  connection.on(ControlEvent.ERROR, ({ info, exception } = {}) => {
    console.warn('⚠️  Lỗi:', info || '', exception?.message || '');
  });

  // Giải thích lỗi bằng tiếng Việt + cách sửa
  function explain(err) {
    const name = err?.constructor?.name || '';
    const detail = [err?.message, err?.exception?.message, ...(err?.errors || []).map(e => e?.message)].filter(Boolean).join(' | ');
    if (name === 'UserOfflineError' || /isn't online|offline/i.test(detail))
      return { msg: `@${USERNAME} chưa phát live`, tip: `Đã bấm Go LIVE chưa? Đúng tên @ chưa? Mở thử https://www.tiktok.com/@${USERNAME}/live` };
    if (/room ?id/i.test(detail))
      return { msg: `Không tìm thấy phòng live của @${USERNAME}`, tip: `Sai tên @ hoặc chưa bấm Go LIVE. Mở thử https://www.tiktok.com/@${USERNAME} xem có đúng trang của bạn không` };
    if (name === 'InvalidUniqueIdError')
      return { msg: `Tên @ "${USERNAME}" không hợp lệ`, tip: 'TIKTOK_USERNAME phải là tên @ trong link hồ sơ, không phải tên hiển thị' };
    if (name === 'SignatureRateLimitError' || /rate.?limit|429/i.test(detail))
      return { msg: 'Dịch vụ ký Euler Stream hết lượt miễn phí', tip: 'Đăng ký key miễn phí ở https://www.eulerstream.com rồi điền EULER_API_KEY trong .env' };
    if (/business plan|pricing/i.test(detail))
      return { msg: 'Tính năng cần gói trả phí Euler Stream', tip: 'Cập nhật bridge mới nhất (git pull) — bản mới không dùng tính năng trả phí' };
    if (/^Sign|Signature/.test(name) || /sign|euler|401|403/i.test(detail))
      return { msg: 'Lỗi dịch vụ ký Euler Stream', tip: 'Điền / kiểm tra EULER_API_KEY trong .env (đăng ký miễn phí ở eulerstream.com)' };
    if (name === 'ConnectTimeoutError' || /timeout|ETIMEDOUT|ENOTFOUND|ECONNRESET/i.test(detail))
      return { msg: 'Mạng chậm / không vào được TikTok', tip: 'Kiểm tra mạng, tắt VPN/proxy rồi thử lại' };
    return { msg: detail || String(err), tip: 'Chụp màn hình cửa sổ này gửi người hỗ trợ' };
  }

  async function connect() {
    try {
      const state = await connection.connect();
      retryMs = 5000;
      console.log(`✅ Đã kết nối live @${USERNAME} (roomId ${state.roomId})`);
      console.log('   Đang chờ bình luận / quà... (người vào xem và tim cũng được in ra để biết dữ liệu đang về)');
      status(true, 'Đang nhận sự kiện');
    } catch (err) {
      const { msg, tip } = explain(err);
      console.error(`❌ Không kết nối được: ${msg}`);
      console.error(`   👉 ${tip}`);
      status(false, msg);
      scheduleReconnect(msg);
    }
  }

  process.on('SIGINT', async () => {
    console.log('\n👋 Dừng bridge');
    await status(false, 'Bridge đã dừng');
    try { await connection.disconnect(); } catch { }
    process.exit(0);
  });

  console.log(`🚀 Bridge: TikTok @${USERNAME} -> ${SERVER}`);
  console.log(`   Trang live của bạn: https://www.tiktok.com/@${USERNAME}/live`);
  console.log(`   EULER_API_KEY: ${EULER_KEY ? 'đã có' : 'CHƯA có (nên đăng ký miễn phí ở eulerstream.com để kết nối ổn định)'}`);
  if (!/^[A-Za-z0-9._]{2,24}$/.test(USERNAME)) {
    console.warn(`⚠️  "${USERNAME}" KHÔNG giống tên @ TikTok (chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, không có khoảng trắng).`);
    console.warn('   Hãy dùng tên trong link hồ sơ: tiktok.com/@TEN_NAY  — không dùng tên hiển thị như "Vibe Live dạo".');
  }
  connect();
}

if (DEMO) {
  runDemo({ post, server: SERVER, intervalMs: Number(process.env.DEMO_INTERVAL_MS) || 20000 });
} else {
  startLive();
}
