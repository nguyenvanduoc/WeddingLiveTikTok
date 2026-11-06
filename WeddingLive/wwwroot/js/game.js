// =====================================================================
//  SÂN KHẤU ĐÁM CƯỚI – Phaser 3 + SignalR
//  Cô dâu chú rể ở trên, khách ở dưới. Khi có quà từ TikTok:
//  1 khách rảnh nhận tên người tặng -> cầm quà đi lên -> tặng -> quay về.
// =====================================================================
(async function () {
  const W = 1280, H = 720;
  const CENTER_X = W / 2;
  const params = new URLSearchParams(location.search);
  const TRANSPARENT = params.get('bg') === '0';     // ?bg=0 => nền trong suốt cho OBS
  const { FONT, makePerson, makeLabel, makeChair, baked, startWalk, stopWalk, setFacing } = window.Chars;
  if (TRANSPARENT) document.body.classList.add('transparent');

  // Cấu hình từ server (tên cô dâu chú rể, số khách...)
  let cfg = { brideName: 'Cô Dâu', groomName: 'Chú Rể', title: 'Đám Cưới Online', guestCount: 6, tables: 5, guestsPerTable: 10, bigGiftDiamonds: 99 };
  try { cfg = { ...cfg, ...(await (await fetch('/api/config')).json()) }; } catch { /* dùng mặc định */ }

  // Tên quà -> emoji hiển thị trên tay khách
  const GIFT_EMOJI = [
    [/rose|hoa hồng/i, '🌹'], [/finger heart/i, '🫰'], [/hand heart/i, '🫶'], [/heart|love|tim/i, '💗'],
    [/tiktok/i, '🎵'], [/ice cream/i, '🍦'], [/doughnut|donut/i, '🍩'], [/cake|bánh/i, '🎂'],
    [/perfume/i, '🌸'], [/galaxy/i, '🌌'], [/universe|planet/i, '🪐'], [/lion/i, '🦁'],
    [/rocket/i, '🚀'], [/car/i, '🏎️'], [/ring|nhẫn/i, '💍'], [/crown/i, '👑'], [/flower|bouquet/i, '💐'],
    [/sunglass/i, '🕶️'], [/coffee/i, '☕'], [/money|gun/i, '💸'], [/confetti/i, '🎊'],
    [/swan/i, '🦢'], [/butterfly/i, '🦋'], [/star/i, '⭐'], [/gg/i, '🎮'], [/rainbow/i, '🌈'], [/kiss/i, '💋']
  ];
  const giftEmoji = (name) => (GIFT_EMOJI.find(([re]) => re.test(name)) || [, '🎁'])[1];
  const isBig = (g) => (g.diamondValue * g.count) >= cfg.bigGiftDiamonds;

  // MC ảo (giọng đọc)
  const voice = window.WeddingVoice.create(cfg);
  await voice.load();

  // Bàn tiệc tròn. Vị trí xếp theo thứ tự ưu tiên; s = tỉ lệ thu nhỏ (bàn xa sân khấu hơn thì to hơn).
  const TABLE_SPOTS = [
    { x: CENTER_X, y: 668, s: 0.74 },   // giữa hàng trước (cuối thảm đỏ)
    { x: 330, y: 530, s: 0.62 },        // hàng sau bên trái
    { x: 950, y: 530, s: 0.62 },        // hàng sau bên phải
    { x: 195, y: 668, s: 0.74 },        // hàng trước bên trái
    { x: 1085, y: 668, s: 0.74 }        // hàng trước bên phải
  ];
  const TABLES = Phaser.Math.Clamp(cfg.tables ?? 0, 0, TABLE_SPOTS.length);
  const PER_TABLE = Phaser.Math.Clamp(cfg.guestsPerTable ?? 10, 4, 12);
  const HAS_TABLE = TABLES > 0;
  const TABLE_RX = 165, TABLE_RY = 42;  // bán kính mặt bàn ở tỉ lệ 1
  const LANE_Y = 465;      // "lối đi ngang" phía trước sân khấu
  const WALK_SCALE = 0.9;  // cỡ nhân vật khi lên sân khấu

  class WeddingScene extends Phaser.Scene {
    constructor() { super('wedding'); }

    create() {
      this.guests = [];
      this.queue = [];                 // quà đang chờ khách rảnh
      this.coupleQueue = [];           // màn diễn của cô dâu chú rể chờ diễn: 'hug' | 'dance'
      this.coupleBusy = false;
      this.meterSeq = -1;
      this.pendingMeter = null;
      this.slots = [                   // vị trí đứng tặng quà: cạnh cô dâu, cạnh chú rể, chính giữa phía trước
        { x: CENTER_X - 170, y: 365, busy: false },
        { x: CENTER_X + 170, y: 365, busy: false },
        { x: CENTER_X, y: 475, busy: false }
      ];

      this.makeTextures();
      if (!TRANSPARENT) this.drawVenue();
      this.drawCouple();
      this.drawMC();
      this.drawGuests();
      this.drawHud();
      this.makeEffects();
      this.connectSignalR();
      // MC không đọc lời giới thiệu khi đang có khách lên tặng quà
      voice.setBusyCheck(() => this.queue.length > 0 || this.guests.some(g => g.busy));
    }

    // ---------------- Texture dùng cho hiệu ứng hạt ----------------
    makeTextures() {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
      g.generateTexture('dot', 12, 12);
      g.clear();
      g.fillStyle(0xffffff, 1).fillCircle(7, 7, 7).fillCircle(17, 7, 7).fillTriangle(0.5, 10, 23.5, 10, 12, 23);
      g.generateTexture('heart', 24, 24);
      g.destroy();
    }

    // ---------------- Khung cảnh lễ cưới ----------------
    drawVenue() {
      // Vẽ khung cảnh tĩnh 1 lần vào RenderTexture (như chụp thành ảnh) => mỗi khung hình
      // không phải tính lại hàng trăm hình tròn/tam giác, nhẹ máy hơn nhiều.
      const g = this.make.graphics({ add: false });
      g.fillGradientStyle(0x3b1f5c, 0x3b1f5c, 0xc06c9a, 0xc06c9a, 1).fillRect(0, 0, W, 330);   // trời
      g.fillGradientStyle(0xf9d9e6, 0xf9d9e6, 0xfdeef4, 0xfdeef4, 1).fillRect(0, 330, W, H - 330); // sàn

      // Sân khấu
      g.fillStyle(0xe7a5c0, 1).fillRoundedRect(330, 285, 620, 100, 24);
      g.fillStyle(0xd88aab, 1).fillRect(350, 368, 580, 16);
      g.fillStyle(0xf3c2d6, 1).fillRect(560, 384, 160, 10).fillRect(545, 394, 190, 10);

      // Thảm đỏ
      const carpetEnd = HAS_TABLE ? 640 : H, spread = (carpetEnd - 404) * 70 / (H - 404);
      g.fillStyle(0xc9184a, 1).fillPoints([{ x: 590, y: 404 }, { x: 690, y: 404 },
        { x: 690 + spread, y: carpetEnd }, { x: 590 - spread, y: carpetEnd }], true);
      g.fillStyle(0xffd166, 0.7).fillRect(588, 404, 4, 4);

      // Cổng hoa
      g.lineStyle(16, 0xffffff, 1);
      g.beginPath(); g.arc(CENTER_X, 330, 215, Math.PI, 2 * Math.PI); g.strokePath();
      g.fillStyle(0xffffff, 1).fillRect(CENTER_X - 223, 330, 16, 50).fillRect(CENTER_X + 207, 330, 16, 50);
      const colors = [0xff4d6d, 0xffb3c6, 0xffffff, 0xff8fab, 0xc9184a];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI + (i / 24) * Math.PI;
        const x = CENTER_X + Math.cos(a) * 215, y = 330 + Math.sin(a) * 215;
        g.fillStyle(0x52b788, 1).fillEllipse(x + 8, y + 4, 14, 8);
        g.fillStyle(colors[i % colors.length], 1).fillCircle(x, y, 11);
        g.fillStyle(0xffe5ec, 1).fillCircle(x, y, 4);
      }

      // Dây đèn lấp lánh
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(0, 30), new Phaser.Math.Vector2(CENTER_X, 140), new Phaser.Math.Vector2(W, 30));
      g.lineStyle(2, 0xffffff, 0.4); curve.draw(g, 64);
      const venue = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(0);
      venue.draw(g);
      g.destroy();
      curve.getPoints(30).forEach((p, i) => {
        const bulb = this.add.circle(p.x, p.y + 6, 5, [0xffe066, 0xffffff, 0xffafcc][i % 3]);
        this.tweens.add({ targets: bulb, alpha: 0.25, duration: 600 + (i % 5) * 180, yoyo: true, repeat: -1, delay: i * 70 });
      });

      // Tim bay nhẹ trên nền trời
      this.add.particles(0, 0, 'heart', {
        x: { min: 0, max: W }, y: 340, lifespan: 7000, speedY: { min: -25, max: -50 }, speedX: { min: -10, max: 10 },
        scale: { start: 0.6, end: 0.2 }, alpha: { start: 0.35, end: 0 }, tint: [0xffafcc, 0xffffff, 0xff8fab], frequency: 700
      }).setDepth(1);
    }

    // ---------------- Cô dâu chú rể ----------------
    drawCouple() {
      this.bride = makePerson(this, CENTER_X - 60, 340, 'bride');
      this.groom = makePerson(this, CENTER_X + 60, 340, 'groom');
      [this.bride, this.groom].forEach(p => p.root.setDepth(340));
      // nhún nhẹ liên tục cho sống động
      this.tweens.add({ targets: [this.bride.puppet, this.groom.puppet], y: -3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      const tag = (x, text) => makeLabel(this, text, { fontSize: '17px', bg: 0xffffff, bgAlpha: 0.9, color: '#c9184a', stroke: 0xff8fab })
        .setPosition(x, 360).setDepth(345);
      tag(CENTER_X - 70, '👰 ' + cfg.brideName);
      tag(CENTER_X + 70, '🤵 ' + cfg.groomName);
      this.add.text(CENTER_X, 205, '💕', { fontFamily: FONT, fontSize: '34px' }).setOrigin(0.5).setDepth(341);
    }

    // ---------------- MC đứng bên trái sân khấu + khung phụ đề ----------------
    drawMC() {
      const x = 372, y = 352;
      this.mc = makePerson(this, x, y, 'mc');
      this.mc.root.setScale(1.1).setDepth(y);
      makeLabel(this, '🎤 MC', { fontSize: '13px', bg: 0xc9184a, bgAlpha: 0.92 }).setPosition(x, y + 14).setDepth(y + 1);
      // Đứng yên: đung đưa nhẹ
      this.tweens.add({ targets: this.mc.puppet, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // Phụ đề: hiện đúng câu MC đang đọc (khung trắng góc trái, đuôi chỉ vào MC)
      this.sub = this.add.container(20, 145).setDepth(905).setAlpha(0);
      this.subBg = this.add.graphics();
      this.subText = this.add.text(14, 10, '', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#5c0f2a',
        wordWrap: { width: 272, useAdvancedWrap: true }, lineSpacing: 2
      });
      this.sub.add([this.subBg, this.subText]);
      this.mcTalk = [];
      voice.onSpeech(text => this.mcSpeak(text), () => this.mcSilent());
    }

    mcSpeak(text) {
      const w = 300;
      this.subText.setText((voice.silent ? '🔇 (khung này tắt tiếng) ' : '🎤 ') + text);
      const h = this.subText.height + 20;
      const tipX = 372 - 20 - 16, tipY = 352 - 145 - 118;          // đầu MC, tính theo gốc khung phụ đề
      const by = Phaser.Math.Clamp(tipY, 18, h - 18);
      this.subBg.clear()
        .fillStyle(0xffffff, 0.96).fillRoundedRect(0, 0, w, h, 14)
        .fillTriangle(w - 2, by - 9, w - 2, by + 9, tipX, tipY)
        .lineStyle(3, 0xc9184a, 1).strokeRoundedRect(0, 0, w, h, 14);
      this.tweens.add({ targets: this.sub, alpha: 1, duration: 120 });

      // Nhép miệng + nhún người khi nói
      this.mcTalk.forEach(t => t.stop());
      this.mc.mouth.setVisible(true);
      this.mcTalk = [
        this.tweens.add({ targets: this.mc.mouth, scaleY: { from: 0.3, to: 1.3 }, duration: 90, yoyo: true, repeat: -1 }),
        this.tweens.add({ targets: this.mc.root, y: 352 - 3, duration: 180, yoyo: true, repeat: -1 })
      ];
    }

    mcSilent() {
      this.mcTalk.forEach(t => t.stop());
      this.mcTalk = [];
      this.mc.mouth.setVisible(false);
      this.mc.root.y = 352;
      this.tweens.add({ targets: this.sub, alpha: 0, duration: 250 });
    }

    // ---------------- Khách mời ở dưới ----------------
    // Mỗi khách có: home (chỗ ngồi), path (các điểm đi từ chỗ ngồi ra lối đi ngang),
    // seatFacing (hướng mặt khi ngồi yên), baseScale (to nhỏ theo xa gần).
    addGuest(x, y, opts = {}) {
      const i = this.guests.length;
      const scale = opts.scale ?? 1;
      if (!TRANSPARENT && opts.chair !== false) makeChair(this, x, y, scale).setDepth(y - 1);
      const p = makePerson(this, x, y, 'guest', i);
      p.root.setScale(scale);
      const label = makeLabel(this, 'Khách ' + (i + 1), { fontSize: '14px' });
      label.setPosition(0, opts.labelY ?? -128);
      if (opts.hideLabel) label.setVisible(false);       // khách ngồi bàn: chỉ hiện tên khi đã có người tặng
      p.root.add(label);
      Object.assign(p, {
        label, homeX: x, homeY: y, busy: false, userId: null, lastUsed: 0, index: i, bubble: null,
        path: opts.path, seatFacing: opts.facing || 'front', compact: !!opts.compact,
        baseScale: scale, labelSize: opts.compact ? 0.85 : 0.95, labelPop: 1, hideLabel: !!opts.hideLabel
      });
      setFacing(p, p.seatFacing);
      this.guests.push(p);
      return p;
    }

    drawGuests() {
      if (!HAS_TABLE) {
        // --- Không có bàn: khách đứng 2 bên lối đi như bản đầu ---
        const n = Phaser.Math.Clamp(cfg.guestCount, 4, 24);
        const rows = Math.ceil(n / 6), top = 520, bottom = 690;
        const xs = [140, 290, 440, 840, 990, 1140];
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / 6);
          const y = rows === 1 ? (top + bottom) / 2 : top + (bottom - top) * row / (rows - 1);
          const laneX = CENTER_X + Phaser.Math.Between(-25, 25);
          this.addGuest(xs[i % 6], y, { path: [{ x: laneX, y }, { x: laneX, y: LANE_Y }] });
        }
        return;
      }

      // --- Có bàn: khách đứng 2 bên sân khấu (0 - 12 người) ---
      const n = Phaser.Math.Clamp(cfg.guestCount, 0, 12);
      const cols = [55, 135, 215, 1065, 1145, 1225];
      for (let i = 0; i < n; i++) {
        const x = cols[i % 6], y = i < 6 ? 445 : 492;
        this.addGuest(x, y, { scale: 0.72, chair: false, path: [{ x, y: LANE_Y }] });
      }

      // --- Các bàn tròn ---
      TABLE_SPOTS.slice(0, TABLES).forEach(spot => this.drawTable(spot));
    }

    // ---------------- 1 bàn tròn + khách ngồi quanh bàn ----------------
    drawTable({ x: TX, y: TY, s }) {
      const RX = TABLE_RX * s;
      const front = Math.floor(PER_TABLE * 0.4);                 // hàng trước, quay lưng
      const sides = PER_TABLE >= 6 ? 2 : 0;                      // hai đầu bàn
      const backN = PER_TABLE - front - sides;                    // hàng sau, nhìn về người xem
      const spreadX = (count, margin) => Array.from({ length: count }, (_, k) =>
        count === 1 ? TX : TX - RX + margin * s + (2 * (RX - margin * s)) * k / (count - 1));
      const seat = { scale: s, compact: true, hideLabel: true };

      // Hàng sau: bàn che phần chân => trông như đang ngồi. Đi thẳng lên sân khấu.
      spreadX(backN, 42).forEach((x, k) => this.addGuest(x, TY - 22 * s, {
        ...seat, labelY: k % 2 ? -146 : -126, path: [{ x, y: LANE_Y }]
      }));

      // Hai đầu bàn: bước ra ngoài rồi đi lên
      if (sides) [-1, 1].forEach(side => {
        const x = TX + side * (RX + 10 * s), y = TY - 4 * s, outX = x + side * 45 * s;
        this.addGuest(x, y, { ...seat, path: [{ x: outX, y }, { x: outX, y: LANE_Y }] });
      });

      // Hàng trước: quay lưng, đi vòng qua đầu bàn rồi lên
      spreadX(front, 55).forEach(x => {
        const y = TY + 59 * s, sideX = x < TX ? TX - RX - 60 * s : TX + RX + 60 * s;
        this.addGuest(x, y, { ...seat, facing: 'back', chair: false, path: [{ x: sideX, y }, { x: sideX, y: LANE_Y }] });
      });

      // Mặt bàn (ảnh vẽ 1 lần, dùng chung cho mọi bàn). depth = TY => che chân hàng sau, nằm dưới hàng trước
      baked(this, 'round_table', 352, 136, 176, 46, t => {
        t.fillStyle(0x000000, 0.12).fillEllipse(0, 44, TABLE_RX * 2 + 10, TABLE_RY * 2);   // bóng
        t.fillStyle(0xf7b6cc, 1).fillEllipse(0, 26, TABLE_RX * 2, TABLE_RY * 2)
          .fillRect(-TABLE_RX, 0, TABLE_RX * 2, 26);                                       // khăn rủ xuống
        t.fillStyle(0xffffff, 1).fillEllipse(0, 0, TABLE_RX * 2, TABLE_RY * 2);           // mặt bàn
        t.lineStyle(3, 0xff8fab, 1).strokeEllipse(0, 0, TABLE_RX * 2, TABLE_RY * 2);
        for (let k = 0; k < 10; k++) {                                                    // đĩa
          const a = (k / 10) * Math.PI * 2;
          const px = Math.cos(a) * (TABLE_RX - 28), py = Math.sin(a) * (TABLE_RY - 12);
          t.fillStyle(0xffffff, 1).fillEllipse(px, py, 26, 12);
          t.lineStyle(2, 0xf3c2d6, 1).strokeEllipse(px, py, 26, 12);
        }
      }).setPosition(TX, TY).setScale(s).setDepth(TY);

      const deco = (dx, dy, e, size) => this.add.text(TX + dx * s, TY + dy * s, e, { fontFamily: FONT, fontSize: Math.round(size * s) + 'px' })
        .setOrigin(0.5, 0.8).setDepth(TY + 1);
      deco(0, 4, '💐', 34);
      deco(-70, 2, '🍾', 22);
      deco(70, 2, '🎂', 24);
      deco(-112, 8, '🥂', 16);
      deco(112, 8, '🥂', 16);
    }

    // ---------------- Chữ, bảng xếp hạng, thông báo ----------------
    drawHud() {
      this.add.text(CENTER_X, 30, `${cfg.brideName} 💍 ${cfg.groomName}`, {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#c9184a', strokeThickness: 6
      }).setOrigin(0.5, 0).setDepth(900);
      this.drawLoveMeter();

      // Bảng hướng dẫn (trái)
      const info = this.add.container(20, 20).setDepth(900);
      const ib = this.add.graphics().fillStyle(0x000000, 0.45).fillRoundedRect(0, 0, 300, 110, 14);
      info.add([ib,
        this.add.text(14, 10, cfg.title, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd6e5' }),
        this.add.text(14, 42, 'Tặng quà để lên chúc mừng\ncô dâu chú rể nhé! 🌹', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
      ]);
      this.queueText = this.add.text(14, 86, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe066' });
      info.add(this.queueText);

      // Bảng xếp hạng (phải)
      const lb = this.add.container(W - 300, 20).setDepth(900);
      lb.add(this.add.graphics().fillStyle(0x000000, 0.45).fillRoundedRect(0, 0, 280, 170, 14));
      lb.add(this.add.text(14, 10, '🏆 Top tặng quà', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#ffd166' }));
      this.lbText = this.add.text(14, 42, 'Chưa có ai…', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', lineSpacing: 6 });
      lb.add(this.lbText);

      this.toasts = [];
    }

    // =================================================================
    //  THANH TÌNH YÊU: đủ HugAt điểm => ôm hôn, đủ DanceAt => khiêu vũ
    // =================================================================
    drawLoveMeter() {
      const w = 380, h = 16, y = 90, x0 = CENTER_X - w / 2;
      this.meter = { w, h, y, x0, shown: 0, data: null };
      const c = this.add.container(0, 0).setDepth(900);
      const bg = this.add.graphics().fillStyle(0x000000, 0.45).fillRoundedRect(x0 - 4, y - h / 2 - 4, w + 8, h + 8, (h + 8) / 2);
      this.meterFill = this.add.graphics();
      this.meterHugIcon = this.add.text(x0 + w / 3, y, '💋', { fontFamily: FONT, fontSize: '18px' }).setOrigin(0.5);
      const end = this.add.text(x0 + w + 4, y, '💃', { fontFamily: FONT, fontSize: '20px' }).setOrigin(0.5);
      this.meterText = this.add.text(CENTER_X, y + 21, '💗 Thanh tình yêu', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffffff', stroke: '#c9184a', strokeThickness: 4
      }).setOrigin(0.5);
      c.add([bg, this.meterFill, this.meterHugIcon, end, this.meterText]);
    }

    drawMeterFill() {
      const { w, h, y, x0, shown, data } = this.meter;
      const f = data ? Phaser.Math.Clamp(shown / data.danceAt, 0, 1) : 0;
      this.meterFill.clear();
      if (f > 0) this.meterFill.fillStyle(0xff4d6d, 1).fillRoundedRect(x0, y - h / 2, Math.max(h, w * f), h, h / 2)
        .fillStyle(0xffffff, 0.25).fillRoundedRect(x0 + 4, y - h / 2 + 3, Math.max(h, w * f) - 8, 4, 2);
      if (data) this.meterFill.fillStyle(0xffffff, 0.8).fillRect(x0 + w * data.hugAt / data.danceAt - 1, y - h / 2, 2, h);
    }

    /** Cập nhật thanh tình yêu (m = ảnh chụp từ server). cheer = cho MC khích lệ khi vượt 50% / 80%. */
    onMeter(m, cheer = true) {
      if (!m || m.seq <= this.meterSeq) return;              // bỏ bản cũ hơn bản đang hiện
      const prev = this.meter.data;
      this.meterSeq = m.seq;
      this.meter.data = m;
      const target = m.hugged ? m.danceAt : m.hugAt;
      const left = Math.max(0, target - m.points);
      const next = m.hugged ? 'cô dâu chú rể nhảy khiêu vũ' : 'cô dâu chú rể ôm nhau và hôn nhẹ';
      this.meterHugIcon.setX(this.meter.x0 + this.meter.w * m.hugAt / m.danceAt);
      this.meterText.setText(`💗 Thanh tình yêu ${m.points}/${m.danceAt} · còn ${left} điểm → ${m.hugged ? '💃 khiêu vũ' : '💋 ôm hôn'}`);
      this.tweens.add({ targets: this.meter, shown: m.points, duration: 600, onUpdate: () => this.drawMeterFill() });
      voice.setMeter({ points: m.points, left, next });
      // Khích lệ khi vượt 50% / 80% quãng tới mốc kế tiếp
      if (cheer && prev && prev.hugged === m.hugged && prev.rounds === m.rounds) {
        const from = m.hugged ? m.hugAt : 0, span = target - from;
        const r0 = (prev.points - from) / span, r1 = (m.points - from) / span;
        if ([0.5, 0.8].some(t => r0 < t && r1 >= t)) voice.cheer();
      }
    }

    // ---------------- Cô dâu chú rể: ôm hôn / khiêu vũ ----------------
    queueCouple(action) {
      this.coupleQueue.push(action);
      this.runCouple();
    }

    runCouple() {
      if (this.coupleBusy || !this.coupleQueue.length) return;
      const action = this.coupleQueue.shift();
      this.coupleBusy = true;
      voice.coupleAction(action);
      const done = () => {
        this.coupleBusy = false;
        if (action === 'dance' && this.pendingMeter) { this.onMeter(this.pendingMeter, false); this.pendingMeter = null; }
        this.runCouple();
      };
      if (action === 'dance') this.doDance(done); else this.doHug(done);
    }

    doHug(done) {
      const B = this.bride.root, G = this.groom.root, y0 = 340;
      // Tiến lại gần nhau
      this.tweens.add({ targets: B, x: CENTER_X - 24, duration: 600, ease: 'Sine.inOut' });
      this.tweens.add({ targets: G, x: CENTER_X + 24, duration: 600, ease: 'Sine.inOut' });
      this.after(600, () => {
        // Nghiêng đầu vào nhau + nụ hôn
        this.tweens.add({ targets: B, angle: 9, duration: 300, ease: 'Sine.out' });
        this.tweens.add({ targets: G, angle: -9, duration: 300, ease: 'Sine.out' });
        this.after(300, () => {
          const kiss = this.add.text(CENTER_X, y0 - 182, '💋', { fontFamily: FONT, fontSize: '30px' })   // ngay trên 2 đầu, không che mặt
            .setOrigin(0.5).setDepth(980).setScale(0);
          this.tweens.add({ targets: kiss, scale: 1.2, duration: 300, ease: 'Back.out', yoyo: true, hold: 1100, onComplete: () => kiss.destroy() });
          this.hearts.explode(40, CENTER_X, y0 - 175);
          this.after(800, () => this.hearts.explode(25, CENTER_X, y0 - 185));
        });
      });
      // Tách ra về chỗ
      this.after(3000, () => {
        this.tweens.add({ targets: [B, G], angle: 0, duration: 300 });
        this.tweens.add({ targets: B, x: CENTER_X - 60, duration: 600, delay: 200, ease: 'Sine.inOut' });
        this.tweens.add({ targets: G, x: CENTER_X + 60, duration: 600, delay: 200, ease: 'Sine.inOut', onComplete: done });
      });
    }

    doDance(done) {
      const B = this.bride.root, G = this.groom.root, cx = CENTER_X, y0 = 340, R = 46;
      this.celebrate();
      // Nốt nhạc, tim, lấp lánh bay quanh
      let alive = true;
      const spawn = () => {
        if (!alive) return;
        const t = this.add.text(cx + Phaser.Math.Between(-170, 170), y0 - Phaser.Math.Between(30, 170),
          Phaser.Utils.Array.GetRandom(['🎵', '🎶', '💕', '✨', '🎵']), { fontFamily: FONT, fontSize: Phaser.Math.Between(18, 30) + 'px' })
          .setOrigin(0.5).setDepth(960);
        this.tweens.add({ targets: t, y: t.y - 80, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
        this.after(220, spawn);
      };
      spawn();
      // Vào vị trí rồi xoay vòng (điệu valse), người nghiêng qua lại theo nhịp
      this.tweens.add({ targets: B, x: cx - R, duration: 500 });
      this.tweens.add({ targets: G, x: cx + R, duration: 500 });
      this.after(500, () => this.tweens.addCounter({
        from: 0, to: 1, duration: 8000,
        onUpdate: (tw) => {
          const v = tw.getValue(), a = Math.PI + v * Math.PI * 4;      // 2 vòng
          B.x = cx + Math.cos(a) * R; B.y = y0 + Math.sin(a) * 14;
          G.x = cx - Math.cos(a) * R; G.y = y0 - Math.sin(a) * 14;
          const sway = Math.sin(v * Math.PI * 16) * 8;
          B.angle = sway; G.angle = -sway;
          B.setDepth(B.y); G.setDepth(G.y);
        },
        onComplete: () => {
          alive = false;
          B.angle = 0; G.angle = 0;
          this.tweens.add({ targets: B, x: cx - 60, y: y0, duration: 600 });
          this.tweens.add({
            targets: G, x: cx + 60, y: y0, duration: 600,
            onComplete: () => { B.setDepth(340); G.setDepth(340); this.celebrate(); done(); }
          });
        }
      }));
    }

    makeEffects() {
      this.fireworks = this.add.particles(0, 0, 'dot', {
        speed: { min: 120, max: 340 }, lifespan: 1300, gravityY: 220, scale: { start: 0.9, end: 0 },
        tint: [0xffd166, 0xff4d6d, 0x4cc9f0, 0x80ffdb, 0xffffff, 0xf72585], blendMode: 'ADD', emitting: false
      }).setDepth(950);
      this.hearts = this.add.particles(0, 0, 'heart', {
        speed: { min: 80, max: 220 }, angle: { min: 200, max: 340 }, lifespan: 1600, gravityY: 120,
        scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: [0xff4d6d, 0xff8fab, 0xffffff, 0xc9184a], emitting: false
      }).setDepth(960);
      this.likeHearts = this.add.particles(0, 0, 'heart', {
        speedY: { min: -260, max: -140 }, speedX: { min: -40, max: 40 }, lifespan: 2600,
        scale: { start: 1.1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: [0xff4d6d, 0xff8fab, 0xf72585], emitting: false
      }).setDepth(940);
    }

    // Hẹn giờ theo thời gian thật (dùng tween). Không dùng time.delayedCall vì đồng hồ đó
    // chạy theo nhịp khung hình: máy/OBS render chậm thì 0.8s có thể thành 10s.
    after(ms, cb) {
      return this.tweens.addCounter({ from: 0, to: 1, duration: Math.max(1, ms), onComplete: () => cb() });
    }

    update() {
      for (const p of this.guests) {
        // Ai đứng thấp hơn (y lớn hơn) thì vẽ đè lên trước
        p.root.setDepth(p.root.y + (p.busy ? 5 : 0));
        // Nhãn tên & bong bóng chat giữ cỡ chữ dễ đọc dù nhân vật bị thu nhỏ
        const inv = 1 / p.root.scaleX;
        p.label.setScale(p.labelSize * p.labelPop * inv);
        if (p.bubble && !p.bubble.popping) p.bubble.setScale(0.9 * inv);
      }
    }

    // =================================================================
    //  XỬ LÝ QUÀ
    // =================================================================
    onGift(gift) {
      // Gộp quà trùng (cùng người, cùng loại) đang chờ để hàng đợi không quá dài
      const same = this.queue.find(q => q.userId === gift.userId && q.giftName === gift.giftName);
      if (same) {
        same.count += gift.count;
        if (gift.meter && (!same.meter || gift.meter.seq > same.meter.seq)) same.meter = gift.meter;
        same.actions = [...(same.actions || []), ...(gift.actions || [])];
      }
      else if (isBig(gift)) this.queue.unshift(gift);      // quà lớn được ưu tiên
      else this.queue.push(gift);
      this.processQueue();
    }

    processQueue() {
      while (this.queue.length) {
        const slot = this.slots.find(s => !s.busy);
        const guest = this.pickGuest(this.queue[0].userId);
        if (!slot || !guest) break;
        this.sendGuest(guest, slot, this.queue.shift());
      }
      this.queueText.setText(this.queue.length ? `⏳ Đang chờ lên sân khấu: ${this.queue.length}` : '');
    }

    // Ưu tiên khách đã mang tên người này; nếu không thì khách rảnh lâu nhất
    pickGuest(userId) {
      const idle = this.guests.filter(g => !g.busy);
      if (!idle.length) return null;
      const same = idle.find(g => g.userId && g.userId === userId);
      if (same) return same;
      const oldest = Math.min(...idle.map(g => g.lastUsed));
      return Phaser.Utils.Array.GetRandom(idle.filter(g => g.lastUsed === oldest));
    }

    sendGuest(guest, slot, gift) {
      guest.busy = true; slot.busy = true;
      guest.userId = gift.userId;
      guest.lastUsed = performance.now();
      const max = guest.compact ? 12 : 24;
      guest.label.setText(gift.nickname.length > max ? gift.nickname.slice(0, max) + '…' : gift.nickname);
      guest.label.setVisible(true);
      this.tweens.add({ targets: guest, labelPop: { from: 1.6, to: 1 }, duration: 400, ease: 'Back.out' });

      const emoji = giftEmoji(gift.giftName);
      guest.gift.setText(emoji);
      voice.announceGift(gift);                    // MC đọc: "Mời Lan Phương lên tặng 15 bông hồng!"

      // Hàng đợi dài => đi nhanh hơn
      const speed = 300 * (1 + Math.min(this.queue.length, 10) * 0.12);
      const pathUp = [...guest.path, { x: slot.x, y: slot.y }];
      const pathBack = [...guest.path].reverse().concat({ x: guest.homeX, y: guest.homeY });

      startWalk(this, guest, speed / 300);
      this.tweens.add({ targets: guest.root, scale: WALK_SCALE, duration: 700 });      // đứng dậy đi lên: to dần
      this.walk(guest, pathUp, speed, () => {
        stopWalk(guest);
        setFacing(guest, 'back');                    // quay về phía cô dâu chú rể
        this.present(guest, gift, emoji, slot, () => {
          slot.busy = false;
          this.processQueue();
          startWalk(this, guest, speed / 300);
          this.tweens.add({ targets: guest.root, scale: guest.baseScale, duration: 900 });  // về chỗ: nhỏ lại
          this.walk(guest, pathBack, speed, () => {
            stopWalk(guest);
            setFacing(guest, guest.seatFacing);
            guest.busy = false;
            this.processQueue();
          });
        });
      });
    }

    // Đi qua lần lượt các điểm với tốc độ không đổi
    walk(p, points, speed, onDone) {
      let { x, y } = p.root;
      const tweens = points.map(pt => {
        const d = Phaser.Math.Distance.Between(x, y, pt.x, pt.y);
        const dy = pt.y - y;
        x = pt.x; y = pt.y;
        return {
          x: pt.x, y: pt.y, duration: Math.max(60, d / speed * 1000), ease: 'Linear',
          onStart: () => { if (dy < -4) setFacing(p, 'back'); else if (dy > 4) setFacing(p, 'front'); }
        };
      });
      this.tweens.chain({ targets: p.root, tweens, onComplete: onDone });
    }

    // Đứng trước cô dâu chú rể và trao quà
    present(guest, gift, emoji, slot, onDone) {
      const big = isBig(gift);
      guest.gift.setText('');
      // Quà bay về phía cô dâu (slot trái), chú rể (slot phải) hoặc chính giữa
      const tx = CENTER_X + (slot.x - CENTER_X) * 0.45, ty = 225;

      // Quà bay từ tay khách lên giữa cô dâu chú rể
      const fly = this.add.text(guest.root.x + 24, guest.root.y - 50, emoji, { fontFamily: FONT, fontSize: '30px' })
        .setOrigin(0.5).setDepth(970);
      const countTxt = gift.count > 1
        ? this.add.text(tx + 28, ty - 10, 'x' + gift.count, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffd166', stroke: '#7b2cbf', strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(971).setAlpha(0)
        : null;

      // khách cúi chào
      this.tweens.add({ targets: guest.puppet, angle: -8, duration: 220, yoyo: true });

      this.tweens.add({
        targets: fly, x: tx, y: ty, scale: big ? 3 : 2, duration: 650, ease: 'Cubic.out',
        onComplete: () => {
          if (countTxt) this.tweens.add({ targets: countTxt, alpha: 1, duration: 200 });
          this.hearts.explode(big ? 50 : 18, tx, ty + 10);
          // Thanh tình yêu: quà làm đầy thanh => hiện đầy, khiêu vũ xong mới về 0
          const acts = gift.actions || [];
          if (acts.includes('dance')) {
            this.pendingMeter = gift.meter;
            this.tweens.add({ targets: this.meter, shown: this.meter.data?.danceAt ?? 0, duration: 600, onUpdate: () => this.drawMeterFill() });
          } else this.onMeter(gift.meter);
          acts.forEach(a => this.queueCouple(a));
          this.coupleHappy(big);
          this.banner(`${emoji} ${gift.nickname} tặng ${gift.count > 1 ? gift.count + ' ' : ''}${gift.giftName}`, big);
          voice.thankGift(gift, big);
          if (big) this.celebrate();
          this.tweens.add({
            targets: [fly, countTxt].filter(Boolean), alpha: 0, y: '-=40', delay: 900, duration: 500,
            onComplete: () => { fly.destroy(); countTxt?.destroy(); }
          });
          this.after(big ? 1400 : 800, onDone);
        }
      });
    }

    coupleHappy(big) {
      if (this.coupleBusy) return;                     // đang ôm hôn / khiêu vũ thì không nhảy lên
      [this.bride, this.groom].forEach((p, i) => this.tweens.add({
        targets: p.root, y: 340 - (big ? 28 : 14), duration: 180, yoyo: true, repeat: big ? 2 : 0, delay: i * 90, ease: 'Quad.out'
      }));
    }

    celebrate() {
      this.cameras.main.flash(250, 255, 240, 250);
      for (let i = 0; i < 6; i++) {
        this.after(i * 260, () =>
          this.fireworks.explode(60, Phaser.Math.Between(200, W - 200), Phaser.Math.Between(70, 230)));
      }
    }

    banner(text, big) {
      this.bannerObj?.destroy();
      const b = makeLabel(this, text, {
        fontSize: big ? '26px' : '22px', bg: big ? 0x7b2cbf : 0xc9184a, bgAlpha: 0.92, stroke: 0xffd166
      }).setPosition(CENTER_X, 142).setDepth(990).setScale(0);
      this.bannerObj = b;
      this.tweens.add({ targets: b, scale: 1, duration: 300, ease: 'Back.out' });
      this.tweens.add({ targets: b, alpha: 0, delay: 2800, duration: 400, onComplete: () => b.destroy() });
    }

    // =================================================================
    //  BÌNH LUẬN / THẢ TIM / FOLLOW
    // =================================================================
    onChat(e) {
      // Khách đang mang tên người đó sẽ nói; nếu chưa có thì 1 khách rảnh bất kỳ nói hộ
      const g = this.guests.find(x => x.userId === e.userId) ||
                Phaser.Utils.Array.GetRandom(this.guests.filter(x => !x.busy)) || this.guests[0];
      const text = g.userId === e.userId ? e.comment : `${e.nickname}: ${e.comment}`;
      g.bubble?.destroy();
      const bubble = makeLabel(this, text.length > 40 ? text.slice(0, 40) + '…' : text,
        { fontSize: '14px', bg: 0xffffff, bgAlpha: 0.95, color: '#333333' });
      // giữ bong bóng nằm trong màn hình
      const k = g.root.scaleX, half = (bubble.textObj.width / 2 + 12) * 0.9;
      bubble.setPosition((Phaser.Math.Clamp(g.root.x, half + 8, W - half - 8) - g.root.x) / k, -160);
      g.root.add(bubble);
      g.bubble = bubble;
      bubble.popping = true;
      this.tweens.add({ targets: bubble, scale: { from: 0, to: 0.9 / k }, duration: 250, ease: 'Back.out', onComplete: () => bubble.popping = false });
      this.after(4000, () => { if (g.bubble === bubble) { bubble.destroy(); g.bubble = null; } });
    }

    onLike(e) {
      const n = Math.min(e.likeCount, 12);
      this.likeHearts.explode(n, W - 60, H - 40);
      this.likeHearts.explode(Math.ceil(n / 2), 60, H - 40);
    }

    onSocial(e) {
      if (e.action === 'follow') voice.thankFollow(e);
      const icon = { follow: '⭐ vừa theo dõi', share: '🔁 vừa chia sẻ live', join: '👋 vừa vào phòng' }[e.action] || e.action;
      const t = makeLabel(this, `${e.nickname} ${icon}`, { fontSize: '15px', bg: 0x2b2d42, bgAlpha: 0.8 })
        .setDepth(980).setPosition(W + 200, 0);
      this.toasts.push(t);
      if (this.toasts.length > 4) this.toasts.shift().destroy();
      this.toasts.forEach((x, i) => x.y = 220 + i * 34);
      this.tweens.add({ targets: t, x: W - 160, duration: 350, ease: 'Cubic.out' });
      this.after(4000, () => this.tweens.add({
        targets: t, alpha: 0, duration: 400,
        onComplete: () => { this.toasts = this.toasts.filter(x => x !== t); t.destroy(); }
      }));
    }

    onLeaderboard(list) {
      voice.setTopGifter(list[0]?.nickname);
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      this.lbText.setText(list.length
        ? list.map((x, i) => `${medals[i]} ${x.nickname.slice(0, 16)}  💎${x.diamonds}`).join('\n')
        : 'Chưa có ai…');
    }

    onReset() {
      this.queue = [];
      this.guests.forEach((g, i) => { g.userId = null; g.label.setText('Khách ' + (i + 1)); g.label.setVisible(!g.hideLabel); });
      this.processQueue();
    }

    // =================================================================
    //  SIGNALR – nhận sự kiện realtime từ server .NET
    // =================================================================
    connectSignalR() {
      const conn = new signalR.HubConnectionBuilder()
        .withUrl(`/hub/wedding?role=stage&voice=${voice.muted ? 0 : 1}`)
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      conn.on('GiftReceived', g => this.onGift({ ...g }));
      conn.on('ChatReceived', e => this.onChat(e));
      conn.on('LikeReceived', e => this.onLike(e));
      conn.on('SocialReceived', e => this.onSocial(e));
      conn.on('Leaderboard', l => this.onLeaderboard(l));
      conn.on('ResetStage', () => this.onReset());
      conn.on('Speak', e => voice.speakNow(e.text));
      conn.on('VoiceConfigChanged', () => voice.load());   // đổi tốc độ ở admin => áp dụng ngay
      conn.on('LoveMeter', m => this.onMeter(m, false));    // mở trang / reset
      conn.on('CoupleAction', a => this.queueCouple(a.action));   // admin bấm thử
      conn.on('BridgeStatus', () => { });            // trạng thái bridge chỉ hiện ở trang admin

      // Báo trạng thái giọng về server (trang admin hiển thị để chẩn đoán)
      const report = () => conn.state === 'Connected' && conn.invoke('ReportVoiceState', voice.state).catch(() => { });
      voice.onStateChange(report);
      conn.onreconnected(report);

      const start = async () => {
        try { await conn.start(); console.log('SignalR connected'); report(); }
        catch (err) { console.warn('SignalR lỗi, thử lại sau 3s', err); setTimeout(start, 3000); }
      };
      conn.onclose(() => setTimeout(start, 3000));   // hết lượt auto-reconnect thì tự thử lại
      start();
      this.conn = conn;
    }
  }

  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    transparent: TRANSPARENT,
    backgroundColor: '#1b1026',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: WeddingScene
  });
})();
