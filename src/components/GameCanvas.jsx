import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { sfx } from '../utils/audio';

export default function GameCanvas({ player, onExit }) {
  const gameRef = useRef(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState('');
  const [activeItem, setActiveItem] = useState(null); // 'CURVE' | 'LIGHTNING' | 'FIRE'
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'phaser-game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0a0f1d',
      pixelArt: true,
      roundPixels: true,
      scene: {
        create: createScene,
        update: updateScene
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    let ball, keeper, aimGuideGraphics, ballShadow, kicker, crowdLayers = [];
    let S = 2, ballBase = 1.8, wallY = 0;
    let goalX, goalY, goalWidth, goalHeight;
    let wallGroup = [];
    let windSpeed = Math.floor(Math.random() * 7) - 3; // -3 a +3

    let currentScore = 0;
    let currentLevel = 1;
    let currentLives = 3;
    let currentTime = 60;
    let isShooting = false;
    let isGameOver = false;

    let swipeStartX = 0, swipeStartY = 0;

    // Atributos del jugador
    const playerAccuracy = player ? player.accuracy : 30;
    const playerCurve = player ? player.curve : 30;
    const playerPower = player ? player.power : 30;

    function makeTextures(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const r = (x, y, w, h, c) => { g.fillStyle(c, 1); g.fillRect(x, y, w, h); };
      const bake = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };

      const person = (key, o) => {
        r(4, 0, 8, 7, o.hair);
        r(5, 7, 6, 2, o.skin);
        r(2, 9, 12, 10, o.shirt);
        r(2, 9, 3, 10, o.shade); r(11, 9, 3, 10, o.shade);
        r(2, 12, 12, 2, o.stripe);
        r(0, 10, 2, 8, o.skin); r(14, 10, 2, 8, o.skin);
        r(3, 19, 10, 5, o.shorts);
        r(4, 24, 3, 4, o.skin); r(9, 24, 3, 4, o.skin);
        r(4, 28, 3, 2, 0x0b0b0b); r(9, 28, 3, 2, 0x0b0b0b);
        bake(key, 16, 30);
      };
      person('kicker', { hair: 0x3b2410, skin: 0xe0a870, shirt: 0x0f172a, shade: 0x020617, stripe: 0xeab308, shorts: 0xeab308 });
      person('rival', { hair: 0x1c1917, skin: 0xd9a066, shirt: 0x2563eb, shade: 0x1e3a8a, stripe: 0xffffff, shorts: 0x1e3a8a });

      // Portero
      r(7, 0, 8, 7, 0x1c1917); r(8, 7, 6, 2, 0xe0a870);
      r(5, 9, 12, 10, 0xeab308); r(5, 9, 3, 10, 0xa16207); r(14, 9, 3, 10, 0xa16207);
      r(0, 9, 5, 4, 0xeab308); r(17, 9, 5, 4, 0xeab308);
      r(0, 13, 4, 4, 0xffffff); r(18, 13, 4, 4, 0xffffff);
      r(6, 19, 10, 5, 0x111827);
      r(7, 24, 3, 4, 0xe0a870); r(12, 24, 3, 4, 0xe0a870);
      r(7, 28, 3, 2, 0x0b0b0b); r(12, 28, 3, 2, 0x0b0b0b);
      bake('keeper', 22, 30);

      // Balón
      g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 7);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(8, 8, 2.6); g.fillCircle(3.5, 5, 1.6); g.fillCircle(12.5, 5, 1.6);
      g.fillCircle(4.5, 12.5, 1.6); g.fillCircle(11.5, 12.5, 1.6);
      g.lineStyle(1, 0x64748b, 1); g.strokeCircle(8, 8, 7);
      bake('ball', 16, 16);

      g.fillStyle(0x000000, 1); g.fillEllipse(12, 5, 24, 10); bake('shadow', 24, 10);
      r(0, 0, 4, 4, 0xffffff); bake('spark', 4, 4);
      g.destroy();
    }

    function makePerson(scene, x, y, key, scale) {
      const sh = scene.add.image(0, 0, 'shadow').setAlpha(0.4);
      const body = scene.add.image(0, 0, key).setOrigin(0.5, 1);
      return scene.add.container(x, y, [sh, body]).setScale(scale);
    }

    function buildStadium(scene, W, H) {
      const crowdH = H * 0.18;
      const bgG = scene.add.graphics();
      bgG.fillGradientStyle(0x0b1224, 0x0b1224, 0x1e293b, 0x1e293b, 1);
      bgG.fillRect(0, 0, W, crowdH);

      const palette = [0xeab308, 0xef4444, 0x38bdf8, 0xf8fafc, 0xf97316];
      const skins = [0xfbd23c, 0xd9a066, 0x8d5524];
      const layers = [scene.add.graphics(), scene.add.graphics()];
      for (let row = 0, y = 8; y < crowdH - 8; y += 13, row++) {
        for (let x = 6, col = 0; x < W; x += 14, col++) {
          const gl = layers[(row + col) % 2];
          gl.fillStyle(palette[(row * 7 + col * 3 + ((row * col) % 5)) % palette.length], 1);
          gl.fillRect(x, y + 5, 10, 7);
          gl.fillStyle(skins[(col + row) % 3], 1);
          gl.fillRect(x + 2, y, 6, 5);
        }
      }
      layers.forEach((l, i) => scene.tweens.add({
        targets: l, y: -3, duration: 420 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut'
      }));
      crowdLayers = layers;

      const ad = scene.add.graphics().setDepth(1);
      ad.fillStyle(0x7f1d1d, 1); ad.fillRect(0, crowdH, W, 22);
      const cols = [0xffffff, 0xeab308, 0x1d4ed8];
      const names = ["PROM '07", 'KFL', 'STRIKERS'];
      const bw = W / 6;
      for (let i = 0; i < 7; i++) {
        ad.fillStyle(cols[i % 3], 1); ad.fillRect(i * bw + 4, crowdH + 4, bw - 8, 14);
        scene.add.text(i * bw + bw / 2, crowdH + 11, names[i % 3], {
          fontFamily: "'Chakra Petch', sans-serif", fontSize: '9px', fontStyle: 'bold',
          color: i % 3 === 1 ? '#0f172a' : i % 3 === 0 ? '#7f1d1d' : '#ffffff'
        }).setOrigin(0.5).setDepth(2);
      }
      ad.fillStyle(0x000000, 0.35); ad.fillRect(0, crowdH + 22, W, 6);
    }

    function buildPitch(scene, W, H) {
      const top = H * 0.18 + 28;
      const g = scene.add.graphics();
      const n = 8; let tot = 0; const wts = [];
      for (let i = 0; i < n; i++) { wts.push(1 + i * 0.3); tot += wts[i]; }
      let y = top;
      for (let i = 0; i < n; i++) {
        const h = (H - top) * wts[i] / tot;
        g.fillStyle(i % 2 ? 0x15803d : 0x22a04b, 1);
        g.fillRect(0, y, W, h);
        y += h;
      }
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.4, 0.4);
      g.fillRect(0, top, W, H - top);

      const cx = W / 2;
      const goalLine = H * 0.22 + goalHeight;
      const aB = H * 0.60;
      const sB = H * 0.40;
      g.lineStyle(3, 0xffffff, 0.85);
      g.strokePoints([
        { x: cx - W * 0.22, y: goalLine }, { x: cx + W * 0.22, y: goalLine },
        { x: cx + W * 0.40, y: aB }, { x: cx - W * 0.40, y: aB }
      ], true);
      g.strokePoints([
        { x: cx - W * 0.12, y: goalLine }, { x: cx + W * 0.12, y: goalLine },
        { x: cx + W * 0.19, y: sB }, { x: cx - W * 0.19, y: sB }
      ], true);
      g.beginPath(); g.arc(cx, aB, W * 0.14, 0, Math.PI, false); g.strokePath();
      g.fillStyle(0xffffff, 0.9); g.fillCircle(cx, H * 0.52, 3);
    }

    function buildGoal(scene, W, H) {
      goalWidth = Math.min(W * 0.5, 150 * S);
      goalHeight = 44 * S;
      goalX = (W - goalWidth) / 2;
      goalY = H * 0.22;
    }

    function drawGoal(scene) {
      const inset = 10 * S;
      const bx = goalX + inset, bw = goalWidth - inset * 2;
      const by = goalY + inset * 0.6, bh = goalHeight - inset * 0.6;

      const net = scene.add.graphics().setDepth(1);
      net.fillStyle(0x0f172a, 0.6); net.fillRect(goalX, goalY, goalWidth, goalHeight);
      net.lineStyle(1, 0xffffff, 0.35);
      for (let x = bx; x <= bx + bw; x += 7) net.lineBetween(x, by, x, by + bh);
      for (let y = by; y <= by + bh; y += 7) net.lineBetween(bx, y, bx + bw, y);
      net.lineStyle(1, 0xffffff, 0.25);
      net.lineBetween(goalX, goalY, bx, by); net.lineBetween(goalX + goalWidth, goalY, bx + bw, by);
      net.lineBetween(goalX, goalY + goalHeight, bx, by + bh);
      net.lineBetween(goalX + goalWidth, goalY + goalHeight, bx + bw, by + bh);

      const posts = scene.add.graphics().setDepth(5);
      posts.fillStyle(0x000000, 0.3); posts.fillRect(goalX - 4, goalY + goalHeight + 2, goalWidth + 8, 6);
      posts.lineStyle(5, 0xffffff, 1); posts.strokeRect(goalX, goalY, goalWidth, goalHeight);
      posts.lineStyle(2, 0x94a3b8, 1); posts.lineBetween(goalX + 3, goalY + 3, goalX + 3, goalY + goalHeight);
    }

    function createScene() {
      const scene = this;
      const W = scene.cameras.main.width;
      const H = scene.cameras.main.height;
      S = Phaser.Math.Clamp(H / 380, 1.6, 3);
      ballBase = S * 0.9;

      sfx.playWhistle();
      makeTextures(scene);
      buildGoal(scene, W, H);
      buildStadium(scene, W, H);
      buildPitch(scene, W, H);
      drawGoal(scene);

      keeper = makePerson(scene, W / 2, goalY + goalHeight - 2, 'keeper', S * 0.9).setDepth(4);
      spawnWall(scene, W, H, currentLevel);

      const ballX = W / 2;
      const ballY = H - 110;
      kicker = makePerson(scene, ballX, ballY + 24, 'kicker', S * 1.25).setDepth(20);
      ballShadow = scene.add.image(ballX, ballY + 8, 'shadow').setAlpha(0.4).setScale(ballBase * 0.8).setDepth(9);
      ball = scene.add.image(ballX, ballY, 'ball').setScale(ballBase).setDepth(25);

      aimGuideGraphics = scene.add.graphics().setDepth(30);
      createWindIndicator(scene, H);

      scene.time.addEvent({
        delay: 1000,
        callback: () => {
          if (isGameOver) return;
          currentTime -= 1;
          setTimeLeft(currentTime);
          if (currentTime <= 0) triggerGameOver('¡TIEMPO AGOTADO!');
        },
        loop: true
      });

      scene.input.on('pointerdown', (pointer) => {
        if (isShooting || isGameOver) return;
        swipeStartX = pointer.x;
        swipeStartY = pointer.y;
      });
      scene.input.on('pointermove', (pointer) => {
        if (isShooting || isGameOver || !pointer.isDown) return;
        const dx = pointer.x - swipeStartX;
        const dy = pointer.y - swipeStartY;
        const angle = Math.atan2(dy, dx);
        drawAimGuide(ballX, ballY, angle, dx, dy, playerAccuracy, playerCurve, windSpeed);
      });
      scene.input.on('pointerup', (pointer) => {
        if (isShooting || isGameOver) return;
        aimGuideGraphics.clear();
        const dx = pointer.x - swipeStartX;
        const dy = pointer.y - swipeStartY;
        if (Math.sqrt(dx * dx + dy * dy) > 20 && dy < 0) {
          executeShot(scene, dx, dy, W, H, ballX, ballY);
        }
      });
    }

    function createWindIndicator(scene, height) {
      const windContainer = scene.add.container(50, height - 70);
      const circle = scene.add.circle(0, 0, 22, 0x1e293b, 0.8).setStrokeStyle(2, 0x22c55e);
      const text = scene.add.text(0, -30, 'WIND', {
        fontFamily: "'Chakra Petch', sans-serif", fontSize: '10px', color: '#22c55e', fontStyle: 'bold'
      }).setOrigin(0.5);

      const arrow = scene.add.text(0, 0, windSpeed >= 0 ? '➡️' : '⬅️', { fontSize: '14px' }).setOrigin(0.5);
      windContainer.add([circle, text, arrow]);
    }

    function drawAimGuide(bx, by, angle, dx, dy, accuracyStat, curveStat, wind) {
      aimGuideGraphics.clear();
      const guideLength = Phaser.Math.Clamp(accuracyStat * 3.8, 70, 230);
      const dotsCount = Math.floor(guideLength / 10);
      
      let sideCurve = (dx * 0.25) * (curveStat / 50);
      if (activeItem === 'CURVE') sideCurve *= 2.5;

      for (let i = 0; i < dotsCount; i++) {
        const step = i / dotsCount;
        const curveOffset = sideCurve * (step * step);
        const windOffset = (activeItem === 'LIGHTNING' ? 0 : wind) * step * 7;
        const nx = bx + Math.cos(angle) * (step * guideLength) + curveOffset + windOffset;
        const ny = by + Math.sin(angle) * (step * guideLength);

        let color = 0xfacc15;
        if (activeItem === 'FIRE') color = 0xef4444;
        else if (activeItem === 'LIGHTNING') color = 0x38bdf8;

        aimGuideGraphics.fillStyle(color, 1 - step * 0.6);
        aimGuideGraphics.fillCircle(nx, ny, 3.5 - step * 1.8);
      }
    }

    function spawnWall(scene, W, H, lvl) {
      wallGroup.forEach(d => d.destroy());
      wallGroup = [];

      // Nivel 1: Sin barrera
      if (lvl <= 1) return;

      wallY = H * 0.48;
      const count = lvl === 2 ? 2 : 3;
      const gap = 17 * S;
      const startX = W / 2 - ((count - 1) * gap) / 2;

      for (let i = 0; i < count; i++) {
        wallGroup.push(makePerson(scene, startX + i * gap, wallY, 'rival', S * 0.95).setDepth(10));
      }
    }

    function executeShot(scene, dx, dy, width, height, bx, by) {
      isShooting = true;
      sfx.playKick();

      let pCurve = playerCurve;
      let pPower = playerPower;

      if (activeItem === 'CURVE') pCurve *= 2.2;
      if (activeItem === 'FIRE') pPower *= 2.0;

      const powerFactor = (pPower / 100) + 0.8;
      const sideCurve = (dx * 0.4) * (pCurve / 40);
      const effectiveWind = activeItem === 'LIGHTNING' ? 0 : windSpeed;

      const targetX = bx + (dx * 1.2 * powerFactor) + sideCurve + (effectiveWind * 8);
      const targetY = goalY + goalHeight / 2;

      // Cálculo de elevación (si la parábola sube lo suficiente para saltar la barrera)
      const isHighShot = Math.abs(dy) > 130;
      const baseLift = (isHighShot ? 28 : 12) * S;

      scene.tweens.add({ targets: kicker, y: kicker.y - 10, duration: 90, yoyo: true });

      // Portero reacciona con base en la habilidad del disparo
      const dir = targetX >= keeper.x ? 1 : -1;
      const keeperTargetX = Phaser.Math.Clamp(targetX, goalX + 15, goalX + goalWidth - 15);
      const keeperDuration = activeItem === 'LIGHTNING' ? 220 : 380;

      scene.tweens.add({
        targets: keeper, x: keeperTargetX, angle: dir * 60, y: keeper.y - 6 * S,
        duration: keeperDuration, ease: 'Power1.out'
      });

      const controlX = bx + (dx * 0.5) + (sideCurve * 0.8);
      const controlY = by - (Math.abs(dy) * 0.5);
      let wallJumped = false;
      let lastTrail = 0;

      const shotDuration = activeItem === 'LIGHTNING' ? 260 : 420;

      scene.tweens.add({
        targets: { t: 0 },
        t: 1,
        duration: shotDuration,
        ease: 'Power1.out',
        onUpdate: (tween, target) => {
          const p = target.t;
          const px = Phaser.Math.Interpolation.QuadraticBezier(p, bx, controlX, targetX);
          const py = Phaser.Math.Interpolation.QuadraticBezier(p, by, controlY, targetY);
          const lift = Math.sin(p * Math.PI) * baseLift;

          ball.setPosition(px, py - lift);
          ball.setScale(ballBase * (1 - p * 0.45));
          ball.angle += 28;
          ballShadow.setPosition(px, py + 8 * (1 - p * 0.45));
          ballShadow.setScale(ballBase * 0.8 * (1 - p * 0.45) * (1 - lift / (40 * S)));

          if (p - lastTrail > 0.05) {
            lastTrail = p;
            let sparkColor = 0xffffff;
            if (activeItem === 'FIRE') sparkColor = 0xef4444;
            else if (activeItem === 'LIGHTNING') sparkColor = 0x38bdf8;

            const tr = scene.add.image(px, py - lift, 'spark').setScale(2.2 * (1 - p * 0.5)).setAlpha(0.7).setDepth(24).setTint(sparkColor);
            scene.tweens.add({ targets: tr, alpha: 0, scale: 0, duration: 320, onComplete: () => tr.destroy() });
          }

          // Salto de la barrera
          if (!wallJumped && py < wallY + 50 && currentLevel > 1) {
            wallJumped = true;
            wallGroup.forEach(d => scene.tweens.add({ targets: d, y: d.y - 9 * S, duration: 150, yoyo: true }));
          }

          // Colisión con la barrera
          wallGroup.forEach(d => {
            if (Math.abs(px - d.x) < 14 * S && Math.abs((py - lift) - d.y) < 18 * S) {
              if (activeItem === 'FIRE') {
                // El Tiro de Fuego rompe la barrera
                scene.tweens.add({ targets: d, alpha: 0.2, y: d.y + 10, duration: 200 });
              } else {
                tween.stop();
                sfx.playHit();
                scene.cameras.main.shake(120, 0.003);
                handleLifeLoss('¡PEGÓ EN LA BARRERA!');
              }
            }
          });
        },
        onComplete: () => {
          evalShot(scene, targetX, targetY, width, height);
          setActiveItem(null); // Consumir habilidad activa
        }
      });
    }

    function evalShot(scene, tx, ty, width, height) {
      const saved = Math.abs(tx - keeper.x) < 22 * (S / 2) + 10;

      if (saved && activeItem !== 'FIRE') {
        sfx.playHit();
        scene.cameras.main.shake(120, 0.003);
        handleLifeLoss('¡TAPÓ EL PORTERO!');
      } else if (tx >= goalX && tx <= goalX + goalWidth) {
        sfx.playGoal();
        currentScore += 200;
        setScore(currentScore);
        triggerFeedback('¡GOOOLAZO!');

        // Subir de nivel cada 400 puntos
        if (currentScore >= currentLevel * 400) {
          currentLevel += 1;
          setLevel(currentLevel);
          spawnWall(scene, width, height, currentLevel);
        }

        scene.cameras.main.shake(200, 0.005);
        scene.cameras.main.flash(160, 255, 255, 190);
        const em = scene.add.particles(tx, ty, 'spark', {
          speed: { min: 90, max: 280 }, angle: { min: 200, max: 340 }, lifespan: 750,
          gravityY: 320, scale: { start: 2.4, end: 0 }, emitting: false,
          tint: [0xeab308, 0xef4444, 0x38bdf8, 0xffffff]
        }).setDepth(40);
        em.explode(36);
        scene.time.delayedCall(1000, () => em.destroy());
        crowdLayers.forEach(l => scene.tweens.add({ targets: l, y: -10, duration: 140, yoyo: true, repeat: 3 }));

        resetRound(scene, width, height);
      } else {
        sfx.playHit();
        handleLifeLoss('¡DESVIADO!');
      }
    }

    function handleLifeLoss(msg) {
      currentLives -= 1;
      setLives(currentLives);
      triggerFeedback(msg);

      if (currentLives <= 0) {
        sfx.playWhistle();
        triggerGameOver('¡SIN VIDAS!');
      } else {
        resetRound(gameRef.current.scene.scenes[0], window.innerWidth, window.innerHeight);
      }
    }

    function resetRound(scene, width, height) {
      setTimeout(() => {
        if (isGameOver) return;
        isShooting = false;
        ball.setPosition(width / 2, height - 110);
        ball.setScale(ballBase);
        ball.setAngle(0);
        ballShadow.setPosition(width / 2, height - 110 + 8).setScale(ballBase * 0.8);
        kicker.setPosition(width / 2, height - 110 + 24);
        keeper.setPosition(width / 2, goalY + goalHeight - 2).setAngle(0);
        windSpeed = Math.floor(Math.random() * 7) - 3;
      }, 750);
    }

    function triggerFeedback(txt) {
      setFeedback(txt);
      setTimeout(() => setFeedback(''), 800);
    }

    function triggerGameOver(reason) {
      isGameOver = true;
      const expGained = Math.floor(currentScore / 10);
      setGameOverData({ reason, score: currentScore, expGained });
    }

    function updateScene() {}

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
    };
  }, [player]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', touchAction: 'none' }}>
      {/* HUD RETRO SUPERIOR */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        zIndex: 999999,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '2px solid #eab308',
        boxSizing: 'border-box',
        fontFamily: "'Chakra Petch', sans-serif"
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#eab308' }}>PTS: {score}</div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6' }}>NIVEL: {level}</div>
        </div>

        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '1px' }}>
          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: '#ef4444' }}>
            {'❤️'.repeat(Math.max(0, lives))}
          </div>

          <button
            onClick={() => onExit(0)}
            style={{
              backgroundColor: '#1e293b',
              color: '#eab308',
              border: '1px solid #eab308',
              borderRadius: '4px',
              padding: '3px 6px',
              fontSize: '9px',
              fontWeight: '700'
            }}
          >
            SALIR
          </button>
        </div>
      </div>

      {/* POWER-UPS Y TIROS ESPECIALES */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 999999
      }}>
        <button
          onClick={() => setActiveItem(activeItem === 'CURVE' ? null : 'CURVE')}
          style={{
            backgroundColor: activeItem === 'CURVE' ? '#eab308' : '#1e293b',
            color: activeItem === 'CURVE' ? '#0f172a' : '#eab308',
            border: '1px solid #eab308',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: "'Chakra Petch', sans-serif"
          }}
        >
          🔥 BENDITO
        </button>

        <button
          onClick={() => setActiveItem(activeItem === 'LIGHTNING' ? null : 'LIGHTNING')}
          style={{
            backgroundColor: activeItem === 'LIGHTNING' ? '#3b82f6' : '#1e293b',
            color: activeItem === 'LIGHTNING' ? '#ffffff' : '#3b82f6',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: "'Chakra Petch', sans-serif"
          }}
        >
          ⚡ RAYO
        </button>

        <button
          onClick={() => setActiveItem(activeItem === 'FIRE' ? null : 'FIRE')}
          style={{
            backgroundColor: activeItem === 'FIRE' ? '#ef4444' : '#1e293b',
            color: activeItem === 'FIRE' ? '#ffffff' : '#ef4444',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: "'Chakra Petch', sans-serif"
          }}
        >
          💥 FUEGO
        </button>
      </div>

      {/* FEEDBACK */}
      {feedback && (
        <div style={{
          position: 'fixed',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#eab308',
          zIndex: 999999,
          fontFamily: "'Chakra Petch', sans-serif",
          textShadow: '0 2px 8px rgba(0,0,0,0.9)'
        }}>
          {feedback}
        </div>
      )}

      {/* CANAL DE JUEGO */}
      <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />

      {/* GAMEOVER MODAL */}
      {gameOverData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 15, 29, 0.96)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 999999,
          fontFamily: "'Chakra Petch', sans-serif"
        }}>
          <h2 style={{ fontSize: '24px', color: '#ef4444', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
            {gameOverData.reason}
          </h2>

          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #eab308',
            borderRadius: '10px',
            padding: '16px',
            width: '100%',
            maxWidth: '280px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>PUNTAJE FINAL</div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#eab308', margin: '4px 0 12px 0' }}>
              {gameOverData.score}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#22c55e' }}>
              <span>EXP Ganada:</span>
              <strong>+{gameOverData.expGained} PTS</strong>
            </div>
          </div>

          <button
            onClick={() => onExit(gameOverData.expGained)}
            style={{
              width: '100%',
              maxWidth: '280px',
              backgroundColor: '#eab308',
              color: '#0a0f1d',
              fontWeight: '700',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            GUARDAR Y MEJORAR JUGADOR
          </button>
        </div>
      )}
    </div>
  );
}
