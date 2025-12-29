
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, Globe, StopCircle, PlayCircle, ArrowRight } from 'lucide-react';

// --- הגדרות ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 עברית' },
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

// רכיב ויזואליזציה נקי (גלי קול) במקום אווטאר ענק
const AudioVisualizer = ({ animate }: { animate: boolean }) => (
  <div className="flex items-center gap-2 h-32">
    {[...Array(9)].map((_, i) => (
      <div
        key={i}
        className={`w-3 bg-indigo-400 rounded-full ${animate ? 'animate-musical-bars' : 'h-4 opacity-30'}`}
        style={{
          animationDelay: `${i * 0.1}s`,
          height: animate ? `${Math.random() * 100}%` : '16px',
          backgroundColor: animate ? (i % 2 === 0 ? '#818cf8' : '#34d399') : undefined
        }}
      />
    ))}
  </div>
);

const App: React.FC = () => {
  // --- State & Logic (הלוגיקה המתוקנת) ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // אתחול מנוע בעת שינוי שפה
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

  // --- ממשק משתמש נקי ומדויק (לפי התמונה) ---
  return (
    <div className="h-screen w-screen bg-[#0F172A] text-white flex flex-col items-center justify-between p-6 font-sans overflow-hidden relative">
      
      {/* כותרת עליונה עדינה */}
      <header className="absolute top-6 left-6 flex items-center gap-2 opacity-70">
          <Globe size={20} className="text-indigo-400" />
          <h1 className="text-sm font-bold tracking-widest uppercase">LingoLive Pro</h1>
      </header>

      {/* סטטוס */}
      <div className="absolute top-6 right-6 flex items-center gap-2 bg-[#1E293B] px-4 py-2 rounded-full border border-slate-700">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-500'}`} />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
            {isActive ? 'LIVE' : 'READY'}
          </span>
      </div>

      {/* מרכז המסך */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl gap-10 mt-10">
          
          {/* ויזואליזציה מרכזית נקייה (במקום אווטאר ענק) */}
          <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500 ${
              isActive ? 'bg-[#1E293B] border border-indigo-500/30 shadow-[0_0_60px_rgba(99,102,241,0.2)]' : 'bg-[#1E293B]/50 border border-slate-700'
          }`}>
               {isActive ? (
                  <AudioVisualizer animate={appState === 'speaking' || appState === 'listening'} />
               ) : (
                  <Mic size={80} className="text-slate-600" />
               )}
          </div>

          {/* טקסט סטטוס */}
          <h2 className="text-4xl font-bold text-white tracking-tight text-center h-12">
             {appState === 'listening' && "Listening..."}
             {appState === 'processing' && "Translating..."}
             {appState === 'speaking' && "Speaking..."}
             {appState === 'idle' && "Ready to translate?"}
          </h2>

          {/* בוררי שפות - נקיים וברורים */}
          <div className="w-full flex items-center justify-between gap-4 px-4 p-4 bg-[#1E293B] rounded-2xl border border-slate-700">
              
              {/* שפת מקור */}
              <div className="relative flex-1 h-16">
                <select 
                    value={langA} 
                    onChange={e => setLangA(e.target.value)} 
                    className="w-full h-full appearance-none bg-[#0F172A] border border-slate-600 rounded-xl pl-4 pr-10 text-lg font-medium text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0F172A]">{l.label}</option>)}
                </select>
                <Globe size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* חץ */}
              <ArrowRight size={24} className="text-slate-500" />

              {/* שפת יעד */}
              <div className="relative flex-1 h-16">
                <select 
                    value={langB} 
                    onChange={e => setLangB(e.target.value)} 
                    className="w-full h-full appearance-none bg-[#0F172A] border border-slate-600 rounded-xl pl-4 pr-10 text-lg font-medium text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0F172A]">{l.label}</option>)}
                </select>
                <Globe size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

          </div>
      </main>

      {/* כפתור פעולה ראשי - רחב וברור בתחתית */}
      <footer className="w-full max-w-2xl mb-6 relative z-20">
           {error && (
             <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-300 text-sm font-bold bg-red-950/80 px-4 py-2 rounded-full border border-red-500/50 animate-pulse whitespace-nowrap">
               <StopCircle size={16} /> {error}
             </div>
           )}
           
           <button 
             onClick={handleToggle} 
             className={`group w-full py-5 rounded-2xl font-bold text-xl shadow-lg transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3 ${
                isActive 
                ? 'bg-gradient-to-r from-red-600 to-red-700' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600'
             }`}
           >
             {isActive ? (
                <>
                    <LogOut size={24} /> STOP TRANSLATION
                </>
             ) : (
                <>
                    <PlayCircle size={24} /> START TRANSLATION
                </>
             )}
           </button>
      </footer>

    </div>
  );
};

export default App;
