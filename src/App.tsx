import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // טעינת קולות הדפדפן בזמן אמת
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  // פונקציית דיבור עם בחירת קול נשי אקטיבית
  const speak = (text: string) => {
    window.speechSynthesis.cancel(); // עצירת דיבור קודם
    const msg = new SpeechSynthesisUtterance(text);
    
    // חיפוש קול נשי בעברית או אנגלית (עדיפות לגוגל)
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Hebrew') || v.name.includes('Female')) && v.lang.includes('he'))
                     || voices.find(v => v.name.includes('Female') || v.name.includes('Google'));

    if (femaleVoice) msg.voice = femaleVoice;
    msg.lang = targetLang;
    msg.pitch = 1.2; 
    msg.rate = 1.0;

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      // חזרה להקשבה רק אם השיחה עדיין פעילה
      if (status === "connected") {
        setTimeout(() => startListening(), 500);
      }
    };
    window.speechSynthesis.speak(msg);
  };

  // חיבור ישיר ל-Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ חסר מפתח API ב-Vercel");
      return;
    }

    try {
      setDebugLog("⚡ Gemini 2 מעבדת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const prompt = `You are a helpful female assistant. Module: ${activeModule}. Native: ${nativeLang}, Target: ${targetLang}. User said: "${userText}". Provide a short, natural spoken response.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      speak(aiText);
    } catch (e: any) {
      setDebugLog("❌ שגיאת תקשורת");
      console.error(e);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ הדפדפן לא תומך בזיהוי קולי");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: ${transcript}`);
      getAIResponse(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error", event.error);
      if (status === "connected" && event.error !== 'aborted') {
        recognition.stop();
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
      setDebugLog("מחוברת");
      speak("שלום, אני מחוברת. אני מוכנה לעזור לך בתרגום ולימוד שפות.");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("מנותק");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-6 overflow-hidden" dir="rtl">
      {/* הממשק מרוכז בצד ימין לפי התמונה */}
      <div className="w-full max-w-[340px] flex flex-col gap-6">
        
        {/* 1. שדות בחירת שפות (צמודים למעלה) */}
        <div className="flex gap-3">
          <div className="flex-1">
            <span className="text-[10px] text-slate-500 mb-1 block">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none">
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="en-US">English 🇺🇸</option>
              <option value="fr-FR">Français 🇫🇷</option>
            </select>
          </div>
          <div className="flex-1">
            <span className="text-[10px] text-slate-500 mb-1 block">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none">
              <option value="en-US">English 🇺🇸</option>
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="es-ES">Español 🇪🇸</option>
            </select>
          </div>
        </div>

        {/* 2. כפתורי מודול (2+2) */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setActiveModule("translation")} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeModule === 'translation' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-900 opacity-60'}`}>
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

        {/* 3. אווטאר האישה (עיגול עם מסגרת) */}
        <div className="flex justify-center items-center py-4">
          <div className={`w-52 h-52 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI Assistant" 
                className={`w-full h-full object-cover transition-transform ${isSpeaking ? 'scale-110' : 'scale-100'}`}
              />
            </div>
          </div>
        </div>

        {/* 4. כפתור התחל שיחה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl ${
            status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600'
          }`}
        >
          {status === 'ready' ? <><Mic size={26} /> התחל שיחה</> : <><Square size={26} /> הפסק שיחה</>}
        </button>

        {/* לוג סטטוס */}
        <div className="mt-auto bg-black/40 p-2 rounded-xl text-center text-[10px] font-mono text-indigo-400 uppercase tracking-tighter">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
