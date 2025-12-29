import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- הגדרות ---
const API_KEY = import.meta.env.VITE_API_KEY;

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
];

const MODULES = [
  { id: 'translator', name: 'Live Translator', icon: '🌐' },
  { id: 'simultaneous', name: 'Simultaneous', icon: '🎧' },
  { id: 'chat', name: 'Chat Mode', icon: '💬' },
  { id: 'learning', name: 'Learning', icon: '🎓' }
];

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL'); // שפה ראשונה
  const [langB, setLangB] = useState('en-US'); // שפה שנייה
  const [selectedModule, setSelectedModule] = useState('translator');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isSessionActive = useRef(false);

  // --- לוגיקת ליבה ---

  const stopSession = useCallback(() => {
    isSessionActive.current = false;
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
  }, []);

  const startListening = useCallback(() => {
    if (!isSessionActive.current) return;
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SpeechRecognition();
    // מגדירים לו להקשיב לשתי השפות במידת האפשר (בדפדפן זה לרוב עובד לפי ה-Primary)
    recognition.lang = langA; 
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      if(isSessionActive.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      setAppState("processing");
      await processBidirectional(text);
    };

    recognition.onend = () => {
      // אם היה שקט והסשן פעיל, נפתח שוב
      if (isSessionActive.current && appState === 'listening') {
        try { recognition.start(); } catch(e){}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {}
  }, [langA, appState]);

  const processBidirectional = async (text: string) => {
    try {
      if (!API_KEY) return;
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const nameA = LANGUAGES.find(l => l.code === langA)?.name;
      const nameB = LANGUAGES.find(l => l.code === langB)?.name;

      // הנחיה לתרגום דו-כיווני חכם
      const prompt = `
        You are a bidirectional simultaneous interpreter between ${nameA} and ${nameB}.
        Context: A conversation between two people.
        Rule 1: If the user speaks in ${nameA}, translate it to ${nameB}.
        Rule 2: If the user speaks in ${nameB}, translate it to ${nameA}.
        Rule 3: Output ONLY the translated text. No explanations. No parroting.
        Input: "${text}"
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      if (!response) {
        if (isSessionActive.current) startListening();
        return;
      }

      speakResponse(response);
    } catch (e) {
      if (isSessionActive.current) startListening();
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActive.current) return;
    setAppState("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    
    // זיהוי שפה אוטומטי להשמעה (עברית או אנגלית)
    // בדיקה פשוטה: אם יש אותיות עבריות, נשתמש בעברית. אחרת אנגלית.
    const isHebrew = /[א-ת]/.test(text);
    utterance.lang = isHebrew ? 'he-IL' : langB;

    utterance.onend = () => {
      if (isSessionActive.current) {
        setAppState("listening");
        startListening(); // חזרה אוטומטית להקשבה
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) {
      stopSession();
    } else {
      isSessionActive.current = true;
      setIsActive(true);
      startListening();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row overflow-hidden font-sans" dir="ltr">
      
      {/* Sidebar - הגדרות בלבד (ללא צ'אט כתוב) */}
      <aside className="w-full md:w-80 h-full bg-[#0f172a] border-r border-white/5 p-6 flex flex-col gap-8 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg">L</div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">LINGOLIVE PRO</h1>
        </div>

        <div className="bg-slate-800/40 p-5 rounded-2xl border border-white/5 space-y-6">
          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Language</label>
             <select 
                value={langA} 
                onChange={e => setLangA(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>
          
          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secondary Language</label>
             <select 
                value={langB} 
                onChange={e => setLangB(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MODULES.map(m => (
              <button 
                key={m.id}
                onClick={() => setSelectedModule(m.id)}
                disabled={isActive}
                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${
                  selectedModule === m.id ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <span className="text-[9px] font-black uppercase">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto text-center p-4">
           <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Bidirectional Mode Active</p>
        </div>
      </aside>

      {/* Main Screen */}
      <main className="flex-1 h-full flex flex-col relative items-center justify-center p-8 bg-gradient-to-br from-[#020617] to-[#0f172a]">
        
        {/* Status Pill */}
        <div className="absolute top-8 right-8 flex items-center gap-3 bg-slate-900/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            {isActive ? 'LIVE SESSION' : 'OFFLINE'}
          </span>
        </div>

        {/* Center UI */}
        <div className="flex flex-col items-center gap-12 z-10 -mt-16">
          
          {/* Avatar Area */}
          <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-700 border-[6px] ${
               appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.3)] scale-105' : 
               appState === 'listening' ? 'border-green-500 shadow-[0_0_60px_rgba(34,197,94,0.2)]' : 
               appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-slate-800'
          } bg-slate-900/40`}>
               
               {appState === 'speaking' ? (
                  <div className="flex gap-1.5 h-16 items-center">
                     <div className="w-2.5 bg-indigo-500 rounded-full animate-[bounce_1s_infinite] h-full"></div>
                     <div className="w-2.5 bg-indigo-400 rounded-full animate-[bounce_1.2s_infinite] h-2/3"></div>
                     <div className="w-2.5 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite] h-full"></div>
                  </div>
               ) : appState === 'listening' ? (
                  <div className="w-20 h-20 rounded-full bg-green-500/20 animate-ping"></div>
               ) : (
                  <span className="text-7xl font-black text-white/5 italic">AI</span>
               )}
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">
               {appState === 'listening' && "Listening..."}
               {appState === 'processing' && "Thinking..."}
               {appState === 'speaking' && "Speaking..."}
               {appState === 'idle' && "Ready to Start?"}
            </h2>
            <div className="flex items-center justify-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest">
               <span>{LANGUAGES.find(l=>l.code===langA)?.name}</span>
               <span className="text-indigo-500">⇌</span>
               <span>{LANGUAGES.find(l=>l.code===langB)?.name}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="absolute bottom-12 w-full max-w-md px-6 z-20">
           {error && <div className="text-red-400 text-center mb-4 font-bold text-xs">{error}</div>}
           
           {!isActive ? (
             <button 
               onClick={handleToggle} 
               className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
             >
               <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
               START SESSION
             </button>
           ) : (
             <button 
               onClick={handleToggle} 
               className="w-full bg-red-600 hover:bg-red-500 text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
             >
               <div className="w-3 h-3 bg-white rounded-sm"></div>
               STOP SESSION
             </button>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
