import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, Volume2 } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה - לחץ על התחל");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  const languages = [
    { code: "he-IL", name: "עברית" }, { code: "en-US", name: "English" },
    { code: "fr-FR", name: "Français" }, { code: "es-ES", name: "Español" },
    { code: "de-DE", name: "Deutsch" }, { code: "it-IT", name: "Italiano" },
    { code: "ru-RU", name: "Русский" }, { code: "ar-SA", name: "العربية" },
    { code: "zh-CN", name: "中文" }, { code: "ja-JP", name: "日本語" },
    { code: "pt-PT", name: "Português" }, { code: "hi-IN", name: "हिन्दी" },
    { code: "tr-TR", name: "Türkçe" }
  ];

  // פונקציית דיבור עם דגש על קול נשי
  const speak = (text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // מציאת קול נשי מתוך הרשימה הזמינה במחשב שלך
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.includes('Google עברית'))
    ) || voices.find(v => v.lang.includes('he')) || voices[0];

    msg.voice = femaleVoice;
    msg.lang = 'he-IL';
    msg.pitch = 1.4; // הגבהת הטון לקול נשי יותר
    msg.rate = 0.9;  // קצב דיבור נעים

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
      setDebugLog("❌ שגיאה: חסר API KEY ב-Vercel");
      return;
    }

    try {
      setDebugLog("⚡ AI חושבת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a young female assistant. Speak naturally in Hebrew. User: ${userText}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ AI עונה");
      speak(aiText);
    } catch (e: any) {
      setDebugLog(`❌ שגיאה: ${e.message}`);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ המיקרופון לא נתמך בדפדפן זה");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    
    recognition.onstart = () => setDebugLog("🎤 אני מקשיבה לך...");
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 אמרת: "${transcript}"`);
      getAIResponse(transcript);
    };

    recognition.onerror = (err: any) => {
      setDebugLog(`❌ שגיאת מיקרופון: ${err.error}`);
      if (err.error === 'not-allowed') {
        alert("אנא אשר את המיקרופון בסרגל הכתובות (סמל המנעול)");
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מחוברת. איך אוכל לעזור?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("המערכת נעצרה");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[340px] flex flex-col gap-4">
        
        {/* שדות שפה */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-sm outline-none">
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-sm outline-none">
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* מודולים */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'translation', name: 'תרגום שיחה', icon: <Mic size={16}/> },
            { id: 'simultaneous', name: 'סימולטני', icon: <Headphones size={16}/> },
            { id: 'chat', name: 'צ\'אט', icon: <MessageSquare size={16}/> },
            { id: 'learning', name: 'לימוד', icon: <GraduationCap size={16}/> }
          ].map(m => (
            <button key={m.id} onClick={()=>setActiveModule(m.id)} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === m.id ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
              {m.icon} {m.name}
            </button>
          ))}
        </div>

        {/* אווטאר אשה */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-52 h-52 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = "https://www.w3schools.com/howto/img_avatar2.png")}
              />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}
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
