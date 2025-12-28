import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'he-IL';
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("🤔 חושב...");
      
      // אתחול מפורש עם הגדרת apiVersion לגרסה יציבה
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });

      // קריאה ישירה למודל
      const result = await model.generateContent(userText);
      const text = result.response.text();
      
      speak(text);
      setDebugLog("✅ עונה לך");
    } catch (e: any) {
      console.error("Full Error:", e);
      setDebugLog("❌ שגיאת תקשורת עם גוגל");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ דפדפן לא נתמך");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`💬 אמרת: ${transcript}`);
      getAIResponse(transcript);
    };

    recognition.onerror = (event: any) => {
      if (status === "connected" && event.error !== 'aborted') {
        try { recognition.start(); } catch(e) {}
      }
    };

    try { recognition.start(); } catch(e) {}
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, איך אפשר לעזור לך?");
      startListening();
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      }
      setDebugLog("שיחה הסתיימה");
    }
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#020617', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>LINGO-AI</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
        <div style={{ 
          width: '180px', height: '180px', borderRadius: '50%', 
          backgroundColor: status === 'connected' ? (isSpeaking ? '#818cf8' : '#4f46e5') : '#1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px',
          boxShadow: status === 'connected' ? '0 0 40px rgba(79, 70, 229, 0.4)' : 'none',
          transform: isSpeaking ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {status === 'connected' ? (isSpeaking ? '🔊' : '🎤') : '💤'}
        </div>

        <button 
          onClick={toggleSession}
          style={{
            padding: '15px 50px', fontSize: '1.2rem', borderRadius: '12px', border: 'none',
            backgroundColor: status === 'ready' ? '#4f46e5' : '#ef4444',
            color: 'white', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          {status === 'ready' ? 'התחל לדבר' : 'עצור'}
        </button>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#0f172a', color: '#818cf8', fontSize: '14px', borderTop: '1px solid #1e293b' }}>
        {debugLog}
      </div>
    </div>
  );
};

export default App;
