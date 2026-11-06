// =====================================================================
//  TikTok Live -> WeddingLive (.NET) bridge
//  Nghe sự kiện của 1 phòng live TikTok và POST sang server .NET:
//    gift   -> /api/events/gift
//    chat   -> /api/events/chat
//    like   -> /api/events/like
//    follow/share -> /api/events/social
//    trạng thái kết nối -> /api/events/status
// =====================================================================
import 'dotenv/config';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const USERNAME = (process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const SERVER = (process.env.SERVER_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_KEY = process.env.API_KEY || '';
const EULER_KEY = process.env.EULER_API_KEY || undefined;
const SEND_JOIN = process.env.SEND_JOIN === 'true';

if (!USERNAME) {
  console.error('❌ Thiếu TIKTOK_USERNAME trong file .env');
  process.exit(1);
}

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
    console.warn(`⚠️  Không gửi được tới ${SERVER} (${path}): ${err.message}`);
  }
}

const status = (connected, message) => post('status', { connected, username: USERNAME, message });

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
    count: Number(first(d.repeatCount, d.comboCount, 1)) || 1
  };
}

// ---------- Kết nối TikTok ----------
const connection = new TikTokLiveConnection(USERNAME, {
  signApiKey: EULER_KEY,
  enableExtendedGiftInfo: true
});

// QUÀ: quà combo (giftType = 1, vd Rose) bắn nhiều event khi đang combo,
// chỉ xử lý khi repeatEnd = true để có tổng số lượng cuối cùng.
connection.on(WebcastEvent.GIFT, (d) => {
  const g = giftInfo(d);
  if (g.type === 1 && !d.repeatEnd) return;
  const user = mapUser(d.user);
  console.log(`🎁 ${user.nickname} tặng ${g.count} x ${g.name} (${g.diamonds}💎/cái)`);
  post('gift', { ...user, giftName: g.name, count: g.count, diamondValue: g.diamonds });
});

connection.on(WebcastEvent.CHAT, (d) => {
  const comment = first(d.comment, d.content, '');
  if (!comment) return;
  const user = mapUser(d.user);
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
if (SEND_JOIN) {
  connection.on(WebcastEvent.MEMBER, (d) => {
    const u = mapUser(d.user);
    post('social', { userId: u.userId, nickname: u.nickname, action: 'join' });
  });
}

connection.on(WebcastEvent.STREAM_END, () => {
  console.log('📴 Live đã kết thúc');
  status(false, 'Live đã kết thúc');
});

// ---------- Tự kết nối lại ----------
let retryMs = 5000;
let reconnectTimer = null;

function scheduleReconnect(reason) {
  if (reconnectTimer) return;
  console.log(`🔁 Thử kết nối lại sau ${retryMs / 1000}s (${reason})`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, retryMs);
  retryMs = Math.min(retryMs * 2, 60000);
}

connection.on(ControlEvent.DISCONNECTED, ({ code, reason } = {}) => {
  console.log(`🔌 Mất kết nối (${code ?? ''} ${reason ?? ''})`);
  status(false, 'Mất kết nối, đang thử lại…');
  scheduleReconnect('disconnected');
});

connection.on(ControlEvent.ERROR, ({ info, exception } = {}) => {
  console.warn('⚠️  Lỗi:', info || '', exception?.message || '');
});

async function connect() {
  try {
    const state = await connection.connect();
    retryMs = 5000;
    console.log(`✅ Đã kết nối live @${USERNAME} (roomId ${state.roomId})`);
    status(true, 'Đang nhận sự kiện');
  } catch (err) {
    const msg = err?.constructor?.name === 'UserOfflineError'
      ? `@${USERNAME} chưa phát live`
      : (err?.message || String(err));
    console.error('❌ Không kết nối được:', msg);
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
connect();
