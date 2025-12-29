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
  // ... שאר השפות נשארות אותו דבר
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
  const [langA, setLangA] = useState('en-US'); // ברירת מחדל לפי התמונה
  const [langB, setLangB] = useState('he-IL'); // ברירת מחדל לפי התמונה
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

  // --- ממשק משתמש חדש לפי התמונה ---

  // רכיב כרטיס צד ימין
  const InfoCard = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="bg-[#161B28] p-6 rounded-3xl flex flex-col items-end text-right w-full max-w-md mb-4 shadow-lg">
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        {subtitle && <p className="text-slate-400 text-sm mb-4 font-mono">{subtitle}</p>}
        <button className="bg-[#2A3045] hover:bg-[#353b54] text-[#6C72FF] text-sm font-bold py-2 px-6 rounded-xl flex items-center gap-2 transition-colors">
            Link <ExternalLink size={14} />
        </button>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#0F121A] text-white font-sans overflow-hidden">

      {/* === Left Sidebar === */}
      <aside className="w-[340px] bg-[#161B28] p-6 flex flex-col gap-8 border-r border-slate-800/50 relative z-10">
          {/* Header / Logo */}
          <div className="flex items-center gap-2">
              <Headphones size={24} className="text-[#6C72FF]" />
              <h1 className="text-xl font-bold tracking-wide">LINGOLIVE PRO</h1>
          </div>

          {/* Language Selectors */}
          <div className="flex flex-col gap-4 p-4 bg-[#212738] rounded-3xl">
               {/* Native Language */}
               <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 ml-2 font-medium uppercase">Native Language</label>
                  <div className="relative">
                      <select
                          value={langA}
                          onChange={e => setLangA(e.target.value)}
                          className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#2A3045]">{l.label}</option>)}
                      </select>
                       {/* Custom arrow icon placeholder if needed, or rely on browser default for now */}
                  </div>
               </div>

               {/* Swap Icon */}
               <div className="flex justify-center -my-2 z-10">
                  <div className="bg-[#2A3045] p-2 rounded-full border border-slate-700">
                       <ArrowRightLeft size={16} className="text-slate-400" />
                  </div>
               </div>

               {/* Target Language */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 ml-2 font-medium uppercase">Target Language</label>
                  <div className="relative">
                      <select
                          value={langB}
                          onChange={e => setLangB(e.target.value)}
                          className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#2A3045]">{l.label}</option>)}
                      </select>
                  </div>
               </div>
          </div>

          {/* Mode Selection Grid */}
          <div className="grid grid-cols-2 gap-4">
              {/* Active Button */}
              <button className="bg-[#4E54C8] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                  <Mic size={28} className="text-white" />
                  <span className="text-xs font-bold text-center leading-tight">LIVE<br/>TRANSLATION</span>
              </button>
              {/* Inactive Buttons (Visual placeholders) */}
              <button className="bg-[#212738] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                  <Headphones size={28} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 text-center leading-tight">SIMULTANEOUS<br/>TRANS</span>
              </button>
              <button className="bg-[#212738] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                  <MessageCircle size={28} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 text-center leading-tight">CHAT<br/>CONVERSATION</span>
              </button>
              <button className="bg-[#212738] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                  <GraduationCap size={28} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 text-center leading-tight">LANGUAGE<br/>LEARNING</span>
              </button>
          </div>

          {/* User Avatar Area */}
          <div className="mt-auto flex justify-center">
               {/* Placeholder image - replace with actual user image */}
              <img
                  src="https://i.pravatar.cc/150?img=47"
                  alt="User Avatar"
                  className="w-28 h-28 rounded-full border-4 border-[#212738]"
              />
          </div>

          {/* Error Message Display */}
          {error && (
              <div className="text-red-400 text-xs text-center flex items-center justify-center gap-1 animate-pulse">
                  <StopCircle size={12} /> {error}
              </div>
          )}

          {/* Start/Stop Button (Main Action) */}
          <button
            onClick={handleToggle}
            className={`w-full py-4 rounded-full font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#6C72FF] hover:bg-[#7a80ff]'
            }`}
          >
            <Mic size={20} />
            {isActive
                ? (appState === 'listening' ? 'Listening...' : appState === 'processing' ? 'Translating...' : appState === 'speaking' ? 'Speaking...' : 'Stop')
                : 'Start'
            }
          </button>

      </aside>

      {/* === Right Main Content === */}
      <main className="flex-1 bg-[#0F121A] p-10 flex flex-col items-center justify-center relative">
          {/* Background gradient effect similar to image */}
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#141925] to-transparent pointer-events-none"></div>

          <div className="z-10 w-full flex flex-col items-end gap-6 pr-10">
              {/* Hero Card - Hebrew Details */}
              <InfoCard
                  title='מאיר גלעד-מומחה לנדל"ן מסחרי -'
                  subtitle="0522530087"
              />

              {/* Placeholder Cards */}
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
          </div>
      </main>

    </div>
  );
};

export default App;
