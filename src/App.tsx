import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");

  // משיכת המפתח מהגדרות Vercel
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";

  const startConversation = async () => {
    if (!apiKey) {
      setDebugLog("❌ חסר מפתח VITE_API_KEY");
      return;
    }
    
    try {
      setStatus("connected");
      setDebugLog("⚡ מתחבר...");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const msg = new SpeechSynthesisUtterance("המערכת מחוברת. איך אפשר לעזור?");
      msg.lang = 'he-IL';
      
      msg.onstart = () => setIsSpeaking(true);
      msg.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(msg);
      setDebugLog("✅ מחובר!");
      
    } catch (e) {
      setDebugLog("❌ שגיאה");
      setStatus("ready");
    }
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#020617', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ margin: 0 }}>LINGO-AI</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
        <div style={{ 
          width: '180px', 
          height: '180px', 
          borderRadius: '50%', 
          backgroundColor: status === 'connected' ? '#4f46e5' : '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '60px',
          boxShadow: status === 'connected' ? '0 0 40px #4f46e5' : 'none',
          transition: 'all 0.3s'
        }}>
          {status === 'connected' ? '🎧' : '🎤'}
        </div>

        <button 
          onClick={status === 'ready' ? startConversation : () => setStatus('ready')}
          style={{
            padding: '15px 50px',
            fontSize: '1.2rem',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: status === 'ready' ? '#4f46e5' : '#ef4444',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {status === 'ready' ? 'התחל שיחה' : 'עצור'}
        </button>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#0f172a', color: '#818cf8', fontSize: '14px' }}>
        {debugLog}
      </div>
    </div>
  );
};

export default App;
