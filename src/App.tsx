import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, LogOut, Globe, StopCircle, PlayCircle, ArrowRight, Brain, ChevronDown } from 'lucide-react';

// --- הגדרות ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

const LANGUAGES = [
  { code: 'he-IL', name: 'Hebrew', label: '🇮🇱 Hebrew' },
  { code: 'en-US', name: 'English', label: '🇺🇸 English' },
  { code: 'es-ES', name: 'Spanish', label: '🇪🇸 Spanish' },
  { code: 'fr-FR', name: 'French', label: '🇫🇷 French' },
  { code: 'ru-RU', name: 'Russian', label: '🇷🇺 Russian' },
  { code: 'ar-SA', name: 'Arabic', label: '🇸🇦 Arabic' },
  { code: 'de-DE', name: 'German', label: '🇩🇪 German' },
  { code: 'it-IT', name: 'Italian', label: '🇮🇹 Italian' },
  { code: 'zh-CN', name: 'Chinese', label: '🇨🇳 Chinese' },
  { code: 'hi-IN', name: 'Hindi', label: '🇮🇳 Hindi' },
];

const App: React.FC = () => {
  // --- State & Logic (אותה לוגיקה מתוקנת מהגרסה הקודמת) ---
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

  // אתחול מנוע בעת שינוי שפת מקור
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
    if (!SpeechRecognition) { setError("Browser not supported (use Chrome)"); return; }
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
        if (event.error === 'not-allowed') { setError("Mic permission denied"); stopSession(); } 
        else if (isSessionActiveRef.current && event.error !== 'aborted') { setTimeout(startListening, 500); }
    };
    try { recognition.start(); recognitionRef.current = recognition; } catch(e) {}
  }, [langA, appState]);

  const processTranslation = async (text: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) { setError("API Key missing"); return; }
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
      console.error(e); setError("AI Error. Retrying...");
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

  // --- ממשק משתמש חדש (תואם לתמונה) ---
  return (
    <div className="h-screen w-screen bg-gradient-to-b from-[#0a0514] to-[#1a0b2e] text-white flex flex-col items-center justify-between p-8 font-sans overflow-hidden relative">
      
      {/* כותרת עליונה */}
      <header className="absolute top-8 left-8 flex items-center gap-3 opacity-80">
          <Globe size={28} className="text-purple-400" />
          <h1 className="text-2xl font-black tracking-[0.2em] uppercase">LingoLive Pro</h1>
      </header>

      {/* סטטוס חיבור */}
      <div className="absolute top-8 right-8 flex items-center gap-3 bg-[#2a1a4a] px-5 py-2.5 rounded-full border border-purple-500/30 shadow-xl">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-slate-500'}`} />
          <span className="text-sm font-bold uppercase tracking-widest">
            {isActive ? 'ACTIVE' : 'READY'}
          </span>
      </div>

      {/* מרכז המסך */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl gap-14 -mt-20">
          
          {/* אווטאר מרכזי ענק וזוהר */}
          <div className={`relative w-80 h-80 rounded-full flex items-center justify-center transition-all duration-700 border-4 border-purple-500/30 bg-gradient-to-b from-[#2a1a4a] to-[#1a0b2e] ${
              appState === 'listening' ? 'shadow-[0_0_150px_rgba(34,197,94,0.4)] border-green-500/50' :
              appState === 'speaking' ? 'shadow-[0_0_180px_rgba(168,85,247,0.5)] scale-105 border-purple-500/80' :
              'shadow-[0_0_100px_rgba(168,85,247,0.2)]'
          }`}>
               <div className="absolute inset-6 rounded-full border-2 border-white/5"></div>
               
               {/* אייקון מרכזי שמשתנה */}
               {appState === 'listening' ? (
                   <Mic size={120} className="text-green-400 animate-pulse" />
               ) : appState === 'speaking' ? (
                   <Brain size={120} className="text-purple-300 animate-pulse-slow" />
               ) : (
                   <Brain size={120} className="text-purple-400/40" />
               )}
          </div>

          {/* טקסט סטטוס ראשי */}
          <h2 className="text-5xl font-black text-white tracking-tight text-center drop-shadow-2xl">
             {appState === 'listening' && "Listening..."}
             {appState === 'processing' && "Translating..."}
             {appState === 'speaking' && "Speaking..."}
             {appState === 'idle' && "Ready to translate?"}
          </h2>

          {/* בוררי שפות - גדולים ומעוצבים כמו בתמונה */}
          <div className="w-full flex items-center justify-center gap-6 px-4">
              
              {/* שפת מקור */}
              <div className="relative flex-1 max-w-xs h-24 group">
                <div className="absolute inset-0 bg-[#2a1a4a] rounded-2xl border-2 border-[#3b2b5b] group-hover:border-purple-500/50 transition-all"></div>
                <select 
                    value={langA} 
                    onChange={e => setLangA(e.target.value)} 
                    className="relative w-full h-full appearance-none bg-transparent pl-6 pr-12 text-2xl font-bold text-white outline-none cursor-pointer z-10"
                >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#1a0b2e]">{l.label}</option>)}
                </select>
                <ChevronDown size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none z-0" />
              </div>

              {/* חץ מעבר */}
              <ArrowRight size={40} className="text-purple-500/50" />

              {/* שפת יעד */}
              <div className="relative flex-1 max-w-xs h-24 group">
                <div className="absolute inset-0 bg-[#2a1a4a] rounded-2xl border-2 border-[#3b2b5b] group-hover:border-purple-500/50 transition-all"></div>
                <select 
                    value={langB} 
                    onChange={e => setLangB(e.target.value)} 
                    className="relative w-full h-full appearance-none bg-transparent pl-6 pr-12 text-2xl font-bold text-white outline-none cursor-pointer z-10"
                >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#1a0b2e]">{l.label}</option>)}
                </select>
                <ChevronDown size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none z-0" />
              </div>

          </div>
      </main>

      {/* כפתור פעולה ראשי - ענק בתחתית */}
      <footer className="w-full max-w-3xl mb-8 relative z-20">
           {error && (
             <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex items-center gap-3 text-red-200 text-lg font-bold bg-red-950/90 px-6 py-3 rounded-full border-2 border-red-500/50 animate-pulse whitespace-nowrap shadow-xl">
               <StopCircle size={24} /> {error}
             </div>
           )}
           
           <button 
             onClick={handleToggle} 
             className={`group w-full py-8 rounded-full font-black text-4xl tracking-wider shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-6 relative overflow-hidden ${
                isActive 
                ? 'bg-gradient-to-r from-red-600 to-pink-700 shadow-[0_10px_60px_rgba(220,38,38,0.5)]' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_10px_60px_rgba(168,85,247,0.5)]'
             }`}
           >
             <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity mix-blend-overlay"></div>
             {isActive ? (
                <>
                    <LogOut size={48} /> STOP
                </>
             ) : (
                <>
                    <PlayCircle size={48} /> START TRANSLATION
                </>
             )}
           </button>
      </footer>

    </div>
  );
};

export default App;
