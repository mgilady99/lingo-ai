import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';
// תיקון נתיב הייבוא לפי מבנה העץ שלך: יוצאים מ-src לתיקיית services המקבילה
import { audioService } from '../services/audioService';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("LINGO-AI מוכנה");
  
  // משיכת המפתח שהגדרת ב-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);

  // פונקציה לניהול הדיבור דרך השירות החיצוני
  const handleSpeak = async (text: string) => {
    setIsSpeaking(true);
    setDebugLog("🔊 AI מדברת...");
    await audioService.speak(text, targetLang);
    setIsSpeaking(false);
    // חזרה להקשבה רק אם המערכת עדיין במצב פעיל
    if (status === "connected") {
      setDebugLog("🎤 מקשיבה שוב...");
      startListening();
    }
  };

  // שליחה ל-Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ שגיאה: מפתח API לא מזוהה");
      return;
    }

    try {
      setDebugLog("⏳ LINGO-AI מעבדת...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a female AI assistant for LINGO-AI. Respond naturally in ${targetLang}. User: ${userText}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      handleSpeak(aiText);
    } catch (e: any) {
      setDebugLog(`❌ שגיאה: ${e.message}`);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: "${transcript}"`);
      getAIResponse(transcript);
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') setDebugLog(`❌ מיקרופון: ${e.error}`);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        // בקשת הרשאה והפעלת המערכת
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מתחברת...");
        handleSpeak("שלום, אני מחוברת ומוכנה לעזור לך.");
      } catch (err) {
        setDebugLog("❌ חובה לאשר מיקרופון בדפדפן");
      }
    } else {
      setStatus("ready");
      audioService.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("המערכת נעצרה");
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex justify-end p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[320px] flex flex-col gap-4">
        
        {/* כותרת מותג */}
        <div className="text-center font-black text-xl tracking-tighter text-indigo-500 pt-2">
          LINGO-AI PRO
        </div>

        {/* שדות שפה קטנים */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-xs outline-none">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-xs outline-none">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* מודולים 2X2 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === 'translation' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <Mic size={18} /> תרגום
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === 'simultaneous' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <Headphones size={18} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === 'chat' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <MessageSquare size={18} /> צ'אט
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === 'learning' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <GraduationCap size={18} /> לימוד
          </button>
        </div>

        {/* אווטאר אשה בתוך העיגול */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-56 h-56 rounded-full p-1 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)] scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#020617]">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה גדול בתחתית */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* לוג סטטוס לדיבאג */}
        <div className="bg-black/40 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-400 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
