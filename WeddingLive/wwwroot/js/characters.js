// =====================================================================
//  Vẽ nhân vật bằng Phaser.Graphics (không cần file ảnh).
//  Muốn dùng ảnh/sprite riêng: thay phần vẽ trong makePerson() bằng
//  scene.add.sprite(...) là được, phần còn lại của game giữ nguyên.
// =====================================================================
(function () {
  const FONT = '"Segoe UI", "Noto Sans", Roboto, Arial, "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';

  const SHIRTS = [0x4f8ef7, 0x2ec4b6, 0xff9f1c, 0x9b5de5, 0xf15bb5, 0x00a6d6,
                  0x06d6a0, 0xef476f, 0x8ac926, 0xff595e, 0x6a4c93, 0x1982c4];
  const HAIRS = [0x2b1d14, 0x4a2c1a, 0x111111, 0x6b3e26, 0x8d5524, 0x222222];
  const SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xffe0bd];

  function pick(arr, i) { return arr[i % arr.length]; }

  // ---------- Nhãn tên có nền bo góc ----------
  function makeLabel(scene, text, opts = {}) {
    const c = scene.add.container(0, 0);
    const bg = scene.add.graphics();
    const t = scene.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: opts.fontSize || '15px', fontStyle: 'bold',
      color: opts.color || '#ffffff'
    }).setOrigin(0.5);
    c.add([bg, t]);
    c.setText = (s) => {
      t.setText(s);
      const w = Math.max(40, t.width + 14), h = t.height + 6;
      bg.clear();
      bg.fillStyle(opts.bg ?? 0x000000, opts.bgAlpha ?? 0.55);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      if (opts.stroke) { bg.lineStyle(2, opts.stroke, 1); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2); }
    };
    c.setText(text);
    c.textObj = t;
    return c;
  }

  // ---------- Mặt ----------
  function drawFace(g, y, skin) {
    g.fillStyle(skin, 1).fillCircle(0, y, 16);
    g.fillStyle(0x2d1b12, 1).fillCircle(-6, y + 1, 2.2).fillCircle(6, y + 1, 2.2);
    g.fillStyle(0xff7b9c, 0.45).fillCircle(-10, y + 6, 3.5).fillCircle(10, y + 6, 3.5);
    g.lineStyle(2, 0x8a3b2b, 1);
    g.beginPath(); g.arc(0, y + 5, 5, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
  }

  // ---------- Chân (tách riêng để đung đưa khi đi) ----------
  function makeLeg(scene, x, color, shoe) {
    const g = scene.add.graphics({ x, y: -34 });
    g.fillStyle(color, 1).fillRoundedRect(-4, 0, 8, 32, 3);
    g.fillStyle(shoe, 1).fillRoundedRect(-5, 28, 12, 7, 3);
    return g;
  }

  /**
   * Tạo 1 nhân vật. Gốc tọa độ (0,0) = chân nhân vật.
   * type: 'guest' | 'bride' | 'groom'
   */
  function makePerson(scene, x, y, type, index = 0) {
    const root = scene.add.container(x, y);
    const shadow = scene.add.ellipse(0, 0, 46, 12, 0x000000, 0.22);
    const puppet = scene.add.container(0, 0);   // phần nhún nhảy khi đi
    const body = scene.add.graphics();
    let legL = null, legR = null;

    const skin = pick(SKINS, index * 3 + 1);
    const hair = pick(HAIRS, index * 5 + 2);

    if (type === 'bride') {
      // tóc dài + khăn voan phía sau
      body.fillStyle(0xffffff, 0.55).fillTriangle(0, -112, -40, -4, 40, -4);
      body.fillStyle(hair, 1).fillRoundedRect(-18, -106, 36, 40, 12);
      // váy cưới xòe
      body.fillStyle(0xffffff, 1).fillTriangle(0, -82, -38, 0, 38, 0);
      body.fillStyle(0xfff4f8, 1).fillRoundedRect(-14, -82, 28, 30, 8);
      body.lineStyle(2, 0xf3c6d6, 1).strokeTriangle(0, -82, -38, 0, 38, 0);
      body.fillStyle(0xf8d7e3, 1).fillRect(-14, -56, 28, 4);
      // tay + bó hoa
      body.fillStyle(skin, 1).fillRoundedRect(-22, -78, 7, 26, 3).fillRoundedRect(15, -78, 7, 26, 3);
      body.fillStyle(0x3a9d4a, 1).fillTriangle(-4, -46, 4, -46, 0, -30);
      [[-6, -52, 0xff4d6d], [0, -56, 0xff8fab], [6, -52, 0xff4d6d], [-3, -48, 0xffffff], [4, -47, 0xffb3c6]]
        .forEach(([fx, fy, c]) => body.fillStyle(c, 1).fillCircle(fx, fy, 5));
      drawFace(body, -96, skin);
      body.fillStyle(hair, 1).fillEllipse(0, -106, 36, 18);
      // vương miện
      body.fillStyle(0xffd166, 1).fillTriangle(-9, -112, -5, -122, -1, -112)
        .fillTriangle(-3, -113, 1, -126, 5, -113).fillTriangle(3, -112, 7, -122, 11, -112);
    } else if (type === 'groom') {
      legL = makeLeg(scene, -7, 0x1d1d2b, 0x0d0d0d);
      legR = makeLeg(scene, 7, 0x1d1d2b, 0x0d0d0d);
      body.fillStyle(0x1d1d2b, 1).fillRoundedRect(-20, -80, 40, 50, 10);           // áo vest
      body.fillStyle(0xffffff, 1).fillTriangle(-8, -80, 8, -80, 0, -52);           // áo sơ mi
      body.fillStyle(0xd62839, 1).fillTriangle(-8, -78, 0, -74, -8, -70)
        .fillTriangle(8, -78, 0, -74, 8, -70).fillCircle(0, -74, 2.5);             // nơ
      body.fillStyle(0xff4d6d, 1).fillCircle(-12, -66, 4);                         // hoa cài áo
      body.fillStyle(0x1d1d2b, 1).fillRoundedRect(-27, -76, 8, 32, 4).fillRoundedRect(19, -76, 8, 32, 4);
      body.fillStyle(skin, 1).fillCircle(-23, -42, 4).fillCircle(23, -42, 4);
      drawFace(body, -96, skin);
      body.fillStyle(0x111111, 1).fillEllipse(0, -106, 36, 16).fillEllipse(-10, -104, 16, 12);
    } else {
      // Khách: xen kẽ nam (áo) / nữ (váy)
      const shirt = pick(SHIRTS, index);
      const female = index % 2 === 1;
      if (female) {
        body.fillStyle(hair, 1).fillRoundedRect(-18, -104, 36, 36, 12);           // tóc dài phía sau
        legL = makeLeg(scene, -6, skin, 0x5c3d2e);
        legR = makeLeg(scene, 6, skin, 0x5c3d2e);
        body.fillStyle(shirt, 1).fillTriangle(0, -80, -24, -26, 24, -26).fillRoundedRect(-13, -80, 26, 26, 8);
      } else {
        legL = makeLeg(scene, -7, 0x34405a, 0x222222);
        legR = makeLeg(scene, 7, 0x34405a, 0x222222);
        body.fillStyle(shirt, 1).fillRoundedRect(-18, -78, 36, 46, 10);
        body.fillStyle(0xffffff, 0.35).fillTriangle(-6, -78, 6, -78, 0, -70);
      }
      body.fillStyle(shirt, 1).fillRoundedRect(-25, -74, 8, 28, 4).fillRoundedRect(17, -74, 8, 28, 4);
      body.fillStyle(skin, 1).fillCircle(-21, -44, 4).fillCircle(21, -44, 4);
      drawFace(body, -92, skin);
      body.fillStyle(hair, 1).fillEllipse(0, -102, 36, 18);
      if (!female) body.fillEllipse(-11, -99, 14, 12);
    }

    // Dáng nhìn từ phía sau (chỉ khách): dùng khi đi lên sân khấu / ngồi quay lưng ở bàn tiệc
    let back = null;
    if (type === 'guest') {
      const shirt = pick(SHIRTS, index);
      const female = index % 2 === 1;
      back = scene.add.graphics().setVisible(false);
      if (female) back.fillStyle(shirt, 1).fillTriangle(0, -80, -24, -26, 24, -26).fillRoundedRect(-13, -80, 26, 26, 8);
      else back.fillStyle(shirt, 1).fillRoundedRect(-18, -78, 36, 46, 10);
      back.fillStyle(shirt, 1).fillRoundedRect(-25, -74, 8, 28, 4).fillRoundedRect(17, -74, 8, 28, 4);
      back.fillStyle(skin, 1).fillCircle(-21, -44, 4).fillCircle(21, -44, 4);
      back.fillStyle(skin, 1).fillCircle(-16, -91, 4).fillCircle(16, -91, 4);       // tai
      back.fillStyle(hair, 1).fillCircle(0, -94, 17);                               // gáy tóc
      if (female) back.fillRoundedRect(-17, -100, 34, 38, 12);                      // tóc dài
    }

    if (legL) puppet.add([legL, legR]);
    puppet.add(body);
    if (back) puppet.add(back);

    // Món quà cầm trên tay (ẩn khi không có)
    const gift = scene.add.text(24, -50, '', { fontFamily: FONT, fontSize: '26px' }).setOrigin(0.5);
    puppet.add(gift);

    root.add([shadow, puppet]);

    const person = { root, puppet, body, back, legL, legR, gift, walkTweens: [], facing: 'front' };
    if (type === 'bride' || type === 'groom') root.setScale(1.3);
    return person;
  }

  // ---------- Đi bộ: đung đưa chân + nhún người ----------
  function startWalk(scene, p, speedFactor = 1) {
    stopWalk(p);
    const dur = 160 / speedFactor;
    if (p.legL) {
      p.walkTweens.push(scene.tweens.add({ targets: p.legL, angle: { from: -22, to: 22 }, duration: dur, yoyo: true, repeat: -1 }));
      p.walkTweens.push(scene.tweens.add({ targets: p.legR, angle: { from: 22, to: -22 }, duration: dur, yoyo: true, repeat: -1 }));
    }
    p.walkTweens.push(scene.tweens.add({ targets: p.puppet, y: -4, duration: dur, yoyo: true, repeat: -1 }));
  }

  function stopWalk(p) {
    p.walkTweens.forEach(t => t.stop());
    p.walkTweens = [];
    if (p.legL) { p.legL.angle = 0; p.legR.angle = 0; }
    p.puppet.y = 0;
  }

  // ---------- Quay mặt: 'front' = nhìn về người xem, 'back' = quay lưng ----------
  function setFacing(p, dir) {
    if (!p.back || p.facing === dir) return;
    p.facing = dir;
    p.body.setVisible(dir === 'front');
    p.back.setVisible(dir === 'back');
  }

  window.Chars = { FONT, makePerson, makeLabel, startWalk, stopWalk, setFacing };
})();
