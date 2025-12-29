import React, { useState, useRef, useEffect, useCallback } from 'react';
// שינוי: אין צורך בייבוא ישיר של ספריית ה-AI כאן, זה קורה בשרת
import { Mic, Headphones, StopCircle, Key, ArrowRightLeft, ExternalLink, Trash2, RefreshCw, Activity } from 'lucide-react';

// --- הגדרות שפות (ללא שינוי) ---
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

// --- רכיב ויזואליזציה ---
const AudioVisualizer = ({ animate, state }: { animate: boolean, state: string }) => {
  const colorClass = state === 'speaking' ? 'bg-cyan-400' : 'bg-green-400';
  return (
    <div className="flex items-center gap-1 h-12">
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${colorClass} transition-all duration-200 ${animate ? 'animate-pulse' : 'h-1 opacity-20'}`}
          style={{
            height: animate ? `${Math.random() * 100}%` : '4px',
            animationDelay: `${i * 0.05}s`
          }}
        />
      ))}
    </div>
  );
};

const App: React.FC = () => {
  // --- State (ללא שינוי) ---
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [langA, setLangA] = useState('he-IL');
  const [langB, setLangB] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role:string, text:string}[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // --- טעינת קולות ---
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- גלילה אוטומטית ---
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // --- ריסטרט למנוע בעת שינוי שפה ---
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
    setError(null);

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
      setTranscript(prev => [...prev, { role: 'user', text }]);
      // קריאה לפונקציית התרגום החדשה (דרך השרת)
      await processTranslationServer(text);
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

  // --- פונקציית תרגום חדשה: שולחת בקשה לשרת Vercel ---
  const processTranslationServer = async (text: string) => {
    try {
      const sourceLangName = LANGUAGES.find(l => l.code === langA)?.name || 'Unknown';
      const targetLangName = LANGUAGES.find(l => l.code === langB)?.name || 'Unknown';

      // שליחת בקשה לנקודת הקצה החדשה שיצרנו
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sourceLangName,
          targetLangName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation failed on server');
      }

      const data = await response.json();
      const translatedText = data.translation;

      if (!translatedText) { 
          if (isSessionActiveRef.current) startListening(); 
          return; 
      }
      
      setTranscript(prev => [...prev, { role: 'model', text: translatedText }]);
      speakResponse(translatedText);
      
    } catch (e: any) {
      console.error(e); 
      setError(`שגיאת שרת: ${e.message}`);
      setAppState("idle");
      if (isSessionActiveRef.current) setTimeout(startListening, 2000);
    }
  };

  // --- מנוע דיבור (ללא שינוי) ---
  const speakResponse = (text: string) => {
    if (!isSessionActiveRef.current) return;
    setAppState("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langB;

    const targetVoice = availableVoices.find(v => v.lang === utterance.lang) || 
                        availableVoices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (targetVoice) utterance.voice = targetVoice;

    utterance.onend = () => {
      if (isSessionActiveRef.current) {
        setAppState("listening");
        setTimeout(() => startListening(), 100);
      }
    };
    
    utterance.onerror = () => { if (isSessionActiveRef.current) startListening(); };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isActive) { stopSession(); } else { isSessionActiveRef.current = true; setIsActive(true); startListening(); }
  };

  // --- ממשק המשתמש (העיצוב מהתמונה שאישרת) ---
  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-sans">
      
      {/* Header */}
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
           <div className="flex flex-col text-left">
             <span className="font-black text-sm tracking-tight">LingoLive Pro</span>
             <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                <Activity size={10} className={isActive ? 'animate-pulse' : ''} />
                {isActive ? 'SECURE SERVER ACTIVE' : 'READY'}
             </span>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setTranscript([])} className="p-2.5 text-slate-500 hover:text-white transition-colors" title="Clear History"><Trash2 size={18} /></button>
           <button onClick={() => window.location.reload()} className="p-2.5 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg transition-colors"><RefreshCw size={18} /></button>
           {isActive && (
             <button onClick={stopSession} className="bg-red-500/20 text-red-400 p-2.5 rounded-lg border border-red-500/20"><XCircle size={18} /></button>
           )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* === סרגל צד שמאל (Sidebar) === */}
        <aside className="w-[360px] bg-[#161B28] p-6 flex flex-col gap-6 border-r border-slate-800/50 relative z-20 shadow-2xl overflow-y-auto">
            
            {/* בוררי שפות */}
            <div className="flex flex-col gap-3 p-4 bg-[#1E2433] rounded-3xl border border-[#2A3045]">
                 
                 {/* שפת מקור */}
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 ml-2 font-bold uppercase tracking-wider">Native Language</label>
                    <div className="relative">
                        <select 
                            value={langA} 
                            onChange={e => setLangA(e.target.value)} 
                            disabled={isActive}
                            className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#2A3045]">{l.label}</option>)}
                        </select>
                    </div>
                 </div>

                 {/* אייקון החלפה */}
                 <div className="flex justify-center -my-2 z-10 relative">
                    <div className="bg-[#2A3045] p-2 rounded-full border border-slate-700 shadow-sm">
                         <ArrowRightLeft size={16} className="text-[#6C72FF]" />
                    </div>
                 </div>

                 {/* שפת יעד */}
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 ml-2 font-bold uppercase tracking-wider">Target Language</label>
                    <div className="relative">
                        <select 
                            value={langB} 
                            onChange={e => setLangB(e.target.value)} 
                            disabled={isActive}
                            className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#2A3045]">{l.label}</option>)}
                        </select>
                    </div>
                 </div>
            </div>

            {/* איזור ויזואליזציה וסטטוס */}
            <div className="flex flex-col items-center justify-center gap-4 py-4 bg-[#1E2433] rounded-3xl border border-[#2A3045] min-h-[200px]">
               {isActive ? (
                  <AudioVisualizer animate={appState === 'speaking' || appState === 'listening'} state={appState} />
               ) : (
                  <Mic size={60} className="text-slate-600 opacity-50" />
               )}
               <h2 className="text-2xl font-black text-white tracking-tight text-center h-10 uppercase">
                  {appState === 'listening' && <span className="text-green-400">Listening...</span>}
                  {appState === 'processing' && <span className="text-yellow-400">Translating...</span>}
                  {appState === 'speaking' && <span className="text-cyan-400">Speaking...</span>}
                  {appState === 'idle' && "Ready"}
               </h2>
            </div>

            {/* הודעת שגיאה */}
            {error && (
                <div className="text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse bg-red-950/50 p-2 rounded-lg border border-red-500/30">
                    <StopCircle size={14} /> {error}
                </div>
            )}

            {/* כפתור התחלה/עצירה ראשי */}
            <button 
              onClick={handleToggle} 
              className={`w-full py-4 rounded-full font-black text-base shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 mt-auto ${
                  isActive 
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                  : 'bg-[#6C72FF] hover:bg-[#7a80ff] shadow-indigo-500/30'
              }`}
            >
              {isActive ? (
                 <>
                    <StopCircle size={20} /> STOP SESSION
                 </>
              ) : (
                 <>
                    <Mic size={20} /> START SESSION
                 </>
              )}
            </button>

        </aside>

        {/* === תוכן ראשי ימין (כרטיסי מידע + תמלול) === */}
        <main className="flex-1 bg-[#0F121A] p-8 flex flex-col relative overflow-hidden">
            {/* אפקט רקע עדין */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1A2333] via-[#0F121A] to-[#0F121A] opacity-60 pointer-events-none"></div>

            <div className="z-10 w-full flex flex-col gap-6 h-full">
                
                {/* איזור כרטיסים עליון (דוגמה) */}
                <div className="flex flex-col items-end gap-4">
                   <div className="bg-[#161B28] p-5 rounded-2xl flex flex-col items-end text-right w-full max-w-sm shadow-lg border border-[#2A3045]">
                      <h3 className="text-white font-bold text-base mb-1" dir="rtl">מאיר גלעד-מומחה לנדל"ן מסחרי</h3>
                      <p className="text-slate-400 text-sm mb-3 font-mono">0522530087</p>
                       <button className="bg-[#2A3045] hover:bg-[#353b54] text-[#6C72FF] text-xs font-bold py-2 px-5 rounded-xl flex items-center gap-2 transition-colors">
                          Link <ExternalLink size={14} />
                      </button>
                  </div>
                </div>

                {/* איזור תמלול חי (Live Transcript) */}
                <div className="flex-1 flex flex-col bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/60">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Live Transcript</h3>
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-bold">{transcript.length} Messages</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-3">
                    {transcript.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-600 opacity-40 italic text-sm">
                        {isActive ? "Listening..." : "Ready to start conversation."}
                      </div>
                    ) : (
                      transcript.map((entry, idx) => (
                        <div key={idx} className={`flex flex-col gap-1 max-w-[85%] ${entry.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${entry.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                            {entry.role === 'user' ? 'You' : 'AI Translation'}
                          </span>
                          <div className={`p-3 rounded-2xl text-sm ${entry.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 rounded-br-none' : 'bg-emerald-600/20 border border-emerald-500/30 rounded-bl-none'}`}>
                            {entry.text}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

            </div>
        </main>

      </div>
    </div>
  );
};

export default App;
