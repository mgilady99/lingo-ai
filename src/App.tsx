
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, Globe, StopCircle, PlayCircle, ArrowRightLeft, ChevronDown } from 'lucide-react';

// --- הגדרות (ללא תלות בקבצים חיצוניים) ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

// רשימת 13 השפות עם דגלים
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

// רכיב אווטאר מרכזי וגדול
const BigAvatar = ({ state }: { state: string }) => {
  let wrapperClass = 'border-slate-800 bg-slate-900';
  let innerClass = 'opacity-20';
  
  if (state === 'listening') {
    wrapperClass = 'border-green-500 shadow-[0_0_80px_rgba(34,197,94,0.4)] bg-green-950/30 animate-pulse-slow';
    innerClass = 'text-green-400 opacity-100 animate-bounce-slight';
  } else if (state === 'speaking') {
    wrapperClass = 'border-indigo-500 shadow-[0_0_100px_rgba(99,102,241,0.5)] bg-indigo-950/30 scale-105 transition-transform duration-500';
    innerClass = 'text-indigo-400 opacity-100';
  } else if (state === 'processing') {
    wrapperClass = 'border-amber-500 animate-pulse bg-amber-950/30';
    innerClass = 'text-amber-400 opacity-80 animate-spin-slow';
  }

  return (
    <div className={`relative w-72 h-72 rounded-full flex items-center justify-center transition-all duration-500 border-[8px] ${wrapperClass}`}>
      <div className="absolute inset-4 rounded-full border-4 border-white/5"></div>
      <Globe size={120} className={`transition-all duration-500 ${innerClass}`} />
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  // --- אתחול קולות ---
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- תיקון הבאג הקריטי: אתחול מנוע זיהוי בעת שינוי שפה ---
  useEffect(() => {
    if (isActive && appState === 'listening') {
        // אם אנחנו באמצע הקשבה והשפה השתנתה, נעצור ונתחיל מחדש
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
        // ה-onend יפעיל מחדש את ההקשבה עם השפה החדשה
    }
  }, [langA]);


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
    recognition.lang = langA; // משתמש בשפת המקור המעודכנת
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
        // לולאה: אם הסשן פעיל, חזור להקשיב
        if (isSessionActiveRef.current) {
            // בדיקה קצרה כדי לוודא שלא עברנו למצב דיבור בינתיים
            if (appState !== 'speaking' && appState !== 'processing') {
                 try { recognition.start(); } catch(e){}
            }
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
  }, [langA, appState]); // תלות ב-langA מבטיחה עדכון

  // --- פונקציית התרגום (עם פרומפט מתוקן) ---
  const processTranslation = async (text: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) { setError("חסר מפתח API ב-Vercel"); return; }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const nameA = LANGUAGES.find(l => l.code === langA)?.name || 'Unknown';
      const nameB = LANGUAGES.find(l => l.code === langB)?.name || 'Unknown';

      // פרומפט חד משמעי המשתמש בשמות השפות
      const prompt = `
        Task: Translate the following input text specifically from ${nameA} to ${nameB}.
        Rules:
        1. Output ONLY the final translated text.
        2. Do not provide explanations, notes, or repeat the input.
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
    utterance.lang = langB; // תמיד מדבר בשפת היעד

    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        startListening(); // חזרה ללולאה
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

  // --- UI מעוצב מחדש (מרכזי, נקי, קונטרסטי) ---
  return (
    // רקע כהה אחיד ונקי
    <div className="h-screen w-screen bg-[#0B0F1A] text-slate-100 flex flex-col items-center justify-between p-6 font-sans overflow-hidden relative">
      
      {/* כותרת עליונה */}
      <header className="mt-4 flex items-center gap-2 opacity-80">
          <Globe size={24} className="text-indigo-500" />
          <h1 className="text-xl font-black tracking-[0.2em] text-white uppercase">LingoLive Pro</h1>
      </header>

      {/* איזור מרכזי */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl gap-12 -mt-16">
          
          {/* אווטאר ענק במרכז */}
          <BigAvatar state={appState} />

          {/* סטטוס טקסטואלי */}
          <h2 className="text-5xl font-black text-white tracking-tight h-16 transition-all text-center drop-shadow-2xl">
             {appState === 'listening' && "אני מקשיב..."}
             {appState === 'processing' && "מתרגם..."}
             {appState === 'speaking' && "מדבר..."}
             {appState === 'idle' && "מוכנים לתרגם?"}
          </h2>

          {/* בוררי שפות - גדולים, ברורים, קונטרסטיים */}
          <div className="w-full flex items-center justify-between bg-[#131b2e] p-3 rounded-[2rem] border-2 border-[#1e293b] shadow-2xl relative">
              
              {/* שפת מקור */}
              <div className="relative flex-1">
                <select 
                    value={langA} 
                    onChange={e => setLangA(e.target.value)}
                    className="w-full appearance-none bg-[#0B0F1A] border-2 border-[#1e293b] rounded-[1.5rem] py-4 pl-6 pr-12 text-xl font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-[#1e293b] hover:border-indigo-500/50"
                >
                {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0B0F1A] text-lg">{l.label}</option>)}
                </select>
                <ChevronDown size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* אייקון מעבר */}
              <div className="px-4 text-slate-500">
                <ArrowRightLeft size={28} />
              </div>

              {/* שפת יעד */}
              <div className="relative flex-1">
                <select 
                    value={langB} 
                    onChange={e => setLangB(e.target.value)}
                    className="w-full appearance-none bg-[#0B0F1A] border-2 border-[#1e293b] rounded-[1.5rem] py-4 pl-6 pr-12 text-xl font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-[#1e293b] hover:border-indigo-500/50"
                >
                {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0B0F1A] text-lg">{l.label}</option>)}
                </select>
                <ChevronDown size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

          </div>
      </main>

      {/* כפתור פעולה ראשי - ענק בתחתית */}
      <footer className="w-full max-w-lg mb-6 relative z-20">
           {error && (
             <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-300 text-sm font-bold bg-red-950/80 p-3 rounded-full border border-red-500/50 animate-pulse whitespace-nowrap">
               <StopCircle size={18} /> {error}
             </div>
           )}
           
           <button 
             onClick={handleToggle} 
             className={`group w-full py-7 rounded-[3.5rem] font-black text-3xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden border-4 ${
                isActive 
                ? 'bg-red-600 border-red-500 shadow-[0_10px_40px_rgba(220,38,38,0.5)]' 
                : 'bg-indigo-600 border-indigo-500 shadow-[0_10px_40px_rgba(79,70,229,0.5)]'
             }`}
           >
             {isActive ? (
                <>
                    <LogOut size={36} /> STOP
                </>
             ) : (
                <>
                    <PlayCircle size={36} /> START
                </>
             )}
           </button>
      </footer>

    </div>
  );
};

export default App;
