import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Mic,
  Headphones,
  MessageCircle,
  GraduationCap,
  ArrowRightLeft,
  ExternalLink,
  StopCircle,
} from 'lucide-react';

// --- הגדרות (ללא שינוי) ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 Hebrew' },
  { code: 'en-US', name: 'English', label: '🇺🇸 English' },
  { code: 'es-ES', name: 'Spanish', label: '🇪🇸 Español' },
  { code: 'fr-FR', name: 'French', label: '🇫🇷 Français' },
  { code: 'ru-RU', name: 'Russian', label: '🇷🇺 Русский' },
  { code: 'ar-SA', name: 'Arabic', label: '🇸🇦 العربية' },
  { code: 'de-DE', name: 'German', label: '🇩🇪 Deutsch' },
  { code: 'it-IT', name: 'Italian', label: '🇮🇹 Italiano' },
  { code: 'zh-CN', name: 'Chinese', label: '🇨🇳 中文' },
  { code: 'hi-IN', name: 'Hindi', label: '🇮🇳 हिन्दी' },
  { code: 'ja-JP', name: 'Japanese', label: '🇯🇵 日本語' },
];

const App: React.FC = () => {
  // --- State & Logic (הלוגיקה המקורית נשמרת במלואה) ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('en-US');
  const [langB, setLangB] = useState('he-IL');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (isActive && appState === 'listening') {
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    }
  }, [langA]);

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
    recognition.lang = langA;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { if(isSessionActiveRef.current) setAppState("listening"); };
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;
      setAppState("processing");
      await processTranslation(text);
    };
    recognition.onend = () => {
        if (isSessionActiveRef.current && appState !== 'speaking' && appState !== 'processing') {
             try { recognition.start(); } catch(e){}
        }
    };
    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') { setError("אין גישה למיקרופון"); stopSession(); }
        else if (isSessionActiveRef.current && event.error !== 'aborted') { setTimeout(startListening, 500); }
    };
    try { recognition.start(); recognitionRef.current = recognition; } catch(e) {}
  }, [langA, appState]);

  const processTranslation = async (text: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) { setError("חסר מפתח API"); return; }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const nameA = LANGUAGES.find(l => l.code === langA)?.name || 'Unknown';
      const nameB = LANGUAGES.find(l => l.code === langB)?.name || 'Unknown';
      const prompt = `Task: Translate from ${nameA} to ${nameB}. Output ONLY translated text. Input: "${text}"`;
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();
      if (!response) { if (isSessionActiveRef.current) startListening(); return; }
      speakResponse(response);
    } catch (e: any) {
      console.error(e); setError("שגיאת AI. מנסה שוב...");
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;
    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langB;
    utterance.onend = () => { if (isSessionActiveRef.current) { setAppState("listening"); startListening(); } };
    utterance.onerror = () => { if (isSessionActiveRef.current) startListening(); };
    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) { stopSession(); } else { isSessionActiveRef.current = true; setIsActive(true); startListening(); }
  };

  // --- רכיבי עזר לממשק ---

  // רכיב כרטיס צד ימין (הפרסומות)
  const InfoCard = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="bg-[#111426] p-6 rounded-3xl flex flex-col items-center text-center w-full max-w-md mb-5 shadow-xl border border-slate-800/60 transition-transform hover:scale-[1.01]">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        {subtitle && <p className="text-[#8B92FF] text-xl font-bold mb-5 tracking-wider">{subtitle}</p>}
        <button className="bg-[#2A2F4A] hover:bg-[#363c5e] text-[#8B92FF] text-sm font-bold py-3 px-10 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-indigo-900/30">
            Link <ExternalLink size={16} />
        </button>
    </div>
  );

  return (
    // מיכל ראשי - רקע כהה מאוד
    <div className="flex h-screen w-screen bg-[#080B14] text-white font-sans overflow-hidden font-inter">

      {/* === סרגל צד שמאל (Left Sidebar) === */}
      <aside className="w-[380px] bg-[#111426] p-6 flex flex-col gap-6 border-r border-slate-800/30 relative z-20 shadow-[5px_0_30px_rgba(0,0,0,0.5)]">
          {/* לוגו וכותרת */}
          <div className="flex items-center gap-3 pl-2 mb-2">
              <div className="bg-gradient-to-br from-[#6C72FF] to-[#8B92FF] p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <Headphones size={22} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">LINGOLIVE PRO</h1>
          </div>

          {/* אזור בחירת שפות - עיצוב נקי וכהה */}
          <div className="flex flex-col gap-1">
               {/* שפת מקור */}
               <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-[10px] text-slate-400 ml-4 font-bold uppercase tracking-widest">NATIVE LANGUAGE</label>
                  <div className="relative">
                      <select
                          value={langA}
                          onChange={e => setLangA(e.target.value)}
                          className="w-full appearance-none bg-[#0F121A] border border-slate-700/60 rounded-2xl px-5 py-4 pr-10 text-sm font-bold text-slate-200 outline-none focus:border-[#6C72FF] transition-all cursor-pointer shadow-inner hover:border-slate-600"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#111426]">{l.label}</option>)}
                      </select>
                  </div>
               </div>

               {/* אייקון החלפה */}
               <div className="flex justify-center -my-3 relative z-20 pointer-events-none">
                  <div className="bg-[#2A2F4A] p-2 rounded-full border-2 border-[#111426] shadow-md">
                       <ArrowRightLeft size={16} className="text-slate-300" />
                  </div>
               </div>

               {/* שפת יעד */}
                <div className="flex flex-col gap-2 relative z-0">
                  <label className="text-[10px] text-slate-400 ml-4 font-bold uppercase tracking-widest">TARGET LANGUAGE</label>
                  <div className="relative">
                      <select
                          value={langB}
                          onChange={e => setLangB(e.target.value)}
                          className="w-full appearance-none bg-[#0F121A] border border-slate-700/60 rounded-2xl px-5 py-4 pr-10 text-sm font-bold text-slate-200 outline-none focus:border-[#6C72FF] transition-all cursor-pointer shadow-inner hover:border-slate-600"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#111426]">{l.label}</option>)}
                      </select>
                  </div>
               </div>
          </div>

          {/* גריד כפתורי מודולים - עיצוב יוקרתי יותר */}
          <div className="grid grid-cols-2 gap-4 mt-4">
              {/* כפתור פעיל - LIVE TRANSLATION עם גרדיאנט וזוהר */}
              <button className="bg-gradient-to-br from-[#6C72FF] to-[#8B92FF] p-5 rounded-[24px] flex flex-col items-center justify-center gap-3 shadow-xl shadow-indigo-500/40 transition-transform hover:scale-[1.03] relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity"></div>
                  <Mic size={34} className="text-white drop-shadow-sm" />
                  <span className="text-[11px] font-extrabold text-center leading-tight tracking-wider text-white drop-shadow-sm">LIVE<br/>TRANSLATION</span>
              </button>
              {/* כפתורים לא פעילים - כהים ואחידים */}
              {[
                { icon: Headphones, text: "SIMULTANEOUS\nTRANS" },
                { icon: MessageCircle, text: "CHAT\nCONVERSATION" },
                { icon: GraduationCap, text: "LANGUAGE\nLEARNING" }
              ].map((Btn, idx) => (
                <button key={idx} className="bg-[#1A1F36] border border-slate-800/80 p-5 rounded-[24px] flex flex-col items-center justify-center gap-3 transition-all hover:border-[#6C72FF]/50 hover:bg-[#202640] group">
                    <Btn.icon size={34} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-400 text-center leading-tight tracking-wider transition-colors whitespace-pre-wrap">{Btn.text}</span>
                </button>
              ))}
          </div>

          {/* אזור אווטאר משתמש - מסגרת עגולה מעוצבת */}
          <div className="mt-auto mb-2 flex justify-center relative">
               {/* הוספת טבעת גרדיאנט מסביב לתמונה */}
               <div className="p-[3px] rounded-full bg-gradient-to-tr from-[#6C72FF] via-[#8B92FF] to-[#A7ADFF] shadow-lg shadow-indigo-500/30">
                  <img
                      src="https://i.pravatar.cc/150?img=47" // החלף בתמונה האמיתית
                      alt="User Avatar"
                      className="w-28 h-28 rounded-full border-4 border-[#111426]"
                  />
               </div>
          </div>

          {/* הודעת שגיאה */}
          {error && (
              <div className="text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse absolute bottom-[85px] left-0 right-0 bg-red-950/50 py-1">
                  <StopCircle size={14} /> {error}
              </div>
          )}

          {/* כפתור התחל ראשי - בולט ויפה יותר */}
          <button
            onClick={handleToggle}
            className={`w-full py-5 rounded-full font-extrabold text-xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden ${
                isActive
                    ? 'bg-gradient-to-r from-red-500 to-red-700 shadow-red-600/40'
                    : 'bg-gradient-to-r from-[#6C72FF] to-[#8B92FF] shadow-indigo-600/50'
            }`}
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity"></div>
            {isActive ? <StopCircle size={26} className="drop-shadow" /> : <Mic size={26} className="drop-shadow" />}
            <span className="tracking-widest drop-shadow-sm">
            {isActive
                ? (appState === 'listening' ? 'LISTENING...' : appState === 'processing' ? 'TRANSLATING...' : appState === 'speaking' ? 'SPEAKING...' : 'STOP')
                : 'START'
            }
            </span>
          </button>
      </aside>

      {/* === תוכן ראשי בצד ימין (הפרסומות) === */}
      <main className="flex-1 bg-[#080B14] p-12 flex flex-col items-end justify-center relative overflow-y-auto z-10">
          {/* אפקט רקע עדין בצד ימין */}
          <div className="absolute inset-0 bg-gradient-to-bl from-[#111426] via-[#080B14] to-[#080B14] pointer-events-none"></div>

          <div className="z-20 w-full flex flex-col items-end pr-10">
              {/* כרטיס ראשון - הפרטים בעברית */}
              <InfoCard
                  title='מאיר גלעד-מומחה לנדל"ן מסחרי -'
                  subtitle="0522530087"
              />

              {/* כרטיסי "פרסם כאן" */}
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
          </div>
      </main>

    </div>
  );
};

export default App;
