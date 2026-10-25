import React, { useState } from 'react';
import { ROSTER_PROM07 } from './data/roster';
import GameCanvas from './components/GameCanvas';
import PWAInstallPrompt from './components/PWAInstallPrompt';

export default function App() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f1d',
      color: '#f8fafc',
      fontFamily: "'Chakra Petch', sans-serif",
      padding: isPlaying ? '0' : '12px 16px',
      boxSizing: 'border-box'
    }}>
      <PWAInstallPrompt />

      {isPlaying ? (
        <GameCanvas 
          player={selectedPlayer} 
          onExit={() => setIsPlaying(false)} 
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
                  {ROSTER_PROM07.length} Jugadores
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {ROSTER_PROM07.map((player) => (
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
                Atributos Iniciales
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>POTENCIA</span>
                    <span style={{ color: '#eab308' }}>{selectedPlayer.power} / 99</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#1e293b', height: '4px', borderRadius: '2px' }}>
                    <div style={{ width: `${selectedPlayer.power}%`, backgroundColor: '#eab308', height: '100%', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>ROSCA / CURVA</span>
                    <span style={{ color: '#3b82f6' }}>{selectedPlayer.curve} / 99</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#1e293b', height: '4px', borderRadius: '2px' }}>
                    <div style={{ width: `${selectedPlayer.curve}%`, backgroundColor: '#3b82f6', height: '100%', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>PUNTERÍA</span>
                    <span style={{ color: '#22c55e' }}>{selectedPlayer.accuracy} / 99</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#1e293b', height: '4px', borderRadius: '2px' }}>
                    <div style={{ width: `${selectedPlayer.accuracy}%`, backgroundColor: '#22c55e', height: '100%', borderRadius: '2px' }}></div>
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
