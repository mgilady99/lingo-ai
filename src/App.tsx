import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, Languages } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // הגדרת קול נשי של גוגל
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // חיפוש קול נשי בעברית או אנגלית
    const femaleVoice = voices.find(v => (v.name.includes('Female') || v.name.includes('Google')) && v.lang.includes('he')) 
                     || voices.find(v => v.name.includes('Female'));
    
    if (femaleVoice) msg.voice = femaleVoice;
    msg.lang = targetLang;
    msg.pitch = 1.2;
    msg.rate = 1.0;

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  // חיבור ישיר ל-Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⚡ Gemini 2.0 מעבדת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      let prompt = `System: You are a professional female language assistant. Module: ${activeModule}. Native: ${nativeLang}, Target: ${targetLang}. User says: ${userText}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת API");
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
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מחוברת. איך אני יכולה לעזור?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("מנותק");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-6 overflow-hidden" dir="rtl">
      {/* הממשק מרוכז בצד ימין כפי שביקשת (או שמאל, תלוי בכיוון המסך) */}
      <div className="w-full max-w-[320px] flex flex-col gap-6">
        
        {/* 1. שדות בחירת שפות (שורה אחת) */}
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-[10px] text-slate-500 mb-1 block">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none appearance-none">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
              <option value="fr-FR">Français</option>
            </select>
          </div>
          <div className="flex-1">
            <span className="text-[10px] text-slate-500 mb-1 block">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none appearance-none">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
        </div>

        {/* 2. כפתורי מודול (2+2) */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setActiveModule("translation")} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeModule === 'translation' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <Mic size={20} /> תרגום שיחה
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeModule === 'simultaneous' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <Headphones size={20} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeModule === 'chat' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <MessageSquare size={20} /> צ'אט שיחה
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeModule === 'learning' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
            <GraduationCap size={20} /> לימוד שפה
          </button>
        </div>

        {/* 3. אווטאר האישה השוודית (במרכז) */}
        <div className="flex justify-center items-center my-4">
          <div className={`w-56 h-56 rounded-full p-1 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.5)]' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור התחל/הפסק (בתחתית) */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
            status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק שיחה</>}
        </button>

        {/* לוג תחתון */}
        <div className="mt-auto text-[10px] text-center text-indigo-400 font-mono tracking-widest uppercase opacity-70">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
