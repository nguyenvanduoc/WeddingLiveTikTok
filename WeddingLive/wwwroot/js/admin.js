// Trang điều khiển: giả lập quà/bình luận để test mà không cần live thật.
(function () {
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Lan Phương', 'Tuấn Anh', 'Bé Na', 'Hoàng Long', 'Mai Chi', 'Quốc Bảo', 'Thu Trang',
                 'Đức Huy', 'Ngọc Hân', 'Minh Khang', 'Bảo Ngọc', 'Gia Hưng', 'Khánh Linh', 'Văn Toàn'];

  $('stageUrl').textContent = location.origin + '/';

  // Lưu API key trong trình duyệt cho tiện (không bắt buộc)
  try { $('apiKey').value = localStorage.getItem('apiKey') || ''; } catch { }
  $('apiKey').addEventListener('change', () => { try { localStorage.setItem('apiKey', $('apiKey').value); } catch { } });

  const OLD_SERVER = 'Server đang chạy bản CŨ (chưa có API mới). Tắt hết cửa sổ dotnet run (Ctrl+C) rồi chạy lại: dotnet run --project WeddingLive';
  const log = (s) => { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${s}\n` + $('log').textContent.slice(0, 3000); };

  async function post(path, body) {
    const res = await fetch('/api/events/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': $('apiKey').value },
      body: JSON.stringify(body ?? {})
    });
    if (!res.ok) log(`❌ ${path}: HTTP ${res.status}${res.status === 401 ? ' (sai API key)' : res.status === 404 ? ' – ' + OLD_SERVER : ''}`);
    return res.ok;
  }

  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, '').toLowerCase();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
    random10: async () => { log('🎁 Đang gửi 10 quà (mỗi 0,8s)…'); for (let i = 0; i < 10; i++) { await post('gift', randomGift()); await sleep(800); } log('🎁 Đã gửi 10 quà ngẫu nhiên'); },
    spam50: async () => { log('🎁 Đang spam 50 quà (mỗi 0,3s)…'); for (let i = 0; i < 50; i++) { await post('gift', randomGift()); await sleep(300); } log('🎁 Đã spam 50 quà'); },
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
    uploadSongs: async () => {
      const files = $('songFiles').files;
      if (!files.length) { log('❌ Chưa chọn file nhạc'); return; }
      const fd = new FormData();
      [...files].forEach(f => fd.append('files', f));
      log(`⬆️ Đang tải ${files.length} bài lên…`);
      const res = await fetch('/api/music/upload', { method: 'POST', headers: { 'X-Api-Key': $('apiKey').value }, body: fd });
      if (!res.ok) { log(`❌ Tải lên lỗi: HTTP ${res.status}${res.status === 404 ? ' – ' + OLD_SERVER : ''}`); return; }
      const r = await res.json();
      log(r.saved.length ? `✅ Đã thêm: ${r.saved.join(', ')}` : '❌ Không có file hợp lệ (.mp3 .ogg .m4a .wav, tối đa 50MB)');
      $('songFiles').value = '';
      refreshSongs();
    },
    musicPlay: async () => { if (await post('music', { action: 'play' })) log('🎵 Phát nhạc'); },
    musicStop: async () => { if (await post('music', { action: 'stop' })) log('⏹ Dừng nhạc'); },
    hug: async () => { if (await post('couple', { action: 'hug' })) log('💋 Thử ôm hôn'); },
    dance: async () => { if (await post('couple', { action: 'dance' })) log('💃 Thử khiêu vũ'); },
    reset: async () => { if (confirm('Xóa bảng xếp hạng và tên khách?') && await post('reset')) log('♻️ Đã reset'); }
  };

  // ---------------- Giọng đọc: phát thử + chẩn đoán ----------------
  let clientSpeed = 1;
  async function playTts(text) {
    const t0 = performance.now();
    const res = await fetch('/api/tts?text=' + encodeURIComponent(text));
    if (res.status === 404) throw new Error(OLD_SERVER);
    if (!res.ok) throw new Error(`Server không tạo được giọng (HTTP ${res.status}). Xem dòng "TTS ... lỗi" trong cửa sổ dotnet run.`);
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preservesPitch = true;
    audio.playbackRate = clientSpeed;   // giống tốc độ phát trên sân khấu
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

  async function getVoiceStatus() {
    const res = await fetch('/api/voice/status');
    if (res.status === 404) throw new Error(OLD_SERVER);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function refreshVoiceStatus() {
    try {
      const s = await getVoiceStatus();
      const lines = [];
      const withVoice = s.stages.filter(x => x.voiceOn);
      if (!s.enabled) lines.push('<span class="bad">❌ Giọng MC đang tắt (Voice:Enabled = false trong appsettings.json)</span>');
      if (!withVoice.length) lines.push('<span class="bad">⚠️ Không có trang sân khấu nào đang mở CÓ TIẾNG.</span> Mở <b>' + location.origin + '/</b> ở tab khác / OBS, hoặc tick "Bật tiếng khung xem trước" bên trái.');
      s.stages.forEach((x, i) => lines.push(`Sân khấu ${i + 1} (${where(x.userAgent)}): ${STATE_TEXT[x.state] || x.state}`));
      if (s.lastError) lines.push(`<span class="bad">Lỗi giọng gần nhất: ${s.lastError}</span>`);
      $('voiceStatus').innerHTML = lines.join('<br>') || '<span class="ok">✅ Ổn</span>';
    } catch (e) {
      $('voiceStatus').innerHTML = '<span class="bad">❌ ' + (e.message === OLD_SERVER ? OLD_SERVER : 'Không kết nối được server (cửa sổ dotnet run đã tắt?)') + '</span>';
    }
  }
  refreshVoiceStatus();
  setInterval(refreshVoiceStatus, 4000);

  // Cảnh báo to khi server đang chạy bản cũ (đã git pull nhưng chưa chạy lại)
  async function checkServerVersion() {
    let msg = '';
    try {
      const res = await fetch('/api/version');
      if (res.status === 404) msg = 'cũ';
      else if (res.ok && (await res.json()).stale) msg = 'cũ';
    } catch { msg = 'tắt'; }
    const el = $('serverBanner');
    el.hidden = !msg;
    el.innerHTML = msg === 'tắt'
      ? '❌ Không kết nối được server. Chạy lại: <code>npm run server</code>'
      : '⚠️ Server đang chạy BẢN CŨ (code đã cập nhật bằng git pull nhưng server chưa chạy lại) → giọng/tốc độ/tính năng mới chưa có tác dụng.<br>'
        + 'Tắt cửa sổ server (Ctrl+C) rồi chạy lại: <code>npm run server</code> (ở thư mục gốc) hoặc bấm đúp <code>start-server.bat</code>, sau đó F5 trang này.';
  }
  checkServerVersion();
  setInterval(checkServerVersion, 10000);

  // ---------------- Danh sách bài hát ----------------
  async function refreshSongs() {
    try {
      const songs = await (await fetch('/api/music')).json();
      $('songInfo').innerHTML = songs.length
        ? `🎤 Có <b>${songs.length}</b> bài hát – sân khấu phát xáo trộn các bài này.`
        : '🎹 Chưa có bài hát nào → đang phát <b>nhạc không lời</b> tự tạo (Wagner, Pachelbel). Tải bài hát có lời lên bên dưới.';
      $('songList').innerHTML = '';
      songs.forEach(name => {
        const li = document.createElement('li');
        li.textContent = '🎵 ' + name;
        const del = document.createElement('button');
        del.textContent = '✖ Xóa';
        del.onclick = async () => {
          if (!confirm('Xóa bài ' + name + '?')) return;
          const res = await fetch('/api/music/' + encodeURIComponent(name), { method: 'DELETE', headers: { 'X-Api-Key': $('apiKey').value } });
          log(res.ok ? '🗑️ Đã xóa ' + name : '❌ Xóa lỗi: HTTP ' + res.status);
          refreshSongs();
        };
        li.appendChild(del);
        $('songList').appendChild(li);
      });
    } catch { $('songInfo').textContent = 'Không đọc được danh sách bài.'; }
  }
  refreshSongs();

  // ---------------- 📡 Chẩn đoán kết nối TikTok ----------------
  const ago = (s) => s == null ? 'chưa bao giờ' : s < 60 ? `${s} giây trước` : `${Math.round(s / 60)} phút trước`;
  const TYPE = { chat: '💬', gift: '🎁', join: '👋', like: '❤️', follow: '⭐', share: '🔁' };
  async function refreshDiag() {
    let d;
    try {
      const res = await fetch('/api/diag');
      if (res.status === 404) { $('diagVerdict').className = 'verdict bad'; $('diagVerdict').textContent = '❌ ' + OLD_SERVER; return; }
      d = await res.json();
    } catch { $('diagVerdict').className = 'verdict bad'; $('diagVerdict').textContent = '❌ Không kết nối được server – cửa sổ server đã tắt? Chạy lại start.bat'; return; }

    const c = d.counts || {}, last = d.lastSeconds || {};
    const seen = d.bridgeLastSeenSeconds, mode = d.bridgeMode, b = d.bridge || {};
    $('diagBridge').innerHTML = seen == null ? '❌ Chưa liên lạc lần nào'
      : `${b.connected ? '🟢' : '🔴'} ${mode === 'demo' ? '<b>DEMO (quà giả)</b>' : 'Live thật'} @${b.username || '?'}<br>${b.message || ''}<br><small>liên lạc ${ago(seen)}</small>`;
    $('diagCounts').innerHTML = `💬 Bình luận: <b>${c.chat || 0}</b> <small>(${ago(last.chat)})</small><br>🎁 Quà: <b>${c.gift || 0}</b> · 👋 Vào xem: <b>${c.join || 0}</b> · ❤️ Tim: <b>${c.like || 0}</b>${c.demo ? `<br><small>🧪 trong đó quà/tin DEMO (giả): ${c.demo} (${ago(last.demo)})</small>` : ''}`;
    const mus = d.music || [];
    const musText = !mus.length ? '🔇 không phát (không có trang sân khấu bật tiếng)'
      : mus.includes('blocked') ? '<span style="color:#ffb3b3">⚠️ bị trình duyệt CHẶN → bấm vào cửa sổ sân khấu 1 lần</span>'
      : mus.includes('playing') ? '🎵 <b>đang phát</b>'
      : mus.every(m => m === 'off') ? '🔇 đang tắt (MusicEnabled = false)'
      : '⏳ chờ tới lượt bài tiếp';
    // Sân khấu đã nhận / đã đọc bao nhiêu bình luận
    const stats = (d.stageStats || []).map(s => { try { return JSON.parse(s || '{}'); } catch { return {}; } });
    const st = stats.reduce((a, s) => { for (const k in s) if (typeof s[k] === 'number' && !/At$|^lag/.test(k)) a[k] = (a[k] || 0) + s[k]; a.lastChatAt = Math.max(a.lastChatAt || 0, s.lastChatAt || 0); return a; }, {});
    const lagS = stats.find(s => s.lagMc != null);
    const recvText = stats.length
      ? `Sân khấu đã nhận: 💬 <b>${st.chat || 0}</b> (đọc ${st.queued || 0}${st.dup ? ', trùng ' + st.dup : ''}${st.blocked ? ', từ cấm ' + st.blocked : ''}${st.empty ? ', rỗng/emoji ' + st.empty : ''}${st.off ? ', TẮT đọc ' + st.off : ''}) · 🎁 <b>${st.gift || 0}</b> · 👋 <b>${st.join || 0}</b>`
        + (st.unstuck ? ` · 🔧 tự gỡ kẹt ${st.unstuck}` : '')
        + (lagS ? `<br>⏱️ Tin thật gần nhất (${lagS.lagKind === 'gift' ? 'quà' : 'bình luận'}): TikTok → máy bạn <b>${lagS.lagTt ?? '?'}s</b>, máy bạn → MC đọc <b>${lagS.lagMc}s</b>` : '')
        + (st.err ? `<br><span style="color:#c62828">⚠ Lỗi trên sân khấu (${st.err}): ${(stats.find(s => s.lastErr) || {}).lastErr || ''}</span>` : '')
      : '';
    $('diagStages').innerHTML = `${d.stagesWithVoice} trang bật tiếng · <b>${d.stagesPlaying}</b> trang đang phát tiếng<br>Nhạc: ${musText}${recvText ? '<br>' + recvText : ''}`;
    // Server có bình luận mới mà sân khấu không nhận => sân khấu mất kết nối với server
    const stageLagSec = st.lastChatAt ? Math.round((d.nowMs - st.lastChatAt) / 1000) : null;
    const stageMissedChat = stats.length && last.chat != null && last.chat < 120 && (stageLagSec == null || stageLagSec > last.chat + 10);
    $('diagRecent').innerHTML = (d.recent || []).map(e => `<li>${TYPE[e.type] || '•'} <b>${e.who}</b> ${e.text} <small>– ${ago(e.ago)}</small></li>`).join('') || '<li>(chưa có)</li>';

    // Kết luận: đứt ở mắt xích nào
    let v, ok = false;
    if (seen == null) v = '❌ Bridge CHƯA gửi gì tới server. Kiểm tra: cửa sổ "TikTok bridge" có đang chạy không (start.bat)? Trong tiktok-bridge\\.env: SERVER_URL=http://localhost:5000, API_KEY trùng Wedding:ApiKey (để trống cả hai nếu không dùng).';
    else if (seen > 40) v = '❌ Bridge đã ngừng liên lạc (' + ago(seen) + '). Cửa sổ bridge bị tắt? Chạy lại: npm start (thư mục gốc).';
    else if (mode === 'demo') v = '❌ Bridge đang chạy DEMO (quà giả), KHÔNG đọc live thật. Sửa file tiktok-bridge\\.env (không phải .env.example): TIKTOK_USERNAME=vibelivedao và DEMO=false, rồi chạy lại bridge.';
    else if (!b.connected) v = '❌ Bridge chưa vào được phòng live: ' + (b.message || '') + '. Đã bấm Go LIVE chưa? Xem dòng 👉 trong cửa sổ bridge.';
    else if (!c.chat && !c.join && !c.like) v = '⏳ Đã kết nối live @' + b.username + ' nhưng chưa nhận sự kiện nào. Nhờ ai đó bình luận trên live để thử.';
    else if (!d.stagesPlaying && d.stagesWithVoice === 0) v = '❌ Bình luận ĐÃ tới server nhưng KHÔNG có trang sân khấu nào bật tiếng → không ai đọc. Mở open-stage.bat hoặc tick "Bật tiếng khung xem trước".';
    else if (mode === 'live' && last.demo != null && last.demo < 60) v = '❌ Đang có 1 cửa sổ bridge DEMO chạy SONG SONG (gửi quà giả làm nghẽn). Tắt hết cửa sổ dòng lệnh rồi chạy lại start.bat 1 lần.';
    else if (stageMissedChat) v = '❌ Server ĐÃ nhận bình luận nhưng trang sân khấu KHÔNG nhận được (mất kết nối với server). Bấm vào cửa sổ sân khấu rồi nhấn F5 (tải lại trang).';
    else if (st.off) v = '❌ Đang TẮT đọc bình luận: sửa "ReadChat": true trong appsettings.json (mục Voice).';
    else if (!d.stagesPlaying) v = '⚠️ Bình luận đã tới, sân khấu có bật tiếng nhưng chưa phát được: bấm nút 🔊 trên trang sân khấu (trình duyệt chặn tiếng) hoặc bấm 🩺 Kiểm tra giọng bên dưới.';
    else {
      v = '✅ Mọi thứ hoạt động: bridge live thật @' + b.username + ', bình luận đã tới server, sân khấu đang phát tiếng.'; ok = true;
      if (d.stagesPlaying > 1) v += ` ⚠️ Nhưng có ${d.stagesPlaying} trang cùng phát tiếng → MC/nhạc bị phát trùng. Bỏ tick "Bật tiếng khung xem trước" nếu đã mở cửa sổ sân khấu (open-stage.bat / OBS).`;
    }
    $('diagVerdict').className = 'verdict ' + (ok ? 'ok' : 'bad');
    $('diagVerdict').textContent = v;
  }
  refreshDiag();
  setInterval(refreshDiag, 3000);

  async function diagnose() {
    const out = $('diag'); out.hidden = false; out.textContent = '';
    const add = (s) => { out.textContent += s + '\n'; };
    add('1) Cấu hình giọng trên server…');
    let s;
    try { s = await getVoiceStatus(); }
    catch (e) { add('   ❌ ' + (e.message === OLD_SERVER ? OLD_SERVER : 'Không kết nối được server: ' + e.message)); return; }
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
  let saved = null;
  try { saved = localStorage.getItem('previewVoice'); } catch { }
  const applyPreview = () => { $('stageFrame').src = pv.checked ? '/?voice=1' : '/?voice=0'; };
  if (saved !== null) {
    pv.checked = saved === '1';
    if (pv.checked) applyPreview();
  } else {
    // Chưa từng chọn: nếu chưa có trang sân khấu nào phát tiếng (OBS, tab khác) thì tự bật tiếng khung này
    getVoiceStatus().then(s => {
      if (!s.stages.some(x => x.voiceOn)) { pv.checked = true; applyPreview(); }
    }).catch(() => { });
  }
  pv.addEventListener('change', () => { try { localStorage.setItem('previewVoice', pv.checked ? '1' : '0'); } catch { } applyPreview(); });

  // Câu mẫu lấy từ cấu hình giọng đọc: bấm để đưa vào ô MC
  function showVoiceConfig(v) {
    clientSpeed = v.clientSpeed || 1;
    $('voiceInfo').textContent = !v.enabled ? '(đang tắt – Voice:Enabled = false)'
      : v.speed === undefined ? '(server bản cũ – chạy lại npm run server)'
      : `(giọng: ${v.provider}, tốc độ x${v.speed})`;
    if (v.speed !== undefined && document.activeElement !== $('speed')) { $('speed').value = v.speed; $('speedVal').textContent = 'x' + v.speed; }
  }
  const reloadVoiceConfig = () => fetch('/api/voice/config').then(r => r.json()).then(showVoiceConfig).catch(() => { });

  // Thanh trượt tốc độ: lưu lên server (appsettings.Local.json) => mọi sân khấu/OBS áp dụng ngay
  $('speed').addEventListener('input', () => { $('speedVal').textContent = 'x' + $('speed').value; });
  $('speed').addEventListener('change', async () => {
    const speed = +$('speed').value;
    const res = await fetch('/api/voice/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': $('apiKey').value },
      body: JSON.stringify({ speed })
    });
    log(res.ok ? `🎚️ Tốc độ giọng: x${speed}` : `❌ Lưu tốc độ lỗi: HTTP ${res.status}${res.status === 404 ? ' – ' + OLD_SERVER : ''}`);
    setTimeout(reloadVoiceConfig, 800);
  });

  // Thanh trượt nhịp sân khấu => lưu appsettings.Local.json, sân khấu áp dụng ngay
  const showStage = (c) => {
    if (c.giftPacingMs !== undefined && document.activeElement !== $('pace')) { $('pace').value = c.giftPacingMs / 1000; $('paceVal').textContent = c.giftPacingMs / 1000 + ' giây'; }
    if (c.idleEverySeconds !== undefined && document.activeElement !== $('idleEvery')) { $('idleEvery').value = c.idleEverySeconds; $('idleVal').textContent = c.idleEverySeconds + ' giây'; }
    if (c.musicEverySeconds !== undefined && document.activeElement !== $('musicEvery')) { $('musicEvery').value = c.musicEverySeconds; $('musicEveryVal').textContent = c.musicEverySeconds + ' giây'; }
    if (c.musicVolume !== undefined && document.activeElement !== $('musicVol')) { $('musicVol').value = c.musicVolume; $('musicVolVal').textContent = Math.round(c.musicVolume * 100) + '%'; }
  };
  const reloadStageConfig = () => fetch('/api/config').then(r => r.json()).then(showStage).catch(() => { });
  async function saveStage(body, msg) {
    const res = await fetch('/api/stage/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': $('apiKey').value }, body: JSON.stringify(body)
    });
    log(res.ok ? msg : `❌ Lưu nhịp lỗi: HTTP ${res.status}${res.status === 404 ? ' – ' + OLD_SERVER : ''}`);
    setTimeout(reloadStageConfig, 800);
  }
  $('pace').addEventListener('input', () => { $('paceVal').textContent = $('pace').value + ' giây'; });
  $('pace').addEventListener('change', () => saveStage({ giftPacingMs: Math.round($('pace').value * 1000) }, `🐢 Khách lên tặng cách nhau ${$('pace').value} giây`));
  $('idleEvery').addEventListener('input', () => { $('idleVal').textContent = $('idleEvery').value + ' giây'; });
  $('idleEvery').addEventListener('change', () => saveStage({ idleEverySeconds: +$('idleEvery').value }, `🎉 Khách mời tự hoạt động mỗi ${$('idleEvery').value} giây`));
  $('musicEvery').addEventListener('input', () => { $('musicEveryVal').textContent = $('musicEvery').value + ' giây'; });
  $('musicEvery').addEventListener('change', () => saveStage({ musicEverySeconds: +$('musicEvery').value }, `🎵 Hết bài thì ${$('musicEvery').value} giây sau phát bài tiếp`));
  $('musicVol').addEventListener('input', () => { $('musicVolVal').textContent = Math.round($('musicVol').value * 100) + '%'; });
  $('musicVol').addEventListener('change', () => saveStage({ musicVolume: +$('musicVol').value }, `🔉 Âm lượng nhạc ${Math.round($('musicVol').value * 100)}%`));
  reloadStageConfig();

  Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/voice/config').then(r => r.json())])
    .then(([w, v]) => {
      showVoiceConfig(v);
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
  conn.on('VoiceConfigChanged', () => setTimeout(reloadVoiceConfig, 300));
  conn.on('BridgeStatus', (s) => {
    const el = $('status');
    el.className = 'status ' + (s.connected ? 'on' : 'off');
    el.textContent = s.connected
      ? `🟢 Đã kết nối live @${s.username}`
      : `⚪ Bridge TikTok: ${s.message || 'chưa kết nối'}`;
  });
  conn.start().catch(e => log('SignalR lỗi: ' + e));
})();
