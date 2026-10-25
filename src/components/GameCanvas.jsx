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

    let runnerPlayer, keeper, goalX, goalY, goalWidth, goalHeight;
    let defendersGroup = [];
    let phase = 'RUNNING'; // 'RUNNING' o 'SHOOTING'
    let currentLane = 1; // 0: Izquierda, 1: Centro, 2: Derecha
    const lanes = [window.innerWidth * 0.25, window.innerWidth * 0.5, window.innerWidth * 0.75];

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let currentTime = 60;
    let isGameOver = false;

    let startX, startY;

    function createScene() {
      const scene = this;
      const width = scene.cameras.main.width;
      const height = scene.cameras.main.height;

      sfx.playWhistle();

      // 1. DIBUJAR CAMPO Y CARRILES
      const bg = scene.add.graphics();
      bg.fillStyle(0x15803d, 1);
      bg.fillRect(0, 0, width, height);

      // Líneas de Carriles (Lanes)
      bg.lineStyle(2, 0xffffff, 0.25);
      bg.strokeLineShape(new Phaser.Geom.Line(width * 0.375, 0, width * 0.375, height));
      bg.strokeLineShape(new Phaser.Geom.Line(width * 0.625, 0, width * 0.625, height));

      // PORTERÍA AL FONDO (Inicialmente lejos)
      goalWidth = Math.min(width * 0.7, 280);
      goalHeight = 80;
      goalX = (width - goalWidth) / 2;
      goalY = height * 0.15;

      const posts = scene.add.graphics();
      posts.lineStyle(5, 0xffffff, 1);
      posts.strokeRect(goalX, goalY, goalWidth, goalHeight);

      // PORTERO ORSINI (#94)
      keeper = scene.add.container(width / 2, goalY + goalHeight - 12);
      const kBody = scene.add.rectangle(0, -10, 16, 24, 0xeab308);
      const kHead = scene.add.circle(0, -22, 6, 0xfbd23c);
      keeper.add([kBody, kHead]);

      // JUGADOR EN CARRERA
      runnerPlayer = scene.add.container(lanes[currentLane], height - 120);
      const pBody = scene.add.rectangle(0, -10, 18, 26, 0x0f172a); // Camiseta Negra
      const pStripe = scene.add.rectangle(0, -14, 18, 5, 0xeab308); // Franja Dorada
      const pHead = scene.add.circle(0, -22, 7, 0xfbd23c);
      const pBall = scene.add.circle(0, 12, 6, 0xffffff); // Balón en los pies
      runnerPlayer.add([pBody, pStripe, pHead, pBall]);

      // GENERAR RIVALES EN EL CAMINO
      spawnDefenders(scene, width, height);

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

      // CONTROLES DE SWIPE (REGATE & DISPARO)
      scene.input.on('pointerdown', (pointer) => {
        startX = pointer.x;
        startY = pointer.y;
      });

      scene.input.on('pointerup', (pointer) => {
        if (!startX || isGameOver) return;
        const deltaX = pointer.x - startX;
        const deltaY = pointer.y - startY;

        if (phase === 'RUNNING') {
          // Swipe Horizontal para Esquivar
          if (Math.abs(deltaX) > 30) {
            if (deltaX > 0 && currentLane < 2) currentLane++;
            else if (deltaX < 0 && currentLane > 0) currentLane--;

            scene.tweens.add({
              targets: runnerPlayer,
              x: lanes[currentLane],
              duration: 150,
              ease: 'Power1.out'
            });
          }
        } else if (phase === 'SHOOTING') {
          // Swipe Vertical/Diagonal para Disparar
          if (deltaY < -30) {
            shootBall(scene, pointer.x, pointer.y, width, height);
          }
        }
      });
    }

    function spawnDefenders(scene, width, height) {
      defendersGroup.forEach(d => d.destroy());
      defendersGroup = [];

      // Generar 3 líneas de defensores con huecos
      for (let i = 0; i < 3; i++) {
        const laneEmpty = Math.floor(Math.random() * 3);
        for (let l = 0; l < 3; l++) {
          if (l !== laneEmpty) {
            const defender = scene.add.container(lanes[l], -150 - (i * 200));
            const dBody = scene.add.rectangle(0, 0, 18, 28, 0xef4444);
            const dHead = scene.add.circle(0, -18, 6, 0xfbd23c);
            defender.add([dBody, dHead]);
            defendersGroup.push(defender);
          }
        }
      }
    }

    function updateScene(time, delta) {
      if (isGameOver) return;

      if (phase === 'RUNNING') {
        // Mover rivales hacia abajo (Efecto de carrera)
        defendersGroup.forEach(d => {
          d.y += 3.5;

          // Colisión de Regate
          if (Math.abs(d.y - runnerPlayer.y) < 25 && Math.abs(d.x - runnerPlayer.x) < 20) {
            sfx.playHit();
            handleLifeLoss('¡BARRIDA RIVAL!');
          }
        });

        // Al superar la última línea de defensores, pasar a Zona de Disparo
        const allPassed = defendersGroup.every(d => d.y > window.innerHeight);
        if (allPassed && defendersGroup.length > 0) {
          triggerShootingPhase();
        }
      }
    }

    function triggerShootingPhase() {
      phase = 'SHOOTING';
      triggerFeedback('¡ZONA DE TIRO! ¡DESLIZA!');

      // Acercar la cámara o jugador
      gameRef.current.canvas.style.filter = 'brightness(1.1)';
    }

    function shootBall(scene, targetX, targetY, width, height) {
      sfx.playKick();

      const tx = Phaser.Math.Clamp(targetX, goalX, goalX + goalWidth);
      const ty = Phaser.Math.Clamp(targetY, goalY, goalY + goalHeight);

      // Movimiento de Orsini
      scene.tweens.add({
        targets: keeper,
        x: Phaser.Math.Clamp(tx, goalX + 20, goalX + goalWidth - 20),
        duration: 350,
        ease: 'Power1.out'
      });

      // Crear balón volador
      const ballFly = scene.add.circle(runnerPlayer.x, runnerPlayer.y, 8, 0xffffff);

      scene.tweens.add({
        targets: ballFly,
        x: tx,
        y: ty,
        scale: 0.5,
        duration: 400,
        onComplete: () => {
          ballFly.destroy();
          const saved = Math.abs(tx - keeper.x) < 25;

          if (saved) {
            sfx.playHit();
            handleLifeLoss('¡TAPÓ ORSINI!');
          } else {
            sfx.playGoal();
            currentScore += 200;
            setScore(currentScore);
            triggerFeedback('¡GOOOLAZO!');
            resetRound(scene, width, height);
          }
        }
      });
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
      phase = 'RUNNING';
      currentLane = 1;
      runnerPlayer.setPosition(lanes[currentLane], height - 120);
      spawnDefenders(scene, width, height);
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

      {/* FEEDBACK CENTRADO */}
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
          fontFamily: "'Chakra Petch', sans-serif",
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          textAlign: 'center'
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
