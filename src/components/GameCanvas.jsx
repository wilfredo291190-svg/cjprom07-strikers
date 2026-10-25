import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

export default function GameCanvas({ player, onExit }) {
  const gameRef = useRef(null);
  
  // Estado local para UI garantizada con React
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

      // 1. DIBUJAR CAMPO Y PERSPECTIVA
      const bg = scene.add.graphics();
      bg.fillStyle(0x0f172a, 1);
      bg.fillRect(0, 0, width, height * 0.25);

      const stripeHeight = (height * 0.75) / 6;
      for (let i = 0; i < 6; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
      }

      // 2. PORTERÍA Y RED
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

      // 3. PORTERO ORSINI (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 15);
      keeperBody = scene.add.rectangle(0, -12, 20, 32, 0xeab308); // Camiseta amarilla de portero
      const keeperHead = scene.add.circle(0, -32, 7, 0xfbd23c);
      keeper.add([keeperBody, keeperHead]);

      // 4. BALÓN, SOMBRA Y TRAZO
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

      // RELOJ FIJO DE 60s
      timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => {
          if (isGameOver) return;
          currentTime -= 1;
          setTimeLeft(currentTime);

          if (currentTime <= 0) {
            triggerGameOver(scene, '¡TIEMPO AGOTADO!');
          }
        },
        callbackScope: scene,
        loop: true
      });

      // GESTOS TÁCTILES
      scene.input.on('pointerdown', (pointer) => {
        if (isShooting || isGameOver) return;
        startX = pointer.x;
        startY = pointer.y;
        startTime = pointer.time;
      });

      scene.input.on('pointerup', (pointer) => {
        if (isShooting || isGameOver || !startX) return;

        const duration = pointer.time - startTime;
        const deltaX = pointer.x - startX;
        const deltaY = pointer.y - startY;

        if (deltaY < -25 && duration < 800) {
          isShooting = true;

          // Parábola y Curva Bézier
          const curveFactor = ((player ? player.curve : 20) / 100) * deltaX;
          const controlX = ball.x + deltaX + curveFactor;
          const controlY = height * 0.5;
          const targetX = Phaser.Math.Clamp(ball.x + deltaX, goalX - 20, goalX + goalWidth + 20);
          const targetY = goalY + (goalHeight / 2);

          const speed = Math.max(300, 750 - ((player ? player.power : 20) * 4));

          // Estirada del Portero
          scene.tweens.add({
            targets: keeper,
            x: Phaser.Math.Clamp(targetX, goalX + 15, goalX + goalWidth - 15),
            duration: speed * 0.8,
            ease: 'Power2.out'
          });

          // Animación de Tiro en Curva
          let progress = 0;
          scene.tweens.add({
            targets: { t: 0 },
            t: 1,
            duration: speed,
            ease: 'Power1.out',
            onUpdate: (tween, target) => {
              progress = target.t;
              const px = Phaser.Math.Interpolation.QuadraticBezier(progress, startXPos, controlX, targetX);
              const py = Phaser.Math.Interpolation.QuadraticBezier(progress, startYPos, controlY, targetY);

              ball.setPosition(px, py);
              ball.setScale(1 - (progress * 0.55));
              ballShadow.setPosition(px, py + (12 * (1 - progress)));
              ballShadow.setScale(1 - (progress * 0.55));

              // Rastro (Trail)
              trailGraphics.clear();
              trailGraphics.lineStyle(3, 0xeab308, 0.6);
              trailGraphics.lineBetween(startXPos, startYPos, px, py);
            },
            onComplete: () => {
              trailGraphics.clear();
              evaluateShot(scene, targetX, targetY, width, height);
            }
          });
        }
      });
    }

    function updateScene() {
      if (currentLevel >= 4 && wallGroup.length > 0 && !isGameOver) {
        wallGroup.forEach(defender => {
          defender.x += Math.sin(this.time.now / 250) * 1.5;
        });
      }
    }

    function spawnWall(scene, levelNum, width, height) {
      wallGroup.forEach(d => d.destroy());
      wallGroup = [];

      if (levelNum === 1) return;

      const numDefenders = levelNum === 2 ? 2 : levelNum === 3 ? 3 : 4;
      const wallY = height * 0.52;
      const startWallX = (width / 2) - ((numDefenders - 1) * 22) / 2;

      for (let i = 0; i < numDefenders; i++) {
        const defender = scene.add.container(startWallX + (i * 22), wallY);
        const body = scene.add.rectangle(0, 0, 16, 36, 0x1e293b);
        const shirtBorder = scene.add.rectangle(0, -10, 16, 4, 0xeab308);
        const head = scene.add.circle(0, -22, 7, 0xfbd23c);

        defender.add([body, shirtBorder, head]);
        wallGroup.push(defender);
      }
    }

    function evaluateShot(scene, targetX, targetY, width, height) {
      const inGoalX = targetX >= goalX && targetX <= (goalX + goalWidth);
      const inGoalY = targetY >= goalY && targetY <= (goalY + goalHeight);

      // Bloqueo por Barrera
      let hitWall = false;
      wallGroup.forEach(d => {
        if (Math.abs(ball.x - d.x) < 20 && Math.abs(ball.y - d.y) < 30) {
          hitWall = true;
        }
      });

      // Atajada de Portero
      const savedByKeeper = Math.abs(ball.x - keeper.x) < 22 && Math.abs(ball.y - keeper.y) < 25;

      if (hitWall || savedByKeeper || !inGoalX || !inGoalY) {
        currentLives -= 1;
        setLives(currentLives);

        const msg = hitWall ? '¡EN LA BARRERA!' : savedByKeeper ? '¡ATAJÓ ORSINI!' : '¡FUERA!';
        triggerFeedback(msg);

        if (currentLives <= 0) {
          triggerGameOver(scene, '¡SIN VIDAS!');
          return;
        }
      } else {
        totalGoals += 1;
        const isCorner = (targetX < goalX + 35 || targetX > goalX + goalWidth - 35) && (targetY < goalY + 30);
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
      }

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
      setTimeout(() => setFeedback(''), 800);
    }

    function triggerGameOver(scene, reason) {
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
      {/* HUD React Superior Indestructible */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#eab308' }}>PTS: {score}</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#3b82f6' }}>NIVEL: {level}</div>
        </div>

        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
        </div>

        <div style={{ fontSize: '13px', color: '#ef4444' }}>
          {'❤️'.repeat(Math.max(0, lives))}
        </div>
      </div>

      {/* Botón Salir al Menú */}
      <button
        onClick={() => onExit(0)}
        style={{
          position: 'absolute',
          top: '50px',
          right: '16px',
          zIndex: 10,
          backgroundColor: '#1e293b',
          color: '#eab308',
          border: '1px solid #eab308',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '10px',
          fontWeight: '700',
          fontFamily: "'Chakra Petch', sans-serif"
        }}
      >
        SALIR
      </button>

      {/* Feedback Flotante */}
      {feedback && (
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#eab308',
          zIndex: 15,
          textShadow: '0 2px 8px rgba(0,0,0,0.8)'
        }}>
          {feedback}
        </div>
      )}

      {/* Contenedor del Lienzo */}
      <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />

      {/* Pantalla Final de Resumen */}
      {gameOverData && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(10, 15, 29, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 20
        }}>
          <h2 style={{ fontSize: '26px', color: '#ef4444', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
            {gameOverData.reason}
          </h2>

          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #eab308',
            borderRadius: '10px',
            padding: '20px',
            width: '100%',
            maxWidth: '300px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>PUNTAJE FINAL</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#eab308', margin: '4px 0 12px 0' }}>
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
              maxWidth: '300px',
              backgroundColor: '#eab308',
              color: '#0a0f1d',
              fontWeight: '700',
              fontFamily: "'Chakra Petch', sans-serif",
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
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
