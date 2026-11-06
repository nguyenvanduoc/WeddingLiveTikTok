// =====================================================================
//  NHẠC CƯỚI khi sân khấu vắng quà thật
//  - Có file trong wwwroot/music (mp3/ogg/m4a/wav) => phát lần lượt (xáo trộn, không lặp liền)
//  - Không có file => tự chơi nhạc bằng Web Audio (giai điệu cổ điển đã hết bản quyền:
//    "Bridal Chorus" của Wagner và "Canon" của Pachelbel) => không lo TikTok tắt tiếng vì bản quyền
//  - MC nói => nhạc nhỏ lại (duck); có quà thật => nhạc nhỏ dần rồi tắt
// =====================================================================
(function () {
  // Tần số nốt nhạc
  const N = {};
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
    for (let o = 2; o <= 6; o++) N[n + o] = 440 * Math.pow(2, (i - 9) / 12 + (o - 4));
  });

  // [nốt, số phách] — R = nghỉ
  const PIECES = [
    {
      name: 'Bridal Chorus (Wagner)', bpm: 72,
      melody: [
        ['G4', 1], ['C5', 0.75], ['C5', 0.25], ['C5', 2], ['G4', 1], ['D5', 0.75], ['B4', 0.25], ['C5', 2],
        ['G4', 1], ['C5', 0.75], ['F5', 0.25], ['F5', 1], ['E5', 0.75], ['D5', 0.25], ['C5', 1], ['B4', 0.75], ['C5', 0.25], ['D5', 2], ['R', 1],
        ['G4', 1], ['C5', 0.75], ['C5', 0.25], ['C5', 2], ['G4', 1], ['D5', 0.75], ['B4', 0.25], ['C5', 2],
        ['G4', 1], ['C5', 0.75], ['F5', 0.25], ['A5', 1], ['G5', 0.75], ['F5', 0.25], ['E5', 1], ['D5', 0.75], ['E5', 0.25], ['C5', 3], ['R', 1]
      ],
      // hợp âm nền mỗi 4 phách
      chords: [['C3', 'G3', 'E4'], ['G2', 'D3', 'B3'], ['C3', 'G3', 'E4'], ['F2', 'C3', 'A3'], ['C3', 'G3', 'E4'], ['G2', 'D3', 'B3'],
        ['C3', 'G3', 'E4'], ['G2', 'D3', 'B3'], ['C3', 'G3', 'E4'], ['F2', 'C3', 'A3'], ['C3', 'G3', 'E4'], ['G2', 'D3', 'B3'], ['C3', 'G3', 'C4']]
    },
    {
      name: 'Canon (Pachelbel)', bpm: 66,
      melody: [
        ['E5', 2], ['D5', 2], ['C5', 2], ['B4', 2], ['A4', 2], ['G4', 2], ['A4', 2], ['B4', 2],
        ['C5', 1], ['E5', 1], ['G5', 1], ['F5', 1], ['E5', 1], ['C5', 1], ['E5', 1], ['D5', 1],
        ['C5', 1], ['A4', 1], ['C5', 1], ['G4', 1], ['F4', 1], ['A4', 1], ['G4', 1], ['F4', 1],
        ['E4', 1], ['G4', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['C5', 1], ['B4', 1], ['G4', 1],
        ['C5', 1], ['E5', 1], ['G5', 1], ['F5', 1], ['E5', 1], ['C5', 1], ['E5', 1], ['D5', 1],
        ['C5', 4]
      ],
      // C G Am Em F C F G (mỗi hợp âm 2 phách)
      chords: [['C3', 'G3', 'E4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'C4'], ['E2', 'B2', 'G3'], ['F2', 'C3', 'A3'], ['C3', 'G3', 'E4'], ['F2', 'C3', 'A3'], ['G2', 'D3', 'B3']],
      chordBeats: 2, loopChords: true
    }
  ];

  function create(getCfg) {
    let ctx = null, master = null, audio = null, playing = false, stopTimer = null;
    let files = [], fileOrder = [], pieceIndex = 0, ducked = false, onEnd = () => { };
    // Trạng thái báo về admin: waiting (chờ tới lượt) | playing | blocked (trình duyệt chặn) | off
    let state = 'waiting', onState = () => { };
    let danceUntil = 0, danceTimer = null, danceDone = null;   // nhạc khiêu vũ: phát liên tục tới danceUntil
    const setState = (s) => { if (s !== state) { state = s; onState(s); } };

    // Trình duyệt chặn âm thanh khi chưa có thao tác của người dùng => bấm/chạm bất kỳ đâu là mở khóa
    function unlock() {
      if (ctx && ctx.state === 'suspended') ctx.resume().then(() => { if (playing) setState('playing'); }).catch(() => { });
      if (audio && audio.paused && playing) audio.play().then(() => setState('playing')).catch(() => { });
      document.querySelector('.music-unlock')?.remove();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

    function showBlocked() {
      setState('blocked');
      if (document.querySelector('.music-unlock, .voice-unlock')) return;   // đã có nút bật tiếng
      const btn = document.createElement('button');
      btn.className = 'voice-unlock music-unlock';
      btn.textContent = '🔊 Bấm để bật nhạc & giọng MC';
      btn.onclick = unlock;
      document.body.appendChild(btn);
    }
    const vol = () => Math.max(0, Math.min(1, getCfg().musicVolume ?? 0.35));
    const target = () => vol() * (ducked ? 0.3 : 1);

    async function loadFiles() {
      try { files = await (await fetch('/api/music')).json(); } catch { files = []; }
    }
    loadFiles();

    function nextFile() {
      if (!fileOrder.length) fileOrder = [...files].sort(() => Math.random() - 0.5);
      return fileOrder.shift();
    }

    // ---------- Nhạc tự tổng hợp (Web Audio) ----------
    function tone(freq, t, dur, type, gain) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.15, dur));
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    function playSynth() {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      // Sau 0,5s vẫn "suspended" => trình duyệt đang chặn tiếng
      setTimeout(() => { if (playing && ctx.state === 'suspended') showBlocked(); else if (playing) setState('playing'); }, 500);
      master = ctx.createGain();
      master.gain.value = target();
      master.connect(ctx.destination);
      const piece = PIECES[pieceIndex++ % PIECES.length];
      const beat = 60 / piece.bpm;
      let t = ctx.currentTime + 0.2, total = 0;
      piece.melody.forEach(([n, b]) => {
        if (n !== 'R') {
          tone(N[n], t + total * beat, b * beat * 0.95, 'triangle', 0.22);
          tone(N[n] * 2, t + total * beat, b * beat * 0.6, 'sine', 0.05);   // ánh kim nhẹ kiểu chuông
        }
        total += b;
      });
      const cb = piece.chordBeats || 4;
      const nChords = piece.loopChords ? Math.ceil(total / cb) : piece.chords.length;
      for (let i = 0; i < nChords; i++) {
        const chord = piece.chords[i % piece.chords.length];
        chord.forEach((n, k) => tone(N[n], t + i * cb * beat + k * 0.04, cb * beat * 0.98, 'sine', 0.07));
      }
      const seconds = total * beat + 1.2;
      stopTimer = setTimeout(() => finish(), seconds * 1000);
      return piece.name;
    }

    // ---------- Phát file nhạc ----------
    function playFile(file, maxSeconds) {
      audio = new Audio('/music/' + encodeURIComponent(file));
      audio.volume = target();
      audio.onended = () => finish();
      audio.onerror = () => { audio = null; playSynth(); };
      audio.play().then(() => setState('playing')).catch((err) => {
        if (err && err.name === 'NotAllowedError') showBlocked();   // bị chặn: giữ bài, chờ bấm mở khóa
        else { audio = null; playSynth(); }
      });
      const max = (maxSeconds ?? getCfg().musicMaxSeconds ?? 90) * 1000;
      stopTimer = setTimeout(() => stop(true), max);   // bài quá dài: cắt sau musicMaxSeconds (nhỏ dần)
      return file;
    }

    function finish() {
      clearTimeout(stopTimer);
      if (audio) { audio.pause(); audio = null; }
      if (master) { try { master.disconnect(); } catch { } master = null; }
      // Đang khiêu vũ mà bài hết sớm => nối ngay bài tiếp cho đủ thời gian
      if (playing && danceUntil && performance.now() < danceUntil - 4000) {
        files.length ? playFile(nextFile(), (danceUntil - performance.now()) / 1000) : playSynth();
        return;
      }
      if (playing) {
        playing = false; setState('waiting');
        const cb = danceDone; danceUntil = 0; danceDone = null; clearTimeout(danceTimer);
        cb?.();
        onEnd();
      }
    }

    function stop(fade = true, ms = 1500) {
      if (!playing) return;
      danceUntil = 0;                         // dừng hẳn (không nối bài khiêu vũ)
      if (!fade) return finish();
      const steps = 15;
      let i = 0;
      const start = audio ? audio.volume : master?.gain.value ?? 0;
      const iv = setInterval(() => {
        i++;
        const v = start * (1 - i / steps);
        if (audio) audio.volume = Math.max(0, v);
        if (master) master.gain.value = Math.max(0, v);
        if (i >= steps) { clearInterval(iv); finish(); }
      }, ms / steps);
    }

    return {
      get playing() { return playing; },
      get state() { return state; },
      onStateChange(fn) { onState = fn; },
      setOff(off) { if (off) setState('off'); else if (state === 'off') setState('waiting'); },
      onEnd(fn) { onEnd = fn; },
      reload: loadFiles,
      /** Phát 1 bài. Trả về tên bài. */
      play() {
        if (playing) return null;
        playing = true;
        clearTimeout(stopTimer);
        return files.length ? playFile(nextFile()) : playSynth();
      },
      /**
       * Nhạc khiêu vũ: phát LIÊN TỤC `seconds` giây (nối nhiều bài nếu cần) rồi nhỏ dần tắt; xong gọi onDone.
       * Đang có bài khác thì bài đó nhường chỗ.
       */
      playDance(seconds, onDone) {
        const start = () => {
          playing = true;
          clearTimeout(stopTimer);
          danceUntil = performance.now() + seconds * 1000;
          danceDone = onDone;
          clearTimeout(danceTimer);
          danceTimer = setTimeout(() => stop(true), Math.max(1000, seconds * 1000 - 1500));   // 1,5s cuối nhỏ dần
          return files.length ? playFile(nextFile(), seconds) : playSynth();
        };
        if (playing) {                         // bài đang phát nhỏ dần trong 0,6s rồi vào nhạc khiêu vũ
          const prevEnd = onEnd; onEnd = () => { };
          stop(true, 600);
          setTimeout(() => { onEnd = prevEnd; start(); }, 700);
          return 'dance';
        }
        return start();
      },
      stop,
      /** MC đang nói => nhạc nhỏ lại. */
      duck(on) {
        ducked = on;
        if (audio) audio.volume = target();
        if (master && ctx) master.gain.setTargetAtTime(target(), ctx.currentTime, 0.15);
      }
    };
  }

  window.WeddingMusic = { create };
})();
