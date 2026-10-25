import React, { useState, useEffect } from 'react';
import { ROSTER_PROM07 } from './data/roster';
import GameCanvas from './components/GameCanvas';
import PWAInstallPrompt from './components/PWAInstallPrompt';

export default function App() {
  const [roster, setRoster] = useState(ROSTER_PROM07);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Pantalla de Carga al Entrar / Re-entrar
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);

    // Resetear partida si el usuario minimiza y vuelve a abrir desde el Home
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const upgradeStat = (playerNumber, statKey) => {
    setRoster(prevRoster => prevRoster.map(player => {
      if (player.number === playerNumber && player.skillPoints > 0 && player[statKey] < 99) {
        return {
          ...player,
          [statKey]: player[statKey] + 1,
          skillPoints: player.skillPoints - 1
        };
      }
      return player;
    }));

    if (selectedPlayer && selectedPlayer.number === playerNumber) {
      setSelectedPlayer(prev => ({
        ...prev,
        [statKey]: prev[statKey] + 1,
        skillPoints: prev.skillPoints - 1
      }));
    }
  };

  const handleGameOver = (expGained) => {
    if (selectedPlayer && expGained > 0) {
      setRoster(prevRoster => prevRoster.map(player => {
        if (player.number === selectedPlayer.number) {
          const newExp = (player.exp || 0) + expGained;
          const newLevel = 1 + Math.floor(newExp / 300);
          const addedSp = newLevel > player.level ? (newLevel - player.level) * 2 : 0;

          const updated = {
            ...player,
            exp: newExp,
            level: newLevel,
            skillPoints: player.skillPoints + addedSp
          };
          setSelectedPlayer(updated);
          return updated;
        }
        return player;
      }));
    }
    setIsPlaying(false);
  };

  // Pantalla de Carga (Loading Screen)
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f1d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#eab308',
        fontFamily: "'Chakra Petch', sans-serif"
      }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 8px 0', letterSpacing: '2px' }}>CJ PROM '07 STRIKERS</h1>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px' }}>CARGANDO DATOS...</div>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #1e293b',
          borderTop: '3px solid #eab308',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f1d',
      color: '#f8fafc',
      fontFamily: "'Chakra Petch', sans-serif",
      padding: isPlaying ? '0' : '12px 16px',
      boxSizing: 'border-box',
      touchAction: 'none',
      userSelect: 'none'
    }}>
      {/* Advertencia Landscape en Mobile */}
      <div className="landscape-warning" style={{
        display: 'none',
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0a0f1d',
        zIndex: 9999999,
        color: '#eab308',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📱</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>POR FAVOR GIRA TU CELULAR</div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Este juego está optimizado en formato vertical</div>
      </div>

      <style>{`
        @media (orientation: landscape) and (max-height: 500px) {
          .landscape-warning { display: flex !important; }
        }
      `}</style>

      <PWAInstallPrompt />

      {isPlaying ? (
        <GameCanvas 
          player={selectedPlayer} 
          onExit={handleGameOver} 
        />
      ) : (
        <>
          <header style={{
            textAlign: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid #eab308',
            paddingBottom: '8px'
          }}>
            <h1 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#eab308',
              margin: 0,
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              CJ PROM '07 STRIKERS
            </h1>
            <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0', textTransform: 'uppercase' }}>
              Nadie es más fuerte que todos juntos
            </p>
          </header>

          {!selectedPlayer ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Plantel Oficial
                </span>
                <span style={{ fontSize: '10px', backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#eab308' }}>
                  {roster.length} Jugadores
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {roster.map((player) => (
                  <div
                    key={player.number}
                    onClick={() => setSelectedPlayer(player)}
                    style={{
                      backgroundColor: '#111827',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#eab308' }}>#{player.number}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.name}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '500' }}>{player.pos}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              maxWidth: '360px',
              margin: '0 auto',
              backgroundColor: '#111827',
              borderRadius: '10px',
              padding: '16px',
              border: '1px solid #eab308'
            }}>
              <button
                onClick={() => setSelectedPlayer(null)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#eab308',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                ← VOLVER AL ROSTER
              </button>

              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: '700', color: '#eab308', lineHeight: 1 }}>
                  #{selectedPlayer.number}
                </span>
                <h2 style={{ fontSize: '18px', margin: '2px 0 4px 0', textTransform: 'uppercase' }}>
                  {selectedPlayer.name}
                </h2>
                <span style={{
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}>
                  {selectedPlayer.pos}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                backgroundColor: '#0a0f1d',
                padding: '8px',
                borderRadius: '6px',
                marginBottom: '12px',
                border: '1px solid #1e293b'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>NIVEL</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#eab308' }}>{selectedPlayer.level}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>SKILL POINTS</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>{selectedPlayer.skillPoints} SP</div>
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>
                MEJORAR ATRIBUTOS
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>POTENCIA</span>
                    <span style={{ color: '#eab308' }}>{selectedPlayer.power} / 99</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, backgroundColor: '#1e293b', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${selectedPlayer.power}%`, backgroundColor: '#eab308', height: '100%', borderRadius: '3px' }}></div>
                    </div>
                    {selectedPlayer.skillPoints > 0 && (
                      <button
                        onClick={() => upgradeStat(selectedPlayer.number, 'power')}
                        style={{ backgroundColor: '#22c55e', color: '#0a0f1d', border: 'none', borderRadius: '4px', fontWeight: 'bold', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        +1
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>ROSCA / CURVA</span>
                    <span style={{ color: '#3b82f6' }}>{selectedPlayer.curve} / 99</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, backgroundColor: '#1e293b', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${selectedPlayer.curve}%`, backgroundColor: '#3b82f6', height: '100%', borderRadius: '3px' }}></div>
                    </div>
                    {selectedPlayer.skillPoints > 0 && (
                      <button
                        onClick={() => upgradeStat(selectedPlayer.number, 'curve')}
                        style={{ backgroundColor: '#22c55e', color: '#0a0f1d', border: 'none', borderRadius: '4px', fontWeight: 'bold', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        +1
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>PUNTERÍA</span>
                    <span style={{ color: '#22c55e' }}>{selectedPlayer.accuracy} / 99</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, backgroundColor: '#1e293b', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${selectedPlayer.accuracy}%`, backgroundColor: '#22c55e', height: '100%', borderRadius: '3px' }}></div>
                    </div>
                    {selectedPlayer.skillPoints > 0 && (
                      <button
                        onClick={() => upgradeStat(selectedPlayer.number, 'accuracy')}
                        style={{ backgroundColor: '#22c55e', color: '#0a0f1d', border: 'none', borderRadius: '4px', fontWeight: 'bold', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        +1
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsPlaying(true)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  backgroundColor: '#eab308',
                  color: '#0a0f1d',
                  fontWeight: '700',
                  fontFamily: "'Chakra Petch', sans-serif",
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                ENTRAR A LA CANCHA
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
