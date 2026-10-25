import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

export default function GameCanvas({ player, onExit }) {
  const gameRef = useRef(null);
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    // Asegurar carga de fuente en Canvas
    document.fonts.ready.then(() => {
      initGame();
    });

    function initGame() {
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

      let ball, ballShadow;
      let goalX, goalY, goalWidth, goalHeight;
      let wallGroup = [];
      let score = 0;
      let streak = 0;
      let maxStreak = 0;
      let totalGoals = 0;
      let level = 1;
      let lives = 3;
      let timeLeft = 60;
      let timerEvent;

      let scoreText, levelText, timerText, livesText, feedbackText;
      let startX, startY, startTime;
      let isShooting = false;
      let isGameOver = false;

      function createScene() {
        const scene = this;
        const width = scene.cameras.main.width;
        const height = scene.cameras.main.height;

        const bg = scene.add.graphics();
        bg.fillStyle(0x0f172a, 1);
        bg.fillRect(0, 0, width, height * 0.25);

        const stripeHeight = (height * 0.75) / 6;
        for (let i = 0; i < 6; i++) {
          bg.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 1);
          bg.fillRect(0, height * 0.25 + (i * stripeHeight), width, stripeHeight);
        }

        goalWidth = Math.min(width * 0.7, 320);
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

        const fontStyle = { fontFamily: "'Chakra Petch', sans-serif", fontStyle: 'bold' };

        scoreText = scene.add.text(16, 16, `PTS: 0`, { ...fontStyle, fontSize: '13px', color: '#eab308' });
        levelText = scene.add.text(16, 34, `NIVEL: 1`, { ...fontStyle, fontSize: '11px', color: '#3b82f6' });
        timerText = scene.add.text(width / 2, 16, `01:00`, { ...fontStyle, fontSize: '18px', color: '#ef4444' }).setOrigin(0.5, 0);
        livesText = scene.add.text(width - 16, 16, `VIDAS: ❤️❤️❤️`, { ...fontStyle, fontSize: '12px', color: '#ef4444' }).setOrigin(1, 0);
        feedbackText = scene.add.text(width / 2, height * 0.45, '', { ...fontStyle, fontSize: '22px', color: '#eab308' }).setOrigin(0.5);

        const startXPos = width / 2;
        const startYPos = height - 110;

        ballShadow = scene.add.ellipse(startXPos, startYPos + 12, 24, 8, 0x000000, 0.4);
        
        ball = scene.add.container(startXPos, startYPos);
        const ballBase = scene.add.circle(0, 0, 14, 0xffffff);
        const ballPattern = scene.add.circle(0, 0, 10, 0x0f172a);
        const ballInner = scene.add.circle(0, 0, 6, 0xffffff);
        ball.add([ballBase, ballPattern, ballInner]);

        spawnWall(scene, level, width, height);

        timerEvent = scene.time.addEvent({
          delay: 1000,
          callback: () => {
            if (isGameOver) return;
            timeLeft -= 1;
            const secs = timeLeft < 10 ? `0${timeLeft}` : `${timeLeft}`;
            timerText.setText(`00:${secs}`);

            if (timeLeft <= 0) {
              triggerGameOver(scene, width, height, '¡TIEMPO AGOTADO!');
            }
          },
          callbackScope: scene,
          loop: true
        });

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

          if (deltaY < -30 && duration < 800) {
            isShooting = true;

            const curveFactor = (player ? player.curve : 20) / 50;
            const targetX = ball.x + (deltaX * (0.8 + curveFactor));
            const targetY = goalY + (goalHeight / 2) + (deltaY * 0.1);
            const speed = Math.max(280, 750 - ((player ? player.power : 20) * 4));

            if (level >= 3) {
              wallGroup.forEach(defender => {
                scene.tweens.add({
                  targets: defender,
                  y: defender.y - 22,
                  duration: 200,
                  yoyo: true,
                  ease: 'Sine.easeOut'
                });
              });
            }

            scene.tweens.add({
              targets: ball,
              x: targetX,
              y: targetY,
              scale: 0.45,
              duration: speed,
              ease: 'Power1.out',
              onUpdate: () => {
                ballShadow.x = ball.x;
                ballShadow.scaleX = ball.scaleX;
              },
              onComplete: () => {
                evaluateShot(scene, targetX, targetY, width, height);
              }
            });
          }
        });
      }

      function updateScene() {
        if (level >= 4 && wallGroup.length > 0 && !isGameOver) {
          wallGroup.forEach(defender => {
            defender.x += Math.sin(this.time.now / 250) * 1.5;
          });
        }
      }

      function spawnWall(scene, currentLevel, width, height) {
        wallGroup.forEach(d => d.destroy());
        wallGroup = [];

        if (currentLevel === 1) return;

        const numDefenders = currentLevel === 2 ? 2 : currentLevel === 3 ? 3 : 4;
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

        let hitWall = false;
        wallGroup.forEach(d => {
          if (Math.abs(ball.x - d.x) < 18 && Math.abs(ball.y - d.y) < 30) {
            hitWall = true;
          }
        });

        if (hitWall || !inGoalX || !inGoalY) {
          lives -= 1;
          streak = 0;
          const hearts = '❤️'.repeat(Math.max(0, lives));
          livesText.setText(`VIDAS: ${hearts}`);

          showFeedback(scene, hitWall ? '¡BARRERA!' : '¡FUERA!', '#ef4444');

          if (lives <= 0) {
            triggerGameOver(scene, width, height, '¡SIN VIDAS!');
            return;
          }
        } else {
          const isCorner = (targetX < goalX + 35 || targetX > goalX + goalWidth - 35) && (targetY < goalY + 30);
          
          streak += 1;
          totalGoals += 1;
          if (streak > maxStreak) maxStreak = streak;

          const points = isCorner ? 250 * streak : 100 * streak;
          score += points;

          showFeedback(scene, isCorner ? '¡ESCUADRA!' : '¡GOOOL!', '#22c55e');

          const newLevel = Math.min(5, 1 + Math.floor(totalGoals / 2));
          if (newLevel !== level) {
            level = newLevel;
            showFeedback(scene, `¡NIVEL ${level}!`, '#3b82f6');
            spawnWall(scene, level, width, height);
          }
        }

        scoreText.setText(`PTS: ${score}`);
        levelText.setText(`NIVEL: ${level}`);

        scene.time.delayedCall(700, () => {
          if (isGameOver) return;
          ball.setPosition(width / 2, height - 110);
          ball.setScale(1);
          ballShadow.setPosition(width / 2, height - 98);
          ballShadow.setScale(1);
          isShooting = false;
        });
      }

      function triggerGameOver(scene, width, height, reason) {
        isGameOver = true;
        if (timerEvent) timerEvent.remove();

        const expGained = Math.floor(score / 10);
        setGameOverData({ reason, score, totalGoals, expGained });
      }

      function showFeedback(scene, text, color) {
        feedbackText.setText(text);
        feedbackText.setColor(color);
        scene.tweens.add({
          targets: feedbackText,
          scale: { from: 0.5, to: 1 },
          alpha: { from: 1, to: 0 },
          duration: 800,
          ease: 'Power1.out'
        });
      }
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
    };
  }, [player]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          backgroundColor: '#1e293b',
          color: '#eab308',
          border: '1px solid #eab308',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: '700',
          fontFamily: "'Chakra Petch', sans-serif"
        }}
      >
        SALIR AL MENU
      </button>

      <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />

      {/* Pantalla Final Integrada con Botón */}
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
          zIndex: 20,
          fontFamily: "'Chakra Petch', sans-serif"
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
            onClick={onExit}
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
            VOLVER AL MENÚ
          </button>
        </div>
      )}
    </div>
  );
}
