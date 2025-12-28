import React from 'react';

const App = () => {
  const testSound = () => {
    // מנסה להפעיל קול דרך מנוע הדיבור של הדפדפן
    const msg = new SpeechSynthesisUtterance();
    msg.text = "The sound system is now active and working";
    msg.lang = 'en-US';
    
    window.speechSynthesis.speak(msg);
    console.log("Audio command sent");
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#000',
      color: '#fff',
      margin: 0,
      fontFamily: 'sans-serif'
    }}>
      {/* פס זיהוי ירוק - אישור שהקוד חדש */}
      <div style={{ 
        width: '100%', 
        backgroundColor: '#22c55e', 
        color: '#000', 
        padding: '15px', 
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '1.2rem',
        boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)'
      }}>
        ✅ NEW CODE ACTIVE - V6
      </div>

      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '30px',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '2.5rem', textAlign: 'center' }}>Audio Diagnostic</h1>
        
        <button 
          onClick={testSound}
          style={{
            padding: '25px 50px',
            fontSize: '1.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
            transition: 'transform 0.1s'
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          🔊 לחץ לבדיקת קול
        </button>

        <div style={{ 
          maxWidth: '400px', 
          backgroundColor: '#111', 
          padding: '20px', 
          borderRadius: '15px',
          border: '1px solid #333',
          lineHeight: '1.6'
        }}>
          <p style={{ margin: 0, color: '#aaa' }}>
            <strong>אם לא שמעת כלום:</strong><br />
            1. בדוק שהרמקולים דלוקים.<br />
            2. בדוק שלשונית הדפדפן לא במצב Mute (קליק ימני על הלשונית למעלה).<br />
            3. וודא שעוצמת הקול במערכת ההפעלה מעל 0.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
