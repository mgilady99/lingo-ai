import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- מניעת שגיאות Build של TypeScript ---
// אנחנו מגדירים למערכת שהמיקרופון קיים בדפדפן
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// --- הגדרות ---
const API_KEY = import.meta.env.VITE_API_KEY;

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
];

const MODULES = [
  { id: 'translator', name: 'מתרגם', prompt: (s:string, t:string) => `Translate from ${s} to ${t}. Output only translation.` },
  { id: 'chat', name: 'שיחה', prompt: (s:string, t:string) => `You are a friend. Chat in ${t}. Keep it short.` },
  { id: 'tutor', name: 'מורה', prompt: (s:string, t:string) => `Correct grammar and reply in ${t}.` },
  { id: 'interview', name: 'ראיון', prompt: (s:string, t:string) => `Interview me in ${t} for a job.` }
];

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [sourceLang, setSourceLang] = useState('he-IL');
  const [targetLang, setTargetLang] = useState('en-US');
  const [selectedModule, setSelectedModule] = useState(MODULES[0]);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRunning = useRef(false);

  // לולאת הקשבה
  const startListening = useCallback(() => {
    if (!isRunning.current) return;
    window.speechSynthesis.cancel();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("דפדפן לא נתמך");
      return;
    }

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
      setTranscript(prev => [...prev, { role: 'user', text }]);
      await callGemini(text);
    };
    rec.onerror = () => isRunning.current && setTimeout(startListening, 1000);
    
    try { rec.start(); recognitionRef.current = rec; } catch(e) {}
  }, [sourceLang]);

  const callGemini = async (userInput: string) => {
    try {
      if (!API_KEY) { setError("חסר API KEY"); return; }
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `${selectedModule.prompt(sourceLang, targetLang)}\nInput: ${userInput}`;
      const result = await model.generateContent(prompt);
      const aiText = result.response.text();

      setTranscript(prev => [...prev, { role: 'ai', text: aiText }]);
      speak(aiText);
    } catch (e) {
      if (isRunning.current) startListening();
    }
  };

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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row overflow-hidden font-sans" dir="ltr">
      <aside className="w-full md:w-80 bg-slate-900 border-r border-white/5 p-6 flex flex-col gap-6">
        <h1 className="text-xl font-black text-indigo-500 italic">LINGOLIVE PRO</h1>
        <div className="bg-slate-800/30 p-4 rounded-2xl border border-white/5 space-y-4">
          <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs">
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs">
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map(m => (
              <button key={m.id} onClick={() => setSelectedModule(m)} className={`p-2 rounded-xl text-[10px] font-bold border ${selectedModule.id === m.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-slate-950/50 rounded-2xl border border-white/5 p-4 overflow-y-auto space-y-2 text-[10px]">
          {transcript.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'text-indigo-400' : 'text-slate-300'}>
              <span className="font-bold uppercase text-[8px] opacity-40 block">{t.role}</span>
              {t.text}
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col items-center justify-center p-8">
        <div className={`w-40 h-40 rounded-full border-4 flex items-center justify-center transition-all duration-500 bg-slate-900 ${
          appState === 'listening' ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' :
          appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.4)]' :
          'border-slate-800'
        }`}>
          {appState === 'listening' ? <span className="animate-ping">🎤</span> : <span className="text-4xl opacity-20">👤</span>}
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-3xl font-black">{appState.toUpperCase()}</h2>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>
        <div className="absolute bottom-12 w-full max-w-xs px-6">
          <button onClick={handleToggle} className={`w-full py-4 rounded-2xl font-black text-lg shadow-2xl transition-all ${isActive ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {isActive ? 'STOP' : 'START CONVERSATION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
