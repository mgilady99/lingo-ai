import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, Settings, Globe, Loader2, Volume2 } from 'lucide-react';

/**
 * הגדרות קבועות ומודולים
 * הכל מוגדר כאן כדי למנוע תלויות חיצוניות
 */
const API_KEY = import.meta.env.VITE_API_KEY;

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
];

const MODULES = [
  { 
    id: 'translator', 
    name: 'Live Translator', 
    description: 'מתרגם סימולטני',
    // הנחיה מדויקת ל-Gemini להיות מתרגם בלבד
    getPrompt: (src: string, trg: string) => `You are a professional interpreter. Translate the input text from ${src} to ${trg}. Output ONLY the translated text, do not add explanations.` 
  },
  { 
    id: 'chat', 
    name: 'Conversation', 
    description: 'שיחה חופשית',
    // הנחיה לשיחה טבעית וקצרה
    getPrompt: (src: string, trg: string) => `You are a friendly conversation partner. The user speaks ${src}, please reply in ${trg}. Keep your answers short and engaging (1-2 sentences).` 
  },
  { 
    id: 'tutor', 
    name: 'Language Tutor', 
    description: 'תיקון שגיאות',
    // הנחיה למורה שמתקן שגיאות
    getPrompt: (src: string, trg: string) => `You are a language teacher. The user speaks ${src}. Reply in ${trg}. If the user made a grammar mistake, politely correct it before answering.` 
  }
];

/**
 * רכיב פנימי: Avatar
 * נבנה כאן כדי למנוע שגיאות טעינה מקבצים חיצוניים
 */
const InternalAvatar = ({ state }: { state: string }) => {
  // קביעת צבעים ואנימציות לפי המצב הנוכחי
  const getStyles = () => {
    switch (state) {
      case 'listening': return 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.4)] scale-105';
      case 'speaking': return 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.6)] scale-110';
      case 'processing': return 'border-yellow-500 animate-pulse';
      default: return 'border-slate-700 opacity-80';
    }
  };

  return (
    <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-700 border-4 bg-slate-900 ${getStyles()}`}>
      {state === 'speaking' ? (
        // אנימציית גלי קול בזמן דיבור
        <div className="flex gap-2 h-16 items-center">
          <div className="w-3 h-full bg-indigo-500 rounded-full animate-[bounce_1s_infinite]"></div>
          <div className="w-3 h-2/3 bg-indigo-400 rounded-full animate-[bounce_1.2s_infinite]"></div>
          <div className="w-3 h-full bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite]"></div>
          <div className="w-3 h-3/4 bg-indigo-400 rounded-full animate-[bounce_1.1s_infinite]"></div>
        </div>
      ) : state === 'listening' ? (
        <Mic size={64} className="text-green-500 animate-pulse" />
      ) : state === 'processing' ? (
        <Loader2 size={64} className="text-yellow-500 animate-spin" />
      ) : (
        <div className="text-center">
          <span className="text-4xl font-black text-slate-600 block">AI</span>
          <span className="text-xs text-slate-600 uppercase tracking-widest">Ready</span>
        </div>
      )}
    </div>
  );
};

/**
 * האפליקציה הראשית
 */
const App = () => {
  // --- ניהול מצבים (State Management) ---
  const [isActive, setIsActive] = useState(false); // האם הסשן פעיל כרגע?
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>("idle");
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- הגדרות משתמש ---
  const [sourceLang, setSourceLang] = useState('he-IL'); // שפת קלט (מיקרופון)
  const [targetLang, setTargetLang] = useState('en-US'); // שפת פלט (AI)
  const [selectedModule, setSelectedModule] = useState(MODULES[0]);

  // --- Refs (משתנים ששומרים ערך מבלי לגרום לרינדור מחדש) ---
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // משתנה קריטי למניעת לולאות אינסופיות או מצבי מרוץ
  const isSessionActiveRef = useRef(false);

  // גלילה אוטומטית לתחתית הצ'אט
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  // טעינת קולות הדפדפן בעת העלייה (חשוב לכרום)
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  /**
   * פונקציה לעצירה מוחלטת של הכל
   */
  const stopSession = useCallback(() => {
    setIsActive(false);
    isSessionActiveRef.current = false;
    setAppState("idle");
    
    // עצירת מיקרופון
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    // עצירת דיבור
    window.speechSynthesis.cancel();
  }, []);

  /**
   * התחלת הסשן
   */
  const startSession = async () => {
    if (!API_KEY) {
      setError("חסר מפתח API. בדוק את הגדרות Vercel.");
      return;
    }
    setError(null);
    setIsActive(true);
    isSessionActiveRef.current = true;
    
    // מתחילים את הלולאה
    startListening();
  };

  /**
   * שלב 1: הקשבה (Listening)
   */
  const startListening = () => {
    if (!isSessionActiveRef.current) return;

    // וודא שאין דיבור ברקע
    window.speechSynthesis.cancel();

    // בדיקת תמיכה בדפדפן
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("הדפדפן אינו תומך בזיהוי דיבור. אנא השתמש ב-Chrome.");
      return;
    }

    // איפוס מופע קודם אם קיים
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang; // הגדרת שפה דינמית
    recognition.continuous = false; // חשוב: עוצר לבד כשיש שקט
    recognition.interimResults = false;

    recognition.onstart = () => {
      if (isSessionActiveRef.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      // ברגע שיש טקסט - עוברים לעיבוד
      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text }]);
      
      // שליחה ל-AI
      await processWithAI(text);
    };

    recognition.onerror = (event: any) => {
      console.error("Mic Error:", event.error);
      if (event.error === 'not-allowed') {
        setError("אין גישה למיקרופון.");
        stopSession();
      } else if (isSessionActiveRef.current && event.error !== 'aborted') {
        // אם הייתה שגיאה רגעית (כמו שקט), נסה מחדש
        setTimeout(() => startListening(), 500);
      }
    };

    recognition.onend = () => {
      // המיקרופון נכבה. אם אנחנו עדיין במצב 'listening' ולא עברנו ל-'processing',
      // סימן שהיה שקט. נפעיל מחדש.
      // אם אנחנו ב-'processing', לא עושים כלום כי ה-AI עובד.
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {
      console.error(e);
    }
  };

  /**
   * שלב 2: עיבוד מול Gemini (Processing)
   */
  const processWithAI = async (text: string) => {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLang)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLang)?.name;

      // בניית הפרומפט המדויק
      const systemPrompt = selectedModule.getPrompt(srcName || '', trgName || '');
      const fullPrompt = `${systemPrompt}\nUser Input: "${text}"`;
      
      const result = await model.generateContent(fullPrompt);
      const responseText = result.response.text();

      setTranscript(prev => [...prev, { role: 'ai', text: responseText }]);
      
      // מעבר לשלב הדיבור
      speakResponse(responseText);

    } catch (e) {
      console.error(e);
      setError("שגיאת תקשורת עם ה-AI. מנסה שוב...");
      // במקרה שגיאה, חוזרים להקשיב
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  /**
   * שלב 3: דיבור (Speaking) + סגירת הלולאה
   */
  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;

    setAppState("speaking");
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang; // שפת היעד
    utterance.rate = 1.0;

    // ניסיון לשפר את הקול (לא חובה, אבל מוסיף)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (preferredVoice) utterance.voice = preferredVoice;

    // === הרגע הקריטי: סגירת הלולאה ===
    utterance.onend = () => {
      // רק כשהדיבור מסתיים באמת, אנחנו פותחים מחדש את המיקרופון
      if (isSessionActiveRef.current) {
        startListening();
      }
    };

    utterance.onerror = () => {
      // גם אם הדיבור נכשל, לא נתקעים
      if (isSessionActiveRef.current) startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- ה-UI של האפליקציה ---
  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row overflow-hidden" dir="ltr">
      
      {/* סרגל צד (Sidebar) */}
      <aside className="w-full md:w-80 h-full bg-[#0f172a] border-r border-white/5 p-5 flex flex-col gap-5 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg">L</div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">LINGOLIVE PRO</h1>
        </div>

        {/* פאנל הגדרות */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Settings size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Configuration</span>
          </div>

          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Input Language</label>
             <select 
                value={sourceLang} 
                onChange={e => setSourceLang(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 transition-colors disabled:opacity-50"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>
          
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Output Language</label>
             <select 
                value={targetLang} 
                onChange={e => setTargetLang(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 transition-colors disabled:opacity-50"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>

          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Mode</label>
             <select 
                value={selectedModule.id} 
                onChange={e => setSelectedModule(MODULES.find(m=>m.id===e.target.value)||MODULES[0])} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 transition-colors disabled:opacity-50"
             >
               {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>
          </div>
        </div>

        {/* היסטוריית צ'אט */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-800/20 rounded-xl border border-white/5 overflow-hidden">
           <div className="p-3 bg-slate-800/50 border-b border-white/5 flex items-center gap-2">
             <MessageSquare size={14} className="text-indigo-400"/>
             <span className="text-[10px] font-bold uppercase tracking-wider">Live Transcript</span>
           </div>
           <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
             {transcript.length === 0 && (
               <div className="text-center text-slate-600 text-xs mt-10">Start conversation to see transcript...</div>
             )}
             {transcript.map((t, i) => (
               <div key={i} className={`flex flex-col gap-1 p-3 rounded-xl text-xs max-w-[90%] ${t.role==='user'?'bg-indigo-600/20 border border-indigo-500/30 self-end ml-auto':'bg-slate-800 border border-slate-700 mr-auto'}`}>
                 <div className="flex justify-between opacity-50 text-[9px] font-bold uppercase">
                    <span>{t.role === 'user' ? 'You' : 'AI'}</span>
                 </div>
                 <p className="leading-relaxed">{t.text}</p>
               </div>
             ))}
           </div>
        </div>
      </aside>

      {/* מסך ראשי */}
      <main className="flex-1 h-full flex flex-col relative items-center justify-center p-6 bg-gradient-to-b from-[#020617] to-[#0f172a]">
        
        {/* סטטוס חיבור */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-xl">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            {isActive ? appState.toUpperCase() : 'OFFLINE'}
          </span>
        </div>

        {/* אזור האווטאר */}
        <div className="flex flex-col items-center gap-10 z-10 transform translate-y-[-20px]">
          <InternalAvatar state={appState} />

          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tight drop-shadow-2xl transition-all duration-300">
               {appState === 'listening' && "I'm Listening..."}
               {appState === 'processing' && "Thinking..."}
               {appState === 'speaking' && "Speaking..."}
               {appState === 'idle' && "Ready to Start?"}
            </h2>
            
            <div className="flex items-center justify-center gap-3 text-slate-400 text-sm bg-slate-900/60 px-5 py-2 rounded-full border border-white/10 shadow-lg">
               <Globe size={16} className="text-indigo-400" />
               <span className="font-medium tracking-wide">
                 {LANGUAGES.find(l=>l.code===sourceLang)?.name} ➔ {LANGUAGES.find(l=>l.code===targetLang)?.name}
               </span>
            </div>
            
            <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mt-2">
              {selectedModule.description} Mode
            </p>
          </div>
        </div>

        {/* כפתורי שליטה */}
        <div className="absolute bottom-12 w-full max-w-md px-6 z-20">
           {error && (
             <div className="flex items-center gap-2 text-red-300 text-xs font-bold justify-center mb-6 bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-pulse">
               <span className="w-2 h-2 bg-red-500 rounded-full"></span>
               {error}
             </div>
           )}
           
           {!isActive ? (
             <button 
               onClick={startSession} 
               className="group w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-3xl font-black text-xl shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-indigo-400/20"
             >
               <Mic size={28} className="group-hover:animate-bounce" /> 
               START CONVERSATION
             </button>
           ) : (
             <button 
               onClick={stopSession} 
               className="w-full bg-red-600 hover:bg-red-500 text-white py-6 rounded-3xl font-black text-xl shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-red-400/20"
             >
               <LogOut size={28} /> 
               STOP SESSION
             </button>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
