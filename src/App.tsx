import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה לשיחה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // פונקציה להפעלת הדיבור של ה-AI
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'he-IL';
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening(); // חוזר להקשיב אחרי שסיים לדבר
    };
    window.speechSynthesis.speak(msg);
  };

  // פונקציה לשליחת הטקסט ל-Gemini
  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("🤔 חושב...");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(userText);
      const response = await result.response;
      speak(response.text());
      setDebugLog("✅ עונה לך");
    } catch (e) {
      setDebugLog("❌ שגיאה בקבלת תשובה");
    }
  };

  // פונקציה להפעלת המיקרופון
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ הדפדפן לא תומך בזיהוי דיבור");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setDebugLog("🎤 מקשיב לך...");
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`💬 אמרת: ${transcript}`);
      getAIResponse(transcript);
    };

    recognition.onerror = () => {
      if (status === "connected") recognition.start(); // ניסיון תיקון אוטומטי
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("המערכת מחוברת. אני מקשיב לך, מה שלומך?");
      startListening();
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
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
          width: '200px', height: '200px', borderRadius: '50%', 
          backgroundColor: status === 'connected' ? (isSpeaking ? '#818cf8' : '#4f46e5') : '#1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '70px',
          boxShadow: status === 'connected' ? '0 0 60px rgba(79, 70, 229, 0.5)' : 'none',
          transition: 'all 0.4s ease',
          transform: isSpeaking ? 'scale(1.15)' : 'scale(1)'
        }}>
          {isSpeaking ? '🔊' : (status === 'connected' ? '🎤' : '💤')}
        </div>

        <button 
          onClick={toggleSession}
          style={{
            padding: '18px 60px', fontSize: '1.3rem', borderRadius: '20px', border: 'none',
            backgroundColor: status === 'ready' ? '#4f46e5' : '#ef4444',
            color: 'white', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}
        >
          {status === 'ready' ? 'התחל לדבר' : 'עצור שיחה'}
        </button>
      </div>

      <div style={{ padding: '25px', backgroundColor: '#0f172a', color: '#818cf8', fontSize: '16px', fontWeight: '500', borderTop: '1px solid #1e293b' }}>
        {debugLog}
      </div>
    </div>
  );
};

export default App;
