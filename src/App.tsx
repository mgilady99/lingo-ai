import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, AlertTriangle } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה - לחץ על התחל");
  
  // בדיקה קריטית של מפתח ה-API
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

  // פונקציית הקול הנשי (TTS)
  const speak = (text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // ניסיון אגרסיבי למצוא קול נשי
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Female')) && v.lang.includes('he')) 
                     || voices.find(v => v.name.includes('Female'))
                     || voices[0];

    msg.voice = femaleVoice;
    msg.pitch = 1.4; // טון גבוה לנשיות
    msg.lang = targetLang;
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  // החיבור ל-AI - Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ תקלה חמורה: מפתח ה-API חסר ב-Vercel!");
      return;
    }

    try {
      setDebugLog("⏳ שולחת ל-Gemini...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `System: Role as female Swedish assistant. Module: ${activeModule}. Task: Respond in ${targetLang}. User: ${userText}` }] }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`❌ שגיאת גוגל: ${data.error.message}`);
        return;
      }

      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ AI ענתה - משמיעה קול");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ תקלת תקשורת (Network/CORS)");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ הדפדפן חוסם מיקרופון");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.onstart = () => setDebugLog("🎤 מקשיבה...");
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: "${transcript}"`);
      getAIResponse(transcript);
    };
    recognition.onerror = (e: any) => {
      setDebugLog(`❌ שגיאת הקלטה: ${e.error}`);
      if (status === "connected") setTimeout(startListening, 1000);
    };
    recognition.start();
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        // בקשת הרשאה אקטיבית
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מתחברת...");
        speak("שלום, אני מחוברת. איך אני יכולה לעזור?");
      } catch (err) {
        setDebugLog("❌ חייב לאשר מיקרופון בדפדפן!");
      }
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      setDebugLog("מערכת נעצרה");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex p-4 overflow-hidden font-sans rtl" dir="rtl">
      {/* ריכוז כל הממשק בצד שמאל */}
      <div className="w-full max-w-[320px] flex flex-col gap-4">
        
        {/* 1. שדות שפה למעלה */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-sm outline-none cursor-pointer">
              {languages.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>)}
            </select>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-sm outline-none cursor-pointer">
              {languages.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* 2. מודולים 2X2 */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'translation', name: 'תרגום שיחה', icon: <Mic size={18}/> },
            { id: 'simultaneous', name: 'סימולטני', icon: <Headphones size={18}/> },
            { id: 'chat', name: 'צ\'אט', icon: <MessageSquare size={18}/> },
            { id: 'learning', name: 'לימוד', icon: <GraduationCap size={18}/> }
          ].map(m => (
            <button key={m.id} onClick={()=>setActiveModule(m.id)} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${activeModule === m.id ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900'}`}>
              {m.icon} {m.name}
            </button>
          ))}
        </div>

        {/* 3. אווטאר האישה השוודית */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-60 h-60 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור הפעלה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* תיבת אבחון (חיוני עבורך!) */}
        <div className="bg-black/60 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-400 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
