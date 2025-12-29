import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- הגדרות ---
const API_KEY = import.meta.env.VITE_API_KEY;

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
];

const MODULES = [
  { id: 'translator', name: 'Live Translation', icon: '🌐' },
  { id: 'simultaneous', name: 'Simultaneous', icon: '🎧' },
  { id: 'chat', name: 'Chat Mode', icon: '💬' },
  { id: 'learning', name: 'Learning', icon: '🎓' }
];

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [sourceLang, setSourceLang] = useState('he-IL'); // שפת המקור ניתנת לשינוי
  const [targetLang, setTargetLang] = useState('en-US'); // שפת היעד ניתנת לשינוי
  const [selectedModule, setSelectedModule] = useState('translator');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRunning = useRef(false);

  // --- לוגיקת תרגום וקול ---

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
      await translateWithGemini(text);
    };

    rec.onerror = () => {
      if (isRunning.current) setTimeout(startListening, 1000);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch(e) {}
  }, [sourceLang]);

  const translateWithGemini = async (userInput: string) => {
    try {
      if (!API_KEY) throw new Error("API Key Missing");
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLang)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLang)?.name;

      const prompt = `Translate this from ${srcName} to ${trgName}. Output ONLY the translation: "${userInput}"`;
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text();

      speak(translatedText);
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
        startListening(); // חזרה אוטומטית להקשבה
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleSession = () => {
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
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col md:flex-row overflow-hidden font-sans" dir="ltr">
      
      {/* סרגל צד (Sidebar) - בדיוק כמו בתמונה */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-r border-white/5 p-6 flex flex-col gap-6 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">L</div>
          <h1 className="text-xl font-black italic tracking-tighter">LINGOLIVE PRO</h1>
        </div>

        {/* בחירת שפות - שדות פתוחים לשינוי */}
        <div className="space-y-4 bg-slate-800/30 p-4 rounded-2xl border border-white/5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Input</label>
              <select 
                value={sourceLang} 
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Output</label>
              <select 
                value={targetLang} 
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* מודולים (4 שדות) */}
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map(m => (
              <button 
                key={m.id}
                onClick={() => setSelectedModule(m.id)}
                className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all border ${
                  selectedModule === m.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span className="text-lg">{m.icon}</span>
                <span className="text-[9px] font-bold uppercase">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-slate-950/50 rounded-2xl border border-white/5 p-4 flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">Status</span>
          <div className="text-xs text-slate-400 italic">
            {appState === 'listening' && "Listening to you..."}
            {appState === 'processing' && "Translating with AI..."}
            {appState === 'speaking' && "AI is speaking..."}
            {appState === 'idle' && "Ready for session."}
          </div>
        </div>
      </aside>

      {/* מסך ראשי */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-950 to-slate-900">
        
        {/* אינדיקטור Connected */}
        <div className="absolute top-8 right-8 flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{isActive ? 'CONNECTED' : 'OFFLINE'}</span>
        </div>

        {/* אווטאר מעוצב */}
        <div className="flex flex-col items-center gap-10">
          <div className={`relative w-56 h-56 rounded-full border-4 flex items-center justify-center transition-all duration-700 ${
            appState === 'listening' ? 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)]' :
            appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.4)] scale-105' :
            appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-white/10'
          }`}>
            <div className="absolute inset-2 rounded-full border border-white/5"></div>
            {appState === 'speaking' ? (
              <div className="flex gap-1 h-12 items-center">
                <div className="w-1.5 bg-indigo-500 rounded-full animate-[bounce_1s_infinite] h-12" />
                <div className="w-1.5 bg-indigo-400 rounded-full animate-[bounce_1.2s_infinite] h-8" />
                <div className="w-1.5 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite] h-12" />
              </div>
            ) : (
              <span className="text-6xl opacity-20 italic font-black">AI</span>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-5xl font-black tracking-tighter">
              {appState === 'listening' && "AI Listening..."}
              {appState === 'processing' && "Translating..."}
              {appState === 'speaking' && "AI Speaking..."}
              {appState === 'idle' && "Start Conversation"}
            </h2>
          </div>
        </div>

        {/* כפתור הפעלה גדול בתחתית */}
        <div className="absolute bottom-12 w-full max-w-sm px-6">
          <button 
            onClick={toggleSession}
            className={`w-full py-6 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
              isActive ? 'bg-red-600 shadow-red-900/40' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40'
            }`}
          >
            {isActive ? "STOP SESSION" : "START TRANSLATION"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
