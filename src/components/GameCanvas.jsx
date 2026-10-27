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
      pixelArt: true, // Forzar renderizado Pixel Art nítido
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
    let windSpeed = Math.floor(Math.random() * 7) - 3; // Viento de -3 a +3

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let currentTime = 60;
    let isShooting = false;
    let isGameOver = false;

    let swipeStartX = 0, swipeStartY = 0;
    let currentAimAngle = -Math.PI / 2; // Dirección por defecto hacia arriba

    // Atributos del jugador cargado
    const playerAccuracy = player ? player.accuracy : 25;
    const playerCurve = player ? player.curve : 25;
    const playerPower = player ? player.power : 25;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      sfx.playWhistle();

      // 1. FONDO DE TRIBUNAS Y CAMPO PIXEL ART
      const bg = scene.add.graphics();
      
      // Tribunas
      bg.fillStyle(0x1e293b, 1);
      bg.fillRect(0, 0, width, height * 0.22);

      // Valla publicitaria estilo retro
      bg.fillStyle(0xeab308, 1);
      bg.fillRect(0, height * 0.22 - 12, width, 12);

      // Campo Verde con Franjas
      const stripeHeight = (height * 0.78) / 8;
      for (let i = 0; i < 8; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.22 + (i * stripeHeight), width, stripeHeight);
      }

      // Línea de área blanca
      bg.lineStyle(2, 0xffffff, 0.5);
      bg.strokeLineShape(new Phaser.Geom.Line(width * 0.1, height * 0.42, width * 0.9, height * 0.42));

      // 2. PORTERÍA Y ORSINI (#94) PIXEL ART
      goalWidth = Math.min(width * 0.72, 290);
      goalHeight = 85;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.22;

      // Red Pixel
      const net = scene.add.graphics();
      net.lineStyle(1, 0xffffff, 0.3);
      for (let x = goalX; x <= goalX + goalWidth; x += 10) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 10) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      // Marco blanco
      const posts = scene.add.graphics();
      posts.lineStyle(4, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // Portero Orsini (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 14);
      const kBody = scene.add.rectangle(0, -10, 16, 24, 0xeab308);
      const kHead = scene.add.circle(0, -22, 6, 0xfbd23c);
      keeper.add([kBody, kHead]);

      // 3. BALÓN Y PATEADOR EN POSICIÓN
      const ballX = width / 2;
      const ballY = height - 120;

      ball = scene.add.container(ballX, ballY);
      const ballBase = scene.add.circle(0, 0, 10, 0xffffff);
      const ballDot = scene.add.circle(0, 0, 4, 0x0f172a);
      ball.add([ballBase, ballDot]);

      aimGuideGraphics = scene.add.graphics();

      spawnDefendersWall(scene, currentLevel, width, height);

      // RELOJ DE TIEMPO
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

      // 4. CONTROLES Y DIBUJO DE LÍNEA PUNTEADA MEJORADA POR PUNTERÍA
      scene.input.on('pointerdown', (pointer) => {
        if (isShooting || isGameOver) return;
        swipeStartX = pointer.x;
        swipeStartY = pointer.y;
      });

      scene.input.on('pointermove', (pointer) => {
        if (isShooting || isGameOver || !pointer.isDown) return;

        const dx = pointer.x - swipeStartX;
        const dy = pointer.y - swipeStartY;
        currentAimAngle = Math.atan2(dy, dx);

        // Dibujar línea punteada indicadora basada en Puntería
        drawAimGuide(ballX, ballY, currentAimAngle, playerAccuracy, playerCurve, windSpeed);
      });

      scene.input.on('pointerup', (pointer) => {
        if (isShooting || isGameOver) return;
        aimGuideGraphics.clear();

        const dx = pointer.x - swipeStartX;
        const dy = pointer.y - swipeStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 25 && dy < 0) {
          executeShot(scene, dx, dy, width, height, ballX, ballY);
        }
      });
    }

    // Dibujo de Línea Punteada Dinámica (Escala según Puntería/Accuracy)
    function drawAimGuide(bx, by, angle, accuracyStat, curveStat, wind) {
      aimGuideGraphics.clear();
      aimGuideGraphics.lineStyle(2, 0xeab308, 0.8);

      // Largo de la guía en base a la puntería (Mayor Accuracy = Línea más larga)
      const guideLength = Phaser.Math.Clamp(accuracyStat * 3.5, 60, 220);
      const dotsCount = Math.floor(guideLength / 12);

      let px = bx;
      let py = by;

      for (let i = 0; i < dotsCount; i++) {
        const step = i / dotsCount;
        // La proyección de la guía simula la curva y el viento
        const curveFactor = (curveStat / 50) * (step * step) * 20;
        const windFactor = wind * step * 8;

        const nextX = bx + Math.cos(angle) * (step * guideLength) + curveFactor + windFactor;
        const nextY = by + Math.sin(angle) * (step * guideLength);

        aimGuideGraphics.fillCircle(nextX, nextY, 2.5);
      }
    }

    function spawnDefendersWall(scene, levelNum, width, height) {
      wallGroup.forEach(d => d.destroy());
      wallGroup = [];

      if (levelNum === 1) return;

      const count = levelNum === 2 ? 2 : levelNum === 3 ? 3 : 4;
      const wallY = height * 0.52;
      const startX = width / 2 - ((count - 1) * 22) / 2;

      for (let i = 0; i < count; i++) {
        const defender = scene.add.container(startX + i * 22, wallY);
        const dBody = scene.add.rectangle(0, 0, 16, 32, 0x0f172a);
        const dStripe = scene.add.rectangle(0, -8, 16, 4, 0xeab308);
        const dHead = scene.add.circle(0, -18, 6, 0xfbd23c);
        defender.add([dBody, dStripe, dHead]);
        wallGroup.push(defender);
      }
    }

    function executeShot(scene, dx, dy, width, height, bx, by) {
      isShooting = true;
      sfx.playKick();

      // Cálculo de Curva y Potencia en base a Stats
      const powerFactor = (playerPower / 100) + 1;
      const curveFactor = (playerCurve / 30);

      // Posición final objetivo
      let targetX = bx + dx * powerFactor + (curveFactor * 25) + (windSpeed * 8);
      let targetY = goalY + goalHeight / 2;

      // Reacción de Orsini
      scene.tweens.add({
        targets: keeper,
        x: Phaser.Math.Clamp(targetX, goalX + 20, goalX + goalWidth - 20),
        duration: 380,
        ease: 'Power1.out'
      });

      // Animación curva del balón en Bézier
      const controlX = bx + (dx / 2) + (curveFactor * 40);
      const controlY = by - (Math.abs(dy) / 2);

      let progress = 0;

      scene.tweens.add({
        targets: { t: 0 },
        t: 1,
        duration: 450,
        ease: 'Power1.out',
        onUpdate: (tween, target) => {
          progress = target.t;
          const px = Phaser.Math.Interpolation.QuadraticBezier(progress, bx, controlX, targetX);
          const py = Phaser.Math.Interpolation.QuadraticBezier(progress, by, controlY, targetY);

          ball.setPosition(px, py);
          ball.setScale(1 - progress * 0.4);

          // Impacto en barrera
          wallGroup.forEach(d => {
            if (Math.abs(px - d.x) < 15 && Math.abs(py - d.y) < 18) {
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
      const saved = Math.abs(tx - keeper.x) < 22;

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
        ball.setPosition(width / 2, height - 120);
        ball.setScale(1);
        keeper.setPosition(width / 2, goalY + goalHeight - 14);
        windSpeed = Math.floor(Math.random() * 7) - 3;
      }, 700);
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
      {/* HUD SUPERIOR */}
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

      {/* BOTONES DE POWER-UPS PROM '07 */}
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
