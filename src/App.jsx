import React, { useState } from 'react';
import { ROSTER_PROM07 } from './data/roster';

export default function App() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'sans-serif', padding: '16px' }}>
      {/* Header con estilo Prom '07 */}
      <header style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #eab308', paddingBottom: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308', margin: '0 0 4px 0' }}>PROMOCIÓN 07 STRIKE</h1>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Nadie es más fuerte que todos juntos</p>
      </header>

      {/* Vista de Selección de Jugador */}
      {!selectedPlayer ? (
        <div>
          <h2 style={{ fontSize: '18px', textAlign: 'center', marginBottom: '16px' }}>Elige tu Jugador del Roster</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
            {ROSTER_PROM07.map((player) => (
              <div
                key={player.number}
                onClick={() => setSelectedPlayer(player)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#eab308' }}>#{player.number}</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>{player.name}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{player.pos}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Ficha del Jugador Seleccionado */
        <div style={{ maxWidth: '400px', margin: '0 auto', backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', border: '2px solid #eab308' }}>
          <button
            onClick={() => setSelectedPlayer(null)}
            style={{ backgroundColor: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', marginBottom: '12px' }}
          >
            ← Volver al Roster
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#eab308' }}>#{selectedPlayer.number}</span>
            <h2 style={{ fontSize: '22px', margin: '4px 0' }}>{selectedPlayer.name}</h2>
            <span style={{ backgroundColor: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{selectedPlayer.pos}</span>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Nivel:</span>
              <strong style={{ color: '#eab308' }}>{selectedPlayer.level}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Skill Points (SP):</span>
              <strong style={{ color: '#22c55e' }}>{selectedPlayer.skillPoints}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>ATRIBUTOS BASE (NIVEL 1)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Potencia</span>
                <span>{selectedPlayer.power} / 99</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px' }}>
                <div style={{ width: `${selectedPlayer.power}%`, backgroundColor: '#eab308', height: '100%', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Rosca / Curva</span>
                <span>{selectedPlayer.curve} / 99</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px' }}>
                <div style={{ width: `${selectedPlayer.curve}%`, backgroundColor: '#3b82f6', height: '100%', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Puntería</span>
                <span>{selectedPlayer.accuracy} / 99</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px' }}>
                <div style={{ width: `${selectedPlayer.accuracy}%`, backgroundColor: '#22c55e', height: '100%', borderRadius: '3px' }}></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert('¡Prototipo de tiros libres en desarrollo con Phaser 3!')}
            style={{ width: '100%', marginTop: '20px', backgroundColor: '#eab308', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
          >
            ENTRAR A LA CANCHA
          </button>
        </div>
      )}
    </div>
  );
}
