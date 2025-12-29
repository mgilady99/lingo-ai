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

  // לולאת התגובה: AI מדברת -> מסיימת -> המיקרופון נפתח
  const handleAISequence = async (text: string) => {
    // 1. מפסיקים להקשיב בזמן שה-AI מדברת כדי שלא תשמע את עצמה
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    setIsSpeaking(true);
    setDebugLog("🔊 AI עונה...");
    
    // 2. השמעת התשובה (ממתינים לסיום)
    await audioService.speak(text, targetLang);
    
    setIsSpeaking(false);
    
    // 3. רק אחרי שהיא סיימה - פותחים מיקרופון שוב
    if (status === "connected") {
      setDebugLog("🎤 אני מקשיבה לך...");
      // השהייה קטנה למניעת שגיאת "Channel Closed"
      setTimeout(() => startListening(), 300);
    }
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⏳ מעבדת...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a helpful blonde female AI partner. Keep the conversation flowing like a human. Respond naturally and concisely in English. User input: ${userText}` }] }]
        })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      handleAISequence(aiText);
    } catch (e: any) {
      setDebugLog(`❌ שגיאה: ${e.message}`);
      if (status === "connected") setTimeout(startListening, 1000);
    }
  };

  const startListening = () => {
    if (status !== "connected") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
      console.error("Mic error:", e.error);
      if (e.error === 'no-speech' && status === "connected") {
        // אם לא שמעתי כלום, נסה שוב בשקט
        setTimeout(() => startListening(), 500);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start mic:", e);
    }
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מתחברת...");
        // משפט פתיחה שמפעיל את הלולאה
        handleAISequence("Hello! I'm Lingo-AI. I'm ready to talk, what's on your mind?");
      } catch (err) {
        setDebugLog("❌ המיקרופון חסום");
      }
    } else {
      setStatus("ready");
      setDebugLog("המערכת הופסקה");
      audioService.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex justify-center p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[340px] flex flex-col gap-4">
        
        <div className="text-center font-black text-xl text-indigo-500 uppercase py-2">LINGO-AI PRO</div>

        {/* API STATUS */}
        <div className="bg-green-900/20 text-green-400 text-[10px] text-center p-1 rounded border border-green-500/20">
          ● API CONNECTION ACTIVE
        </div>

        {/* שפות */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1 font-bold">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-[10px] text-slate-500 block mb-1 font-bold">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* מודולים 2X2 */}
        <div className="grid grid-cols-2 gap-2">
          {['תרגום שיחה', 'סימולטני', 'צ\'אט חי', 'לימוד שפה'].map((m, i) => (
            <div key={i} className={`p-4 rounded-2xl flex flex-col items-center gap-1 text-[11px] font-black transition-all ${i===2 ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
              {m}
            </div>
          ))}
        </div>

        {/* אווטאר עם אפקט דיבור */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-60 h-60 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.6)] scale-105' : 'bg-slate-800 shadow-inner'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#020617]">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                className="w-full h-full object-cover"
                alt="AI Partner"
              />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button onClick={toggleSession} className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600 hover:bg-red-500'}`}>
          {status === 'ready' ? "התחל שיחה" : "הפסק שיחה"}
        </button>

        {/* לוג דיאגנוסטיקה */}
        <div className="bg-black/40 p-3 rounded-lg text-[10px] font-mono text-indigo-300 border border-slate-800 min-h-[50px]">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
