import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- הגדרות בסיסיות ---
const API_KEY = import.meta.env.VITE_API_KEY;

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
];

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [sourceLang, setSourceLang] = useState('he-IL');
  const [targetLang, setTargetLang] = useState('en-US');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRunning = useRef(false);

  // --- מנוע הקשבה ---
  const startListening = useCallback(() => {
    if (!isRunning.current) return;
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}

    const rec = new SpeechRecognition();
    rec.lang = sourceLang;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setAppState('listening');
    rec.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;
      
      setAppState('processing');
      await callGemini(text);
    };

    rec.onerror = () => {
      if (isRunning.current) setTimeout(startListening, 1000);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch(e) {}
  }, [sourceLang]);

  // --- מנוע תרגום (Gemini) ---
  const callGemini = async (userInput: string) => {
    try {
      if (!API_KEY) return;
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLang)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLang)?.name;

      // פרומפט נוקשה למניעת אפקט ה"תוכי"
      const prompt = `You are a professional translator. 
      Task: Translate the user's input from ${srcName} to ${trgName}.
      Rules: Output ONLY the translated text. Do NOT repeat the user's words in their original language. Do NOT add explanations.
      Input: "${userInput}"`;

      const result = await model.generateContent(prompt);
      const aiText = result.response.text();

      speak(aiText);
    } catch (e) {
      if (isRunning.current) startListening();
    }
  };

  // --- מנוע דיבור ---
  const speak = (text: string) => {
    setAppState('speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;

    utterance.onend = () => {
      if (isRunning.current) {
        setAppState('listening');
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) {
      isRunning.current = false;
      setIsActive(false);
      setAppState('idle');
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      isRunning.current = true;
      setIsActive(true);
      startListening();
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-between p-6 overflow-hidden font-sans" dir="rtl">
      
      {/* כותרת ולוגו */}
      <header className="w-full flex justify-between items-center max-w-4xl">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20">L</div>
          <h1 className="text-2xl font-black italic tracking-tighter">LINGOLIVE</h1>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            {isActive ? appState : 'Offline'}
          </span>
        </div>
      </header>

      {/* אזור מרכזי: אווטאר ומצב */}
      <main className="flex flex-col items-center gap-10 py-10">
        
        {/* הגדרות שפה מהירות */}
        <div className="flex items-center gap-4 bg-slate-900/80 p-2 rounded-2xl border border-white/5 shadow-2xl">
          <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} disabled={isActive} className="bg-transparent text-sm font-bold outline-none cursor-pointer p-2">
            {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.label} (מקור)</option>)}
          </select>
          <div className="text-indigo-500 font-bold">➔</div>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} disabled={isActive} className="bg-transparent text-sm font-bold outline-none cursor-pointer p-2">
            {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.label} (יעד)</option>)}
          </select>
        </div>

        {/* אווטאר מעוצב */}
        <div className={`relative w-56 h-56 rounded-full border-4 flex items-center justify-center transition-all duration-700 bg-slate-900/50 ${
          appState === 'listening' ? 'border-green-500 shadow-[0_0_60px_rgba(34,197,94,0.3)] scale-105' :
          appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.4)] scale-110' :
          appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-white/10'
        }`}>
          {appState === 'listening' ? (
            <div className="flex gap-1 h-12 items-center">
              <div className="w-1.5 h-full bg-green-500 rounded-full animate-[bounce_1s_infinite]" />
              <div className="w-1.5 h-3/4 bg-green-500 rounded-full animate-[bounce_1.2s_infinite]" />
              <div className="w-1.5 h-full bg-green-500 rounded-full animate-[bounce_0.8s_infinite]" />
            </div>
          ) : appState === 'speaking' ? (
            <div className="text-4xl animate-pulse">🔊</div>
          ) : (
            <div className="text-6xl opacity-10">👤</div>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-black tracking-tight mb-2">
            {appState === 'listening' && "אני מקשיבה..."}
            {appState === 'processing' && "מתרגמת..."}
            {appState === 'speaking' && "משמיעה תרגום..."}
            {appState === 'idle' && "מוכנים להתחיל?"}
          </h2>
          <p className="text-slate-500 font-medium">התרגום יתבצע אוטומטית בכל סוף משפט</p>
        </div>
      </main>

      {/* כפתור הפעלה תחתון */}
      <footer className="w-full max-w-md pb-10">
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center p-3 rounded-xl mb-6">{error}</div>}
        
        <button 
          onClick={handleToggle}
          className={`group w-full py-6 rounded-3xl font-black text-xl transition-all duration-300 flex items-center justify-center gap-4 shadow-2xl active:scale-95 ${
            isActive 
            ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-red-500/20' 
            : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-500/30 hover:scale-[1.02]'
          }`}
        >
          {isActive ? (
            <>
              <div className="w-4 h-4 bg-white rounded-sm" />
              עצור תרגום
            </>
          ) : (
            <>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              התחל תרגום רציף
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

export default App;
