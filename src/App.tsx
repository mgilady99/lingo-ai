
import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // פונקציית הקול הנשי (TTS)
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'he-IL';
    msg.pitch = 1.2; // טון נשי חביב
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  // חיבור ישיר ל-Gemini 2.0 - פותר את שגיאת ה-404
  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("🤔 חושבת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `System: Module is ${activeModule}. User says: ${userText}` }] }]
        })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ עונה");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת חיבור ל-AI");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: ${transcript}`);
      getAIResponse(transcript);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מחוברת. איך אפשר לעזור?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex p-4 overflow-hidden font-sans" dir="rtl">
      {/* ריכוז כל הרכיבים בצד שמאל */}
      <div className="w-full max-w-[280px] flex flex-col gap-4">
        
        {/* 1. שדות בחירת שפה (למעלה) */}
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-[10px] opacity-50 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs outline-none">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div className="flex-1">
            <span className="text-[10px] opacity-50 block mb-1">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs outline-none">
              <option value="en-US">English</option>
              <option value="fr-FR">Français</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* 2. ארבעת המודולים (2+2) */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] transition-all ${activeModule === 'translation' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-900 opacity-60'}`}>
            <Mic size={18} /> תרגום
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] transition-all ${activeModule === 'simultaneous' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-900 opacity-60'}`}>
            <Headphones size={18} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] transition-all ${activeModule === 'chat' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-900 opacity-60'}`}>
            <MessageSquare size={18} /> צ'אט
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] transition-all ${activeModule === 'learning' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-900 opacity-60'}`}>
            <GraduationCap size={18} /> לימוד
          </button>
        </div>

        {/* 3. תמונת האווטאר (בעיגול עם מסגרת) */}
        <div className="flex justify-center py-2">
          <div className={`w-48 h-48 rounded-full overflow-hidden border-[6px] transition-all duration-500 ${isSpeaking ? 'border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)] scale-105' : 'border-slate-800'}`}>
            <img 
              src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/200?text=Avatar'; }}
            />
          </div>
        </div>

        {/* 4. כפתור הפעלה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-lg shadow-xl active:scale-95 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}
        >
          {status === 'ready' ? <><Mic size={24}/> התחל שיחה</> : <><Square size={24}/> עצור</>}
        </button>

        {/* סטטוס מערכת */}
        <div className="mt-auto bg-black/40 p-2 rounded text-center text-[10px] font-mono text-indigo-400 uppercase tracking-tighter">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
