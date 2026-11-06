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
    const queue = [];            // { text, priority }  priority: 3 = admin, 2 = quà lớn, 1 = follow, 0 = giới thiệu
    let pendingThanks = [];      // quà thường chờ cảm ơn (gộp lại nếu nhiều)
    let playing = false, locked = false;
    let lastSpoke = performance.now() - 50000;   // ~10s sau khi mở trang sẽ đọc câu chào
    let announceIndex = 0;
    let isStageBusy = () => false;

    // Trạng thái giọng (báo về server để trang admin chẩn đoán):
    // waiting | ok | blocked (trình duyệt chặn) | fallback (server TTS lỗi, dùng giọng trình duyệt) | disabled | muted
    let state = 'waiting', onState = () => { };
    const setState = (s) => { if (s !== state) { state = s; onState(s); } };

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const fill = (tpl, data) => tpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
    const base = () => ({ bride: wedding.brideName, groom: wedding.groomName });

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
    function takeNext() {
      queue.sort((a, b) => b.priority - a.priority);
      if (queue.length && queue[0].priority >= 2) return queue.shift();
      if (pendingThanks.length) {
        const list = pendingThanks; pendingThanks = [];
        if (list.length === 1) {
          const g = list[0];
          return { text: fill(pick(cfg.giftThanks), { ...base(), name: cleanName(g.nickname), count: g.count, gift: giftName(g.giftName) }) };
        }
        // Nhiều quà dồn lại => cảm ơn gộp 1 câu
        const names = [...new Set(list.map(g => cleanName(g.nickname)))];
        const shown = names.slice(0, 3);
        const more = names.length - shown.length;
        const joined = shown.length > 1 ? shown.slice(0, -1).join(', ') + ' và ' + shown.at(-1) : shown[0];
        return { text: fill(pick(cfg.groupThanks), { ...base(), names: more > 0 ? `${shown.join(', ')} và ${more} bạn khác` : joined }) };
      }
      return queue.shift();
    }

    async function pump() {
      if (playing || locked || !cfg.enabled || MUTED_BY_URL) return;
      const item = takeNext();
      if (!item) return;
      playing = true;
      try {
        await say(item.text);
      } catch (err) {
        if (err && err.name === 'NotAllowedError') {   // bị chặn autoplay: giữ câu lại, hiện nút bật tiếng
          queue.unshift({ ...item, priority: 9 });
          playing = false;
          showUnlock();
          return;
        }
      }
      playing = false;
      lastSpoke = performance.now();
      setTimeout(pump, 400);
    }

    function enqueue(text, priority) {
      if (!cfg.enabled || MUTED_BY_URL || !text) return;
      // Không để hàng đợi quá dài: bỏ câu ít quan trọng nhất
      if (queue.length >= 6) {
        queue.sort((a, b) => b.priority - a.priority);
        if (queue.at(-1).priority <= priority) queue.pop(); else return;
      }
      queue.push({ text, priority });
      pump();
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

    // ---------------- MC tự giới thiệu khi sân khấu yên lặng ----------------
    setInterval(() => {
      const every = (cfg.announceIntervalSeconds || 0) * 1000;
      if (!every || playing || locked || queue.length || pendingThanks.length || isStageBusy()) return;
      if (performance.now() - lastSpoke < every) return;
      const list = cfg.announcements || [];
      if (!list.length) return;
      enqueue(fill(list[announceIndex++ % list.length], base()), 0);
    }, 2000);

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
      /** Gọi khi khách trao quà xong. */
      thankGift(gift, big) {
        if (big) {
          enqueue(fill(pick(cfg.bigGiftThanks), { ...base(), name: cleanName(gift.nickname), count: gift.count, gift: giftName(gift.giftName) }), 2);
        } else {
          pendingThanks.push(gift);
          pump();
        }
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
