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
    scene.background = new THREE.Color(0x0a0f1d); // Fondo nocturno oscuro
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2.8, 11);
    camera.lookAt(0, 1.2, -12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. ILUMINACIÓN DE ESTADIO
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfde047, 1.1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 3. CANCHA Y GRADERÍAS EN 3D (Carreras y Obstáculos)
    const fieldGeo = new THREE.PlaneGeometry(30, 120);
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, -30);
    field.receiveShadow = true;
    scene.add(field);

    // Franjas de pasto
    for (let i = -90; i < 30; i += 5) {
      if ((i / 5) % 2 === 0) {
        const stripeGeo = new THREE.PlaneGeometry(30, 5);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, i);
        stripe.receiveShadow = true;
        scene.add(stripe);
      }
    }

    // Graderías/Estadio al fondo
    const stadiumGeo = new THREE.BoxGeometry(40, 12, 5);
    const stadiumMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
    stadium.position.set(0, 6, -62);
    scene.add(stadium);

    // 4. PORTERÍA 3D
    const goalWidth = 6.4;
    const goalHeight = 2.2;
    const goalZ = -50;

    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    
    // Travesaño superior
    const crossbarGeo = new THREE.CylinderGeometry(0.06, 0.06, goalWidth, 16);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    scene.add(crossbar);

    // Postes laterales
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, goalHeight, 16);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    leftPost.castShadow = true;
    scene.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(goalWidth / 2, goalHeight / 2, goalZ);
    rightPost.castShadow = true;
    scene.add(rightPost);

    // 5. JUGADOR EN CARRERA (3D Completo)
    const playerGroup = new THREE.Group();
    
    // Piernas (En carrera)
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.22, 0);
    playerGroup.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.22, 0);
    playerGroup.add(legR);

    // Cuerpo
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.7, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a }); // Camiseta Negra Prom '07
    const pBody = new THREE.Mesh(bodyGeo, bodyMat);
    pBody.position.y = 0.75;
    pBody.castShadow = true;
    playerGroup.add(pBody);

    // Franja Dorada de la Prom
    const stripeGeo = new THREE.CylinderGeometry(0.205, 0.19, 0.12, 16);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xeab308 });
    const pStripe = new THREE.Mesh(stripeGeo, stripeMat);
    pStripe.position.set(0, 0.82, 0);
    playerGroup.add(pStripe);

    // Cabeza
    const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfbd23c });
    const pHead = new THREE.Mesh(headGeo, headMat);
    pHead.position.y = 1.25;
    pHead.castShadow = true;
    playerGroup.add(pHead);

    playerGroup.position.set(0, 0, 6);
    scene.add(playerGroup);

    // 6. BALÓN 3D
    const ballGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(0, 0.18, 6.7);
    ball.castShadow = true;
    scene.add(ball);

    // 7. PORTERO ORSINI (#94) AL FONDO
    const keeperGroup = new THREE.Group();
    const kBodyGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.7, 16);
    const kBodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308 }); // Camiseta Dorada
    const kBody = new THREE.Mesh(kBodyGeo, kBodyMat);
    kBody.position.y = 0.75;
    kBody.castShadow = true;
    keeperGroup.add(kBody);

    const kHeadGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const kHead = new THREE.Mesh(kHeadGeo, headMat);
    kHead.position.y = 1.2;
    kHead.castShadow = true;
    keeperGroup.add(kHead);

    keeperGroup.position.set(0, 0, goalZ + 0.3);
    scene.add(keeperGroup);

    // Silbato de inicio
    sfx.playWhistle();

    // 8. VARIABLES DE JUEGO Y CARRILES
    const laneWidth = 2.4;
    let currentLane = 1; // 0: Izquierda, 1: Centro, 2: Derecha
    const targetLanesX = [-laneWidth, 0, laneWidth];

    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let currentTime = 60;
    let isGameOver = false;

    let defenders = [];
    let gamePhase = 'RUNNING'; // 'RUNNING' o 'SHOOTING'
    let distanceToGoal = 56; // Inicias a 56 metros de la portería

    // Generar 4 barreras de rivales escalonadas
    const spawnDefenders = () => {
      defenders.forEach(d => scene.remove(d.mesh));
      defenders = [];

      const defenderMat = new THREE.MeshStandardMaterial({ color: 0xef4444 }); // Rivales en rojo
      const defGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.75, 16);

      for (let i = 0; i < 4; i++) {
        // Dejar un carril vacío al azar
        const emptyLane = Math.floor(Math.random() * 3);
        const zPos = 0 - (i * 12); // Separados por 12 metros

        for (let l = 0; l < 3; l++) {
          if (l !== emptyLane) {
            const defGroup = new THREE.Group();
            const dBody = new THREE.Mesh(defGeo, defenderMat);
            dBody.position.y = 0.75;
            dBody.castShadow = true;
            defGroup.add(dBody);

            const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), headMat);
            dHead.position.y = 1.2;
            dHead.castShadow = true;
            defGroup.add(dHead);

            defGroup.position.set(targetLanesX[l], 0, zPos);
            scene.add(defGroup);

            defenders.push({ mesh: defGroup, lane: l, z: zPos });
          }
        }
      }
    };

    spawnDefenders();

    // Contador de tiempo
    const timerInterval = setInterval(() => {
      if (isGameOver) return;
      currentTime -= 1;
      setTimeLeft(currentTime);
      if (currentTime <= 0) triggerGameOver('¡TIEMPO AGOTADO!');
    }, 1000);

    // 9. CONTROLES TÁCTILES (SWIPES)
    let startXPos, startYPos;

    const handleStart = (e) => {
      if (isGameOver) return;
      const t = e.touches ? e.touches[0] : e;
      startXPos = t.clientX;
      startYPos = t.clientY;
    };

    const handleEnd = (e) => {
      if (isGameOver) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const deltaX = t.clientX - startXPos;
      const deltaY = t.clientY - startYPos;

      if (gamePhase === 'RUNNING') {
        // Movimiento a la izquierda / derecha para esquivar
        if (Math.abs(deltaX) > 25) {
          if (deltaX > 0 && currentLane < 2) currentLane++;
          else if (deltaX < 0 && currentLane > 0) currentLane--;
        }
      } else if (gamePhase === 'SHOOTING') {
        // Disparo final al arco (Swipe hacia arriba)
        if (deltaY < -25) {
          executeShot(deltaX / 100);
        }
      }
    };

    container.addEventListener('touchstart', handleStart, { passive: true });
    container.addEventListener('touchend', handleEnd, { passive: true });
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mouseup', handleEnd);

    // 10. ANIMACIÓN DEL DISPARO Y GOL
    let isBallFlying = false;
    let ballFlyProgress = 0;
    let shotTargetX = 0;
    let shotTargetY = 1.2;

    const executeShot = (curveValue) => {
      isBallFlying = true;
      ballFlyProgress = 0;
      sfx.playKick();

      // Apuntar a donde fue el swipe
      shotTargetX = THREE.MathUtils.clamp(playerGroup.position.x + (curveValue * 4), -goalWidth / 2 + 0.4, goalWidth / 2 - 0.4);
      shotTargetY = 0.5 + Math.random() * (goalHeight - 0.6); // Altura al azar dentro del marco

      // Orsini se lanza a tapar
      const kSpeed = Math.abs(shotTargetX - keeperGroup.position.x) > 1.2 ? 0.08 : 0.05;
      scene.tweens = scene.tweens || [];
    };

    // 11. BUCLE DE JUEGO (GAME LOOP)
    let animFrameId;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      if (!isGameOver) {
        // Suave interpolación de carril del jugador
        playerGroup.position.x = THREE.MathUtils.lerp(playerGroup.position.x, targetLanesX[currentLane], 0.15);
        if (!isBallFlying) {
          ball.position.x = playerGroup.position.x;
        }

        if (gamePhase === 'RUNNING') {
          // El escenario se mueve hacia el jugador para simular carrera
          defenders.forEach(d => {
            d.mesh.position.z += 0.22; // Velocidad de carrera de defensores

            // Detección de colisión / tacleada
            if (Math.abs(d.mesh.position.z - playerGroup.position.z) < 0.45 && d.lane === currentLane) {
              sfx.playHit();
              handleLifeLoss('¡BARRIDA RIVAL!');
            }
          });

          // Reducir la distancia a la portería
          distanceToGoal = Math.max(12, 56 - Math.floor(defenders[0]?.mesh.position.z * 1.5));
          
          // Fase de definición (Penal)
          if (defenders.every(d => d.mesh.position.z > playerGroup.position.z + 1.5)) {
            triggerShootingPhase();
          }
        } else if (gamePhase === 'SHOOTING' && isBallFlying) {
          // Animación del Balón en Vuelo
          ballFlyProgress += 0.038;

          if (ballFlyProgress < 1) {
            const t = ballFlyProgress;
            // Curva parabólica simple 3D
            const bz = THREE.MathUtils.lerp(playerGroup.position.z + 0.7, goalZ, t);
            const bx = THREE.MathUtils.lerp(playerGroup.position.x, shotTargetX, t);
            const by = THREE.MathUtils.lerp(0.18, shotTargetY, t) + Math.sin(t * Math.PI) * 1.4;

            ball.position.set(bx, by, bz);
            ball.rotation.x += 0.35;

            // Portero Orsini intentando tapar en 3D
            keeperGroup.position.x = THREE.MathUtils.lerp(keeperGroup.position.x, shotTargetX * 0.7, 0.04);
          } else {
            // Evaluar si fue gol, fuera o si tapó Orsini
            isBallFlying = false;
            evalShotResult(shotTargetX, shotTargetY);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    function triggerShootingPhase() {
      gamePhase = 'SHOOTING';
      triggerFeedback('¡ZONA DE DISPARO! ¡MATE!');
    }

    function evalShotResult(tx, ty) {
      // Comparar coordenadas de impacto con la estirada de Orsini
      const saved = Math.abs(tx - keeperGroup.position.x) < 0.8 && ty < 1.7;

      if (saved) {
        sfx.playHit();
        handleLifeLoss('¡TAPÓ ORSINI!');
      } else if (Math.abs(tx) <= goalWidth / 2 && ty <= goalHeight) {
        sfx.playGoal();
        currentScore += 250;
        setScore(currentScore);
        triggerFeedback('¡GOOOLAZO!');
        resetRound();
      } else {
        sfx.playHit();
        handleLifeLoss('¡FUERA!');
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
        currentLane = 1;
        playerGroup.position.set(0, 0, 6);
        ball.position.set(0, 0.18, 6.7);
        keeperGroup.position.set(0, 0, goalZ + 0.3);
        spawnDefenders();
      }, 800);
    }

    function triggerFeedback(txt) {
      setFeedback(txt);
      setTimeout(() => setFeedback(''), 750);
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
