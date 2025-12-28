import React, { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    console.log("V11 - SRC FOLDER TEST ACTIVE");
  }, []);

  const testSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    osc.connect(audioCtx.destination);
    osc.start();
    setTimeout(() => osc.stop(), 500);
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#111', color: 'white', margin: 0 }}>
      {/* אם אתה רואה את הפס הצהוב הזה, סימן שתיקיית ה-src עובדת! */}
      <div style={{ 
        width: '100%', 
        backgroundColor: '#facc15', 
        color: '#000', 
        padding: '40px', 
        textAlign: 'center', 
        fontWeight: 'bold', 
        fontSize: '2.5rem' 
      }}>
        ⚠️ V11 - YELLOW BAR (IN SRC FOLDER) ⚠️
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '30px' }}>
        <button 
          onClick={testSound}
          style={{ padding: '30px 60px', fontSize: '2rem', cursor: 'pointer', borderRadius: '15px', backgroundColor: 'white', color: 'black' }}
        >
          🔊 נגן צליל בדיקה
        </button>
        <p style={{ fontSize: '1.2rem' }}>האם אתה רואה את הפס הצהוב?</p>
      </div>
    </div>
  );
};

export default App;
