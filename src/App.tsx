import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, MessageSquare, Settings, Globe, StopCircle } from 'lucide-react';

// --- הגדרות ---
const API_KEY = import.meta.env.VITE_API_KEY;

// 13 השפות המבוקשות
const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
  { code: 'ar-SA', name: 'Arabic', label: 'العربية 🇸🇦' },
  { code: 'de-DE', name: 'German', label: 'Deutsch 🇩🇪' },
  { code: 'it-IT', name: 'Italian', label: 'Italiano 🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese', label: 'Português 🇧🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', label: '中文 (简体) 🇨🇳' },
  { code: 'ja-JP', name: 'Japanese', label: '日本語 🇯🇵' },
  { code: 'ko-KR', name: 'Korean', label: '한국어 🇰🇷' },
  { code: 'hi-IN', name: 'Hindi', label: 'हिन्दी 🇮🇳' },
];

const MODULES = [
  { 
    id: 'translator', 
    name: 'Live Translator', 
    desc: 'מתרגם מדויק בלבד',
    getPrompt: (s:string, t:string) => `Task: Strictly translate the input from ${s} to ${t}. Rules: Output ONLY the translated text. Do NOT explain. Do NOT repeat the input. If untranslatable, output nothing.`
  },
  { 
    id: 'chat', 
    name: 'Conversation', 
    desc: 'שיחה טבעית קצרה',
    getPrompt: (s:string, t:string) => `You are a conversational partner. The user speaks ${s}. Reply naturally in ${t}. Keep responses short (1-2 sentences).`
  },
  { 
    id: 'tutor', 
    name: 'Language Tutor', 
    desc: 'תיקון ותירגול',
    getPrompt: (s:string, t:string) => `Act as a language teacher. User speaks ${s}. Reply in ${t}. Briefly correct any major grammatical errors in their input before replying.`
  },
  { 
    id: 'simultaneous', 
    name: 'Simultaneous', 
    desc: 'תרגום מהיר',
    getPrompt: (s:string, t:string) => `Mode: Simultaneous Interpretation. Translate input from ${s} to ${t} immediately and accurately. No extra text.`
  }
];

// קומפוננטה חדשה לוויזואליזציה של גלי קול
const AudioWaveform = ({ animate }: { animate: boolean }) => (
  <div className="flex items-center gap-1.5 h-20">
    {[...Array(7)].map((_, i) => (
      <div
        key={i}
        className={`w-2.5 bg-indigo-400 rounded-full ${animate ? 'animate-musical-bars' : 'h-3 opacity-50'}`}
        style={{
          animationDelay: `${i * 0.1}s`,
          height: animate ? `${Math.random() * 100}%` : '8px'
        }}
      />
    ))}
  </div>
);

const App: React.FC = () => {
  // --- State ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [selectedModuleId, setSelectedModuleId] = useState('translator');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role:string, text:string}[]>([]);

  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- אתחול ---
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // --- לוגיקת ליבה ---
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
    if (!SpeechRecognition) { setError("דפדפן לא נתמך"); return; }

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SpeechRecognition();
    recognition.lang = langA; 
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        if(isSessionActiveRef.current) setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text || !text.trim()) return;

      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text }]);
      await processBidirectional(text);
    };

    recognition.onend = () => {
        if (isSessionActiveRef.current && appState === 'listening') {
            try { recognition.start(); } catch(e){}
        }
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
            setError("אין גישה למיקרופון");
            stopSession();
        } else if (isSessionActiveRef.current && event.error !== 'aborted') {
            setTimeout(startListening, 500);
        }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {}
  }, [langA, appState]);

  const processBidirectional = async (text: string) => {
    try {
      if (!API_KEY) { setError("חסר מפתח API"); return; }
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      // שליפת השמות באנגלית עבור ה-Prompt
      const nameA = LANGUAGES.find(l => l.code === langA)?.name || 'Unknown Language';
      const nameB = LANGUAGES.find(l => l.code === langB)?.name || 'Unknown Language';
      const module = MODULES.find(m => m.id === selectedModuleId);

      let prompt = '';
      if (module?.id === 'translator' || module?.id === 'simultaneous') {
        // פרומפט דו-כיווני דינמי עבור כל צמד שפות
        prompt = `
          You are a bidirectional simultaneous interpreter between ${nameA} and ${nameB}.
          Context: A conversation between two people.
          Rule 1: If the user speaks in ${nameA}, translate it to ${nameB}.
          Rule 2: If the user speaks in ${nameB}, translate it to ${nameA}.
          Rule 3: Output ONLY the translated text. No explanations. No parroting.
          Input: "${text}"
        `;
      } else {
         prompt = `${module?.getPrompt(nameA, nameB)}\n\nInput Text: "${text}"`;
      }
      
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      if (!response) {
        if (isSessionActiveRef.current) startListening();
        return;
      }

      setTranscript(prev => [...prev, { role: 'ai', text: response }]);
      speakResponse(response);

    } catch (e: any) {
      console.error(e);
      setError("שגיאת AI, מנסה שוב...");
      if (isSessionActiveRef.current) setTimeout(startListening, 1000);
    }
  };

  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;
    setAppState("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    
    // זיהוי שפה אוטומטי פשוט (ניתן לשכלל עם ספריית זיהוי שפה אם צריך)
    // כרגע בודק עברית כברירת מחדל, אחרת משתמש בשפה השנייה
    const isHebrew = /[א-ת]/.test(text);
    utterance.lang = isHebrew ? 'he-IL' : langB;

    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        startListening();
      }
    };
    
    utterance.onerror = () => {
        if (isSessionActiveRef.current) startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) {
      stopSession();
    } else {
      isSessionActiveRef.current = true;
      setIsActive(true);
      startListening();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row overflow-hidden font-sans" dir="ltr">
      
      {/* Sidebar - כמו בתמונה */}
      <aside className="w-full md:w-96 h-full bg-[#0f172a] border-r border-white/5 p-6 flex flex-col gap-6 shadow-2xl z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-500/20">L</div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">LINGOLIVE PRO</h1>
        </div>

        <div className="bg-slate-800/40 p-5 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Settings size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Configuration</span>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Module</label>
             <select 
                value={selectedModuleId} 
                onChange={e => setSelectedModuleId(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold appearance-none cursor-pointer"
             >
               {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">First Language (Mic)</label>
             <select 
                value={langA} 
                onChange={e => setLangA(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold appearance-none cursor-pointer"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>
          
          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Second Language (AI)</label>
             <select 
                value={langB} 
                onChange={e => setLangB(e.target.value)} 
                disabled={isActive}
                className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold appearance-none cursor-pointer"
             >
               {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
             </select>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-800/20 rounded-xl border border-white/5 overflow-hidden">
           <div className="p-3 bg-slate-800/50 border-b border-white/5 flex items-center gap-2">
             <MessageSquare size={14} className="text-indigo-400"/>
             <span className="text-[10px] font-bold uppercase tracking-wider">Live Transcript</span>
           </div>
           <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
             {transcript.length === 0 && (
               <div className="text-center text-slate-600 text-xs mt-10 opacity-50">Transcript will appear here...</div>
             )}
             {transcript.map((t, i) => (
               <div key={i} className={`flex flex-col gap-1 p-3 rounded-xl text-xs max-w-[90%] shadow-sm ${t.role==='user'?'bg-indigo-600/20 border border-indigo-500/30 self-end ml-auto rounded-br-none':'bg-slate-700/50 border border-slate-600/30 mr-auto rounded-bl-none'}`}>
                 <div className="flex justify-between opacity-70 text-[9px] font-bold uppercase tracking-wider">
                    <span className={t.role === 'user' ? 'text-indigo-300' : 'text-slate-300'}>{t.role === 'user' ? 'You' : 'AI'}</span>
                 </div>
                 <p className="leading-relaxed">{t.text}</p>
               </div>
             ))}
           </div>
        </div>
      </aside>

      {/* Main Screen - כמו בתמונה */}
      <main className="flex-1 h-full flex flex-col relative items-center justify-center p-8 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e293b]">
        
        {/* Status Pill */}
        <div className="absolute top-8 right-8 flex items-center gap-3 bg-slate-900/80 px-5 py-2.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl z-20">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-500'}`} />
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">
            {isActive ? appState : 'READY'}
          </span>
        </div>

        {/* Center UI - Visualizer & Text */}
        <div className="flex flex-col items-center gap-12 z-10 -mt-16">
          
          {/* Visualizer Area */}
          <div className={`relative w-80 h-80 rounded-full flex items-center justify-center transition-all duration-700 ${
               isActive ? 'bg-gradient-to-br from-indigo-900/50 to-purple-900/50 shadow-[0_0_120px_rgba(99,102,241,0.3)] border border-indigo-500/30' : 'bg-slate-900/50 border border-white/5'
          }`}>
               <div className="absolute inset-4 rounded-full border border-white/10"></div>
               <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:30px_30px] rounded-full opacity-50"></div>
               
               {isActive ? (
                  <AudioWaveform animate={appState === 'speaking' || appState === 'listening'} />
               ) : (
                  <Globe size={100} className="text-white/10" />
               )}
          </div>

          <div className="text-center space-y-6">
            <h2 className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl leading-tight">
               {appState === 'listening' && "I'm Listening..."}
               {appState === 'processing' && "Translating..."}
               {appState === 'speaking' && "Speaking..."}
               {appState === 'idle' && "Ready to Start?"}
            </h2>
            
            <div className="flex flex-col items-center gap-3">
                <div className="inline-flex items-center justify-center gap-4 text-slate-300 text-lg bg-slate-900/60 px-8 py-3 rounded-full border border-white/10 shadow-lg font-bold tracking-wide uppercase">
                <span>{LANGUAGES.find(l=>l.code===langA)?.name}</span>
                <span className="text-indigo-500 text-xl">⇌</span>
                <span>{LANGUAGES.find(l=>l.code===langB)?.name}</span>
                </div>
                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold bg-slate-900/40 px-4 py-1 rounded-full">
                    {MODULES.find(m=>m.id===selectedModuleId)?.name} Mode
                </p>
            </div>
          </div>
        </div>

        {/* Action Button - כמו בתמונה */}
        <div className="absolute bottom-16 w-full max-w-md px-6 z-20">
           {error && (
             <div className="flex items-center gap-3 text-red-300 text-xs font-bold justify-center mb-6 bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-pulse shadow-lg">
               <StopCircle size={16} /> {error}
             </div>
           )}
           
           <button 
             onClick={handleToggle} 
             className={`group w-full py-7 rounded-[3rem] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden ${
                isActive 
                ? 'bg-gradient-to-r from-red-600 to-pink-600 shadow-[0_20px_60px_-10px_rgba(220,38,38,0.5)] border border-red-400/20' 
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_20px_60px_-10px_rgba(79,70,229,0.5)] border border-indigo-400/20'
             }`}
           >
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             {isActive ? (
                <>
                    <LogOut size={32} /> STOP SESSION
                </>
             ) : (
                <>
                    <Mic size={32} /> START SESSION
                </>
             )}
           </button>
        </div>

      </main>
    </div>
  );
};

export default App;
