import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, Settings, Globe, StopCircle, PlayCircle } from 'lucide-react';

// --- הגדרות (ללא תלות בקבצים חיצוניים) ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

// רשימת 13 השפות
const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 עברית' },
  { code: 'en-US', name: 'English', label: '🇺🇸 English' },
  { code: 'es-ES', name: 'Spanish', label: '🇪🇸 Español' },
  { code: 'fr-FR', name: 'French', label: '🇫🇷 Français' },
  { code: 'ru-RU', name: 'Russian', label: '🇷🇺 Русский' },
  { code: 'ar-SA', name: 'Arabic', label: '🇸🇦 العربية' },
  { code: 'de-DE', name: 'German', label: '🇩🇪 Deutsch' },
  { code: 'it-IT', name: 'Italian', label: '🇮🇹 Italiano' },
  { code: 'pt-BR', name: 'Portuguese', label: '🇧🇷 Português' },
  { code: 'zh-CN', name: 'Chinese', label: '🇨🇳 中文' },
  { code: 'ja-JP', name: 'Japanese', label: '🇯🇵 日本語' },
  { code: 'ko-KR', name: 'Korean', label: '🇰🇷 한국어' },
  { code: 'hi-IN', name: 'Hindi', label: '🇮🇳 हिन्दी' },
];

// רכיב אווטאר פנימי (כמו בתמונה, ללא תלות חיצונית)
const Avatar = ({ state }: { state: string }) => {
  let color = 'bg-slate-800 border-slate-700';
  let glow = '';
  
  if (state === 'listening') {
    color = 'bg-green-600 border-green-400';
    glow = 'shadow-[0_0_50px_rgba(34,197,94,0.6)]';
  } else if (state === 'speaking') {
    color = 'bg-indigo-600 border-indigo-400';
    glow = 'shadow-[0_0_60px_rgba(99,102,241,0.7)]';
  } else if (state === 'processing') {
    color = 'bg-amber-600 animate-pulse border-amber-400';
  }

  return (
    <div className={`relative w-56 h-56 rounded-full flex items-center justify-center transition-all duration-500 border-[6px] ${color} ${glow}`}>
      <div className="absolute inset-2 rounded-full border-2 border-white/20"></div>
      
      {state === 'speaking' ? (
         <div className="flex gap-1.5 h-14 items-center">
            <div className="w-2.5 h-full bg-white rounded-full animate-[bounce_1s_infinite]"></div>
            <div className="w-2.5 h-2/3 bg-white rounded-full animate-[bounce_1.2s_infinite]"></div>
            <div className="w-2.5 h-full bg-white rounded-full animate-[bounce_0.8s_infinite]"></div>
         </div>
      ) : state === 'listening' ? (
         <Mic size={70} className="text-white animate-pulse" />
      ) : state === 'processing' ? (
         <Globe size={70} className="text-white animate-spin-slow" />
      ) : (
         <span className="text-7xl font-black text-white/30 select-none">AI</span>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('it-IT'); // ברירת מחדל: איטלקית
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  // --- אתחול ---
  useEffect(() => {
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

  const startListening = useCallback(() => {
    if (!isSessionActiveRef.current) return;
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("דפדפן לא נתמך. השתמש ב-Chrome"); return; }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SpeechRecognition();
    recognition.lang = langA; // מקשיב לשפה הראשית
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        if(isSessionActiveRef.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      setAppState("processing");
      await processTranslation(text);
    };

    recognition.onend = () => {
        if (isSessionActiveRef.current && appState === 'listening') {
            try { recognition.start(); } catch(e){}
        }
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
            setError("אין גישה למיקרופון");
            stopSession();
        } else if (isSessionActiveRef.current && event.error !== 'aborted') {
            setTimeout(startListening, 500);
        }
    };

    try { recognition.start(); recognitionRef.current = recognition; } catch(e) {}
  }, [langA, appState]);

  // --- פונקציית התרגום (התיקון הקריטי) ---
  const processTranslation = async (text: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) { setError("חסר מפתח API ב-Vercel"); return; }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const nameA = LANGUAGES.find(l => l.code === langA)?.name || 'Unknown';
      const nameB = LANGUAGES.find(l => l.code === langB)?.name || 'Unknown';

      // --- הפרומפט המתוקן ---
      // משתמש בשמות השפות באופן מפורש וישיר
      const prompt = `
        Task: Translate the following text from ${nameA} to ${nameB}.
        Constraint 1: Output ONLY the translated text.
        Constraint 2: Do not add explanations or repeat the input.
        Input Text: "${text}"
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      if (!response) {
        if (isSessionActiveRef.current) startListening();
        return;
      }
      
      speakResponse(response);

    } catch (e: any) {
      console.error(e);
      setError("שגיאת AI. מנסה שוב...");
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;
    setAppState("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    // תמיד משמיע בשפת היעד
    utterance.lang = langB;

    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        startListening();
      }
    };
    
    utterance.onerror = () => {
        if (isSessionActiveRef.current) startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) {
      stopSession();
    } else {
      isSessionActiveRef.current = true;
      setIsActive(true);
      startListening();
    }
  };

  // --- UI (עיצוב "ננו בננה" נקי) ---
  const langNameA = LANGUAGES.find(l=>l.code===langA)?.label;
  const langNameB = LANGUAGES.find(l=>l.code===langB)?.label;

  return (
    <div className="h-screen w-screen bg-[#0a0f1e] text-slate-100 flex flex-col items-center justify-center p-8 font-sans" dir="ltr">
      
      {/* כותרת עליונה */}
      <header className="absolute top-8 flex items-center gap-3 bg-[#141b2d] px-5 py-2.5 rounded-full border border-white/10 shadow-xl z-20">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white italic shadow-lg">L</div>
          <h1 className="text-lg font-black tracking-tight text-white">LINGOLIVE PRO</h1>
      </header>

      {/* סטטוס */}
      <div className="absolute top-8 right-8 flex items-center gap-3 bg-[#141b2d] px-4 py-2 rounded-full border border-white/10 shadow-xl z-20">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-500'}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            {isActive ? appState : 'READY'}
          </span>
      </div>

      {/* מרכז המסך - אווטאר ובחירת שפות */}
      <div className="flex flex-col items-center gap-10 z-10 -mt-10">
          
          {/* אווטאר */}
          <Avatar state={appState} />

          {/* טקסט סטטוס ראשי */}
          <div className="text-center h-16">
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight drop-shadow-2xl">
               {appState === 'listening' && "אני מקשיב..."}
               {appState === 'processing' && "מתרגם..."}
               {appState === 'speaking' && "מדבר..."}
               {appState === 'idle' && "מוכנים?"}
            </h2>
          </div>

          {/* בוררי שפות - גדולים וברורים */}
          <div className="flex items-center gap-4 bg-[#141b2d] p-3 rounded-3xl border border-white/10 shadow-2xl">
              
              <div className="relative">
                <select 
                    value={langA} 
                    onChange={e => setLangA(e.target.value)} 
                    disabled={isActive}
                    className="appearance-none bg-[#0a0f1e] border border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-lg font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50 hover:bg-[#1e293b]"
                >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <Globe size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="text-2xl text-indigo-500 animate-pulse">➔</div>

              <div className="relative">
                <select 
                    value={langB} 
                    onChange={e => setLangB(e.target.value)} 
                    disabled={isActive}
                    className="appearance-none bg-[#0a0f1e] border border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-lg font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50 hover:bg-[#1e293b]"
                >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <Globe size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

          </div>
      </div>

      {/* כפתור פעולה ראשי */}
      <div className="absolute bottom-14 w-full max-w-md px-6 z-20">
           {error && (
             <div className="flex items-center gap-3 text-red-300 text-sm font-bold justify-center mb-6 bg-red-900/30 p-4 rounded-xl border border-red-500/30 animate-pulse shadow-lg">
               <StopCircle size={18} /> {error}
             </div>
           )}
           
           <button 
             onClick={handleToggle} 
             className={`group w-full py-6 rounded-[3rem] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden ${
                isActive 
                ? 'bg-gradient-to-r from-red-600 to-pink-700 shadow-[0_20px_60px_-10px_rgba(220,38,38,0.6)] border border-red-400/30' 
                : 'bg-gradient-to-r from-indigo-600 to-violet-700 shadow-[0_20px_60px_-10px_rgba(79,70,229,0.6)] border border-indigo-400/30'
             }`}
           >
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             {isActive ? (
                <>
                    <LogOut size={32} /> עצור תרגום
                </>
             ) : (
                <>
                    <PlayCircle size={32} /> התחל תרגום
                </>
             )}
           </button>
      </div>

    </div>
  );
};

export default App;
