import React, { useState, useRef } from 'react';

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
      
      // פנייה ישירה ל-API של גוגל בנתיב v1 היציב
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiText = data.candidates[0].content.parts[0].text;
      speak(aiText);
      setDebugLog("✅ עונה לך");
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setDebugLog("❌ שגיאה: " + (e.message || "תקשורת"));
      setStatus("ready");
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
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`💬 אמרת: ${transcript}`);
      getAIResponse(transcript);
    };

    recognition.onerror = () => {
      if (status === "connected") try { recognition.start(); } catch(e) {}
    };

    try { recognition.start(); } catch(e) {}
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מחוברת דרך הנתיב היציב. מה שלומך?");
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
        <h1 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px' }}>LINGO-AI</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
        <div style={{ 
          width: '180px', height: '180px', borderRadius: '50%', 
          backgroundColor: status === 'connected' ? '#4f46e5' : '#1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px',
          boxShadow: status === 'connected' ? '0 0 40px #4f46e5' : 'none',
          transform: isSpeaking ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}>
          {status === 'connected' ? (isSpeaking ? '🔊' : '🎤') : '💤'}
        </div>

        <button 
          onClick={toggleSession}
          style={{
            padding: '15px 50px', fontSize: '1.1rem', borderRadius: '12px', border: 'none',
            backgroundColor: status === 'ready' ? '#4f46e5' : '#ef4444',
            color: 'white', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          {status === 'ready' ? 'התחל לדבר' : 'עצור'}
        </button>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#0f172a', color: '#818cf8', fontSize: '14px' }}>
        {debugLog}
      </div>
    </div>
  );
};

export default App;
