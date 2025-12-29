import React, { useState, useRef, useEffect } from 'react';
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

  // רשימת 13 שפות לבחירה
  const languages = [
    { code: "he-IL", name: "עברית" },
    { code: "en-US", name: "English" },
    { code: "fr-FR", name: "Français" },
    { code: "es-ES", name: "Español" },
    { code: "de-DE", name: "Deutsch" },
    { code: "it-IT", name: "Italiano" },
    { code: "ru-RU", name: "Русский" },
    { code: "ar-SA", name: "العربية" },
    { code: "zh-CN", name: "中文" },
    { code: "ja-JP", name: "日本語" },
    { code: "pt-PT", name: "Português" },
    { code: "hi-IN", name: "हिन्दी" },
    { code: "tr-TR", name: "Türkçe" }
  ];

  // פונקציית דיבור (TTS) - אופטימיזציה לקול נשי
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // חיפוש קול נשי
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Hebrew')) && v.lang.includes('he'))
                     || voices.find(v => v.name.includes('Female'));
    
    if (femaleVoice) msg.voice = femaleVoice;
    msg.lang = targetLang.includes('he') ? 'he-IL' : targetLang;
    msg.pitch = 1.2;
    msg.rate = 1.0;

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    
    window.speechSynthesis.speak(msg);
  };

  // שליחה ל-Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ חסר מפתח API ב-Vercel");
      return;
    }

    try {
      setDebugLog("⚡ AI מעבדת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const prompt = `You are a helpful young female language assistant. 
      Module: ${activeModule}. User's Native: ${nativeLang}. User's Target: ${targetLang}. 
      Task: Translate/Answer naturally in the target language.
      User said: "${userText}"`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ AI עונה");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת חיבור לבינה מלאכותית");
      console.error(e);
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
    
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      setDebugLog("מתחברת...");
      // קול פתיחה כדי לאשר אודיו בדפדפן
      speak("שלום, אני מחוברת ומוכנה לעזור.");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("מנותק");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-center p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[340px] flex flex-col gap-4 pt-4">
        
        {/* 1. שדות שפה למעלה (גודל קומפקטי) */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 block mb-1">שפת אם</label>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none">
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 block mb-1">שפת תרגום</label>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none">
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* 2. מודולים 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === 'translation' ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
            <Mic size={18} /> תרגום שיחה
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === 'simultaneous' ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
            <Headphones size={18} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === 'chat' ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
            <MessageSquare size={18} /> צ'אט שיחה
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === 'learning' ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
            <GraduationCap size={18} /> לימוד שפה
          </button>
        </div>

        {/* 3. אווטאר אשה בתוך עיגול מעוצב */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-56 h-56 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className={`w-full h-full object-cover transition-transform ${isSpeaking ? 'scale-110' : 'scale-100'}`}
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור התחל/הפסק בתחתית */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-2xl transition-transform active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק שיחה</>}
        </button>

        {/* לוג סטטוס קטן */}
        <div className="text-[10px] text-center text-indigo-400 font-mono opacity-60 mb-2">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
