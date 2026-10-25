import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { sfx } from '../utils/audio';

export default function GameCanvas({ player, onExit }) {
  const mountRef = useRef(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState('');
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. ESCENA, CÁMARA Y RENDERIZADOR 3D
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Fondo nocturno
    scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Posición de la cámara idéntica a tu captura (Detrás del balón)
    camera.position.set(0, 2.5, 12);
    camera.lookAt(0, 1.8, -12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. ILUMINACIÓN DE ESTADIO
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfde047, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 3. CANCHA Y GRADERÍAS EN 3D
    // Césped
    const fieldGeo = new THREE.PlaneGeometry(60, 80);
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    // Franjas de pasto
    for (let i = -35; i < 35; i += 5) {
      if ((i / 5) % 2 === 0) {
        const stripeGeo = new THREE.PlaneGeometry(60, 5);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, i);
        stripe.receiveShadow = true;
        scene.add(stripe);
      }
    }

    // Graderías/Estadio al fondo
    const stadiumGeo = new THREE.BoxGeometry(70, 15, 5);
    const stadiumMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
    stadium.position.set(0, 7.5, -28);
    scene.add(stadium);

    // 4. PORTERÍA 3D
    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalZ = -18;

    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    
    // Travesaño superior
    const crossbarGeo = new THREE.CylinderGeometry(0.08, 0.08, goalWidth, 16);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    scene.add(crossbar);

    // Postes laterales
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, goalHeight, 16);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    leftPost.castShadow = true;
    scene.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(goalWidth / 2, goalHeight / 2, goalZ);
    rightPost.castShadow = true;
    scene.add(rightPost);

    // 5. BALÓN 3D DE FÚTBOL
    const ballGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    const startBallPos = new THREE.Vector3(0, 0.3, 6);
    ball.position.copy(startBallPos);
    ball.castShadow = true;
    scene.add(ball);

    // 6. PORTERO ORSINI (#94) EN 3D
    const keeperGroup = new THREE.Group();
    
    // Cuerpo
    const kBodyGeo = new THREE.CylinderGeometry(0.25, 0.2, 0.9, 16);
    const kBodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308 }); // Camiseta Dorada
    const kBody = new THREE.Mesh(kBodyGeo, kBodyMat);
    kBody.position.y = 0.9;
    kBody.castShadow = true;
    keeperGroup.add(kBody);

    // Cabeza
    const kHeadGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const kHeadMat = new THREE.MeshStandardMaterial({ color: 0xfbd23c });
    const kHead = new THREE.Mesh(kHeadGeo, kHeadMat);
    kHead.position.y = 1.5;
    kHead.castShadow = true;
    keeperGroup.add(kHead);

    keeperGroup.position.set(0, 0, goalZ + 0.5);
    scene.add(keeperGroup);

    // Silbato de inicio
    sfx.playWhistle();

    // 7. VARIABLES DE JUEGO Y TIRO 3D
    let isShooting = false;
    let isDrawing = false;
    let touchPoints = [];
    let shotProgress = 0;
    let shotPath = [];

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let currentTime = 60;
    let isGameOver = false;

    // Reloj
    const timerInterval = setInterval(() => {
      if (isGameOver) return;
      currentTime -= 1;
      setTimeLeft(currentTime);
      if (currentTime <= 0) {
        triggerGameOver('¡TIEMPO AGOTADO!');
      }
    }, 1000);

    // 8. CONTROL TÁCTIL 3D (SWIPE CURVO)
    const handleStart = (e) => {
      if (isShooting || isGameOver) return;
      const t = e.touches ? e.touches[0] : e;
      touchPoints = [{ x: t.clientX, y: t.clientY }];
      isDrawing = true;
    };

    const handleMove = (e) => {
      if (!isDrawing || isShooting || isGameOver) return;
      const t = e.touches ? e.touches[0] : e;
      touchPoints.push({ x: t.clientX, y: t.clientY });
    };

    const handleEnd = () => {
      if (!isDrawing || isShooting || isGameOver) return;
      isDrawing = false;

      if (touchPoints.length < 3) return;

      const pStart = touchPoints[0];
      const pEnd = touchPoints[touchPoints.length - 1];
      const pMid = touchPoints[Math.floor(touchPoints.length / 2)];

      // Si el trazo fue hacia arriba
      if (pEnd.y < pStart.y - 30) {
        isShooting = true;
        sfx.playKick();

        // Convertir el trazo en una trayectoria 3D en el espacio
        const deltaX = (pEnd.x - pStart.x) / (window.innerWidth / 12);
        const curveX = ((pMid.x - (pStart.x + pEnd.x) / 2) / (window.innerWidth / 8));
        const heightY = Math.min(3.2, Math.max(0.4, (pStart.y - pEnd.y) / (window.innerHeight / 4)));

        shotPath = {
          targetX: THREE.MathUtils.clamp(deltaX, -goalWidth / 2 + 0.3, goalWidth / 2 - 0.3),
          targetY: heightY,
          controlX: curveX * 3,
          targetZ: goalZ
        };
      }
    };

    container.addEventListener('touchstart', handleStart, { passive: true });
    container.addEventListener('touchmove', handleMove, { passive: true });
    container.addEventListener('touchend', handleEnd, { passive: true });
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseup', handleEnd);

    // 9. ANIMACIÓN Y LOOP 3D
    let animFrameId;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      // Animación del Balón en Vuelo 3D
      if (isShooting && shotPath.targetZ) {
        shotProgress += 0.025;

        if (shotProgress <= 1) {
          // Curva Bézier en 3D
          const t = shotProgress;
          const px = (1 - t) * (1 - t) * startBallPos.x + 2 * (1 - t) * t * shotPath.controlX + t * t * shotPath.targetX;
          const py = (1 - t) * (1 - t) * startBallPos.y + 2 * (1 - t) * t * (shotPath.targetY + 2) + t * t * shotPath.targetY;
          const pz = (1 - t) * startBallPos.z + t * shotPath.targetZ;

          ball.position.set(px, py, pz);
          ball.rotation.x += 0.2;
          ball.rotation.y += 0.2;

          // Movimiento del Portero Orsini 3D
          keeperGroup.position.x = THREE.MathUtils.lerp(keeperGroup.position.x, shotPath.targetX * 0.8, 0.05);
        } else {
          // Disparo finalizado: Evaluar Gol o Atajada
          evalShot(shotPath.targetX, shotPath.targetY, keeperGroup.position.x);
          isShooting = false;
          shotProgress = 0;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    function evalShot(tx, ty, kx) {
      const savedByKeeper = Math.abs(tx - kx) < 0.8 && ty < 1.8;

      if (savedByKeeper) {
        sfx.playHit();
        handleCollision('¡TAPÓ ORSINI!');
      } else if (Math.abs(tx) <= goalWidth / 2 && ty <= goalHeight && ty >= 0.2) {
        sfx.playGoal();
        currentScore += 100;
        setScore(currentScore);
        triggerFeedback('¡GOOOL!');
        resetBall();
      } else {
        sfx.playHit();
        handleCollision('¡FUERA!');
      }
    }

    function handleCollision(msg) {
      currentLives -= 1;
      setLives(currentLives);
      triggerFeedback(msg);

      if (currentLives <= 0) {
        sfx.playWhistle();
        triggerGameOver('¡SIN VIDAS!');
      } else {
        resetBall();
      }
    }

    function resetBall() {
      setTimeout(() => {
        if (isGameOver) return;
        ball.position.copy(startBallPos);
        keeperGroup.position.set(0, 0, goalZ + 0.5);
      }, 700);
    }

    function triggerFeedback(txt) {
      setFeedback(txt);
      setTimeout(() => setFeedback(''), 500);
    }

    function triggerGameOver(reason) {
      isGameOver = true;
      clearInterval(timerInterval);
      const expGained = Math.floor(currentScore / 10);
      setGameOverData({ reason, score: currentScore, expGained });
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [player]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', touchAction: 'none' }}>
      {/* HUD MANTENIDO LIMPIO */}
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
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#eab308',
          zIndex: 999999,
          fontFamily: "'Chakra Petch', sans-serif",
          textShadow: '0 2px 8px rgba(0,0,0,0.9)'
        }}>
          {feedback}
        </div>
      )}

      {/* RECEPTOR DE LA ESCENA THREE.JS */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

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
