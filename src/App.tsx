
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- הגדרות ---
const API_KEY = import.meta.env.VITE_API_KEY;

// רשימת שפות
const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
  { code: 'ar-SA', name: 'Arabic', label: 'العربية 🇸🇦' },
];

// רשימת מודולים עם פרומפטים נוקשים למניעת חזרתיות
const MODULES = [
  { 
    id: 'translator', 
    name: 'Live Translator', 
    desc: 'מתרגם מדויק בלבד',
    getPrompt: (s:string, t:string) => `Task: Strictly translate the input from ${s} to ${t}. Rules: Output ONLY the translated text. Do NOT explain. Do NOT repeat the input. If untranslatable, output nothing.`
  },
  { 
    id: 'chat', 
    name: 'Conversation', 
    desc: 'שיחה טבעית קצרה',
    getPrompt: (s:string, t:string) => `You are a conversational partner. The user speaks ${s}. Reply naturally in ${t}. Keep responses short (1-2 sentences).`
  },
  { 
    id: 'tutor', 
    name: 'Language Tutor', 
    desc: 'תיקון ותירגול',
    getPrompt: (s:string, t:string) => `Act as a language teacher. User speaks ${s}. Reply in ${t}. Briefly correct any major grammatical errors in their input before replying.`
  },
  { 
    id: 'simultaneous', 
    name: 'Simultaneous', 
    desc: 'תרגום מהיר',
    getPrompt: (s:string, t:string) => `Mode: Simultaneous Interpretation. Translate input from ${s} to ${t} immediately and accurately. No extra text.`
  }
];

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [sourceLang, setSourceLang] = useState('he-IL');
  const [targetLang, setTargetLang] = useState('en-US');
  const [selectedModuleId, setSelectedModuleId] = useState('translator');
  const [error, setError] = useState<string | null>(null);
  // טקסט אחרון לדיבאג
  const [lastTranscript, setLastTranscript] = useState<{role:string, text:string} | null>(null);

  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  // --- אתחול ---
  useEffect(() => {
    // טעינת קולות לדפדפן
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- לוגיקת ליבה ---

  const stopSession = useCallback(() => {
    isSessionActiveRef.current = false;
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
  }, []);

  const startSession = useCallback(() => {
    if (!API_KEY) { setError("חסר מפתח API"); return; }
    setError(null);
    isSessionActiveRef.current = true;
    setIsActive(true);
    startListening();
  }, []);

  const startListening = () => {
    if (!isSessionActiveRef.current) return;
    
    // וידוא שהרמקול שקט לפני הקשבה
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("דפדפן לא נתמך"); return; }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang; // שימוש בשפת המקור הנבחרת
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        if(isSessionActiveRef.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      setAppState("processing");
      setLastTranscript({ role: 'user', text });
      await processWithAI(text);
    };

    recognition.onend = () => {
        // אם המיקרופון נסגר (שקט) אבל עדיין במצב הקשבה, נחדש אותו
        if (isSessionActiveRef.current && appState === 'listening') {
            try { recognition.start(); } catch(e){}
        }
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
            setError("אין גישה למיקרופון");
            stopSession();
        } else if (isSessionActiveRef.current && event.error !== 'aborted') {
            // ניסיון התאוששות משגיאות רשת/זיהוי
            setTimeout(startListening, 500);
        }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {}
  };

  const processWithAI = async (text: string) => {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLang)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLang)?.name;
      const module = MODULES.find(m => m.id === selectedModuleId);

      // שימוש בפרומפט הנוקשה
      const prompt = `${module?.getPrompt(srcName||'English', trgName||'English')}\n\nInput Text: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      if (!responseText.trim()) {
          // אם ה-AI החזיר תשובה ריקה, חזור להקשיב
          if (isSessionActiveRef.current) startListening();
          return;
      }

      setLastTranscript({ role: 'ai', text: responseText });
      speakResponse(responseText);

    } catch (e: any) {
      console.error(e);
      setError("שגיאת AI, מנסה שוב...");
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;

    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang; // שימוש בשפת היעד הנבחרת
    
    // ניסיון למצוא קול טבעי יותר אם קיים
    const voices = window.speechSynthesis.getVoices();
    const targetPrefix = targetLang.split('-')[0];
    const preferredVoice = voices.find(v => v.lang.startsWith(targetPrefix) && v.name.includes('Google')) || voices.find(v => v.lang.startsWith(targetPrefix));
    if (preferredVoice) utterance.voice = preferredVoice;

    // === סגירת הלולאה ===
    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        startListening(); // חזרה מיידית להקשבה
      }
    };
    
    utterance.onerror = () => {
        // במקרה של שגיאת דיבור, לא להיתקע
        if (isSessionActiveRef.current) startListening();
    };

    window.speechSynthesis.speak(utterance);
  };


  // --- UI ---
  const selectedModuleData = MODULES.find(m => m.id === selectedModuleId);

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row overflow-hidden font-sans" dir="ltr">
      
      {/* Sidebar (סרגל צד שמאל) - העיצוב המקורי */}
      <aside className="w-full md:w-80 h-full bg-[#0f172a] border-r border-white/5 p-6 flex flex-col gap-6 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-500/20">L</div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">LINGOLIVE PRO</h1>
        </div>

        {/* פאנל הגדרות */}
        <div className="bg-slate-800/40 p-5 rounded-2xl border border-white/5 space-y-5">
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Input Language (Mic)</label>
             <select 
                value={sourceLang} 
                onChange={e => setSourceLang(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 transition-colors disabled:opacity-50 outline-none appearance-none font-bold"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>
          
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Output Language (AI)</label>
             <select 
                value={targetLang} 
                onChange={e => setTargetLang(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 transition-colors disabled:opacity-50 outline-none appearance-none font-bold"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Module</label>
             <div className="grid grid-cols-2 gap-2">
                {MODULES.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setSelectedModuleId(m.id)}
                        disabled={isActive}
                        className={`p-3 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 h-20 ${selectedModuleId === m.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'} disabled:opacity-50`}
                    >
                        <span className="text-[10px] uppercase">{m.name}</span>
                    </button>
                ))}
             </div>
          </div>
        </div>

        {/* אזור סטטוס טקסטואלי קטן */}
        {lastTranscript && (
            <div className="mt-auto bg-slate-900/50 p-3 rounded-xl border border-white/5 text-[10px]">
                <span className="block font-bold uppercase opacity-50 mb-1">{lastTranscript.role}</span>
                <p className="line-clamp-3 text-slate-300">{lastTranscript.text}</p>
            </div>
        )}
      </aside>

      {/* Main Screen (מסך מרכזי) */}
      <main className="flex-1 h-full flex flex-col relative items-center justify-center p-8 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e293b]">
        
        {/* אינדיקטור חיבור עליון */}
        <div className="absolute top-8 right-8 flex items-center gap-3 bg-slate-900/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-xl">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            {isActive ? 'LIVE SESSION' : 'OFFLINE'}
          </span>
        </div>

        {/* אזור האווטאר והסטטוס */}
        <div className="flex flex-col items-center justify-center gap-12 z-10 -mt-20">
          
          {/* האווטאר המעוצב */}
          <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500 border-[6px] ${
               appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_100px_rgba(99,102,241,0.4)] scale-105' : 
               appState === 'listening' ? 'border-green-500 shadow-[0_0_80px_rgba(34,197,94,0.3)]' : 
               appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-slate-800'
          } bg-slate-900/80 backdrop-blur-sm`}>
               
               {appState === 'speaking' ? (
                  <div className="flex gap-1.5 h-16 items-center">
                     <div className="w-2.5 h-full bg-indigo-400 rounded-full animate-[bounce_1s_infinite]"></div>
                     <div className="w-2.5 h-2/3 bg-indigo-500 rounded-full animate-[bounce_1.2s_infinite]"></div>
                     <div className="w-2.5 h-full bg-indigo-400 rounded-full animate-[bounce_0.8s_infinite]"></div>
                  </div>
               ) : appState === 'listening' ? (
                  <div className="w-20 h-20 rounded-full bg-green-500 animate-ping opacity-75"></div>
               ) : (
                  <span className="text-7xl font-black text-white/10 select-none">AI</span>
               )}
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tight drop-shadow-2xl transition-all duration-300">
               {appState === 'listening' && "Listening..."}
               {appState === 'processing' && "Translating..."}
               {appState === 'speaking' && "Speaking..."}
               {appState === 'idle' && "Ready to Start?"}
            </h2>
            
            <div className="inline-flex items-center justify-center gap-3 text-slate-300 text-sm bg-slate-900/40 px-6 py-2 rounded-full border border-white/5 font-bold tracking-wide uppercase">
               <span>{MODULES.find(m=>m.id===selectedModuleId)?.name} MODE</span>
            </div>
          </div>
        </div>

        {/* כפתור שליטה ראשי תחתון */}
        <div className="absolute bottom-12 w-full max-w-md px-6 z-20">
           {error && (
             <div className="text-red-300 text-xs font-bold text-center mb-6 bg-red-500/10 p-3 rounded-xl border border-red-500/20 animate-pulse">
               ⚠️ {error}
             </div>
           )}
           
           {!isActive ? (
             <button 
               onClick={startSession} 
               className="group w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-6 rounded-[2rem] font-black text-2xl shadow-[0_20px_50px_-10px_rgba(79,70,229,0.4)] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-indigo-400/20 relative overflow-hidden"
             >
               <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
               START CONVERSATION
             </button>
           ) : (
             <button 
               onClick={stopSession} 
               className="group w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white py-6 rounded-[2rem] font-black text-2xl shadow-[0_20px_50px_-10px_rgba(220,38,38,0.4)] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-red-400/20 relative overflow-hidden"
             >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
               STOP SESSION
             </button>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
