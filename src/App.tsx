import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, Headphones, Square } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");

  // שימוש בשם המפתח המדויק שלך מה-Vercel
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";

  const startConversation = async () => {
    if (!apiKey) {
      setDebugLog("❌ שגיאה: VITE_API_KEY חסר ב-Vercel");
      return;
    }
    
    try {
      setStatus("connected");
      setDebugLog("⚡ מתחבר ל-Gemini...");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const msg = new SpeechSynthesisUtterance("המערכת מחוברת למפתח שלך");
      msg.lang = 'he-IL';
      
      msg.onstart = () => setIsSpeaking(true);
      msg.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(msg);
      setDebugLog("✅ מחובר!");
      
    } catch (e) {
      setDebugLog("❌ שגיאה בחיבור");
      setStatus("ready");
    }
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#020617', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LINGO-AI</h1>
        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>V2.0.1</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
        <div style={{ 
          width: '200px', 
          height: '200px', 
          borderRadius: '50%', 
          backgroundColor: status === 'connected' ? '#4f46e5' : '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.5s ease',
          boxShadow: status === 'connected' ? '0 0 50px rgba(79, 70, 229, 0.4)' : 'none',
          transform: isSpeaking ? 'scale(1.1)' : 'scale(1)'
        }}>
          {status === 'connected' ? <Headphones size={60} /> : <Mic size={60} />}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={status === 'ready' ? startConversation : () => { setStatus('ready'); window.speechSynthesis.cancel(); }}
            style={{
              padding: '20px 60px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              borderRadius: '15px',
              border: 'none',
              backgroundColor: status === 'ready' ? '#4f46e5' : '#ef4444',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {status === 'ready' ? 'התחל שיחה' : 'עצור'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#0f172a', fontSize: '0.8rem', color: '#818cf8' }}>
        {debugLog}
      </div>
    </div>
  );
};

export default App;
