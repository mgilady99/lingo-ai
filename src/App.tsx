import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה - לחץ על התחל");
  
  // משיכת המפתח - וודא שהוא מוגדר ב-Vercel תחת VITE_API_KEY
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // 1. פתרון לבעיית השמע: טעינת קולות מוקדמת
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => synth.getVoices();
    synth.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const speak = (text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel(); // עצירת דיבור קודם
    
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // חיפוש קול נשי בעברית או אנגלית
    const femaleVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Hebrew') || v.name.includes('Female')) && v.lang.includes('he'))
                     || voices.find(v => v.name.includes('Female') || v.name.includes('Google'));

    if (femaleVoice) msg.voice = femaleVoice;
    msg.lang = targetLang;
    msg.pitch = 1.2;
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") {
        setDebugLog("🎤 מקשיבה שוב...");
        setTimeout(() => startListening(), 400);
      }
    };
    
    window.speechSynthesis.speak(msg);
  };

  // 2. חיבור חסין ל-Gemini 2.0 Flash
  const getAIResponse = async (userText: string) => {
    if (!apiKey || apiKey.length < 10) {
      setDebugLog("❌ שגיאה: מפתח ה-API לא הוגדר ב-Vercel!");
      return;
    }

    try {
      setDebugLog("⚡ ה-AI מעבדת את הבקשה...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Role: Female Assistant. Module: ${activeModule}. Task: Translate or chat naturally from ${nativeLang} to ${targetLang}. User input: "${userText}"` }] }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`❌ שגיאת API: ${data.error.message}`);
        return;
      }

      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה - משמיעה...");
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ תקלה בתקשורת עם שרת ה-AI");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugLog("❌ הדפדפן שלך לא תומך בהקלטה");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: "${transcript}"`);
      getAIResponse(transcript);
    };

    recognition.onerror = (err: any) => {
      if (err.error === 'no-speech') {
        if (status === "connected") startListening();
      } else {
        setDebugLog(`❌ שגיאת מיקרופון: ${err.error}`);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      setDebugLog("מתחברת...");
      // דיבור ראשוני "פותח" את חסימת האודיו של הדפדפן
      speak("שלום, אני מחוברת. אני מוכנה לעזור.");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("המערכת הופסקה");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[340px] flex flex-col gap-4 pt-2">
        
        {/* שדות שפה */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-slate-500 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block mb-1">שפת תרגום</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* מודולים */}
        <div className="grid grid-cols-2 gap-2">
          {['translation', 'simultaneous', 'chat', 'learning'].map((m) => (
            <button key={m} onClick={()=>setActiveModule(m)} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${activeModule === m ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
              {m === 'translation' && <Mic size={16}/>}
              {m === 'simultaneous' && <Headphones size={16}/>}
              {m === 'chat' && <MessageSquare size={16}/>}
              {m === 'learning' && <GraduationCap size={16}/>}
              {m === 'translation' ? 'תרגום שיחה' : m === 'simultaneous' ? 'סימולטני' : m === 'chat' ? 'צ\'אט' : 'לימוד'}
            </button>
          ))}
        </div>

        {/* אווטאר */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-52 h-52 rounded-full p-1 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="AI" 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/200?text=AI")}
              />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600 animate-pulse'}`}
        >
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* לוג הדיבאג - כאן תראה מה הבעיה */}
        <div className="bg-black/50 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-300 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
