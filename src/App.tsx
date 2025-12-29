import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- אייקונים פנימיים (SVG) כדי למנוע קריסות תלות ---
const IconMic = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IconStop = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconSettings = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

// --- הגדרות ---
const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
];

const MODULES = [
  { id: 'translator', name: 'Live Translator', prompt: (s:string, t:string) => `Translate from ${s} to ${t}. Output only translation.` },
  { id: 'chat', name: 'Conversation', prompt: (s:string, t:string) => `Chat in ${t}. Keep it short.` },
  { id: 'tutor', name: 'Language Tutor', prompt: (s:string, t:string) => `Teach ${t}. Correct mistakes.` }
];

const App = () => {
  // State
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState("idle"); // idle, listening, processing, speaking
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [sourceLang, setSourceLang] = useState('he-IL');
  const [targetLang, setTargetLang] = useState('en-US');
  const [selectedModule, setSelectedModule] = useState(MODULES[0]);

  // Refs
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // בטוח לשימוש גם אם process/meta לא מוגדרים
  const getApiKey = () => {
    try {
      return import.meta.env.VITE_API_KEY;
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  const stopSession = useCallback(() => {
    setIsActive(false);
    isSessionActiveRef.current = false;
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    window.speechSynthesis.cancel();
  }, []);

  const startSession = async () => {
    const key = getApiKey();
    if (!key) {
      setError("חסר מפתח API (VITE_API_KEY)");
      return;
    }
    setError(null);
    setIsActive(true);
    isSessionActiveRef.current = true;
    startListening();
  };

  const startListening = () => {
    if (!isSessionActiveRef.current) return;
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("דפדפן לא נתמך (רק Chrome)");
      return;
    }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      if (isSessionActiveRef.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text }]);
      await processAI(text);
    };

    recognition.onerror = (e: any) => {
        // התעלמות משגיאות קטנות, טיפול בחוסר הרשאה
        if (e.error === 'not-allowed') {
            setError("אין גישה למיקרופון");
            stopSession();
        }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {
      console.error(e);
    }
  };

  const processAI = async (text: string) => {
    try {
      const key = getApiKey();
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const sName = LANGUAGES.find(l => l.code === sourceLang)?.name;
      const tName = LANGUAGES.find(l => l.code === targetLang)?.name;

      const prompt = `${selectedModule.prompt(sName||'', tName||'')}\nInput: "${text}"`;
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      setTranscript(prev => [...prev, { role: 'ai', text: response }]);
      speakResponse(response);

    } catch (e: any) {
      console.error(e);
      setError("שגיאת AI: " + (e.message || "Unknown error"));
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;

    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;
    
    // המנגנון הרציף
    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- UI ---
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row overflow-hidden" dir="ltr">
      
      {/* Sidebar */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-r border-white/5 p-4 flex flex-col gap-4 z-20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">L</div>
          <h1 className="text-lg font-bold italic tracking-tighter text-white">LINGOLIVE</h1>
        </div>

        <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <IconSettings /> <span className="text-[10px] font-bold uppercase">Settings</span>
          </div>

          <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} disabled={isActive} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs">
             {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} disabled={isActive} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs">
             {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          <select value={selectedModule.id} onChange={e => setSelectedModule(MODULES.find(m=>m.id===e.target.value)||MODULES[0])} disabled={isActive} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs">
             {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-800/30 rounded-xl border border-white/5 p-2 overflow-hidden">
           <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
             {transcript.map((t, i) => (
               <div key={i} className={`p-2 rounded-lg text-xs ${t.role==='user'?'bg-indigo-600/20 ml-4 border border-indigo-500/30':'bg-slate-800 mr-4 border border-slate-700'}`}>
                 <span className="block text-[8px] font-bold uppercase opacity-50 mb-1">{t.role === 'user' ? 'You' : 'AI'}</span>
                 {t.text}
               </div>
             ))}
           </div>
        </div>
      </aside>

      {/* Main Screen */}
      <main className="flex-1 h-full flex flex-col relative items-center justify-center p-6 bg-slate-950">
        
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase">{isActive ? appState : 'OFFLINE'}</span>
        </div>

        {/* Avatar */}
        <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${
             appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.5)] scale-110' : 
             appState === 'listening' ? 'border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.4)]' : 
             appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-slate-800'
        } bg-slate-900`}>
             {appState === 'listening' ? <IconMic /> : 
              appState === 'speaking' ? <div className="animate-bounce">🔊</div> : 
              <span className="text-2xl font-black text-slate-700">AI</span>}
        </div>

        <div className="mt-8 text-center h-20">
          <h2 className="text-3xl font-black text-white">
             {appState === 'listening' && "Listening..."}
             {appState === 'processing' && "Thinking..."}
             {appState === 'speaking' && "Speaking..."}
             {appState === 'idle' && "Ready?"}
          </h2>
          {error && <div className="text-red-400 text-sm mt-2 font-bold bg-red-900/20 px-3 py-1 rounded inline-block">{error}</div>}
        </div>

        <div className="absolute bottom-12 w-full max-w-sm px-6">
           {!isActive ? (
             <button onClick={startSession} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
               <IconMic /> START
             </button>
           ) : (
             <button onClick={stopSession} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
               <IconStop /> STOP
             </button>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
