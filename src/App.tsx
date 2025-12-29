import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, Volume2 } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה - לחץ START");
  
  // משיכת המפתח מ-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);

  // פונקציית דיבור משופרת - קול נשי
  const speak = (text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // חיפוש קול נשי (עברית או אנגלית)
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Female')) && v.lang.includes('he')) 
                     || voices.find(v => v.name.includes('Female'))
                     || voices[0];

    msg.voice = femaleVoice;
    msg.pitch = 1.3; // טון נשי
    msg.lang = targetLang;
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
      setDebugLog("❌ שגיאה: מפתח API חסר ב-Vercel");
      return;
    }

    try {
      setDebugLog("⚡ שולחת ל-Gemini...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Role: Female Assistant. Module: ${activeModule}. Response Language: ${targetLang}. User input: ${userText}` }] }]
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
      setDebugLog("❌ תקלת תקשורת");
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
    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') setDebugLog(`❌ שגיאה: ${e.error}`);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        // בקשת הרשאה והפעלת אודיו
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מתחברת...");
        speak("אני מחוברת ומוכנה לעזור.");
      } catch (err) {
        setDebugLog("❌ חובה לאשר מיקרופון");
      }
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("נעצר");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[320px] flex flex-col gap-4">
        
        {/* 1. שדות שפה למעלה */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <label className="text-[10px] text-slate-500 block mb-1">שפת אם</label>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <label className="text-[10px] text-slate-500 block mb-1">שפת תרגום</label>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* 2. מודולים 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === 'translation' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <Mic size={18} /> תרגום שיחה
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

        {/* 3. אווטאר אשה שוודית */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-56 h-56 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור התחל שיחה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* לוג סטטוס תחתון */}
        <div className="bg-black/40 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-400 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
