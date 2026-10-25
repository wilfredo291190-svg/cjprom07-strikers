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

    // 1. ESCENA, CÁMARA Y RENDERIZADOR CON SOMBRAS AVANZADAS
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913); // Noche de estadio
    scene.fog = new THREE.FogExp2(0x060913, 0.012);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.2, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. ILUMINACIÓN PBR (Luces de Estadio)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    mainLight.position.set(12, 25, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const backLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    backLight.position.set(-10, 15, -20);
    scene.add(backLight);

    // 3. CANCHA Y TRIBUNAS DE IMPACTO VISUAL
    const fieldGeo = new THREE.PlaneGeometry(28, 110);
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, -30);
    field.receiveShadow = true;
    scene.add(field);

    // Franjas de césped cortado
    for (let i = -80; i < 20; i += 6) {
      if ((i / 6) % 2 === 0) {
        const stripeGeo = new THREE.PlaneGeometry(28, 6);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, i);
        stripe.receiveShadow = true;
        scene.add(stripe);
      }
    }

    // Estadio y Graderías en el fondo
    const stadiumGroup = new THREE.Group();
    const wallGeo = new THREE.BoxGeometry(45, 14, 4);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const stadiumWall = new THREE.Mesh(wallGeo, wallMat);
    stadiumWall.position.set(0, 7, -55);
    stadiumGroup.add(stadiumWall);

    // Vallas publicitarias
    const adGeo = new THREE.BoxGeometry(22, 1.2, 0.4);
    const adMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 });
    const adBoard = new THREE.Mesh(adGeo, adMat);
    adBoard.position.set(0, 0.6, -46);
    stadiumGroup.add(adBoard);

    scene.add(stadiumGroup);

    // 4. PORTERÍA Y DIANAS DE PUNTUACIÓN (BULLSEYES 3D)
    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalZ = -44;

    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.1 });
    const postRadius = 0.08;

    // Travesaño y Postes
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 16), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    scene.add(crossbar);

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16), postMat);
    postL.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    postL.castShadow = true;
    scene.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16), postMat);
    postR.position.set(goalWidth / 2, goalHeight / 2, goalZ);
    postR.castShadow = true;
    scene.add(postR);

    // Red de Portería
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25 });
    const net = new THREE.Mesh(new THREE.BoxGeometry(goalWidth, goalHeight, 1.8), netMat);
    net.position.set(0, goalHeight / 2, goalZ - 0.9);
    scene.add(net);

    // Dianas de Multiplicador en las Esquinas (Escuadras 5X y 3X)
    const targets = [];
    const createTarget = (x, y, multiplier, labelColor) => {
      const targetGroup = new THREE.Group();
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 16, 32), new THREE.MeshStandardMaterial({ color: labelColor }));
      const innerBull = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      targetGroup.add(outerRing, innerBull);
      targetGroup.position.set(x, y, goalZ + 0.1);
      scene.add(targetGroup);
      targets.push({ mesh: targetGroup, x, y, multiplier });
    };

    createTarget(-goalWidth / 2 + 0.7, goalHeight - 0.6, 5, 0xef4444); // Escuadra Izq (5X)
    createTarget(goalWidth / 2 - 0.7, goalHeight - 0.6, 5, 0xef4444);  // Escuadra Der (5X)
    createTarget(0, goalHeight - 0.5, 3, 0xeab308);                    // Centro Superior (3X)

    // 5. FABRICA DE JUGADORES CON ANATOMÍA ARTICULADA
    function createHumanoidPlayer(jerseyColor, stripeColor, isKeeper = false) {
      const group = new THREE.Group();

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
      const kitMat = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.4 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.3 });
      const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });

      // Torso / Camiseta
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.7, 16), kitMat);
      torso.position.y = 1.05;
      torso.castShadow = true;
      group.add(torso);

      if (stripeColor) {
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.26, 0.15, 16), stripeMat);
        stripe.position.y = 1.15;
        torso.add(stripe);
      }

      // Cabeza & Cabello
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), skinMat);
      head.position.y = 1.58;
      head.castShadow = true;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), bootMat);
      hair.position.y = 1.62;
      group.add(head, hair);

      // Brazos (Izquierdo y Derecho Articulados)
      const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.55);
      const armL = new THREE.Mesh(armGeo, skinMat);
      armL.position.set(-0.35, 1.05, 0);
      const armR = new THREE.Mesh(armGeo, skinMat);
      armR.position.set(0.35, 1.05, 0);
      group.add(armL, armR);

      // Pantalón / Shorts
      const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.3, 16), kitMat);
      shorts.position.y = 0.65;
      group.add(shorts);

      // Piernas & Tacos
      const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.65);
      const legL = new THREE.Mesh(legGeo, skinMat);
      legL.position.set(-0.14, 0.3, 0);
      const legR = new THREE.Mesh(legGeo, skinMat);
      legR.position.set(0.14, 0.3, 0);

      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.26), bootMat);
      bootL.position.set(-0.14, 0.05, 0.06);
      const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.26), bootMat);
      bootR.position.set(0.14, 0.05, 0.06);

      group.add(legL, legR, bootL, bootR);

      return {
        mesh: group,
        armL, armR, legL, legR, bootL, bootR
      };
    }

    // Jugador Principal (Prom '07)
    const playerObj = createHumanoidPlayer(0x0f172a, 0xeab308);
    playerObj.mesh.position.set(0, 0, 6);
    scene.add(playerObj.mesh);

    // Portero Orsini (#94)
    const keeperObj = createHumanoidPlayer(0xeab308, null, true);
    keeperObj.mesh.position.set(0, 0, goalZ + 0.4);
    scene.add(keeperObj.mesh);

    // Balón 3D
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    ball.position.set(0, 0.22, 6.7);
    ball.castShadow = true;
    scene.add(ball);

    sfx.playWhistle();

    // 6. GENERAR RIVALES EN EL CAMINO (Defensas)
    const lanes = [-2.5, 0, 2.5];
    let currentLane = 1;
    let defenders = [];

    const spawnDefenders = () => {
      defenders.forEach(d => scene.remove(d.obj.mesh));
      defenders = [];

      // 3 Bloques de Defensores
      for (let i = 0; i < 3; i++) {
        const emptyLane = Math.floor(Math.random() * 3);
        const zPos = 0 - (i * 14);

        for (let l = 0; l < 3; l++) {
          if (l !== emptyLane) {
            const defObj = createHumanoidPlayer(0xef4444, null);
            defObj.mesh.position.set(lanes[l], 0, zPos);
            scene.add(defObj.mesh);
            defenders.push({ obj: defObj, lane: l, z: zPos });
          }
        }
      }
    };

    spawnDefenders();

    // 7. VARIABLES Y ESTADOS
    let currentScore = 0;
    let currentLives = 3;
    let currentTime = 60;
    let isGameOver = false;

    let gamePhase = 'RUNNING'; // 'RUNNING' o 'SHOOTING'
    let isShooting = false;
    let shotProgress = 0;
    let shotData = { targetX: 0, targetY: 1.2, curveX: 0 };

    const timerInterval = setInterval(() => {
      if (isGameOver) return;
      currentTime -= 1;
      setTimeLeft(currentTime);
      if (currentTime <= 0) triggerGameOver('¡TIEMPO AGOTADO!');
    }, 1000);

    // 8. CONTROLES TÁCTILES MEJORADOS (SWIPE SUAVE Y DISPARO REAL)
    let startTouchX = 0, startTouchY = 0;

    const handleStart = (e) => {
      if (isGameOver || isShooting) return;
      const t = e.touches ? e.touches[0] : e;
      startTouchX = t.clientX;
      startTouchY = t.clientY;
    };

    const handleEnd = (e) => {
      if (isGameOver || isShooting) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const deltaX = t.clientX - startTouchX;
      const deltaY = t.clientY - startTouchY;

      if (gamePhase === 'RUNNING') {
        // Regate de carril
        if (Math.abs(deltaX) > 30) {
          if (deltaX > 0 && currentLane < 2) currentLane++;
          else if (deltaX < 0 && currentLane > 0) currentLane--;
        }
      } else if (gamePhase === 'SHOOTING') {
        // Disparo al arco
        if (deltaY < -30) {
          const power = Math.min(2.2, Math.abs(deltaY) / 60);
          const curve = (deltaX / window.innerWidth) * 4;
          executeShot(power, curve);
        }
      }
    };

    container.addEventListener('touchstart', handleStart, { passive: true });
    container.addEventListener('touchend', handleEnd, { passive: true });
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mouseup', handleEnd);

    // 9. LÓGICA DEL DISPARO Y ATAJADA DE ORSINI
    const executeShot = (power, curve) => {
      isShooting = true;
      shotProgress = 0;
      sfx.playKick();

      shotData = {
        targetX: THREE.MathUtils.clamp(playerObj.mesh.position.x + curve * 2.5, -goalWidth / 2 + 0.3, goalWidth / 2 - 0.3),
        targetY: THREE.MathUtils.clamp(power * 1.1, 0.4, goalHeight - 0.2),
        curveX: curve * 1.8
      };
    };

    // 10. ANIMACIÓN EN TIEMPO REAL (GAME LOOP)
    let animFrameId;
    let runAnimTime = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      if (!isGameOver) {
        runAnimTime += 0.15;

        // Movimiento del jugador de carril
        playerObj.mesh.position.x = THREE.MathUtils.lerp(playerObj.mesh.position.x, lanes[currentLane], 0.18);

        if (gamePhase === 'RUNNING') {
          // Animación de Extremidades al Correr (Brazos y Piernas)
          playerObj.legL.rotation.x = Math.sin(runAnimTime) * 0.6;
          playerObj.legR.rotation.x = -Math.sin(runAnimTime) * 0.6;
          playerObj.armL.rotation.x = -Math.sin(runAnimTime) * 0.6;
          playerObj.armR.rotation.x = Math.sin(runAnimTime) * 0.6;

          if (!isShooting) {
            ball.position.x = playerObj.mesh.position.x;
          }

          // Movimiento de defensas hacia el jugador
          defenders.forEach(d => {
            d.mesh.position.z += 0.26;
            d.obj.legL.rotation.x = Math.sin(runAnimTime * 0.8) * 0.4;
            d.obj.legR.rotation.x = -Math.sin(runAnimTime * 0.8) * 0.4;

            // Detección de Colisión
            if (Math.abs(d.mesh.position.z - playerObj.mesh.position.z) < 0.5 && d.lane === currentLane) {
              sfx.playHit();
              handleLifeLoss('¡ENTRADA RIVAL!');
            }
          });

          // Transición a Zona de Disparo
          if (defenders.length > 0 && defenders.every(d => d.mesh.position.z > playerObj.mesh.position.z + 1)) {
            triggerShootingPhase();
          }
        } else if (gamePhase === 'SHOOTING' && isShooting) {
          shotProgress += 0.032;

          if (shotProgress <= 1) {
            const t = shotProgress;
            // Trayectoria Bézier 3D con Rosca
            const startZ = playerObj.mesh.position.z + 0.6;
            const bz = THREE.MathUtils.lerp(startZ, goalZ, t);
            const bx = THREE.MathUtils.lerp(playerObj.mesh.position.x, shotData.targetX, t) + Math.sin(t * Math.PI) * shotData.curveX;
            const by = THREE.MathUtils.lerp(0.22, shotData.targetY, t) + Math.sin(t * Math.PI) * 1.2;

            ball.position.set(bx, by, bz);
            ball.rotation.x += 0.4;
            ball.rotation.y += 0.2;

            // Estirada de Orsini (#94) hacia el balón
            keeperObj.mesh.position.x = THREE.MathUtils.lerp(keeperObj.mesh.position.x, shotData.targetX * 0.85, 0.06);
            if (Math.abs(shotData.targetX) > 1.2) {
              keeperObj.mesh.rotation.z = THREE.MathUtils.lerp(keeperObj.mesh.rotation.z, -Math.sign(shotData.targetX) * 0.8, 0.08);
            }
          } else {
            isShooting = false;
            evalShotResult(shotData.targetX, shotData.targetY);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    function triggerShootingPhase() {
      gamePhase = 'SHOOTING';
      triggerFeedback('¡ZONA DE TIRO! ¡BUSA LA ESCUADRA!');

      // Acercar la cámara para sensación de definición
      scene.tweens = scene.tweens || [];
    }

    function evalShotResult(tx, ty) {
      const savedByKeeper = Math.abs(tx - keeperObj.mesh.position.x) < 0.95 && ty < 1.8;

      if (savedByKeeper) {
        sfx.playHit();
        handleLifeLoss('¡PARADÓN DE ORSINI!');
      } else if (Math.abs(tx) <= goalWidth / 2 && ty <= goalHeight) {
        sfx.playGoal();

        // Verificar si impactó en Diana de Multiplicador
        let multiplier = 1;
        targets.forEach(tgt => {
          if (Math.abs(tx - tgt.x) < 0.6 && Math.abs(ty - tgt.y) < 0.6) {
            multiplier = tgt.multiplier;
          }
        });

        const pts = 150 * multiplier;
        currentScore += pts;
        setScore(currentScore);

        triggerFeedback(multiplier > 1 ? `¡ESCUADRAZO x${multiplier}! (+${pts} PTS)` : '¡GOOOOL!');
        resetRound();
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
        resetRound();
      }
    }

    function resetRound() {
      setTimeout(() => {
        if (isGameOver) return;
        gamePhase = 'RUNNING';
        isShooting = false;
        currentLane = 1;
        playerObj.mesh.position.set(0, 0, 6);
        ball.position.set(0, 0.22, 6.7);
        keeperObj.mesh.position.set(0, 0, goalZ + 0.4);
        keeperObj.mesh.rotation.z = 0;
        spawnDefenders();
      }, 900);
    }

    function triggerFeedback(txt) {
      setFeedback(txt);
      setTimeout(() => setFeedback(''), 900);
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
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '20px',
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

      {/* CONTENEDOR TRES DIMENSIONES */}
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
