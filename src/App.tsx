import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Headphones, MessageCircle, GraduationCap, ArrowRightLeft, ExternalLink, StopCircle, Activity } from 'lucide-react';

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 Hebrew' },
  { code: 'en-US', name: 'English', label: '🇺🇸 English' },
  { code: 'es-ES', name: 'Spanish', label: '🇪🇸 Español' },
  { code: 'fr-FR', name: 'French', label: '🇫🇷 Français' },
  { code: 'ru-RU', name: 'Russian', label: '🇷🇺 Русский' },
  { code: 'ar-SA', name: 'Arabic', label: '🇸🇦 العربية' },
];

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
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);

  // טעינת קולות לדיבור
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    }
  }, []);

  const stopAll = useCallback(() => {
    console.log("Stopping session...");
    isActiveRef.current = false;
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  // פונקציה להפעלת ההקשבה מחדש
  const restartListening = useCallback(() => {
      if (!isActiveRef.current) return;
      console.log("Restarting listening...");
      setAppState("listening");
      try {
          if (recognitionRef.current) recognitionRef.current.start();
      } catch (e) {
          console.error("Failed to restart recognition:", e);
          // ניסיון נוסף אם נכשל
          setTimeout(() => {
              if (isActiveRef.current) restartListening();
          }, 1000);
      }
  }, []);


  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    // ניסיון לזהות את שפת הפלט (פשוט לפי אנגלית/עברית)
    const isHebrew = /[\u0590-\u05FF]/.test(text);
    const targetLangCode = isHebrew ? 'he-IL' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLangCode;
    utterance.rate = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith(targetLangCode.split('-')[0])) ||
                           voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0]));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      console.log("Finished speaking. Returning to listening mode.");
      if (isActiveRef.current) {
        restartListening();
      }
    };

    utterance.onerror = (e) => {
        console.error("Speech error:", e);
        if (isActiveRef.current) restartListening();
    };

    setAppState("speaking");
    window.speechSynthesis.speak(utterance);
  }, [restartListening]);

  const startSession = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Browser not supported. Use Chrome.");
      stopAll();
      return;
    }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    // כדי לתמוך בשני הכיוונים, לא מגדירים שפה ספציפית ונותנים לדפדפן לזהות
    // (זה עובד פחות טוב, אבל זה הפתרון הפשוט כרגע לדו-כיווניות)
    rec.lang = langA; // מתחילים עם שפת המקור
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
        console.log("Recognition started");
        setAppState("listening");
        setError(null);
    };

    rec.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      console.log("Heard:", text);
      setAppState("processing");
      
      // עצירת ההקשבה בזמן העיבוד
      rec.stop();

      try {
        const langALabel = LANGUAGES.find(l => l.code === langA)?.name;
        const langBLabel = LANGUAGES.find(l => l.code === langB)?.name;

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              text, 
              langA, 
              langB,
              langALabel,
              langBLabel
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
        // חזרה להקשבה אחרי שגיאה
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            if (isActiveRef.current) restartListening();
        }, 2000);
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Recognition error:", event.error);
      if (event.error === 'no-speech' && isActiveRef.current) {
          restartListening();
      }
    };

    rec.onend = () => {
      console.log("Recognition ended");
      // אם הדיבור לא פעיל ועדיין אמורים להיות פעילים, מפעילים מחדש
      if (isActiveRef.current && appState !== 'speaking' && appState !== 'processing') {
          restartListening();
      }
    };

    rec.start();
  }, [langA, langB, speak, appState, restartListening, stopAll]);

  const handleToggle = () => {
    if (isActive) {
      stopAll();
    } else {
      isActiveRef.current = true;
      setIsActive(true);
      startSession();
    }
  };

  // החלפת שפות בלחיצה על החץ
  const swapLanguages = () => {
      setLangA(langB);
      setLangB(langA);
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

        {/* מודולים - 4 כפתורים */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button className="bg-[#5D65F6] p-6 rounded-[28px] flex flex-col items-center gap-3 shadow-xl shadow-[#5D65F6]/20 transition-transform active:scale-95">
            <Mic size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Live<br/>Translation</span>
          </button>
          <button className="bg-[#161B28] p-6 rounded-[28px] flex flex-col items-center gap-3 border border-white/5 opacity-60">
            <Headphones size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Simultaneous<br/>Trans</span>
          </button>
          <button className="bg-[#161B28] p-6 rounded-[28px] flex flex-col items-center gap-3 border border-white/5 opacity-60">
            <MessageCircle size={32} />
            <span className="text-[10px] font-black text-center leading-tight uppercase">Chat<br/>Conversation</span>
          </button>
          <button className="bg-[#161B28] p-6 rounded-[28px] flex flex-col items-center gap-3 border border-white/5 opacity-60">
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

        {/* כפתור הפעלה */}
        <button onClick={handleToggle} className={`w-full py-6 rounded-[24px] font-black text-xl tracking-wider flex items-center justify-center gap-4 transition-all duration-300 active:scale-95 shadow-2xl ${isActive ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-[#5D65F6] shadow-[#5D65F6]/40 hover:bg-[#6C72FF]'}`}>
          {isActive ? <StopCircle size={28} /> : <Mic size={28} />}
          {isActive ? 'STOP SESSION' : 'START TRANSLATION'}
        </button>
      </aside>

      {/* Main Content - ימין */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* אפקט רקע */}
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
            {appState === 'listening' ? 'Listening...' : appState === 'processing' ? 'Translating...' : appState === 'speaking' ? 'Speaking...' : 'Ready'}
          </span>
        </div>
      </main>

    </div>
  );
}
