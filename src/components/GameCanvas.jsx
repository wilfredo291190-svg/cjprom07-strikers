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
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'phaser-game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0a0f1d',
      scene: {
        create: createScene,
        update: updateScene
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    let ball, ballShadow, keeper;
    let goalX, goalY, goalWidth, goalHeight;
    let wallGroup = [];
    let trailGraphics, curvePreviewGraphics;

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let totalGoals = 0;
    let currentTime = 60;
    let timerEvent;

    let swipePoints = [];
    let isDrawingCurve = false;
    let isShooting = false;
    let isGameOver = false;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      sfx.playWhistle();

      // 1. ESTADIO Y CAMPO 2.5D
      const bg = scene.add.graphics();
      bg.fillStyle(0x0f172a, 1);
      bg.fillRect(0, 0, width, height * 0.25);

      // Reflectores
      bg.fillStyle(0xfde047, 0.12);
      bg.fillTriangle(0, 0, width * 0.45, height * 0.25, 0, height * 0.25);
      bg.fillTriangle(width, 0, width * 0.55, height * 0.25, width, height * 0.25);

      // Césped
      const stripeHeight = (height * 0.75) / 6;
      for (let i = 0; i < 6; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
      }

      // Línea de área
      bg.lineStyle(2, 0xffffff, 0.3);
      bg.strokeLineShape(new Phaser.Geom.Line(width * 0.08, height * 0.42, width * 0.92, height * 0.42));

      // 2. PORTERÍA CON PERSPECTIVA
      goalWidth = Math.min(width * 0.75, 320);
      goalHeight = 90;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.23;

      // Red
      const net = scene.add.graphics();
      net.lineStyle(1, 0xe2e8f0, 0.25);
      for (let x = goalX; x <= goalX + goalWidth; x += 10) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 10) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      // Postes
      const posts = scene.add.graphics();
      posts.lineStyle(6, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // 3. PORTERO ORSINI (#94) CON ANATOMÍA (Brazos, Piernas, Guantes)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 12);
      
      const kLegL = scene.add.rectangle(-6, 8, 5, 16, 0x0f172a);
      const kLegR = scene.add.rectangle(6, 8, 5, 16, 0x0f172a);
      const kBody = scene.add.rectangle(0, -8, 18, 22, 0xeab308); // Camiseta Dorada
      const kArmL = scene.add.rectangle(-12, -10, 5, 16, 0xeab308);
      const kArmR = scene.add.rectangle(12, -10, 5, 16, 0xeab308);
      const kGloveL = scene.add.circle(-13, -18, 4, 0xffffff);
      const kGloveR = scene.add.circle(13, -18, 4, 0xffffff);
      const kHead = scene.add.circle(0, -22, 7, 0xfbd23c);
      const kNum = scene.add.text(0, -11, '94', {
        fontFamily: "'Chakra Petch', sans-serif", fontSize: '9px', color: '#0f172a', fontStyle: 'bold'
      }).setOrigin(0.5);

      keeper.add([kLegL, kLegR, kBody, kArmL, kArmR, kGloveL, kGloveR, kHead, kNum]);

      // 4. BALÓN Y SOMBRA
      const startXPos = width / 2;
      const startYPos = height - 110;

      ballShadow = scene.add.ellipse(startXPos, startYPos + 12, 24, 8, 0x000000, 0.4);

      ball = scene.add.container(startXPos, startYPos);
      const ballBase = scene.add.circle(0, 0, 14, 0xffffff);
      const ballP1 = scene.add.polygon(0, 0, [0, -6, 5, -2, 3, 4, -3, 4, -5, -2], 0x0f172a);
      const ballP2 = scene.add.circle(-8, -4, 3, 0x0f172a);
      const ballP3 = scene.add.circle(8, -4, 3, 0x0f172a);
      ball.add([ballBase, ballP1, ballP2, ballP3]);

      trailGraphics = scene.add.graphics();
      curvePreviewGraphics = scene.add.graphics();

      spawnWall(scene, currentLevel, width, height);

      // TIMER
      timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => {
          if (isGameOver) return;
          currentTime -= 1;
          setTimeLeft(currentTime);

          if (currentTime <= 0) {
            triggerGameOver('¡TIEMPO AGOTADO!');
          }
        },
        callbackScope: scene,
        loop: true
      });

      // 5. CONTROL TÁCTIL DE DIBUJO DE CURVA LIBRE (FREE-DRAW)
      const container = document.getElementById('phaser-game-container');

      const startSwipe = (e) => {
        if (isShooting || isGameOver) return;
        const touch = e.touches ? e.touches[0] : e;
        if (!touch) return;

        swipePoints = [{ x: touch.clientX, y: touch.clientY }];
        isDrawingCurve = true;
      };

      const moveSwipe = (e) => {
        if (!isDrawingCurve || isShooting || isGameOver) return;
        const touch = e.touches ? e.touches[0] : e;
        if (!touch) return;

        const currentP = { x: touch.clientX, y: touch.clientY };
        swipePoints.push(currentP);

        // Previsualizar la curva amarilla que dibuja el dedo
        curvePreviewGraphics.clear();
        curvePreviewGraphics.lineStyle(3, 0xeab308, 0.8);
        for (let i = 0; i < swipePoints.length - 1; i++) {
          curvePreviewGraphics.lineBetween(
            swipePoints[i].x, swipePoints[i].y,
            swipePoints[i + 1].x, swipePoints[i + 1].y
          );
        }
      };

      const endSwipe = () => {
        if (!isDrawingCurve || isShooting || isGameOver) return;
        isDrawingCurve = false;
        curvePreviewGraphics.clear();

        if (swipePoints.length < 3) return; // Trazo muy corto

        const firstP = swipePoints[0];
        const lastP = swipePoints[swipePoints.length - 1];
        const midP = swipePoints[Math.floor(swipePoints.length / 2)];

        // Validar disparo hacia arriba
        if (lastP.y < firstP.y - 30) {
          isShooting = true;
          sfx.playKick();

          executeCurvedShot(scene, firstP, midP, lastP, startXPos, startYPos, width, height);
        }
      };

      if (container) {
        container.addEventListener('touchstart', startSwipe, { passive: true });
        container.addEventListener('touchmove', moveSwipe, { passive: true });
        container.addEventListener('touchend', endSwipe, { passive: true });

        container.addEventListener('mousedown', startSwipe);
        container.addEventListener('mousemove', moveSwipe);
        container.addEventListener('mouseup', endSwipe);
      }
    }

    function executeCurvedShot(scene, pStart, pMid, pEnd, startXPos, startYPos, width, height) {
      // El punto medio dibujado por el dedo define el giro/rosca (Curva Bézier cuadrática)
      const curveStat = player ? player.curve : 20;
      const powerStat = player ? player.power : 20;

      // Calcular desvío lateral generado por el trazo del usuario
      const curveDeviation = (pMid.x - ((pStart.x + pEnd.x) / 2)) * (1 + curveStat / 40);
      const controlX = ((startXPos + pEnd.x) / 2) + curveDeviation;
      const controlY = height * 0.48;

      const targetX = Phaser.Math.Clamp(pEnd.x, goalX - 15, goalX + goalWidth + 15);
      const targetY = Phaser.Math.Clamp(pEnd.y, goalY - 10, goalY + goalHeight + 10);

      const shotSpeed = Phaser.Math.Clamp(650 - (powerStat * 3.5), 320, 560);

      // Animación de Estirada de Orsini
      const isCorner = (targetX < goalX + 35 || targetX > goalX + goalWidth - 35);
      const keeperSpeed = isCorner ? 0.42 : 0.68;
      const keeperTargetX = Phaser.Math.Clamp(targetX, goalX + 18, goalX + goalWidth - 18);

      scene.tweens.add({
        targets: keeper,
        x: keeperTargetX,
        duration: shotSpeed / keeperSpeed,
        ease: 'Power1.out'
      });

      let progress = 0;
      let hasCollided = false;

      scene.tweens.add({
        targets: { t: 0 },
        t: 1,
        duration: shotSpeed,
        ease: 'Power1.out',
        onUpdate: (tween, target) => {
          if (hasCollided) return;

          progress = target.t;
          const px = Phaser.Math.Interpolation.QuadraticBezier(progress, startXPos, controlX, targetX);
          const py = Phaser.Math.Interpolation.QuadraticBezier(progress, startYPos, controlY, targetY);

          ball.setPosition(px, py);
          ball.setRotation(progress * 14);
          ball.setScale(1 - progress * 0.55);
          ballShadow.setPosition(px, py + 12 * (1 - progress));

          trailGraphics.clear();
          trailGraphics.lineStyle(3, 0xeab308, 0.6);
          trailGraphics.lineBetween(startXPos, startYPos, px, py);

          // Colisión Barrera
          wallGroup.forEach(d => {
            if (Math.abs(px - d.x) < 16 && Math.abs(py - d.y) < 22) {
              hasCollided = true;
              tween.stop();
              trailGraphics.clear();
              sfx.playHit();
              handleCollision(scene, 'BARRERA!');
            }
          });

          // Colisión Orsini
          if (!hasCollided && Math.abs(px - keeper.x) < 15 && Math.abs(py - (goalY + goalHeight - 12)) < 16 && progress > 0.8) {
            hasCollided = true;
            tween.stop();
            trailGraphics.clear();
            sfx.playHit();
            handleCollision(scene, 'TAPÓ!');
          }
        },
        onComplete: () => {
          if (!hasCollided) {
            trailGraphics.clear();
            evaluateShot(scene, targetX, targetY, width, height);
          }
        }
      });
    }

    function updateScene() {
      if (currentLevel >= 4 && wallGroup.length > 0 && !isGameOver) {
        wallGroup.forEach(defender => {
          defender.x += Math.sin(this.time.now / 300) * 1.2;
        });
      }
    }

    function spawnWall(scene, levelNum, width, height) {
      wallGroup.forEach(d => d.destroy());
      wallGroup = [];

      if (levelNum === 1) return;

      const numDefenders = levelNum === 2 ? 2 : levelNum === 3 ? 3 : 4;
      const wallY = height * 0.52;
      const startWallX = width / 2 - ((numDefenders - 1) * 22) / 2;

      for (let i = 0; i < numDefenders; i++) {
        const defender = scene.add.container(startWallX + i * 22, wallY);
        
        // Defensores Prom '07 con Brazos, Piernas y Camiseta
        const legL = scene.add.rectangle(-5, 10, 4, 16, 0x0f172a);
        const legR = scene.add.rectangle(5, 10, 4, 16, 0x0f172a);
        const body = scene.add.rectangle(0, -6, 16, 22, 0x0f172a); // Camiseta Negra
        const stripe = scene.add.rectangle(0, -10, 16, 4, 0xeab308); // Franja Dorada
        const armL = scene.add.rectangle(-9, -4, 4, 14, 0x0f172a);
        const armR = scene.add.rectangle(9, -4, 4, 14, 0x0f172a);
        const head = scene.add.circle(0, -20, 6, 0xfbd23c);

        defender.add([legL, legR, body, stripe, armL, armR, head]);
        wallGroup.push(defender);
      }
    }

    function handleCollision(scene, msg) {
      currentLives -= 1;
      setLives(currentLives);
      triggerFeedback(msg);

      if (currentLives <= 0) {
        sfx.playWhistle();
        triggerGameOver('¡SIN VIDAS!');
      } else {
        resetBall(scene);
      }
    }

    function evaluateShot(scene, targetX, targetY, width, height) {
      const inGoalX = targetX >= goalX && targetX <= goalX + goalWidth;
      const inGoalY = targetY >= goalY && targetY <= goalY + goalHeight;

      if (!inGoalX || !inGoalY) {
        sfx.playHit();
        handleCollision(scene, 'FUERA!');
      } else {
        sfx.playGoal();
        totalGoals += 1;
        const isCorner = (targetX < goalX + 35 || targetX > goalX + goalWidth - 35) && targetY < goalY + 30;
        const pts = isCorner ? 250 : 100;
        currentScore += pts;
        setScore(currentScore);

        triggerFeedback(isCorner ? 'ESCUADRA!' : 'GOL!');

        const newLvl = Math.min(5, 1 + Math.floor(totalGoals / 2));
        if (newLvl !== currentLevel) {
          currentLevel = newLvl;
          setLevel(currentLevel);
          spawnWall(scene, currentLevel, width, height);
        }

        resetBall(scene);
      }
    }

    function resetBall(scene) {
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      scene.time.delayedCall(600, () => {
        if (isGameOver) return;
        ball.setPosition(width / 2, height - 110);
        ball.setRotation(0);
        ball.setScale(1);
        ballShadow.setPosition(width / 2, height - 98);
        ballShadow.setScale(1);
        keeper.setPosition(width / 2, goalY + goalHeight - 12);
        isShooting = false;
      });
    }

    function triggerFeedback(text) {
      setFeedback(text);
      setTimeout(() => setFeedback(''), 400);
    }

    function triggerGameOver(reason) {
      isGameOver = true;
      if (timerEvent) timerEvent.remove();

      const expGained = Math.floor(currentScore / 10);
      setGameOverData({ reason, score: currentScore, totalGoals, expGained });
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
    };
  }, [player]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0a0f1d',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      fontFamily: "'Chakra Petch', sans-serif"
    }}>
      {/* HUD LIMPIO */}
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
        boxSizing: 'border-box'
      }}>
        <div style={{ lineHeight: '1.2' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#eab308' }}>PTS: {score}</div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6' }}>NIVEL: {level}</div>
        </div>

        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '1px', textAlign: 'center' }}>
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

      {/* FEEDBACK CENTRADO */}
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
          textShadow: '0 2px 6px rgba(0,0,0,0.9)'
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
          zIndex: 999999
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

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid #1e293b', paddingTop: '8px', marginBottom: '8px' }}>
              <span>Goles Totales:</span>
              <strong>{gameOverData.totalGoals}</strong>
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
              fontFamily: "'Chakra Petch', sans-serif",
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
