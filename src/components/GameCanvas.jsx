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

      // Silbato de Inicio
      sfx.playWhistle();

      // 1. ILUSTRACIÓN DEL CAMPO Y ESTADIO NOCTURNO
      const bg = scene.add.graphics();
      bg.fillStyle(0x0f172a, 1);
      bg.fillRect(0, 0, width, height * 0.25);

      // Reflectores de Estadio (Luz)
      bg.fillStyle(0xfde047, 0.15);
      bg.fillTriangle(0, 0, width * 0.4, height * 0.25, 0, height * 0.25);
      bg.fillTriangle(width, 0, width * 0.6, height * 0.25, width, height * 0.25);

      // Césped con Degradado y Franjas
      const stripeHeight = (height * 0.75) / 6;
      for (let i = 0; i < 6; i++) {
        bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
        bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
      }

      // Líneas de Campo en Perspectiva
      bg.lineStyle(2, 0xffffff, 0.4);
      bg.strokeLineShape(new Phaser.Geom.Line(width * 0.1, height * 0.4, width * 0.9, height * 0.4));

      // 2. PORTERÍA 2.5D
      goalWidth = Math.min(width * 0.75, 320);
      goalHeight = 90;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.25;

      targetAimX = width / 2;
      targetAimY = goalY + goalHeight / 2;

      // Red Detallada
      const net = scene.add.graphics();
      net.lineStyle(1, 0xe2e8f0, 0.3);
      for (let x = goalX; x <= goalX + goalWidth; x += 10) {
        net.lineBetween(x, goalY, x, goalY + goalHeight);
      }
      for (let y = goalY; y <= goalY + goalHeight; y += 10) {
        net.lineBetween(goalX, y, goalX + goalWidth, y);
      }

      // Marco (Postes Blancos con Sombra)
      const posts = scene.add.graphics();
      posts.lineStyle(6, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // RETÍCULA DE APUNTADO
      aimTarget = scene.add.container(targetAimX, targetAimY);
      const aimOuter = scene.add.circle(0, 0, 14, 0xeab308, 0.4);
      const aimBorder = scene.add.circle(0, 0, 14).setStrokeStyle(2, 0xeab308);
      const aimInner = scene.add.circle(0, 0, 4, 0xffffff);
      aimTarget.add([aimOuter, aimBorder, aimInner]);

      // PORTERO ORSINI (#94) - UNIFORME OFICIAL
      keeper = scene.add.container(width / 2, goalY + goalHeight - 15);
      const keeperBody = scene.add.rectangle(0, -12, 18, 30, 0xeab308); // Camiseta Dorada
      const keeperShorts = scene.add.rectangle(0, 2, 18, 10, 0x0f172a); // Pantalón Negro
      const keeperHead = scene.add.circle(0, -28, 7, 0xfbd23c);
      const keeperNum = scene.add.text(0, -14, '94', {
        fontFamily: "'Chakra Petch', sans-serif", fontSize: '9px', color: '#0f172a', fontStyle: 'bold'
      }).setOrigin(0.5);

      keeper.add([keeperBody, keeperShorts, keeperHead, keeperNum]);

      // BALÓN OFICIAL HD (Gajos)
      const startXPos = width / 2;
      const startYPos = height - 110;

      ballShadow = scene.add.ellipse(startXPos, startYPos + 12, 24, 8, 0x000000, 0.4);

      ball = scene.add.container(startXPos, startYPos);
      const ballBase = scene.add.circle(0, 0, 14, 0xffffff);
      const ballPattern1 = scene.add.polygon(0, 0, [0, -6, 5, -2, 3, 4, -3, 4, -5, -2], 0x0f172a);
      const ballPattern2 = scene.add.circle(-8, -4, 3, 0x0f172a);
      const ballPattern3 = scene.add.circle(8, -4, 3, 0x0f172a);
      ball.add([ballBase, ballPattern1, ballPattern2, ballPattern3]);

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

      // CONTROLES TÁCTILES
      const container = document.getElementById('phaser-game-container');
      let chargingState = false;

      const startCharge = (e) => {
        if (isShooting || isGameOver || chargingState) return;
        chargingState = true;
        setIsCharging(true);
        powerValue = 10;
        powerIncreasing = true;

        if (powerInterval) clearInterval(powerInterval);
        powerInterval = setInterval(() => {
          if (powerIncreasing) {
            powerValue += 4;
            if (powerValue >= 100) powerIncreasing = false;
          } else {
            powerValue -= 4;
            if (powerValue <= 10) powerIncreasing = true;
          }
          setPower(powerValue);
        }, 30);
      };

      const moveAim = (e) => {
        if (isShooting || isGameOver) return;
        const touch = e.touches ? e.touches[0] : e;
        if (!touch) return;

        targetAimX = Phaser.Math.Clamp(touch.clientX, goalX + 10, goalX + goalWidth - 10);
        targetAimY = Phaser.Math.Clamp(touch.clientY, goalY + 10, goalY + goalHeight - 10);
        aimTarget.setPosition(targetAimX, targetAimY);
      };

      const releaseShot = () => {
        if (!chargingState || isShooting || isGameOver) return;
        chargingState = false;
        clearInterval(powerInterval);
        setIsCharging(false);
        isShooting = true;

        sfx.playKick(); // Sonido de Patada
        executeShot(scene, targetAimX, targetAimY, powerValue, width, height, startXPos, startYPos);
      };

      if (container) {
        container.addEventListener('touchstart', (e) => { startCharge(e); moveAim(e); }, { passive: true });
        container.addEventListener('touchmove', moveAim, { passive: true });
        container.addEventListener('touchend', releaseShot, { passive: true });

        container.addEventListener('mousedown', (e) => { startCharge(e); moveAim(e); });
        container.addEventListener('mousemove', moveAim);
        container.addEventListener('mouseup', releaseShot);
      }
    }

    function executeShot(scene, tx, ty, pValue, width, height, startXPos, startYPos) {
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
          ball.setRotation(progress * 12); // Rotación del balón en el aire
          ball.setScale(1 - progress * 0.55);
          ballShadow.setPosition(px, py + 12 * (1 - progress));

          trailGraphics.clear();
          trailGraphics.lineStyle(3, 0xeab308, 0.6);
          trailGraphics.lineBetween(startXPos, startYPos, px, py);

          // COLISIÓN BARRERA
          wallGroup.forEach(d => {
            if (Math.abs(px - d.x) < 16 && Math.abs(py - d.y) < 22) {
              hasCollided = true;
              tween.stop();
              trailGraphics.clear();
              sfx.playHit();
              handleCollision(scene, 'BARRERA!');
            }
          });

          // COLISIÓN PORTERO
          if (!hasCollided && Math.abs(px - keeper.x) < 15 && Math.abs(py - (goalY + goalHeight - 15)) < 16 && progress > 0.8) {
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
        
        // Camiseta Oficial Negro y Dorado Prom '07
        const body = scene.add.rectangle(0, 0, 16, 36, 0x0f172a);
        const goldStripe = scene.add.rectangle(0, -6, 16, 6, 0xeab308);
        const head = scene.add.circle(0, -22, 7, 0xfbd23c);

        defender.add([body, goldStripe, head]);
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
        sfx.playGoal(); // Sonido de Gol
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

      {/* BARRA DE POTENCIA ARCADE */}
      {isCharging && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '180px',
          height: '10px',
          backgroundColor: '#1e293b',
          border: '2px solid #eab308',
          borderRadius: '5px',
          zIndex: 99999,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${power}%`,
            height: '100%',
            backgroundColor: power > 75 ? '#ef4444' : power > 40 ? '#eab308' : '#22c55e'
          }} />
        </div>
      )}

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
