import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export default function GameCanvas({ player, onExit }) {
  const gameRef = useRef(null);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'phaser-game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#15803d',
      scene: {
        create: createScene,
        update: updateScene
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    let ball;
    let goalArea;
    let score = 0;
    let scoreText;
    let startX, startY, startTime;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      const graphics = scene.add.graphics();
      
      graphics.fillStyle(0x166534, 1);
      graphics.fillRect(0, 0, width, height * 0.4);

      graphics.lineStyle(4, 0xffffff, 1);
      const goalWidth = width * 0.6;
      const goalHeight = height * 0.2;
      const goalX = (width - goalWidth) / 2;
      const goalY = height * 0.15;

      graphics.strokeRect(goalX, goalY, goalWidth, goalHeight);
      
      graphics.lineStyle(1, 0xcbd5e1, 0.4);
      for (let x = goalX; x <= goalX + goalWidth; x += 15) {
        graphics.lineBetween(x, goalY, x, goalY + goalHeight);
      }

      goalArea = new Phaser.Geom.Rectangle(goalX, goalY, goalWidth, goalHeight);

      scoreText = scene.add.text(16, 16, `GOLES: 0 | ${player ? player.name : ''} #${player ? player.number : ''}`, {
        fontFamily: 'Chakra Petch, sans-serif',
        fontSize: '14px',
        color: '#eab308',
        fontStyle: 'bold'
      });

      ball = scene.add.circle(width / 2, height - 120, 18, 0xffffff);
      scene.add.circle(width / 2, height - 120, 16, 0x000000);

      scene.input.on('pointerdown', (pointer) => {
        startX = pointer.x;
        startY = pointer.y;
        startTime = pointer.time;
      });

      scene.input.on('pointerup', (pointer) => {
        const duration = pointer.time - startTime;
        const deltaX = pointer.x - startX;
        const deltaY = pointer.y - startY;

        if (deltaY < -30 && duration < 800) {
          const targetX = ball.x + deltaX * (1 + (player ? player.curve / 100 : 0.2));
          const targetY = goalY + (goalHeight / 2);
          const speed = Math.max(250, 800 - (player ? player.power * 5 : 100));

          scene.tweens.add({
            targets: ball,
            x: targetX,
            y: targetY,
            scale: 0.4,
            duration: speed,
            ease: 'Power2',
            onComplete: () => {
              if (Phaser.Geom.Rectangle.Contains(goalArea, targetX, targetY)) {
                score += 1;
                scoreText.setText(`GOLES: ${score} | ${player ? player.name : ''} #${player ? player.number : ''}`);
              }

              scene.time.delayedCall(800, () => {
                ball.setPosition(width / 2, height - 120);
                ball.setScale(1);
              });
            }
          });
        }
      });
    }

    function updateScene() {}

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
          fontFamily: 'Chakra Petch, sans-serif'
        }}
      >
        SALIR AL MENU
      </button>

      <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
