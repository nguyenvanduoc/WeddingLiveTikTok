// =====================================================================
//  MC ẢO – đọc lời giới thiệu đám cưới + cảm ơn khi có quà/follow
//  - Phát MP3 từ /api/tts (Google/Azure) qua thẻ <audio> => OBS thu được tiếng
//    khi bật "Control audio via OBS" trên Browser Source.
//  - Lỗi mạng/TTS => tự chuyển sang giọng của trình duyệt (speechSynthesis).
//  - Thêm ?voice=0 vào URL để tắt tiếng (trang admin dùng cách này cho khung xem trước).
// =====================================================================
(function () {
  const MUTED_BY_URL = new URLSearchParams(location.search).get('voice') === '0';

  function create(wedding) {
    let cfg = { enabled: false };
    const queue = [];            // { text, priority }  3 = admin, 2 = đọc tên người tặng quà, 1 = follow/cảm ơn, 0 = câu dẫn
    let playing = false, locked = false;
    let lastSpoke = performance.now() - 1e9;     // mở trang là MC chào ngay
    let topGifter = '';                          // người tặng nhiều nhất (cho câu dẫn có {top1})
    let meter = null;                            // thanh tình yêu: { points, left, next }
    let onSpeak = () => { }, onSilent = () => { };   // nhân vật MC: nhép miệng + phụ đề
    let announceIndex = 0;
    let isStageBusy = () => false;

    // Trạng thái giọng (báo về server để trang admin chẩn đoán):
    // waiting | ok | blocked (trình duyệt chặn) | fallback (server TTS lỗi, dùng giọng trình duyệt) | disabled | muted
    let state = 'waiting', onState = () => { };
    const setState = (s) => { if (s !== state) { state = s; onState(s); } };

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const fill = (tpl, data) => tpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
    const base = () => ({
      bride: wedding.brideName, groom: wedding.groomName, top1: topGifter,
      points: meter?.points ?? '', left: meter?.left ?? '', next: meter?.next ?? ''
    });
    const giftData = (g) => ({ ...base(), name: cleanName(g.nickname), count: g.count, gift: giftName(g.giftName) });

    // Tên TikTok hay có emoji/ký hiệu => bỏ đi cho dễ đọc
    function cleanName(s) {
      const t = (s || '').normalize('NFC').replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
      return t.slice(0, 30) || 'bạn';
    }

    function giftName(name) {
      const map = cfg.giftNames || {};
      const key = Object.keys(map).find(k => k.toLowerCase() === (name || '').toLowerCase());
      return key ? map[key] : (name || 'món quà');
    }

    // ---------------- Phát âm thanh ----------------
    function playUrl(url, onStart) {
      return new Promise((resolve, reject) => {
        const a = new Audio(url);
        a.volume = cfg.volume ?? 1;
        a.preservesPitch = true;                 // đọc nhanh mà không bị the thé
        a.playbackRate = cfg.clientSpeed || 1;   // giọng Google Translate: tăng tốc khi phát
        a.onended = () => resolve();
        a.onerror = () => reject(new Error('audio-error'));
        a.play().then(onStart).catch(reject);   // NotAllowedError = trình duyệt chặn tự phát âm thanh
      });
    }

    function speakBrowser(text) {
      return new Promise(resolve => {
        if (!('speechSynthesis' in window)) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        const vi = speechSynthesis.getVoices().find(v => (v.lang || '').toLowerCase().startsWith('vi'));
        if (vi) u.voice = vi;
        u.volume = cfg.volume ?? 1;
        u.rate = cfg.speed || 1;
        const done = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(done, 20000);
        u.onend = done; u.onerror = done;
        speechSynthesis.speak(u);
      });
    }

    async function say(text) {
      if (cfg.provider === 'browser') return speakBrowser(text);
      try {
        await playUrl('/api/tts?text=' + encodeURIComponent(text), () => setState('ok'));
      } catch (err) {
        if (err && err.name === 'NotAllowedError') throw err;
        console.warn('TTS server lỗi, dùng giọng trình duyệt', err);
        setState('fallback');
        await speakBrowser(text);
      }
    }

    // ---------------- Hàng đợi lời nói ----------------
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const silent = () => MUTED_BY_URL || !cfg.enabled;

    function takeNext() {
      queue.sort((a, b) => b.priority - a.priority);   // sort ổn định: cùng mức thì ai đến trước đọc trước
      return queue.shift();
    }

    async function pump() {
      if (playing || locked) return;
      const item = takeNext();
      if (!item) return;
      playing = true;
      onSpeak(item.text);
      try {
        if (silent()) {
          // Trang tắt tiếng (vd khung xem trước ở admin): MC vẫn nhép miệng + hiện phụ đề theo thời lượng ước tính
          await delay(Math.max(1200, item.text.length * 75 / (cfg.speed || 1)));
        } else {
          await say(item.text);
        }
      } catch (err) {
        if (err && err.name === 'NotAllowedError') {   // bị chặn autoplay: giữ câu lại, hiện nút bật tiếng
          queue.unshift({ ...item, priority: 9 });
          playing = false;
          onSilent();
          showUnlock();
          return;
        }
      }
      playing = false;
      onSilent();
      lastSpoke = performance.now();
      setTimeout(pump, 250);
    }

    function enqueue(text, priority, extra = {}) {
      if (!text) return;
      // Hàng đợi quá dài (quà dồn dập): bỏ câu ít quan trọng / cũ nhất
      if (queue.length >= 12) {
        queue.sort((a, b) => b.priority - a.priority);
        if (queue.at(-1).priority <= priority) queue.pop(); else return;
      }
      queue.push({ text, priority, ...extra });
      pump();
    }

    // ---------------- Bình luận: làm sạch + lọc từ cấm + chống spam ----------------
    const PRIORITY_CHAT = 2.8;                 // đọc trước câu đọc tên người tặng (2) và ôm hôn/khiêu vũ (2.5), sau admin (3)
    const recentChats = new Map();             // "người|câu" -> thời điểm đã nhận
    const noMarks = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

    function isBanned(text) {
      const words = cfg.bannedWords || [];
      if (!words.length || !text) return false;
      const raw = text.toLowerCase(), plain = noMarks(text);
      const tokens = new Set(raw.split(/[^\p{L}\p{N}]+/u).concat(plain.split(/[^a-z0-9]+/)));
      return words.some(w => {
        const lw = w.toLowerCase().trim(), pw = noMarks(w).trim();
        if (!lw) return false;
        // Từ ngắn (vd "vl", "dm") chỉ khớp nguyên từ để không chặn nhầm "admin", "vlog"...
        if (pw.length <= 3) return tokens.has(lw) || (lw === pw && tokens.has(pw));
        return raw.includes(lw) || (lw === pw ? plain.includes(pw) : false);
      });
    }

    /** Làm sạch bình luận để đọc; trả về null nếu không nên đọc (link, toàn emoji, từ cấm). */
    function cleanComment(s) {
      if (!s || /(https?:\/\/|www\.|\.com\b|\.vn\b)/i.test(s)) return null;
      let t = s.normalize('NFC')
        .replace(/[^\p{L}\p{N}\s.,!?'"-]/gu, ' ')     // bỏ emoji, ký hiệu
        .replace(/([!?.,])\1+/g, '$1')                  // "!!!!" -> "!"
        .replace(/(\p{L})\1{3,}/gu, '$1$1')             // "quáaaaaa" -> "quáa"
        .replace(/\s+/g, ' ').trim();
      if ((t.match(/\p{L}/gu) || []).length < 2) return null;   // toàn emoji / ký hiệu
      const max = cfg.maxChatLength || 100;
      if (t.length > max) t = t.slice(0, t.lastIndexOf(' ', max) > max / 2 ? t.lastIndexOf(' ', max) : max) + '…';
      return t;
    }

    // ---------------- Nút bật âm thanh (khi trình duyệt chặn autoplay) ----------------
    function showUnlock() {
      if (locked) return;
      locked = true;
      setState('blocked');
      const btn = document.createElement('button');
      btn.className = 'voice-unlock';
      btn.textContent = '🔊 Bấm để bật giọng MC';
      btn.onclick = () => { btn.remove(); locked = false; pump(); };
      document.body.appendChild(btn);
    }

    // ---------------- MC tự nói câu dẫn khi sân khấu yên lặng ----------------
    setInterval(() => {
      const every = (cfg.announceIntervalSeconds || 0) * 1000;
      if (!every || playing || locked || queue.length || isStageBusy()) return;
      if (performance.now() - lastSpoke < every) return;
      const list = cfg.announcements || [];
      // Bỏ qua câu có {top1} khi chưa ai tặng quà
      for (let tries = 0; tries < list.length; tries++) {
        const tpl = list[announceIndex++ % list.length];
        if (tpl.includes('{top1}') && !topGifter) continue;
        if (/\{(left|points|next)\}/.test(tpl) && !meter) continue;
        enqueue(fill(tpl, base()), 0);
        break;
      }
    }, 500);

    return {
      async load() {
        try { cfg = await (await fetch('/api/voice/config')).json(); } catch { cfg = { enabled: false }; }
        if ('speechSynthesis' in window) speechSynthesis.getVoices();   // nạp sẵn danh sách giọng
        if (MUTED_BY_URL) setState('muted'); else if (!cfg.enabled) setState('disabled');
        return cfg;
      },
      setBusyCheck(fn) { isStageBusy = fn; },
      onStateChange(fn) { onState = fn; },
      get state() { return state; },
      muted: MUTED_BY_URL,
      /** Trang này không phát tiếng (tắt bằng ?voice=0 hoặc Voice:Enabled = false). */
      get silent() { return MUTED_BY_URL || !cfg.enabled; },
      /** MC: gọi khi bắt đầu nói (kèm câu đang nói) và khi im lặng. */
      onSpeech(start, end) { onSpeak = start; onSilent = end; },
      /** Bình luận/tên có từ cấm không (sân khấu dùng để ẩn bong bóng chat). */
      isBlocked(e) { return isBanned(e?.comment) || isBanned(e?.nickname); },
      /** Bình luận trên live: MC ưu tiên đọc. */
      readChat(e) {
        if (cfg.readChat === false || this.isBlocked(e)) return;
        const comment = cleanComment(e.comment);
        if (!comment) return;
        // Cùng người nhắn cùng câu trong 30 giây => chỉ đọc 1 lần
        const key = (e.userId || e.nickname) + '|' + comment.toLowerCase(), now = performance.now();
        if (recentChats.get(key) > now - 30000) return;
        recentChats.set(key, now);
        if (recentChats.size > 300) recentChats.clear();
        // Spam bình luận: chỉ giữ N bình luận mới nhất đang chờ đọc
        const waiting = queue.filter(q => q.chat);
        if (waiting.length >= (cfg.maxPendingChats || 4)) queue.splice(queue.indexOf(waiting[0]), 1);
        enqueue(fill(pick(cfg.chatTemplates || ['{name} nói: {comment}']), { ...base(), name: cleanName(e.nickname), comment }), PRIORITY_CHAT, { chat: true });
      },
      /** Cập nhật thanh tình yêu: { points, left, next } (dùng cho {points} {left} {next}). */
      setMeter(m) { meter = m; },
      /** Khích lệ người xem tặng quà (khi thanh tình yêu được 50% / 80%). */
      cheer() {
        if (cfg.meterCheer?.length && queue.length < 4) enqueue(fill(pick(cfg.meterCheer), base()), 1);
      },
      /** Cô dâu chú rể ôm hôn ('hug') / khiêu vũ ('dance'). */
      coupleAction(a) {
        const list = a === 'dance' ? cfg.danceLines : cfg.hugLines;
        if (list?.length) enqueue(fill(pick(list), base()), 2.5);
      },
      /** Cập nhật người tặng nhiều nhất (bảng xếp hạng). */
      setTopGifter(name) { topGifter = name ? cleanName(name) : ''; },
      /** Khách bắt đầu lên sân khấu: đọc tên người tặng + quà gì (mỗi quà 1 câu). */
      announceGift(gift) {
        enqueue(fill(pick(cfg.giftAnnounce), giftData(gift)), 2);
      },
      /** Khách trao quà xong: quà lớn thì cảm ơn thêm; quà thường cảm ơn khi MC đang rảnh. */
      thankGift(gift, big) {
        if (big) enqueue(fill(pick(cfg.bigGiftThanks), giftData(gift)), 2);
        else if (!playing && !queue.length) enqueue(fill(pick(cfg.giftThanks), giftData(gift)), 1);
      },
      thankFollow(e) {
        if (cfg.thankFollow && queue.length < 3) enqueue(fill(pick(cfg.followThanks), { ...base(), name: cleanName(e.nickname) }), 1);
      },
      /** Admin gõ câu cho MC đọc ngay. */
      speakNow(text) { enqueue(text, 3); },
      giftName
    };
  }

  window.WeddingVoice = { create };
})();
