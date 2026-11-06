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
  const { FONT, makePerson, makeLabel, startWalk, stopWalk } = window.Chars;
  if (TRANSPARENT) document.body.classList.add('transparent');

  // Cấu hình từ server (tên cô dâu chú rể, số khách...)
  let cfg = { brideName: 'Cô Dâu', groomName: 'Chú Rể', title: 'Đám Cưới Online', guestCount: 12, bigGiftDiamonds: 99 };
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

  class WeddingScene extends Phaser.Scene {
    constructor() { super('wedding'); }

    create() {
      this.guests = [];
      this.queue = [];                 // quà đang chờ khách rảnh
      this.slots = [                   // vị trí đứng tặng quà: cạnh cô dâu, cạnh chú rể, chính giữa phía trước
        { x: CENTER_X - 170, y: 365, busy: false },
        { x: CENTER_X + 170, y: 365, busy: false },
        { x: CENTER_X, y: 475, busy: false }
      ];

      this.makeTextures();
      if (!TRANSPARENT) this.drawVenue();
      this.drawCouple();
      this.drawGuests();
      this.drawHud();
      this.makeEffects();
      this.connectSignalR();
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
      const g = this.add.graphics();
      g.fillGradientStyle(0x3b1f5c, 0x3b1f5c, 0xc06c9a, 0xc06c9a, 1).fillRect(0, 0, W, 330);   // trời
      g.fillGradientStyle(0xf9d9e6, 0xf9d9e6, 0xfdeef4, 0xfdeef4, 1).fillRect(0, 330, W, H - 330); // sàn

      // Sân khấu
      g.fillStyle(0xe7a5c0, 1).fillRoundedRect(330, 285, 620, 100, 24);
      g.fillStyle(0xd88aab, 1).fillRect(350, 368, 580, 16);
      g.fillStyle(0xf3c2d6, 1).fillRect(560, 384, 160, 10).fillRect(545, 394, 190, 10);

      // Thảm đỏ
      g.fillStyle(0xc9184a, 1).fillPoints([{ x: 590, y: 404 }, { x: 690, y: 404 }, { x: 760, y: H }, { x: 520, y: H }], true);
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

    // ---------------- Khách mời ở dưới ----------------
    drawGuests() {
      const n = Phaser.Math.Clamp(cfg.guestCount, 4, 24);
      const perRow = 6;                                  // 3 bên trái + 3 bên phải lối đi
      const rows = Math.ceil(n / perRow);
      const top = 520, bottom = 690;
      const leftXs = [140, 290, 440], rightXs = [840, 990, 1140];

      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const y = rows === 1 ? (top + bottom) / 2 : top + (bottom - top) * row / (rows - 1);
        const x = col < 3 ? leftXs[col] : rightXs[col - 3];

        if (!TRANSPARENT) {   // ghế
          const chair = this.add.graphics().setDepth(y - 1);
          chair.fillStyle(0xffffff, 1).fillRoundedRect(x - 22, y - 70, 44, 50, 8);
          chair.lineStyle(3, 0xf3c2d6, 1).strokeRoundedRect(x - 22, y - 70, 44, 50, 8);
          chair.fillStyle(0xff8fab, 1).fillCircle(x, y - 64, 6);
        }
        const p = makePerson(this, x, y, 'guest', i);
        const label = makeLabel(this, 'Khách ' + (i + 1), { fontSize: '14px' });
        label.setPosition(0, -128);
        p.root.add(label);
        Object.assign(p, { label, homeX: x, homeY: y, busy: false, userId: null, lastUsed: 0, index: i, bubble: null });
        this.guests.push(p);
      }
    }

    // ---------------- Chữ, bảng xếp hạng, thông báo ----------------
    drawHud() {
      this.add.text(CENTER_X, 30, `${cfg.brideName} 💍 ${cfg.groomName}`, {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#c9184a', strokeThickness: 6
      }).setOrigin(0.5, 0).setDepth(900);

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

    update() {
      // Ai đứng thấp hơn (y lớn hơn) thì vẽ đè lên trước
      for (const p of this.guests) p.root.setDepth(p.root.y + (p.busy ? 5 : 0));
    }

    // =================================================================
    //  XỬ LÝ QUÀ
    // =================================================================
    onGift(gift) {
      // Gộp quà trùng (cùng người, cùng loại) đang chờ để hàng đợi không quá dài
      const same = this.queue.find(q => q.userId === gift.userId && q.giftName === gift.giftName);
      if (same) same.count += gift.count;
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
      return idle.find(g => g.userId && g.userId === userId) || idle.sort((a, b) => a.lastUsed - b.lastUsed)[0];
    }

    sendGuest(guest, slot, gift) {
      guest.busy = true; slot.busy = true;
      guest.userId = gift.userId;
      guest.lastUsed = this.time.now;
      guest.label.setText(gift.nickname);
      this.tweens.add({ targets: guest.label, scale: { from: 1.6, to: 1 }, duration: 400, ease: 'Back.out' });

      const emoji = giftEmoji(gift.giftName);
      guest.gift.setText(emoji);

      // Hàng đợi dài => đi nhanh hơn
      const speed = 300 * (1 + Math.min(this.queue.length, 10) * 0.12);
      const aisleX = CENTER_X + Phaser.Math.Between(-25, 25);
      const pathUp = [{ x: aisleX, y: guest.homeY }, { x: aisleX, y: 450 }, { x: slot.x, y: slot.y }];
      const pathBack = [{ x: aisleX, y: 450 }, { x: aisleX, y: guest.homeY }, { x: guest.homeX, y: guest.homeY }];

      startWalk(this, guest, speed / 300);
      this.walk(guest, pathUp, speed, () => {
        stopWalk(guest);
        this.present(guest, gift, emoji, slot, () => {
          slot.busy = false;
          this.processQueue();
          startWalk(this, guest, speed / 300);
          this.walk(guest, pathBack, speed, () => {
            stopWalk(guest);
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
        x = pt.x; y = pt.y;
        return { x: pt.x, y: pt.y, duration: Math.max(60, d / speed * 1000), ease: 'Linear' };
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
          this.coupleHappy(big);
          this.banner(`${emoji} ${gift.nickname} tặng ${gift.count > 1 ? gift.count + ' ' : ''}${gift.giftName}`, big);
          if (big) this.celebrate();
          this.tweens.add({
            targets: [fly, countTxt].filter(Boolean), alpha: 0, y: '-=40', delay: 900, duration: 500,
            onComplete: () => { fly.destroy(); countTxt?.destroy(); }
          });
          this.time.delayedCall(big ? 1400 : 800, onDone);
        }
      });
    }

    coupleHappy(big) {
      [this.bride, this.groom].forEach((p, i) => this.tweens.add({
        targets: p.root, y: 340 - (big ? 28 : 14), duration: 180, yoyo: true, repeat: big ? 2 : 0, delay: i * 90, ease: 'Quad.out'
      }));
    }

    celebrate() {
      this.cameras.main.flash(250, 255, 240, 250);
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 260, () =>
          this.fireworks.explode(60, Phaser.Math.Between(200, W - 200), Phaser.Math.Between(70, 230)));
      }
    }

    banner(text, big) {
      this.bannerObj?.destroy();
      const b = makeLabel(this, text, {
        fontSize: big ? '26px' : '22px', bg: big ? 0x7b2cbf : 0xc9184a, bgAlpha: 0.92, stroke: 0xffd166
      }).setPosition(CENTER_X, 118).setDepth(990).setScale(0);
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
      const half = bubble.textObj.width / 2 + 12;
      bubble.setPosition(Phaser.Math.Clamp(g.root.x, half + 8, W - half - 8) - g.root.x, -160);
      g.root.add(bubble);
      g.bubble = bubble;
      this.tweens.add({ targets: bubble, scale: { from: 0, to: 1 }, duration: 250, ease: 'Back.out' });
      this.time.delayedCall(4000, () => { if (g.bubble === bubble) { bubble.destroy(); g.bubble = null; } });
    }

    onLike(e) {
      const n = Math.min(e.likeCount, 12);
      this.likeHearts.explode(n, W - 60, H - 40);
      this.likeHearts.explode(Math.ceil(n / 2), 60, H - 40);
    }

    onSocial(e) {
      const icon = { follow: '⭐ vừa theo dõi', share: '🔁 vừa chia sẻ live', join: '👋 vừa vào phòng' }[e.action] || e.action;
      const t = makeLabel(this, `${e.nickname} ${icon}`, { fontSize: '15px', bg: 0x2b2d42, bgAlpha: 0.8 })
        .setDepth(980).setPosition(W + 200, 0);
      this.toasts.push(t);
      if (this.toasts.length > 4) this.toasts.shift().destroy();
      this.toasts.forEach((x, i) => x.y = 220 + i * 34);
      this.tweens.add({ targets: t, x: W - 160, duration: 350, ease: 'Cubic.out' });
      this.time.delayedCall(4000, () => this.tweens.add({
        targets: t, alpha: 0, duration: 400,
        onComplete: () => { this.toasts = this.toasts.filter(x => x !== t); t.destroy(); }
      }));
    }

    onLeaderboard(list) {
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      this.lbText.setText(list.length
        ? list.map((x, i) => `${medals[i]} ${x.nickname.slice(0, 16)}  💎${x.diamonds}`).join('\n')
        : 'Chưa có ai…');
    }

    onReset() {
      this.queue = [];
      this.guests.forEach((g, i) => { g.userId = null; g.label.setText('Khách ' + (i + 1)); });
      this.processQueue();
    }

    // =================================================================
    //  SIGNALR – nhận sự kiện realtime từ server .NET
    // =================================================================
    connectSignalR() {
      const conn = new signalR.HubConnectionBuilder()
        .withUrl('/hub/wedding')
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      conn.on('GiftReceived', g => this.onGift({ ...g }));
      conn.on('ChatReceived', e => this.onChat(e));
      conn.on('LikeReceived', e => this.onLike(e));
      conn.on('SocialReceived', e => this.onSocial(e));
      conn.on('Leaderboard', l => this.onLeaderboard(l));
      conn.on('ResetStage', () => this.onReset());
      conn.on('BridgeStatus', () => { });            // trạng thái bridge chỉ hiện ở trang admin

      const start = async () => {
        try { await conn.start(); console.log('SignalR connected'); }
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
