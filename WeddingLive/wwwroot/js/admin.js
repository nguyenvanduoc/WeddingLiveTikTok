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
    speak: async () => { const t = $('mcText').value.trim(); if (t && await post('speak', { text: t })) log('📢 MC: ' + t); },
    preview: async () => {
      const t = $('mcText').value.trim(); if (!t) return;
      try { await playTts(t); log('🎧 Đang phát trên máy này'); }
      catch (e) { log('❌ ' + e.message); }
    },
    diagnose: () => diagnose(),
    reset: async () => { if (confirm('Xóa bảng xếp hạng và tên khách?') && await post('reset')) log('♻️ Đã reset'); }
  };

  // ---------------- Giọng đọc: phát thử + chẩn đoán ----------------
  async function playTts(text) {
    const t0 = performance.now();
    const res = await fetch('/api/tts?text=' + encodeURIComponent(text));
    if (!res.ok) throw new Error(`Server không tạo được giọng (HTTP ${res.status}). Xem dòng "TTS ... lỗi" trong cửa sổ dotnet run.`);
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    await audio.play();
    return { ms: Math.round(performance.now() - t0), kb: Math.round(blob.size / 1024) };
  }

  const STATE_TEXT = {
    ok: '<span class="ok">đang phát tiếng bình thường</span>',
    waiting: 'đã mở, chưa đọc câu nào (MC tự đọc sau ~10 giây)',
    blocked: '<span class="bad">trình duyệt CHẶN tiếng → bấm nút 🔊 trên trang sân khấu</span>',
    fallback: '<span class="bad">giọng server lỗi, đang dùng giọng Windows (OBS có thể không thu được)</span>',
    disabled: '<span class="bad">Voice:Enabled = false</span>',
    muted: 'tắt tiếng (?voice=0)'
  };
  const where = (ua) => /OBS|obs-browser/i.test(ua || '') ? 'OBS' : (/Headless/i.test(ua || '') ? 'Headless' : 'Trình duyệt');

  async function refreshVoiceStatus() {
    try {
      const s = await (await fetch('/api/voice/status')).json();
      const lines = [];
      const withVoice = s.stages.filter(x => x.voiceOn);
      if (!s.enabled) lines.push('<span class="bad">❌ Giọng MC đang tắt (Voice:Enabled = false trong appsettings.json)</span>');
      if (!withVoice.length) lines.push('<span class="bad">⚠️ Không có trang sân khấu nào đang mở CÓ TIẾNG.</span> Mở <b>' + location.origin + '/</b> ở tab khác / OBS, hoặc tick "Bật tiếng khung xem trước" bên trái.');
      s.stages.forEach((x, i) => lines.push(`Sân khấu ${i + 1} (${where(x.userAgent)}): ${STATE_TEXT[x.state] || x.state}`));
      if (s.lastError) lines.push(`<span class="bad">Lỗi giọng gần nhất: ${s.lastError}</span>`);
      $('voiceStatus').innerHTML = lines.join('<br>') || '<span class="ok">✅ Ổn</span>';
    } catch { $('voiceStatus').textContent = 'Không đọc được trạng thái (server đã tắt?)'; }
  }
  refreshVoiceStatus();
  setInterval(refreshVoiceStatus, 4000);

  async function diagnose() {
    const out = $('diag'); out.hidden = false; out.textContent = '';
    const add = (s) => { out.textContent += s + '\n'; };
    add('1) Cấu hình giọng trên server…');
    const s = await (await fetch('/api/voice/status')).json();
    add(s.enabled ? `   ✅ Đang bật, giọng: ${s.provider}` : '   ❌ Đang TẮT: sửa "Voice": { "Enabled": true } trong appsettings.json');
    add('2) Server tạo file giọng đọc…');
    try {
      const r = await playTts('Xin chào, đây là giọng MC của đám cưới.');
      add(`   ✅ Tạo được (${r.kb} KB, ${r.ms} ms) và đang phát trên máy này → bạn có nghe thấy không?`);
      add('      Nếu KHÔNG nghe: kiểm tra loa/âm lượng Windows, tab Chrome có bị tắt tiếng (chuột phải tab → Unmute site).');
    } catch (e) {
      add('   ❌ ' + e.message);
      if (e.name === 'NotAllowedError') add('      Trình duyệt chặn phát tiếng: bấm lại nút này 1 lần nữa.');
      else add('      Máy có vào được translate.google.com không? Hoặc dùng Azure: điền Voice:AzureKey.');
    }
    add('3) Giọng tiếng Việt có sẵn của Windows (dự phòng)…');
    const vi = ('speechSynthesis' in window) ? speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang)) : [];
    add(vi.length ? `   ✅ ${vi.map(v => v.name).join(', ')}` : '   ⚠️ Không có (chỉ ảnh hưởng khi giọng server lỗi). Cài: Settings → Time & language → Speech → Add voices → Tiếng Việt');
    add('4) Trang sân khấu đang mở…');
    const st = s.stages.filter(x => x.voiceOn);
    add(st.length ? `   ✅ ${st.length} trang có tiếng: ` + st.map(x => `${where(x.userAgent)} = ${x.state}`).join(', ')
                  : '   ❌ Không có trang sân khấu nào bật tiếng → giọng MC (cảm ơn quà, giới thiệu) không phát ở đâu cả.');
    add('5) Trong OBS: Browser Source → tick "Control audio via OBS"; Audio Mixer → ⚙ Advanced Audio Properties');
    add('   → Audio Monitoring = "Monitor and Output" để nghe được trên loa máy mình.');
  }

  // Bật/tắt tiếng khung xem trước (nhớ lựa chọn trong trình duyệt)
  const pv = $('previewVoice');
  try { pv.checked = localStorage.getItem('previewVoice') === '1'; } catch { }
  const applyPreview = () => { $('stageFrame').src = pv.checked ? '/?voice=1' : '/?voice=0'; };
  if (pv.checked) applyPreview();
  pv.addEventListener('change', () => { try { localStorage.setItem('previewVoice', pv.checked ? '1' : '0'); } catch { } applyPreview(); });

  // Câu mẫu lấy từ cấu hình giọng đọc: bấm để đưa vào ô MC
  Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/voice/config').then(r => r.json())])
    .then(([w, v]) => {
      $('voiceInfo').textContent = v.enabled ? `(giọng: ${v.provider})` : '(đang tắt – Voice:Enabled = false)';
      const fill = (t) => t.replaceAll('{bride}', w.brideName).replaceAll('{groom}', w.groomName);
      (v.announcements || []).slice(0, 7).forEach((t, i) => {
        const b = document.createElement('button');
        b.textContent = `Câu ${i + 1}`;
        b.title = fill(t);
        b.onclick = () => { $('mcText').value = fill(t); };
        $('quickLines').appendChild(b);
      });
    }).catch(() => { });

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
