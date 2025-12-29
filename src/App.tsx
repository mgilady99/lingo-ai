import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, Headphones, MessageCircle, GraduationCap, ArrowRightLeft, ExternalLink, StopCircle } from 'lucide-react';

// --- הגדרות API (ללא שינוי) ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

// --- רשימת שפות (ללא שינוי) ---
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

const App: React.FC = () => {
  // --- State & Logic (הלוגיקה המקורית נשמרת במלואה) ---
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

  // --- רכיב כרטיס מידע בצד ימין ---
  const InfoCard = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="bg-[#161B28] p-5 rounded-2xl flex flex-col items-end text-right w-full max-w-sm mb-4 shadow-lg border border-[#2A3045]">
        <h3 className="text-white font-bold text-base mb-1" dir="rtl">{title}</h3>
        {subtitle && <p className="text-slate-400 text-sm mb-3 font-mono">{subtitle}</p>}
        <button className="bg-[#2A3045] hover:bg-[#353b54] text-[#6C72FF] text-xs font-bold py-2 px-5 rounded-xl flex items-center gap-2 transition-colors">
            Link <ExternalLink size={14} />
        </button>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#0F121A] text-white font-sans overflow-hidden">
      
      {/* === סרגל צד שמאל (Sidebar) === */}
      <aside className="w-[360px] bg-[#161B28] p-6 flex flex-col gap-6 border-r border-slate-800/50 relative z-20 shadow-2xl">
          
          {/* לוגו */}
          <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#2A3045] rounded-xl">
                <Headphones size={24} className="text-[#6C72FF]" />
              </div>
              <h1 className="text-xl font-black tracking-wide">LINGOLIVE PRO</h1>
          </div>

          {/* בוררי שפות - מעוצבים כמו בתמונה */}
          <div className="flex flex-col gap-3 p-4 bg-[#1E2433] rounded-3xl border border-[#2A3045]">
               
               {/* שפת מקור */}
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 ml-2 font-bold uppercase tracking-wider">Native Language</label>
                  <div className="relative">
                      <select 
                          value={langA} 
                          onChange={e => setLangA(e.target.value)} 
                          className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer"
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
                          className="w-full appearance-none bg-[#2A3045] border border-slate-700 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-white outline-none focus:border-[#6C72FF] transition-all cursor-pointer"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#2A3045]">{l.label}</option>)}
                      </select>
                  </div>
               </div>
          </div>

          {/* כפתורי מודולים (גריד) */}
          <div className="grid grid-cols-2 gap-3 flex-1">
              <button className="bg-[#4E54C8] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-lg shadow-indigo-500/30 border border-indigo-400/50 transition-transform active:scale-95">
                  <Mic size={28} className="text-white" />
                  <span className="text-[10px] font-black text-center leading-tight tracking-wider">LIVE<br/>TRANSLATION</span>
              </button>
              <button className="bg-[#1E2433] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-all border border-[#2A3045] hover:border-[#6C72FF]">
                  <Headphones size={28} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 text-center leading-tight tracking-wider">SIMULTANEOUS<br/>TRANS</span>
              </button>
              <button className="bg-[#1E2433] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-all border border-[#2A3045] hover:border-[#6C72FF]">
                  <MessageCircle size={28} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 text-center leading-tight tracking-wider">CHAT<br/>CONVERSATION</span>
              </button>
              <button className="bg-[#1E2433] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-all border border-[#2A3045] hover:border-[#6C72FF]">
                  <GraduationCap size={28} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 text-center leading-tight tracking-wider">LANGUAGE<br/>LEARNING</span>
              </button>
          </div>

          {/* אזור אווטאר משתמש */}
          <div className="flex justify-center py-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#6C72FF] rounded-full blur-md opacity-30"></div>
                <img 
                    src="https://i.pravatar.cc/150?img=47" 
                    alt="User Avatar" 
                    className="w-24 h-24 rounded-full border-4 border-[#212738] relative z-10 shadow-xl"
                />
              </div>
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
            className={`w-full py-4 rounded-full font-black text-base shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 ${
                isActive 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                : 'bg-[#6C72FF] hover:bg-[#7a80ff] shadow-indigo-500/30'
            }`}
          >
            {isActive ? (
               <>
                  <StopCircle size={20} />
                  {appState === 'listening' ? 'LISTENING...' : appState === 'processing' ? 'TRANSLATING...' : appState === 'speaking' ? 'SPEAKING...' : 'STOP'}
               </>
            ) : (
               <>
                  <Mic size={20} /> START
               </>
            )}
          </button>

      </aside>

      {/* === תוכן ראשי ימין (כרטיסי מידע) === */}
      <main className="flex-1 bg-[#0F121A] p-10 flex flex-col items-center justify-center relative overflow-hidden">
          {/* אפקט רקע עדין */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1A2333] via-[#0F121A] to-[#0F121A] opacity-60 pointer-events-none"></div>

          <div className="z-10 w-full flex flex-col items-end gap-6 pr-10">
              {/* כרטיס ראשי - פרטים בעברית */}
              <InfoCard 
                  title='מאיר גלעד-מומחה לנדל"ן מסחרי -' 
                  subtitle="0522530087" 
              />

              {/* כרטיסי דמה */}
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
              <InfoCard title="פרסם כאן" />
          </div>
      </main>

    </div>
  );
};

export default App;
