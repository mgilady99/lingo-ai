import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';
import { audioService } from '../services/audioService';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("LINGO-AI PRO מוכנה");
  
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);

  // פונקציה לניהול השיחה הרציפה
  const handleSpeakAndListen = async (text: string) => {
    setIsSpeaking(true);
    setDebugLog("🔊 AI עונה...");
    
    // ממתינים עד שהדיבור יסתיים לחלוטין לפני שפותחים מיקרופון
    await audioService.speak(text, targetLang);
    
    setIsSpeaking(false);
    
    // אם המשתמש לא לחץ על "הפסק", פותחים שוב את המיקרופון באופן אוטומטי
    if (status === "connected") {
      setDebugLog("🎤 ממתינה לך...");
      startListening();
    }
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⏳ מעבדת תשובה...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a female AI partner for LINGO-AI. Keep the conversation flowing. Respond naturally and concisely in English. User input: ${userText}` }] }]
        })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      handleSpeakAndListen(aiText);
    } catch (e: any) {
      setDebugLog(`❌ שגיאה: ${e.message}`);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // אם יש הקלטה פעילה, עוצרים אותה לפני שמתחילים חדשה
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 אמרת: "${transcript}"`);
      getAIResponse(transcript);
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' && status === "connected") {
        // אם לא נשמע דיבור, מנסים להקשיב שוב
        setTimeout(startListening, 500);
      } else {
        setDebugLog(`🎤 מיקרופון: ${e.error}`);
      }
    };

    // אם המערכת הופסקה על ידי המשתמש בזמן הדיבור, לא נפתח את המיקרופון
    recognition.onend = () => {
      if (status === "connected" && !isSpeaking && !debugLog.includes("אמרת")) {
        startListening();
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מתחברת...");
        await handleSpeakAndListen("I'm ready. Let's talk.");
      } catch (err) {
        setDebugLog("❌ חובה לאשר מיקרופון");
      }
    } else {
      setStatus("ready");
      setDebugLog("המערכת הופסקה");
      audioService.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.location.reload(); // ריענון נקי כדי לסגור את כל ערוצי ההקלטה
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex justify-center p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[340px] flex flex-col gap-4">
        
        <div className="text-center font-black text-xl text-indigo-500 uppercase py-2">LINGO-AI PRO</div>

        {/* API STATUS */}
        <div className="bg-green-900/20 text-green-400 text-[10px] text-center p-1 rounded border border-green-500/20">
          ● API KEY LOADED
        </div>

        {/* שפות */}
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

        {/* מודולים */}
        <div className="grid grid-cols-2 gap-2">
          {['תרגום שיחה', 'סימולטני', 'צ\'אט', 'לימוד'].map((m, i) => (
            <div key={i} className={`p-4 rounded-2xl flex flex-col items-center gap-1 text-[11px] font-bold ${i===0 ? 'bg-indigo-600' : 'bg-slate-900 opacity-60'}`}>
              {m}
            </div>
          ))}
        </div>

        {/* אווטאר */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-60 h-60 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.5)] scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#020617]">
              <img src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button onClick={toggleSession} className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}>
          {status === 'ready' ? "התחל שיחה" : "הפסק שיחה"}
        </button>

        {/* לוג דיבאג */}
        <div className="bg-black/40 p-3 rounded-lg text-[10px] font-mono text-indigo-300 border border-slate-800 min-h-[50px]">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
