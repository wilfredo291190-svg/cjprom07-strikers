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

    // Dimensiones seguras para producción
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. ESCENA Y RENDERIZADOR
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.012);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 3.2, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Limpiar cualquier canvas previo
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. ILUMINACIÓN
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    mainLight.position.set(12, 25, 15);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // 3. CANCHA EN 3D
    const fieldGeo = new THREE.PlaneGeometry(28, 110);
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, -30);
    field.receiveShadow = true;
    scene.add(field);

    // 4. PORTERÍA Y NET
    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalZ = -44;

    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalWidth, 16), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    scene.add(crossbar);

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalHeight, 16), postMat);
    postL.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    scene.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalHeight, 16), postMat);
    postR.position.set(goalWidth / 2, goalHeight / 2, goalZ);
    scene.add(postR);

    // 5. JUGADOR HUMANOIDE (Prom '07)
    const playerGroup = new THREE.Group();
    const kitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.7, 16), kitMat);
    torso.position.y = 1.05;
    playerGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
    head.position.y = 1.58;
    playerGroup.add(head);

    playerGroup.position.set(0, 0, 6);
    scene.add(playerGroup);

    // BALÓN 3D
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    ball.position.set(0, 0.22, 6.7);
    scene.add(ball);

    sfx.playWhistle();

    // 6. GAME LOOP
    let animFrameId;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [player]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#060913',
      overflow: 'hidden',
      touchAction: 'none'
    }}>
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

      {/* CONTENEDOR 3D ROBUSTO */}
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </div>
  );
}
