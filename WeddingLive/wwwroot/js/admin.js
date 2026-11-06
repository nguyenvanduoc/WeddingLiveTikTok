// Trang điều khiển: giả lập quà/bình luận để test mà không cần live thật.
(function () {
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Lan Phương', 'Tuấn Anh', 'Bé Na', 'Hoàng Long', 'Mai Chi', 'Quốc Bảo', 'Thu Trang',
                 'Đức Huy', 'Ngọc Hân', 'Minh Khang', 'Bảo Ngọc', 'Gia Hưng', 'Khánh Linh', 'Văn Toàn'];

  $('stageUrl').textContent = location.origin + '/';

  // Lưu API key trong trình duyệt cho tiện (không bắt buộc)
  try { $('apiKey').value = localStorage.getItem('apiKey') || ''; } catch { }
  $('apiKey').addEventListener('change', () => { try { localStorage.setItem('apiKey', $('apiKey').value); } catch { } });

  const log = (s) => { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${s}\n` + $('log').textContent.slice(0, 3000); };

  async function post(path, body) {
    const res = await fetch('/api/events/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': $('apiKey').value },
      body: JSON.stringify(body ?? {})
    });
    if (!res.ok) log(`❌ ${path}: HTTP ${res.status}${res.status === 401 ? ' (sai API key)' : ''}`);
    return res.ok;
  }

  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, '').toLowerCase();
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function giftFrom(nick, value, count) {
    const [giftName, diamonds] = value.split('|');
    return { userId: slug(nick), nickname: nick, giftName, diamondValue: +diamonds, count: +count || 1 };
  }

  function randomGift() {
    const opts = [...$('gift').options].map(o => o.value);
    const weighted = [...opts.slice(0, 5), ...opts.slice(0, 5), ...opts.slice(0, 3), ...opts.slice(5)];
    const v = rnd(weighted);
    const count = v.startsWith('Rose') ? 1 + Math.floor(Math.random() * 20) : 1;
    return giftFrom(rnd(NAMES), v, count);
  }

  const actions = {
    gift: async () => { const g = giftFrom($('nick').value || 'Ẩn danh', $('gift').value, $('count').value);
                        if (await post('gift', g)) log(`🎁 ${g.nickname} tặng ${g.count} ${g.giftName}`); },
    random10: async () => { for (let i = 0; i < 10; i++) await post('gift', randomGift()); log('🎁 Đã gửi 10 quà ngẫu nhiên'); },
    spam50: async () => { await Promise.all(Array.from({ length: 50 }, () => post('gift', randomGift()))); log('🎁 Đã spam 50 quà'); },
    chat: async () => { const n = $('nick').value || 'Ẩn danh';
                        if (await post('chat', { userId: slug(n), nickname: n, comment: $('comment').value })) log(`💬 ${n}: ${$('comment').value}`); },
    like: async () => { await post('like', { userId: 'x', nickname: rnd(NAMES), likeCount: 10 }); log('❤️ +10 tim'); },
    follow: async () => { await post('social', { userId: 'x', nickname: rnd(NAMES), action: 'follow' }); log('⭐ follow'); },
    share: async () => { await post('social', { userId: 'x', nickname: rnd(NAMES), action: 'share' }); log('🔁 share'); },
    reset: async () => { if (confirm('Xóa bảng xếp hạng và tên khách?') && await post('reset')) log('♻️ Đã reset'); }
  };

  document.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => actions[b.dataset.act]()));

  // Theo dõi trạng thái bridge TikTok qua SignalR
  const conn = new signalR.HubConnectionBuilder().withUrl('/hub/wedding').withAutomaticReconnect().build();
  conn.on('BridgeStatus', (s) => {
    const el = $('status');
    el.className = 'status ' + (s.connected ? 'on' : 'off');
    el.textContent = s.connected
      ? `🟢 Đã kết nối live @${s.username}`
      : `⚪ Bridge TikTok: ${s.message || 'chưa kết nối'}`;
  });
  conn.start().catch(e => log('SignalR lỗi: ' + e));
})();
