
import React, { useEffect } from 'react';

const App = () => {
  // אישור בקונסול
  useEffect(() => {
    console.log("CRITICAL TEST - RED BAR VERSION ACTIVE");
  }, []);

  const testSound = () => {
    const msg = new SpeechSynthesisUtterance();
    msg.text = "System test successful. Sound is working.";
    msg.lang = 'en-US';
    window.speechSynthesis.speak(msg);
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#050505',
      color: '#fff',
      margin: 0,
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* פס זיהוי אדום - אם אתה לא רואה אותו, הקוד לא התעדכן! */}
      <div style={{ 
        width: '100%', 
        backgroundColor: '#ff0000', 
        color: '#fff', 
        padding: '20px', 
        textAlign: 'center',
        fontWeight: '900',
        fontSize: '1.5rem',
        textTransform: 'uppercase',
        boxShadow: '0 0 20px rgba(255, 0, 0, 0.6)',
        zIndex: 1000
      }}>
        🚨 WARNING: TESTING NEW CODE - RED BAR ACTIVE 🚨
      </div>

      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px'
      }}>
        <h1 style={{ fontSize: '3rem', margin: 0 }}>Audio Test</h1>
        
        <button 
          onClick={testSound}
          style={{
            padding: '30px 60px',
            fontSize: '2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(255,255,255,0.2)'
          }}
        >
          🔊 לחץ לבדיקת קול
        </button>

        <p style={{ color: '#666' }}>גרסה: 1.0.7</p>
      </div>
    </div>
  );
};

export default App;
