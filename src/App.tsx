import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Headphones, MessageCircle, GraduationCap, ArrowRightLeft, ExternalLink, StopCircle, Activity } from 'lucide-react';

// רשימת השפות
const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 Hebrew' },
  { code: 'en-US', name: 'English', label: '🇺🇸 English' },
  { code: 'es-ES', name: 'Spanish', label: '🇪🇸 Español' },
  { code: 'fr-FR', name: 'French', label: '🇫🇷 Français' },
  { code: 'ru-RU', name: 'Russian', label: '🇷🇺 Русский' },
  { code: 'ar-SA', name: 'Arabic', label: '🇸🇦 العربية' },
];

// רכיב כרטיס מידע (לא השתנה)
function InfoCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="w-[500px] bg-[#161B28] p-8 rounded-[32px] flex flex-col items-center text-center border border-white/5 shadow-2xl backdrop-blur-md mb-6">
      <h3 className="text-white font-bold text-xl mb-2" dir="rtl">{title}</h3>
      {subtitle && <p className="text-white text-3xl font-black mb-6 tracking-tight">{subtitle}</p>}
      <button className="bg-[#2A3045] hover:bg-[#353b54] text-[#6C72FF] text-sm font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all active:scale-95">
        Link <ExternalLink size={16} />
      </button>
    </div>
  );
}

export default function App() {
  // סטייטים לניהול האפליקציה
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  
  // --- סטייט חדש לניהול המצב הנבחר ---
  // 'default' = Live Translation, 'simultaneous', 'chat', 'learning'
  const [mode, setMode] = useState<'default' | 'simultaneous' | 'chat' | 'learning'>('default');

  // רפרנסים לשימוש בתוך קולבקים
  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null); // טיימר חדש להפעלה מחדש בטוחה

  // טעינת קולות לדיבור בדפדפן
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    // ניקוי טיימרים ביציאה
    return () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    }
  }, []);

  // פונקציה לעצירה מוחלטת של הכל
  const stopAll = useCallback(() => {
    console.log("Stopping session...");
    isActiveRef.current = false;
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
  }, []);

  // --- פונקציה משופרת להפעלת ההקשבה מחדש ---
  const restartListening = useCallback(() => {
      // בודקים אם ה-Session עדיין אמור להיות פעיל
      if (!isActiveRef.current) return;
      
      // מונעים הפעלה מחדש אם כבר מקשיבים או מדברים
      if (appState === 'listening' || appState === 'speaking') return;

      console.log("Attempting to restart listening...");
      
      // ניקוי טיימר קודם אם קיים
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

      // שימוש ב-setTimeout קצר כדי לוודא שהמיקרופון באמת פנוי לפני הפעלה מחדש
      restartTimeoutRef.current = setTimeout(() => {
          if (!isActiveRef.current) return; // בדיקה נוספת לפני הביצוע
          try {
              // אם יש מופע קיים, מנסים לעצור אותו קודם
              if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
              
              setAppState("listening");
              // יצירת מופע חדש והתחלה
              startSession(); 
          } catch (e) {
              console.error("Failed to restart recognition:", e);
              // ניסיון נוסף במקרה של כישלון
              restartTimeoutRef.current = setTimeout(restartListening, 1000);
          }
      }, 300); // המתנה קצרה
  }, [appState]); // תלות ב-appState חשובה כאן

  // פונקציית הדיבור (TTS)
  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    
    // במצב סימולטני, תמיד מדברים בשפת היעד (LangB)
    let targetLangCode = langB;

    if (mode !== 'simultaneous') {
        // במצבים אחרים, מנסים לזהות את השפה לפי הטקסט (עברית/אנגלית כברירת מחדל)
        const isHebrew = /[\u0590-\u05FF]/.test(text);
        targetLangCode = isHebrew ? 'he-IL' : 'en-US';
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLangCode;
    utterance.rate = 1;

    // ניסיון למצוא קול איכותי של גוגל
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith(targetLangCode.split('-')[0])) ||
                           voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0]));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      console.log("Finished speaking.");
      setAppState("idle"); // חזרה למצב המתנה
      // הפעלה מחדש של ההקשבה תתבצע דרך rec.onend
    };

    utterance.onerror = (e) => {
        console.error("Speech error:", e);
        setAppState("idle");
    };

    console.log(`Speaking in language: ${targetLangCode}`);
    setAppState("speaking");
    window.speechSynthesis.speak(utterance);
  }, [langB, mode]);

  // --- פונקציית התחלת הסשן (יצירת ה-Recognition) ---
  // הועברה מחוץ ל-useEffect כדי שנוכל לקרוא לה מחדש
  const startSession = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Browser not supported. Use Chrome.");
      stopAll();
      return;
    }

    // עצירה של מופע קודם אם קיים
    if (recognitionRef.current) try { recognitionRef.current.abort(); } catch(e){}
    
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    
    // הגדרת שפת ההקשבה
    // במצב סימולטני - מקשיבים רק לשפת המקור (LangA)
    // במצבים אחרים - נותנים לדפדפן לזהות (לא מגדירים שפה) כדי לתמוך בדו-כיווניות
    rec.lang = mode === 'simultaneous' ? langA : undefined; 
    
    rec.continuous = false; // נקשיב למשפט אחד בכל פעם
    rec.interimResults = false; // רק תוצאות סופיות

    rec.onstart = () => {
        console.log("Recognition started successfully");
        setAppState("listening");
        setError(null);
    };

    rec.onresult = async (event: any) => {
      // מניעת עיבוד כפול אם התוצאה כבר התקבלה
      if (appState === 'processing') return;

      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      console.log("Heard:", text);
      
      // במצב סימולטני, לא עוצרים את ההקשבה כדי לאפשר זרימה
      // במצבים אחרים, עוצרים כדי לעבד ולדבר
      if (mode !== 'simultaneous') {
          rec.stop();
          setAppState("processing");
      } else {
          // בסימולטני רק מסמנים שמעבדים, בלי לעצור את המיקרופון
          setAppState("processing"); 
      }

      try {
        const langALabel = LANGUAGES.find(l => l.code === langA)?.name;
        const langBLabel = LANGUAGES.find(l => l.code === langB)?.name;

        console.log(`Sending to server [Mode: ${mode}]...`);

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              text, 
              langA, 
              langB,
              langALabel,
              langBLabel,
              mode // --- שליחת המצב לשרת ---
          }),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        if (data.translation) {
          console.log("Translated:", data.translation);
          speak(data.translation);
        } else {
            throw new Error("No translation in response");
        }
      } catch (e: any) {
        console.error("Translation error:", e);
        setError(`Error: ${e.message}`);
        setAppState("idle");
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Recognition error:", event.error);
      // התעלמות משגיאות נפוצות שלא דורשות טיפול מיוחד
      if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
      }
      // במקרה של שגיאת רשת או חוסר הרשאה, מציגים שגיאה
      if (event.error === 'network' || event.error === 'not-allowed') {
          setError(`Microphone error: ${event.error}`);
          stopAll();
      }
    };

    // --- התיקון הקריטי להקשבה רציפה ---
    rec.onend = () => {
      console.log(`Recognition ended. (Active: ${isActiveRef.current}, State: ${appState})`);
      
      // אם הסשן פעיל, ואנחנו לא באמצע דיבור או עיבוד, צריך להפעיל מחדש
      if (isActiveRef.current && appState !== 'speaking' && appState !== 'processing') {
          console.log("Triggering restart from onend...");
          restartListening();
      } 
      // אם סיימנו עיבוד (במצב סימולטני) ולא מדברים, גם אז מפעילים מחדש
      else if (isActiveRef.current && appState === 'processing' && mode === 'simultaneous') {
           console.log("Restarting after simultaneous processing...");
           restartListening();
      }
      // אחרת, אם סיימנו לדבר, ה-onend של הדיבור יקרא ל-restartListening
    };

    try {
        rec.start();
    } catch(e) {
        console.error("Failed to start initial recognition:", e);
        restartListening();
    }
  }, [langA, langB, speak, appState, mode, restartListening]); // הוספת mode כתלות

  // כפתור ההפעלה הראשי
  const handleToggle = () => {
    if (isActive) {
      stopAll();
    } else {
      console.log("Starting new session...");
      isActiveRef.current = true;
      setIsActive(true);
      // מחכים רגע קטן לפני ההתחלה כדי לוודא שהכל מאופס
      setTimeout(startSession, 100);
    }
  };

  // החלפת שפות
  const swapLanguages = () => {
      setLangA(langB);
      setLangB(langA);
  };

  // פונקציה עזר לקביעת סגנון כפתורי המצבים
  const getModeButtonStyle = (btnMode: string) => {
      const isActiveMode = mode === btnMode;
      const baseStyle = "p-6 rounded-[28px] flex flex-col items-center gap-3 transition-all active:scale-95 cursor-pointer";
      if (isActiveMode) {
          return `${baseStyle} bg-[#5D65F6] shadow-xl shadow-[#5D65F6]/20 scale-105 border-2 border-[#6C72FF]`;
      }
      return `${baseStyle} bg-[#161B28] border border-white/5 opacity-60 hover:opacity-100 hover:bg-[#1E2433]`;
  };

  return (
    <div className="flex h-screen w-screen bg-[#050815] text-white font-sans overflow-hidden">
      
      {/* Sidebar - שמאל */}
      <aside className="w-[400px] bg-[#0B1020] p-8 flex flex-col border-r border-white/5 shadow-2xl z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[#6C72FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#6C72FF]/20">
            <Headphones size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter italic">LINGOLIVE PRO</h1>
        </div>

        {/* בחירת שפות */}
        <div className="bg-[#161B28] p-6 rounded-[24px] mb-8 border border-white/5 relative">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-3 px-2">
            <span>Native Language</span>
            <span>Target Language</span>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <select value={langA} onChange={e => setLangA(e.target.value)} className="flex-1 bg-[#2A3045] border-none rounded-xl py-4 px-4 text-sm font-bold outline-none appearance-none">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            
            <button onClick={swapLanguages} className="bg-[#6C72FF] p-3 rounded-full shadow-lg hover:scale-110 transition-transform z-20">
                <ArrowRightLeft size={18} className="text-white" />
            </button>

            <select value={langB} onChange={e => setLangB(e.target.value)} className="flex-1 bg-[#2A3045] border-none rounded-xl py-4 px-4 text-sm font-bold outline-none appearance-none">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* --- כפתורי מודולים פעילים --- */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button onClick={() => setMode('default')} className={getModeButtonStyle('default')}>
            <Mic size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Live<br/>Translation</span>
          </button>
          <button onClick={() => setMode('simultaneous')} className={getModeButtonStyle('simultaneous')}>
            <Headphones size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Simultaneous<br/>Trans</span>
          </button>
          <button onClick={() => setMode('chat')} className={getModeButtonStyle('chat')}>
            <MessageCircle size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Chat<br/>Conversation</span>
          </button>
          <button onClick={() => setMode('learning')} className={getModeButtonStyle('learning')}>
            <GraduationCap size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Language<br/>Learning</span>
          </button>
        </div>

        {/* אווטאר וסטטוס */}
        <div className="mt-auto mb-6 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-3xl opacity-30 transition-colors duration-500 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-[#6C72FF]'}`}></div>
            <img src="https://i.pravatar.cc/150?img=47" className={`w-32 h-32 rounded-full border-[5px] relative z-10 transition-all duration-500 ${isActive ? 'border-green-400 scale-105' : 'border-[#2A3045]'}`} alt="Avatar" />
            {isActive && <div className="absolute bottom-0 right-0 bg-green-500 w-8 h-8 rounded-full border-4 border-[#0B1020] z-20 animate-bounce"></div>}
          </div>
            
            {/* הודעת שגיאה */}
            {error && (
              <div className="text-red-400 text-xs font-bold bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 animate-pulse">
                  {error}
              </div>
            )}
        </div>

        {/* כפתור הפעלה ראשי */}
        <button onClick={handleToggle} className={`w-full py-6 rounded-[24px] font-black text-xl tracking-wider flex items-center justify-center gap-4 transition-all duration-300 active:scale-95 shadow-2xl ${isActive ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-[#5D65F6] shadow-[#5D65F6]/40 hover:bg-[#6C72FF]'}`}>
          {isActive ? <StopCircle size={28} /> : <Mic size={28} />}
          {isActive ? 'STOP SESSION' : `START ${mode === 'default' ? 'TRANSLATION' : mode.toUpperCase()}`}
        </button>
      </aside>

      {/* Main Content - ימין (לא השתנה) */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(108,114,255,0.1)_0%,_transparent_60%)] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
        
        <div className="z-10 flex flex-col gap-4 scale-110">
          <InfoCard title='מאיר גלעד-מומחה לנדל"ן מסחרי -' subtitle="0522530087" />
          <InfoCard title="שטחי מסחר להשכרה" />
          <InfoCard title="משרדים למכירה בתל אביב" />
          <InfoCard title="ייעוץ והערכת נכסים" />
        </div>

        {/* סטטוס חי למטה */}
        <div className="absolute bottom-12 flex items-center gap-4 bg-[#161B28]/80 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl">
          <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${appState === 'listening' ? 'bg-green-500 animate-ping' : appState === 'processing' ? 'bg-yellow-500 animate-pulse' : appState === 'speaking' ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`}></div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">
            {appState === 'listening' ? `Listening (${mode})...` : appState === 'processing' ? 'Translating...' : appState === 'speaking' ? 'Speaking...' : 'Ready'}
          </span>
        </div>
      </main>

    </div>
  );
}
