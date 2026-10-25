import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

export default function GameCanvas({ player, onExit }) {
  const gameRef = useRef(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState('');
  const [power, setPower] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
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

    let ball, ballShadow, keeper, aimTarget;
    let goalX, goalY, goalWidth, goalHeight;
    let wallGroup = [];
    let trailGraphics;

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let totalGoals = 0;
    let currentTime = 60;
    let timerEvent;

    let targetAimX, targetAimY;
    let powerValue = 0;
    let powerIncreasing = true;
    let powerInterval = null;
    let isShooting = false;
    let isGameOver = false;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      // CAMPO
      const bg = scene.add.graphics();
      bg.fillStyle(0x0f172a, 1);
      bg.fillRect(0, 0, width, height * 0.25);

      const stripeHeight = (height * 0.75) / 6;
      for (let i = 0; i < 6; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
      }

      // PORTERÍA 2.5D
      goalWidth = Math.min(width * 0.75, 320);
      goalHeight = 90;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.22;

      targetAimX = width / 2;
      targetAimY = goalY + goalHeight / 2;

      const net = scene.add.graphics();
      net.lineStyle(1, 0xffffff, 0.25);
      for (let x = goalX; x <= goalX + goalWidth; x += 12) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 12) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      const posts = scene.add.graphics();
      posts.lineStyle(5, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // RETÍCULA DE APUNTADO (AIM TARGET)
      aimTarget = scene.add.circle(targetAimX, targetAimY, 12, 0xeab308, 0.6);
      scene.add.circle(targetAimX, targetAimY, 4, 0xffffff);

      // PORTERO ORSINI (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 15);
      const keeperBody = scene.add.rectangle(0, -12, 16, 28, 0xeab308);
      const keeperHead = scene.add.circle(0, -26, 6, 0xfbd23c);
      keeper.add([keeperBody, keeperHead]);

      // BALÓN
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

      // TIMER FIJO DE 60s
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

      // EVENTOS TÁCTILES NATIVOS PARA EVITAR BLOQUEO EN iOS
      const container = document.getElementById('phaser-game-container');

      const handleTouchMove = (e) => {
        if (isShooting || isGameOver) return;
        const touch = e.touches[0];
        if (!touch) return;
        
        targetAimX = Phaser.Math.Clamp(touch.clientX, goalX + 10, goalX + goalWidth - 10);
        targetAimY = Phaser.Math.Clamp(touch.clientY, goalY + 10, goalY + goalHeight - 10);
        aimTarget.setPosition(targetAimX, targetAimY);
      };

      const handleTouchStart = (e) => {
        if (isShooting || isGameOver || isCharging) return;
        setIsCharging(true);
        powerValue = 10;
        powerIncreasing = true;

        if (powerInterval) clearInterval(powerInterval);
        powerInterval = setInterval(() => {
          if (powerIncreasing) {
            powerValue += 6;
            if (powerValue >= 100) powerIncreasing = false;
          } else {
            powerValue -= 6;
            if (powerValue <= 10) powerIncreasing = true;
          }
          setPower(powerValue);
        }, 25);
      };

      const handleTouchEnd = () => {
        if (!isCharging || isShooting || isGameOver) return;
        clearInterval(powerInterval);
        setIsCharging(false);
        isShooting = true;

        executeShot(scene, targetAimX, targetAimY, powerValue, width, height, startXPos, startYPos);
      };

      if (container) {
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });
      }
    }

    function executeShot(scene, tx, ty, pValue, width, height, startXPos, startYPos) {
      // Determinación de altura según la barra de potencia
      let finalY = goalY + goalHeight - 10;
      if (pValue > 40 && pValue <= 75) {
        finalY = goalY + (goalHeight / 2);
      } else if (pValue > 75) {
        finalY = goalY + 15;
      }

      const powerStat = player ? player.power : 20;
      const curveStat = player ? player.curve : 20;
      const shotSpeed = Phaser.Math.Clamp(600 - (pValue * 2) - (powerStat * 2), 300, 550);

      const controlX = startXPos + ((tx - startXPos) * (1 + curveStat / 80));
      const controlY = height * 0.48;

      const isCorner = (tx < goalX + 35 || tx > goalX + goalWidth - 35);
      const keeperSpeed = isCorner ? 0.45 : 0.7;
      const keeperTargetX = Phaser.Math.Clamp(tx, goalX + 18, goalX + goalWidth - 18);

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
          const px = Phaser.Math.Interpolation.QuadraticBezier(progress, startXPos, controlX, tx);
          const py = Phaser.Math.Interpolation.QuadraticBezier(progress, startYPos, controlY, finalY);

          ball.setPosition(px, py);
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
              handleCollision(scene, 'BARRERA!');
            }
          });

          // Colisión Portero
          if (!hasCollided && Math.abs(px - keeper.x) < 15 && Math.abs(py - (goalY + goalHeight - 15)) < 16 && progress > 0.8) {
            hasCollided = true;
            tween.stop();
            trailGraphics.clear();
            handleCollision(scene, 'TAPÓ!');
          }
        },
        onComplete: () => {
          if (!hasCollided) {
            trailGraphics.clear();
            evaluateShot(scene, tx, finalY, width, height);
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
        handleCollision(scene, 'FUERA!');
      } else {
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
        ball.setScale(1);
        ballShadow.setPosition(width / 2, height - 98);
        ballShadow.setScale(1);
        keeper.setPosition(width / 2, goalY + goalHeight - 15);
        setPower(0);
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
      {/* HUD FIX NATIVO CON SAFE AREA */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        zIndex: 999999,
        backgroundColor: '#0f172a',
        borderBottom: '2px solid #eab308',
        boxSizing: 'border-box'
      }}>
        <div style={{ lineHeight: '1.2' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#eab308' }}>PTS: {score}</div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6' }}>NIVEL: {level}</div>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '1px' }}>
          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
        </div>

        <div style={{ fontSize: '12px', color: '#ef4444' }}>
          {'❤️'.repeat(Math.max(0, lives))}
        </div>

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

      {/* BARRA DE POTENCIA TIPO ARCADE INFERIOR */}
      {isCharging && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '12px',
          backgroundColor: '#1e293b',
          border: '2px solid #eab308',
          borderRadius: '6px',
          zIndex: 99999,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${power}%`,
            height: '100%',
            backgroundColor: power > 75 ? '#ef4444' : power > 40 ? '#eab308' : '#22c55e',
            transition: 'width 0.02s linear'
          }} />
        </div>
      )}

      {/* FEEDBACK INVASIVIDAD CERO */}
      {feedback && (
        <div style={{
          position: 'fixed',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '22px',
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
