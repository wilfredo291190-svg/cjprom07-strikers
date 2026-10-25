import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

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

    let ball, ballShadow, keeper, keeperBody;
    let goalX, goalY, goalWidth, goalHeight;
    let wallGroup = [];
    let trailGraphics;

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let totalGoals = 0;
    let currentTime = 60;
    let timerEvent;

    let startX, startY, startTime;
    let isShooting = false;
    let isGameOver = false;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      // CAMPO Y PERSPECTIVA
      const bg = scene.add.graphics();
      bg.fillStyle(0x0f172a, 1);
      bg.fillRect(0, 0, width, height * 0.25);

      const stripeHeight = (height * 0.75) / 6;
      for (let i = 0; i < 6; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
      }

      // PORTERÍA
      goalWidth = Math.min(width * 0.72, 320);
      goalHeight = 90;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.22;

      const net = scene.add.graphics();
      net.lineStyle(1, 0xffffff, 0.25);
      for (let x = goalX; x <= goalX + goalWidth; x += 12) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 12) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      const posts = scene.add.graphics();
      posts.lineStyle(6, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // PORTERO ORSINI (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 15);
      keeperBody = scene.add.rectangle(0, -12, 18, 30, 0xeab308);
      const keeperHead = scene.add.circle(0, -28, 6, 0xfbd23c);
      keeper.add([keeperBody, keeperHead]);

      // BALÓN Y SOMBRA
      const startXPos = width / 2;
      const startYPos = height - 110;

      ballShadow = scene.add.ellipse(startXPos, startYPos + 12, 24, 8, 0x000000, 0.4);

      ball = scene.add.container(startXPos, startYPos);
      const ballBase = scene.add.circle(0, 0, 14, 0xffffff);
      const ballPattern = scene.add.circle(0, 0, 10, 0x0f172a);
      const ballInner = scene.add.circle(0, 0, 6, 0xffffff);
      ball.add([ballBase, ballPattern, ballInner]);

      trailGraphics = scene.add.graphics();

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

      // CONTROLES DE TIRO BASADOS EN SWIPE
      scene.input.on('pointerdown', (pointer) => {
        if (isShooting || isGameOver) return;
        startX = pointer.x;
        startY = pointer.y;
        startTime = pointer.time;
      });

      scene.input.on('pointerup', (pointer) => {
        if (isShooting || isGameOver || !startX) return;

        const duration = Math.max(50, pointer.time - startTime);
        const deltaX = pointer.x - startX;
        const deltaY = pointer.y - startY;

        if (deltaY < -20) {
          isShooting = true;

          // Cálculo de velocidad por gesto y stat
          const swipeVelocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / duration;
          const powerStat = player ? player.power : 20;
          const shotSpeed = Math.max(220, 700 - (swipeVelocity * 180) - (powerStat * 3.5));

          // Cálculo de curva
          const curveStat = player ? player.curve : 20;
          const controlX = ball.x + (deltaX * (1 + curveStat / 50));
          const controlY = height * 0.48;
          const targetX = Phaser.Math.Clamp(ball.x + deltaX * 1.1, goalX - 15, goalX + goalWidth + 15);
          const targetY = goalY + (goalHeight / 2);

          // IA adaptativa de Orsini por nivel
          const keeperSpeedFactor = currentLevel === 1 ? 0.35 : currentLevel <= 3 ? 0.55 : 0.8;
          const keeperTargetX = Phaser.Math.Clamp(targetX, goalX + 25, goalX + goalWidth - 25);

          scene.tweens.add({
            targets: keeper,
            x: keeperTargetX,
            duration: shotSpeed / keeperSpeedFactor,
            ease: 'Power1.out'
          });

          // Trayectoria
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
              ball.setScale(1 - progress * 0.55);
              ballShadow.setPosition(px, py + 12 * (1 - progress));
              ballShadow.setScale(1 - progress * 0.55);

              trailGraphics.clear();
              trailGraphics.lineStyle(3, 0xeab308, 0.6);
              trailGraphics.lineBetween(startXPos, startYPos, px, py);

              // COLISIÓN BARRERA
              wallGroup.forEach(d => {
                if (Math.abs(px - d.x) < 16 && Math.abs(py - d.y) < 22) {
                  hasCollided = true;
                  tween.stop();
                  trailGraphics.clear();
                  handleCollision(scene, '¡EN LA BARRERA!');
                }
              });

              // COLISIÓN ORSINI (Hitbox reducido)
              if (!hasCollided && Math.abs(px - keeper.x) < 15 && Math.abs(py - (goalY + goalHeight - 15)) < 18 && progress > 0.75) {
                hasCollided = true;
                tween.stop();
                trailGraphics.clear();
                handleCollision(scene, '¡ATAJÓ ORSINI!');
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
        const body = scene.add.rectangle(0, 0, 16, 36, 0x1e293b);
        const shirtBorder = scene.add.rectangle(0, -10, 16, 4, 0xeab308);
        const head = scene.add.circle(0, -22, 7, 0xfbd23c);

        defender.add([body, shirtBorder, head]);
        wallGroup.push(defender);
      }
    }

    function handleCollision(scene, msg) {
      currentLives -= 1;
      setLives(currentLives);
      triggerFeedback(msg);

      if (currentLives <= 0) {
        triggerGameOver('¡SIN VIDAS!');
      } else {
        resetBall(scene);
      }
    }

    function evaluateShot(scene, targetX, targetY, width, height) {
      const inGoalX = targetX >= goalX && targetX <= goalX + goalWidth;
      const inGoalY = targetY >= goalY && targetY <= goalY + goalHeight;

      if (!inGoalX || !inGoalY) {
        handleCollision(scene, '¡FUERA!');
      } else {
        totalGoals += 1;
        const isCorner = (targetX < goalX + 35 || targetX > goalX + goalWidth - 35) && targetY < goalY + 30;
        const pts = isCorner ? 250 : 100;
        currentScore += pts;
        setScore(currentScore);

        triggerFeedback(isCorner ? '¡ESCUADRA!' : '¡GOOOL!');

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

      scene.time.delayedCall(700, () => {
        if (isGameOver) return;
        ball.setPosition(width / 2, height - 110);
        ball.setScale(1);
        ballShadow.setPosition(width / 2, height - 98);
        ballShadow.setScale(1);
        keeper.setPosition(width / 2, goalY + goalHeight - 15);
        isShooting = false;
      });
    }

    function triggerFeedback(text) {
      setFeedback(text);
      setTimeout(() => setFeedback(''), 900);
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
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      fontFamily: "'Chakra Petch', sans-serif"
    }}>
      {/* HUD SUPERIOR */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        backgroundColor: 'rgba(10, 15, 29, 0.85)',
        borderBottom: '1px solid #eab308'
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#eab308' }}>PTS: {score}</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#3b82f6' }}>NIVEL: {level}</div>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
        </div>

        <div style={{ fontSize: '12px', color: '#ef4444' }}>
          {'❤️'.repeat(Math.max(0, lives))}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {/* Botón Test para saltar directo a mejoras */}
          <button
            onClick={() => onExit(500)}
            style={{
              backgroundColor: '#22c55e',
              color: '#0a0f1d',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '9px',
              fontWeight: 'bold'
            }}
          >
            +500 EXP (TEST)
          </button>

          <button
            onClick={() => onExit(0)}
            style={{
              backgroundColor: '#1e293b',
              color: '#eab308',
              border: '1px solid #eab308',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '9px',
              fontWeight: '700'
            }}
          >
            SALIR
          </button>
        </div>
      </div>

      {/* FEEDBACK CENTRAL */}
      {feedback && (
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#eab308',
          zIndex: 60,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          padding: '6px 16px',
          borderRadius: '8px',
          border: '1px solid #eab308'
        }}>
          {feedback}
        </div>
      )}

      {/* CANVAS */}
      <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />

      {/* GAMEOVER MODAL */}
      {gameOverData && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(10, 15, 29, 0.96)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
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
