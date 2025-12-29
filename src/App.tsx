import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, AlertCircle } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה - לחץ על התחל");
  
  // משיכת המפתח עם בדיקה
  const apiKey = import.meta.env.VITE_API_KEY;

  const languages = [
    { code: "he-IL", name: "עברית" }, { code: "en-US", name: "English" },
    { code: "fr-FR", name: "Français" }, { code: "es-ES", name: "Español" },
    { code: "de-DE", name: "Deutsch" }, { code: "it-IT", name: "Italiano" },
    { code: "ru-RU", name: "Русский" }, { code: "ar-SA", name: "العربية" },
    { code: "zh-CN", name: "中文" }, { code: "ja-JP", name: "日本語" },
    { code: "pt-PT", name: "Português" }, { code: "hi-IN", name: "हिन्दी" },
    { code: "tr-TR", name: "Türkçe" }
  ];

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    // בחירת קול נשי
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Female')) && v.lang.includes('he')) || voices[0];
    msg.voice = femaleVoice;
    msg.pitch = 1.2;
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ שגיאה: מפתח ה-API (VITE_API_KEY) לא נמצא! בדוק ב-Vercel.");
      return;
    }

    try {
      setDebugLog("⚡ שולח ל-Gemini 2.0...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a female voice assistant. Module: ${activeModule}. User language: ${nativeLang}. Translate/Answer: ${userText}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) {
        setDebugLog(`❌ שגיאת API: ${data.error.message}`);
        return;
      }

      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת רשת - בדוק חיבור אינטרנט");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.onstart = () => setDebugLog("🎤 מקשיבה...");
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: "${transcript}"`);
      getAIResponse(transcript);
    };
    recognition.onerror = (err: any) => setDebugLog(`❌ שגיאת מיקרופון: ${err.error}`);
    recognition.start();
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("אני מחוברת ומוכנה.");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      setDebugLog("נעצר");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-center p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[350px] flex flex-col gap-4">
        
        {/* 1. שדות שפה למעלה */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-sm outline-none cursor-pointer">
              {languages.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>)}
            </select>
          </div>
          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block mb-1">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-sm outline-none cursor-pointer">
              {languages.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* 2. מודולים 2X2 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${activeModule === 'translation' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900'}`}>
            <Mic size={18} /> תרגום שיחה
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${activeModule === 'simultaneous' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900'}`}>
            <Headphones size={18} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${activeModule === 'chat' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900'}`}>
            <MessageSquare size={18} /> צ'אט
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${activeModule === 'learning' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900'}`}>
            <GraduationCap size={18} /> לימוד
          </button>
        </div>

        {/* 3. אווטאר אשה בתוך העיגול */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-60 h-60 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI" 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = "https://www.w3schools.com/howto/img_avatar2.png")}
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור הפעלה בתחתית */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* לוג הדיבאג - קריטי לבדיקה שלך */}
        <div className="bg-black/40 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-300 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
