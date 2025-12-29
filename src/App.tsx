import React, { useState, useRef } from 'react';
import { Mic, Headphones, Square, Sparkles } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה לשיחה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // פונקציית הקול הנשי
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // ניסיון למצוא קול נשי בעברית
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes('Hebrew') || v.lang === 'he-IL');
    if (femaleVoice) msg.voice = femaleVoice;
    
    msg.lang = 'he-IL';
    msg.pitch = 1.1; // קצת יותר גבוה לקול נשי חביב
    msg.rate = 1.0;

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") setTimeout(() => startListening(), 400);
    };
    window.speechSynthesis.speak(msg);
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⚡ Gemini 2.0 חושבת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }]
        })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      
      setDebugLog("✅ עונה לך עכשיו");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת תקשורת");
      speak("סליחה, יש לי תקלה קטנה בחיבור.");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    
    recognition.onstart = () => setDebugLog("🎤 אני מקשיבה...");
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`💬 אמרת: ${transcript}`);
      getAIResponse(transcript);
    };
    
    recognition.onerror = () => {
      if (status === "connected" && !isSpeaking) try { recognition.start(); } catch(e) {}
    };

    try { recognition.start(); } catch(e) {}
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום! אני ג'ימיני 2, העוזרת האישית שלך. איך אני יכולה לעזור היום?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("השיחה הסתיימה");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="p-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          <h1 className="font-black text-xl tracking-tight text-indigo-400">LINGO-AI V2</h1>
        </div>
        <Sparkles className="text-indigo-400 opacity-50" size={20} />
      </div>

      {/* Main UI */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className={`relative transition-all duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            status === 'connected' ? 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.4)]' : 'border-slate-800'
          }`}>
            <div className="w-48 h-48 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-7xl shadow-2xl">
              {isSpeaking ? '👩‍קול' : (status === 'connected' ? '🎙️' : '👩‍💼')}
            </div>
          </div>
        </div>

        <div className="mt-12 max-w-sm">
          <h2 className="text-2xl font-bold mb-3">{status === 'ready' ? 'מוכנה להתחיל?' : 'אני מקשיבה לך'}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">שיחה חיה עם Gemini 2.0 Flash</p>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-10 border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl flex flex-col items-center gap-6">
        <button 
          onClick={toggleSession}
          className={`w-full max-w-xs py-5 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
            status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-red-500/20 text-red-500 border border-red-500/50'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחלת שיחה</> : <><Square size={24} /> סיום שיחה</>}
        </button>
        
        <div className="w-full max-w-md bg-black/40 rounded-xl p-3 border border-slate-800 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">Status Log</p>
          <p className="text-xs font-mono text-indigo-400 uppercase tracking-tighter">{debugLog}</p>
        </div>
      </div>
    </div>
  );
};

export default App;
