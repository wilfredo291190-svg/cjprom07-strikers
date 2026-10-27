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
  const [activeItem, setActiveItem] = useState(null);
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'phaser-game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0a0f1d',
      pixelArt: true,
      scene: {
        create: createScene,
        update: updateScene
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    let ball, keeper, aimGuideGraphics;
    let goalX, goalY, goalWidth, goalHeight;
    let wallGroup = [];
    let windSpeed = Math.floor(Math.random() * 7) - 3; // -3 a +3

    let currentScore = 0;
    let currentLives = 3;
    let currentTime = 60;
    let isShooting = false;
    let isGameOver = false;

    let swipeStartX = 0, swipeStartY = 0;

    // Atributos del jugador
    const playerAccuracy = player ? player.accuracy : 30;
    const playerCurve = player ? player.curve : 30;
    const playerPower = player ? player.power : 30;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      sfx.playWhistle();

      // 1. TRIBUNA DE PÚBLICO RETRO (ESTILO SOCCER CURVE)
      const crowdGraphics = scene.add.graphics();
      crowdGraphics.fillStyle(0x1e293b, 1);
      crowdGraphics.fillRect(0, 0, width, height * 0.18);

      // Dibujar cabezas de público pixeladas
      for (let x = 10; x < width; x += 16) {
        for (let y = 10; y < height * 0.16; y += 14) {
          const color = (x + y) % 3 === 0 ? 0xeab308 : (x + y) % 2 === 0 ? 0xef4444 : 0x38bdf8;
          crowdGraphics.fillStyle(color, 1);
          crowdGraphics.fillRect(x, y, 10, 10);
        }
      }

      // 2. VALLA PUBLICITARIA Y CAMPO
      const bg = scene.add.graphics();
      // Valla
      bg.fillStyle(0x991b1b, 1);
      bg.fillRect(0, height * 0.18, width, 16);
      bg.fillStyle(0xffffff, 1);
      bg.fillRect(0, height * 0.18 + 4, width, 8);

      // Césped
      const stripeH = (height * 0.82) / 7;
      for (let i = 0; i < 7; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x16a34a : 0x15803d, 1);
        bg.fillRect(0, height * 0.18 + 16 + (i * stripeH), width, stripeH);
      }

      // Líneas del área en perspectiva
      bg.lineStyle(2, 0xffffff, 0.7);
      const areaTopY = height * 0.32;
      const areaBottomY = height * 0.60;
      bg.strokeRect(width * 0.2, areaTopY, width * 0.6, areaBottomY - areaTopY);

      // Semi-círculo del área
      bg.strokeCircle(width / 2, height * 0.70, 70);

      // 3. PORTERÍA Y ORSINI (#94)
      goalWidth = Math.min(width * 0.45, 240);
      goalHeight = 70;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.22;

      // Red
      const net = scene.add.graphics();
      net.lineStyle(1, 0xffffff, 0.4);
      for (let x = goalX; x <= goalX + goalWidth; x += 8) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 8) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      // Marco
      const posts = scene.add.graphics();
      posts.lineStyle(4, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // Portero Orsini (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 12);
      const kBody = scene.add.rectangle(0, -8, 14, 20, 0xeab308);
      const kHead = scene.add.circle(0, -18, 5, 0xfbd23c);
      keeper.add([kBody, kHead]);

      // 4. BARRERA DE RIVALES
      spawnWall(scene, width, height);

      // 5. PATEADOR Y BALÓN
      const ballX = width / 2;
      const ballY = height - 110;

      // Jugador de espaldas
      const kicker = scene.add.container(ballX, ballY + 20);
      const pBody = scene.add.rectangle(0, -10, 16, 22, 0x0f172a); // Camiseta negra
      const pStripe = scene.add.rectangle(0, -12, 16, 4, 0xeab308); // Franja dorada
      const pHead = scene.add.circle(0, -20, 6, 0xfbd23c);
      kicker.add([pBody, pStripe, pHead]);

      // Balón
      ball = scene.add.container(ballX, ballY);
      const bBase = scene.add.circle(0, 0, 8, 0xffffff);
      const bDot = scene.add.circle(0, 0, 3, 0x0f172a);
      ball.add([bBase, bDot]);

      aimGuideGraphics = scene.add.graphics();

      // INDICADOR DE VIENTO RETRO (ABAJO IZQUIERDA)
      createWindIndicator(scene, height);

      // RELOJ
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

      // CONTROLES DE SWIPE / APUNTADO
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

        drawAimGuide(ballX, ballY, angle, playerAccuracy, playerCurve, windSpeed);
      });

      scene.input.on('pointerup', (pointer) => {
        if (isShooting || isGameOver) return;
        aimGuideGraphics.clear();

        const dx = pointer.x - swipeStartX;
        const dy = pointer.y - swipeStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 20 && dy < 0) {
          executeShot(scene, dx, dy, width, height, ballX, ballY);
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

    function drawAimGuide(bx, by, angle, accuracyStat, curveStat, wind) {
      aimGuideGraphics.clear();
      aimGuideGraphics.lineStyle(2, 0xeab308, 0.9);

      // Puntería determina la longitud
      const guideLength = Phaser.Math.Clamp(accuracyStat * 3.8, 70, 230);
      const dotsCount = Math.floor(guideLength / 10);

      for (let i = 0; i < dotsCount; i++) {
        const step = i / dotsCount;
        const curveOffset = (curveStat / 40) * (step * step) * 22;
        const windOffset = wind * step * 7;

        const nx = bx + Math.cos(angle) * (step * guideLength) + curveOffset + windOffset;
        const ny = by + Math.sin(angle) * (step * guideLength);

        aimGuideGraphics.fillCircle(nx, ny, 2);
      }
    }

    function spawnWall(scene, width, height) {
      wallGroup.forEach(d => d.destroy());
      wallGroup = [];

      const wallY = height * 0.48;
      const count = 3;
      const startX = width / 2 - ((count - 1) * 20) / 2;

      for (let i = 0; i < count; i++) {
        const defender = scene.add.container(startX + i * 20, wallY);
        const dBody = scene.add.rectangle(0, 0, 14, 28, 0x1d4ed8); // Rival azul
        const dHead = scene.add.circle(0, -16, 5, 0xfbd23c);
        defender.add([dBody, dHead]);
        wallGroup.push(defender);
      }
    }

    function executeShot(scene, dx, dy, width, height, bx, by) {
      isShooting = true;
      sfx.playKick();

      const curveFactor = (playerCurve / 25);
      const powerFactor = (playerPower / 100) + 1;

      const targetX = bx + (dx * powerFactor) + (curveFactor * 20) + (windSpeed * 6);
      const targetY = goalY + goalHeight / 2;

      // Movimiento de Orsini
      scene.tweens.add({
        targets: keeper,
        x: Phaser.Math.Clamp(targetX, goalX + 15, goalX + goalWidth - 15),
        duration: 360,
        ease: 'Power1.out'
      });

      const controlX = bx + (dx / 2) + (curveFactor * 35);
      const controlY = by - (Math.abs(dy) / 2);

      scene.tweens.add({
        targets: { t: 0 },
        t: 1,
        duration: 420,
        ease: 'Power1.out',
        onUpdate: (tween, target) => {
          const progress = target.t;
          const px = Phaser.Math.Interpolation.QuadraticBezier(progress, bx, controlX, targetX);
          const py = Phaser.Math.Interpolation.QuadraticBezier(progress, by, controlY, targetY);

          ball.setPosition(px, py);
          ball.setScale(1 - progress * 0.45);

          // Colisión Barrera
          wallGroup.forEach(d => {
            if (Math.abs(px - d.x) < 12 && Math.abs(py - d.y) < 16) {
              tween.stop();
              sfx.playHit();
              handleLifeLoss('¡PEGÓ EN LA BARRERA!');
            }
          });
        },
        onComplete: () => {
          evalShot(scene, targetX, targetY, width, height);
        }
      });
    }

    function evalShot(scene, tx, ty, width, height) {
      const saved = Math.abs(tx - keeper.x) < 20;

      if (saved) {
        sfx.playHit();
        handleLifeLoss('¡TAPÓ ORSINI!');
      } else if (tx >= goalX && tx <= goalX + goalWidth) {
        sfx.playGoal();
        currentScore += 200;
        setScore(currentScore);
        triggerFeedback('¡GOOOLAZO!');
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
        ball.setScale(1);
        keeper.setPosition(width / 2, goalY + goalHeight - 12);
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

      {/* POWER-UPS PROM '07 */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px',
        zIndex: 999999
      }}>
        <button
          onClick={() => setActiveItem('BANANA')}
          style={{
            backgroundColor: activeItem === 'BANANA' ? '#eab308' : '#1e293b',
            color: activeItem === 'BANANA' ? '#0f172a' : '#eab308',
            border: '1px solid #eab308',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: "'Chakra Petch', sans-serif"
          }}
        >
          🍌 BANANAZO
        </button>

        <button
          onClick={() => setActiveItem('THUNDER')}
          style={{
            backgroundColor: activeItem === 'THUNDER' ? '#3b82f6' : '#1e293b',
            color: activeItem === 'THUNDER' ? '#ffffff' : '#3b82f6',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: "'Chakra Petch', sans-serif"
          }}
        >
          ⚡ TRUENO
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
