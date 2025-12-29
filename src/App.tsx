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

  // טעינת קולות לדיבור
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const stopAll = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, langCode: string) => {
    // ביטול כל דיבור קודם
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 1; // מהירות רגילה

    // פונקציה פנימית לבחירת קול
    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log(`נמצאו ${voices.length} קולות זמינים.`);

      if (voices.length === 0) {
        console.warn("לא נמצאו קולות דיבור. ייתכן שהדפדפן עדיין טוען אותם.");
        return;
      }

      // ניסיון למצוא קול מועדף (למשל של גוגל) התואם לשפה
      let preferredVoice = voices.find(v => 
        v.lang.startsWith(langCode.split('-')[0]) && v.name.includes('Google')
      );

      // אם לא נמצא קול מועדף, קח כל קול שמתאים לשפה
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
      }

      if (preferredVoice) {
        console.log(`נבחר קול: ${preferredVoice.name} לשפה ${langCode}`);
        utterance.voice = preferredVoice;
      } else {
        console.warn(`לא נמצא קול מתאים לשפה ${langCode}. משתמש בקול ברירת המחדל.`);
      }

      // הפעלת הדיבור
      window.speechSynthesis.speak(utterance);
    };

    // בדיקה אם הקולות כבר טעונים
    if (window.speechSynthesis.getVoices().length > 0) {
      selectVoice();
    } else {
      // אם לא, נרשם לאירוע טעינת הקולות ונפעיל כשיסתיים
      console.log("ממתין לטעינת קולות...");
      window.speechSynthesis.onvoiceschanged = () => {
        console.log("הקולות נטענו.");
        selectVoice();
      };
    }

    utterance.onend = () => {
      console.log("הדיבור הסתיים.");
      if (isActiveRef.current) {
        setAppState("listening");
        startListening();
      }
    };

    utterance.onerror = (event) => {
      console.error("שגיאה בדיבור:", event);
      if (isActiveRef.current) {
        setAppState("listening");
        startListening();
      }
    };

    setAppState("speaking");
  }, []);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Browser not supported. Use Chrome.");
      return;
    }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.lang = langA;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setAppState("listening");
    rec.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text) return;

      setAppState("processing");
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, from: langA, to: langB }),
        });
        const data = await res.json();
        if (data.translation) {
          speak(data.translation, langB);
        }
      } catch (e) {
        setError("Translation failed.");
        setAppState("idle");
        setTimeout(startListening, 1000);
      }
    };

    rec.onerror = () => {
      if (isActiveRef.current) setTimeout(startListening, 500);
    };

    rec.onend = () => {
      if (isActiveRef.current && appState === 'listening') {
        try { rec.start(); } catch(e){}
      }
    };

    try { rec.start(); } catch(e){}
  }, [langA, langB, speak, appState]);

  const handleToggle = () => {
    if (isActive) {
      stopAll();
    } else {
      isActiveRef.current = true;
      setIsActive(true);
      startListening();
    }
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
        <div className="bg-[#161B28] p-6 rounded-[24px] mb-8 border border-white/5">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-3 px-2">
            <span>Native</span>
            <span>Target</span>
          </div>
          <div className="flex items-center gap-3">
            <select value={langA} onChange={e => setLangA(e.target.value)} className="flex-1 bg-[#2A3045] border-none rounded-xl py-3 px-3 text-sm font-bold outline-none">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <ArrowRightLeft size={16} className="text-[#6C72FF]" />
            <select value={langB} onChange={e => setLangB(e.target.value)} className="flex-1 bg-[#2A3045] border-none rounded-xl py-3 px-3 text-sm font-bold outline-none">
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

        {/* אווטאר */}
        <div className="mt-auto mb-10 flex justify-center">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-[#6C72FF]'}`}></div>
            <img src="https://i.pravatar.cc/150?img=47" className={`w-32 h-32 rounded-full border-4 relative z-10 transition-colors ${isActive ? 'border-green-500' : 'border-[#2A3045]'}`} alt="Avatar" />
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button onClick={handleToggle} className={`w-full py-5 rounded-full font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl ${isActive ? 'bg-red-500 shadow-red-500/20' : 'bg-[#5D65F6] shadow-[#5D65F6]/40'}`}>
          {isActive ? <StopCircle size={24} /> : <Mic size={24} />}
          {isActive ? 'STOP' : 'START'}
        </button>
      </aside>

      {/* Main Content - ימין */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 relative">
        {/* אפקט רקע */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(108,114,255,0.08)_0%,_transparent_70%)] pointer-events-none"></div>
        
        <div className="z-10 flex flex-col gap-2">
          <InfoCard title='מאיר גלעד-מומחה לנדל"ן מסחרי -' subtitle="0522530087" />
          <InfoCard title="פרסם כאן" />
          <InfoCard title="פרסם כאן" />
          <InfoCard title="פרסם כאן" />
        </div>

        {/* סטטוס חי למטה */}
        <div className="absolute bottom-10 flex items-center gap-2 bg-[#161B28] px-6 py-2 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {appState === 'listening' ? 'Listening...' : appState === 'processing' ? 'Translating...' : appState === 'speaking' ? 'Speaking...' : 'Ready'}
          </span>
        </div>
      </main>

    </div>
  );
}
