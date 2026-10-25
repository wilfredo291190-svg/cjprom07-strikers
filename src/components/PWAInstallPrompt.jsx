import React, { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalado como App
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Mostrar modal si es móvil
    if (ios || /android/.test(userAgent)) {
      setShowPrompt(true);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '12px',
      left: '12px',
      right: '12px',
      backgroundColor: '#111827',
      border: '2px solid #eab308',
      borderRadius: '12px',
      padding: '14px',
      zIndex: 9999,
      boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
      fontFamily: "'Chakra Petch', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#eab308' }}>📱 ¡MEJOR EXPERIENCIA DE JUEGO!</span>
        <button onClick={() => setShowPrompt(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '16px', fontWeight: 'bold' }}>✕</button>
      </div>
      <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '0 0 10px 0', lineHeight: '1.4' }}>
        Instala <strong>CJ PROM '07 STRIKERS</strong> en tu pantalla de inicio para jugar en pantalla completa sin barras del navegador.
      </p>
      <div style={{ backgroundColor: '#0a0f1d', padding: '8px', borderRadius: '6px', fontSize: '10px', color: '#94a3b8' }}>
        {isIOS ? (
          <span>Toca el botón <strong>Compartir (flecha hacia arriba ⎋)</strong> y luego <strong>"Agregar al inicio ➕"</strong>.</span>
        ) : (
          <span>Toca el menú de opciones (⋮) de tu navegador y selecciona <strong>"Instalar aplicación"</strong>.</span>
        )}
      </div>
    </div>
  );
}
