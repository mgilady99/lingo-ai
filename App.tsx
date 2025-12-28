import React from 'react';

const App = () => {
  const testSound = () => {
    // יצירת אובייקט דיבור פשוט של הדפדפן
    const msg = new SpeechSynthesisUtterance();
    msg.text = "The sound is working perfectly";
    msg.lang = 'en-US';
    msg.rate = 1;
    
    // הפעלה
    window.speechSynthesis.speak(msg);
    console.log("Audio command sent to browser");
  };

  return (
    <div style={{ 
      height: '100 screen', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#000',
      color: '#fff',
      gap: '20px'
    }}>
      <h1 style={{ color: '#4ade80' }}>Audio Diagnostic</h1>
      <p>לחץ על הכפתור כדי לבדוק אם המחשב מסוגל להוציא קול מהדפדפן:</p>
      
      <button 
        onClick={testSound}
        style={{
          padding: '20px 40px',
          fontSize: '24px',
          fontWeight: 'bold',
          cursor: 'pointer',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '12px'
        }}
      >
        🔊 PLAY TEST SOUND
      </button>
      
      <p style={{ fontSize: '12px', color: '#666' }}>
        אם לא שומעים כלום: בדוק שהלשונית לא ב-Mute ושעוצמת הקול במחשב מוגברת.
      </p>
    </div>
  );
};

export default App;
