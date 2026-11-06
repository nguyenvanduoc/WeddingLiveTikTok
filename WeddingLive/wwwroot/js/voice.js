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
    let current = null, stopCurrent = null;
    let realSpoken = () => { };                // game.js đăng ký để đo độ trễ (bridge nhận -> MC bắt đầu đọc)    // câu đang đọc + hàm ngắt nó (để quà/tin nhắn THẬT chen ngay)
    const PRIORITY_REAL = 3.8;                 // quà / bình luận THẬT từ TikTok: đọc đầu tiên
    let lastSpoke = performance.now() - 1e9;     // mở trang là MC chào ngay
    let topGifter = '';                          // người tặng nhiều nhất (cho câu dẫn có {top1})
    let meter = null;                            // thanh tình yêu: { points, left, next }
    let onSpeak = () => { }, onSilent = () => { };   // nhân vật MC: nhép miệng + phụ đề
    let announceIndex = 0, idleIndex = 0, autoCount = 0;
    let lastGiftAt = performance.now();         // lần gần nhất có quà thật (mở trang: chào mừng trước, 20s sau mới kêu gọi)
    const nextIdleLine = () => fill(cfg.idleLines[idleIndex++ % cfg.idleLines.length], base());   // xoay vòng, không lặp liền
    let isStageBusy = () => false;
    let isMusicPlaying = () => false;

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
      return key ? map[key] : (window.__giftCatalog?.[(name || '').toLowerCase()]?.vi || name || 'món quà');
    }

    // ---------------- Phát âm thanh ----------------
    const ttsUrl = (text) => '/api/tts?text=' + encodeURIComponent(text);
    function playUrl(url, onStart, preloaded) {
      return new Promise((resolve, reject) => {
        const a = preloaded || new Audio(url);
        a.volume = cfg.volume ?? 1;
        a.preservesPitch = true;                 // đọc nhanh mà không bị the thé
        a.playbackRate = cfg.clientSpeed || 1;   // giọng Google Translate: tăng tốc khi phát
        // Chống kẹt: nếu trình duyệt không báo "đã đọc xong" thì sau tối đa 25 giây vẫn đọc câu tiếp
        const guard = setTimeout(() => { try { a.pause(); } catch { } resolve(); }, 25000);
        stopCurrent = () => { clearTimeout(guard); try { a.pause(); } catch { } resolve(); };
        a.onended = () => { clearTimeout(guard); resolve(); };
        a.onerror = () => { clearTimeout(guard); reject(new Error('audio-error')); };
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
        stopCurrent = () => { speechSynthesis.cancel(); done(); };
        u.onend = done; u.onerror = done;
        speechSynthesis.speak(u);
      });
    }

    async function say(text, preloaded) {
      if (cfg.provider === 'browser') return speakBrowser(text);
      try {
        await playUrl(ttsUrl(text), () => setState('ok'), preloaded);
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

    // Độ ưu tiên thực tế: bình luận chờ > 4 giây được đọc TRƯỚC câu về quà (quà dồn dập không làm
    // bình luận bị bỏ quên); lời chào người vào chờ > 12 giây cũng được đẩy lên.
    function effective(q, now) {
      const waited = now - (q.at || now);
      if (q.real) return q.priority;                 // tin thật: luôn ở đầu hàng (theo thứ tự đến)
      if (q.chat && waited > 4000) return 3.7;
      if (q.join && waited > 12000) return 3.25;
      return q.priority;
    }
    function takeNext() {
      const now = performance.now();
      queue.sort((a, b) => effective(b, now) - effective(a, now));   // sort ổn định: cùng mức thì ai đến trước đọc trước
      return queue.shift();
    }

    async function pump() {
      if (playing || locked) return;
      const item = takeNext();
      if (!item) return;
      playing = true;
      current = item; stopCurrent = null;
      if (item.real && item.ts) realSpoken(item);
      onSpeak(item.text);
      try {
        if (silent()) {
          // Trang tắt tiếng (vd khung xem trước ở admin): MC vẫn nhép miệng + hiện phụ đề theo thời lượng ước tính
          await delay(Math.max(1200, item.text.length * 75 / (cfg.speed || 1)));
        } else {
          await say(item.text, item.audio);
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
      setTimeout(pump, queue.some(q => q.real) ? 50 : 250);   // còn tin thật => đọc tiếp liền
    }

    function enqueue(text, priority, extra = {}) {
      if (!text) return;
      // Hàng đợi quá dài (quà dồn dập): bỏ câu ít quan trọng / cũ nhất
      if (queue.length >= 12) {
        const now = performance.now();
        queue.sort((a, b) => effective(b, now) - effective(a, now));
        if (effective(queue.at(-1), now) <= priority) queue.pop(); else return;
      }
      const item = { text, priority, at: performance.now(), ...extra };
      // Tin THẬT: tải trước giọng đọc ngay khi nhận => tới lượt là phát liền, không chờ tạo giọng
      if (item.real && !silent() && cfg.provider !== 'browser') {
        try { item.audio = new Audio(ttsUrl(text)); item.audio.preload = 'auto'; item.audio.load(); } catch { item.audio = null; }
      }
      queue.push(item);
      // Tin THẬT tới trong lúc MC đang nói câu tự động / câu DEMO => ngắt câu đó, đọc tin thật ngay
      if (priority >= PRIORITY_REAL && playing && current && !current.real && current.priority < 4 && stopCurrent) {
        const stop = stopCurrent; stopCurrent = null; stop();
      }
      pump();
    }

    // ---------------- Chào người vào phòng ----------------
    const greeted = new Map();                 // người đã chào -> thời điểm
    let joinBuffer = [], joinTimer = null;
    function flushJoins() {
      joinTimer = null;
      const names = [...new Set(joinBuffer)];
      joinBuffer = [];
      if (!names.length || !cfg.joinGreetings?.length) return;
      // Đã có câu chào đang chờ đọc => gộp thêm tên vào câu đó thay vì xếp thêm câu mới
      const waiting = queue.find(q => q.join);
      const all = waiting ? [...new Set([...waiting.names, ...names])] : names;
      const shown = all.slice(0, 3), more = all.length - shown.length;
      const tpl = waiting?.tpl || pick(cfg.joinGreetings);
      const text = fill(tpl, {
        ...base(),
        names: more > 0 ? `${shown.join(', ')} và ${more} bạn khác` : shown.join(', ').replace(/, ([^,]*)$/, ' và $1')
      });
      if (waiting) { waiting.names = all; waiting.text = text; }
      else enqueue(text, 2, { join: true, names: all, tpl });
    }

    // ---------------- Bình luận: làm sạch + lọc từ cấm + chống spam ----------------
    // Thứ tự ưu tiên (số lớn đọc trước): admin 4 > QUÀ 3.5 > ôm hôn/khiêu vũ 3.3 > BÌNH LUẬN 3
    //   > CHÀO NGƯỜI VÀO 2 = cảm ơn follow > khích lệ 1 > khách mời 0.6 > mời gọi 0.5 > câu dẫn 0
    const PRIORITY_CHAT = 3;
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
        .replace(/\[[\p{L}\p{N}_ ]{1,20}\]/gu, ' ')       // mã biểu tượng cảm xúc TikTok: [wow] [smile]...
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

    // ---------------- MC tự nói khi sân khấu yên lặng ----------------
    // Vòng 3 câu: câu chúc hay -> câu dẫn -> (lâu không có quà ? câu kêu gọi tặng quà : câu chúc hay).
    // Trong lúc có nhạc: ~20 giây nói 1 câu chúc hay (nhạc nhỏ lại khi MC nói).
    let quoteIndex = 0, quoteOrder = [];
    const nextQuote = () => {
      if (!quoteOrder.length) quoteOrder = [...(cfg.weddingQuotes || [])].sort(() => Math.random() - 0.5);
      return fill(quoteOrder.shift() || '', base());
    };
    setInterval(() => {
      const every = (cfg.announceIntervalSeconds || 0) * 1000;
      if (!every || playing || locked || queue.length || isStageBusy()) return;
      const musicOn = isMusicPlaying();
      if (performance.now() - lastSpoke < (musicOn ? Math.max(every, 20000) : every)) return;
      const hasQuotes = !!cfg.weddingQuotes?.length;
      if (musicOn) { if (hasQuotes) enqueue(nextQuote(), 0); return; }
      const slot = autoCount++ % 3;
      const quiet = performance.now() - lastGiftAt > 20000;
      if (slot === 0 && hasQuotes) { enqueue(nextQuote(), 0); return; }
      if (slot === 2) {
        if (quiet && cfg.idleLines?.length) { enqueue(nextIdleLine(), 0); return; }
        if (hasQuotes) { enqueue(nextQuote(), 0); return; }
      }
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
      setMusicCheck(fn) { isMusicPlaying = fn; },
      onStateChange(fn) { onState = fn; },
      get state() { return state; },
      muted: MUTED_BY_URL,
      /** Trang này không phát tiếng (tắt bằng ?voice=0 hoặc Voice:Enabled = false). */
      get silent() { return MUTED_BY_URL || !cfg.enabled; },
      /** MC: gọi khi bắt đầu nói (kèm câu đang nói) và khi im lặng. */
      onSpeech(start, end) { onSpeak = start; onSilent = end; },
      /** Bình luận/tên có từ cấm không (sân khấu dùng để ẩn bong bóng chat). */
      isBlocked(e) { return isBanned(e?.comment) || isBanned(e?.nickname); },
      /** Trả về: 'queued' (đã xếp đọc) | 'off' | 'blocked' | 'empty' | 'dup' — để admin chẩn đoán. */
      readChat(e) {
        if (cfg.readChat === false) return 'off';
        if (this.isBlocked(e)) return 'blocked';
        const comment = cleanComment(e.comment);
        if (!comment) return 'empty';
        // Cùng người nhắn cùng câu trong 30 giây => chỉ đọc 1 lần
        const key = (e.userId || e.nickname) + '|' + comment.toLowerCase(), now = performance.now();
        if (recentChats.get(key) > now - 30000) return 'dup';
        recentChats.set(key, now);
        if (recentChats.size > 300) recentChats.clear();
        // Spam bình luận: chỉ giữ N bình luận mới nhất đang chờ đọc
        const waiting = queue.filter(q => q.chat && (e.demo || !q.real));   // bình luận thật không bị bỏ vì bình luận khác
        if (waiting.length >= (cfg.maxPendingChats || 4)) queue.splice(queue.indexOf(waiting[0]), 1);
        enqueue(fill(pick(cfg.chatTemplates || ['{name} nói: {comment}']), { ...base(), name: cleanName(e.nickname), comment }),
          e.demo ? 1.2 : PRIORITY_REAL, { chat: true, real: !e.demo, ts: e.ts, tiktokTs: e.tiktokTs, kind: 'chat' });
        return 'queued';
      },
      /** Khách mời trong tiệc lên chúc mừng (chỉ khi MC rảnh, ưu tiên thấp hơn mọi thứ từ TikTok). */
      npcVisit(name, offer) {
        if (playing || queue.length || !cfg.npcLines?.length) return;
        enqueue(fill(pick(cfg.npcLines), { ...base(), name, offer }), 0.6);
      },
      /** MC giới thiệu bài nhạc cưới. */
      musicLine() {
        if (cfg.musicLines?.length) enqueue(fill(pick(cfg.musicLines), base()), 1.5);
      },
      /** Sân khấu vắng: MC mời gọi người xem (chỉ khi MC đang rảnh). */
      idleLine() {
        if (playing || queue.length || !cfg.idleLines?.length) return;
        enqueue(nextIdleLine(), 0.5);
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
        if (list?.length) enqueue(fill(pick(list), base()), 3.3);
      },
      /** Cập nhật người tặng nhiều nhất (bảng xếp hạng). */
      setTopGifter(name) { topGifter = name ? cleanName(name) : ''; },
      /** Khách bắt đầu lên sân khấu: đọc tên người tặng + quà gì (mỗi quà 1 câu). */
      announceGift(gift) {
        lastGiftAt = performance.now();
        enqueue(fill(pick(cfg.giftAnnounce), giftData(gift)), gift.demo ? 1.2 : PRIORITY_REAL, { real: !gift.demo, ts: gift.ts, tiktokTs: gift.tiktokTs, kind: 'gift' });
      },
      /** Khách trao quà xong: quà lớn thì cảm ơn thêm; quà thường cảm ơn khi MC đang rảnh. */
      thankGift(gift, big) {
        if (big) enqueue(fill(pick(cfg.bigGiftThanks), giftData(gift)), 3.4);
        else if (!playing && !queue.length) enqueue(fill(pick(cfg.giftThanks), giftData(gift)), 1);
      },
      /** Đăng ký hàm nhận thông báo "MC bắt đầu đọc tin thật" (đo độ trễ). */
      onRealSpoken(fn) { realSpoken = fn; },
      /** Quà dồn quá nhiều: cảm ơn gộp những người không kịp lên sân khấu. */
      thankMany(names) {
        const list = [...new Set(names.map(cleanName))];
        if (!list.length) return;
        const shown = list.slice(0, 4), more = list.length - shown.length;
        const who = shown.join(', ') + (more > 0 ? ` và ${more} bạn khác` : '');
        enqueue(`Cảm ơn ${who} đã gửi quà chúc mừng cô dâu chú rể!`, 3.4);
      },
      thankFollow(e) {
        if (cfg.thankFollow && queue.length < 6) enqueue(fill(pick(cfg.followThanks), { ...base(), name: cleanName(e.nickname) }), 2);
      },
      /** Admin gõ câu cho MC đọc ngay. */
      speakNow(text) { enqueue(text, 4); },

      /**
       * Người mới vào phòng live: MC chào nhanh "Hello {names}!".
       * Gộp người vào gần nhau thành 1 câu (tối đa 3 tên + "và N bạn khác"); vào lại trong 10 phút không chào lại.
       */
      greetJoin(e) {
        if (cfg.greetJoin === false || isBanned(e?.nickname)) return;
        const key = e.userId || e.nickname, now = performance.now();
        if (greeted.get(key) > now - 10 * 60 * 1000) return;
        greeted.set(key, now);
        if (greeted.size > 2000) greeted.clear();
        joinBuffer.push(cleanName(e.nickname));
        if (!joinTimer) joinTimer = setTimeout(flushJoins, 1500);   // đợi 1,5s gom người vào cùng lúc
      },
      giftName
    };
  }

  window.WeddingVoice = { create };
})();
