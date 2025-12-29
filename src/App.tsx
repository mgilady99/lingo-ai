import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Mic,
  Headphones,
  MessageCircle,
  GraduationCap,
  ArrowRightLeft,
  ExternalLink,
  StopCircle,
  Play
} from 'lucide-react';

// --- הגדרות (ללא שינוי) ---
const getApiKey = () => {
  try { return import.meta.env.VITE_API_KEY; } catch (e) { return ""; }
};

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
  // הגדרת ברירות מחדל שיתאימו לתמונה (אנגלית לעברית)
  const [langA, setLangA] = useState('en-US');
  const [langB, setLangB] = useState('he-IL');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

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

  // --- רכיבי עזר לממשק ---

  // רכיב כרטיס צד ימין
  const InfoCard = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="bg-[#111426] p-6 rounded-3xl flex flex-col items-center text-center w-full max-w-md mb-6 shadow-lg border border-slate-800/50">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        {subtitle && <p className="text-slate-300 text-lg font-bold mb-4">{subtitle}</p>}
        <button className="bg-[#2A2F4A] hover:bg-[#363c5e] text-[#8B92FF] text-sm font-bold py-2 px-8 rounded-xl flex items-center gap-2 transition-colors">
            Link <ExternalLink size={14} />
        </button>
    </div>
  );

  return (
    // מיכל ראשי - רקע כהה מאוד, תופס את כל המסך, פריסת Flex
    <div className="flex h-screen w-screen bg-[#080B14] text-white font-sans overflow-hidden">

      {/* === סרגל צד שמאל (Left Sidebar) === */}
      <aside className="w-[380px] bg-[#111426] p-6 flex flex-col gap-8 border-r border-slate-800/30 relative z-10 shadow-2xl">
          {/* לוגו וכותרת */}
          <div className="flex items-center gap-3 pl-2">
              <div className="bg-[#8B92FF] p-2 rounded-lg">
                <Headphones size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">LINGOLIVE PRO</h1>
          </div>

          {/* אזור בחירת שפות */}
          <div className="flex flex-col gap-3 p-5 bg-[#1A1F36] rounded-[30px] border border-slate-700/30 shadow-inner">
               {/* שפת מקור */}
               <div className="flex flex-col gap-2">
                  <label className="text-[11px] text-slate-400 ml-4 font-bold uppercase tracking-wider">NATIVE LANGUAGE</label>
                  <div className="relative">
                      <select
                          value={langA}
                          onChange={e => setLangA(e.target.value)}
                          className="w-full appearance-none bg-[#111426] border border-slate-700/50 rounded-2xl px-4 py-3 pr-10 text-sm font-medium text-white outline-none focus:border-[#8B92FF] transition-all cursor-pointer shadow-sm"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#111426]">{l.label}</option>)}
                      </select>
                  </div>
               </div>

               {/* אייקון החלפה */}
               <div className="flex justify-center -my-1 relative z-10">
                  <div className="bg-[#2A2F4A] p-1.5 rounded-full border border-slate-600/50 shadow-md">
                       <ArrowRightLeft size={14} className="text-slate-300" />
                  </div>
               </div>

               {/* שפת יעד */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] text-slate-400 ml-4 font-bold uppercase tracking-wider">TARGET LANGUAGE</label>
                  <div className="relative">
                      <select
                          value={langB}
                          onChange={e => setLangB(e.target.value)}
                          className="w-full appearance-none bg-[#111426] border border-slate-700/50 rounded-2xl px-4 py-3 pr-10 text-sm font-medium text-white outline-none focus:border-[#8B92FF] transition-all cursor-pointer shadow-sm"
                      >
                          {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#111426]">{l.label}</option>)}
                      </select>
                  </div>
               </div>
          </div>

          {/* גריד כפתורי מודולים */}
          <div className="grid grid-cols-2 gap-4 mt-2">
              {/* כפתור פעיל - LIVE TRANSLATION */}
              <button className="bg-[#5D65F6] p-4 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]">
                  <Mic size={32} className="text-white" />
                  <span className="text-[11px] font-extrabold text-center leading-tight tracking-wider">LIVE<br/>TRANSLATION</span>
              </button>
              {/* כפתורים לא פעילים (ויזואלית בלבד) */}
              <button className="bg-[#1A1F36] border border-slate-700/30 p-4 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-all hover:border-slate-500">
                  <Headphones size={32} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 text-center leading-tight tracking-wider">SIMULTANEOUS<br/>TRANS</span>
              </button>
              <button className="bg-[#1A1F36] border border-slate-700/30 p-4 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-all hover:border-slate-500">
                  <MessageCircle size={32} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 text-center leading-tight tracking-wider">CHAT<br/>CONVERSATION</span>
              </button>
              <button className="bg-[#1A1F36] border border-slate-700/30 p-4 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-all hover:border-slate-500">
                  <GraduationCap size={32} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 text-center leading-tight tracking-wider">LANGUAGE<br/>LEARNING</span>
              </button>
          </div>

          {/* אזור אווטאר משתמש */}
          <div className="mt-auto mb-4 flex justify-center">
               {/* תמונה זמנית - יש להחליף לתמונת המשתמש האמיתית */}
              <img
                  src="https://i.pravatar.cc/150?img=47"
                  alt="User Avatar"
                  className="w-24 h-24 rounded-full border-4 border-[#1A1F36] shadow-xl"
              />
          </div>

          {/* הודעת שגיאה */}
          {error && (
              <div className="text-red-400 text-xs text-center flex items-center justify-center gap-1 animate-pulse absolute bottom-24 left-0 right-0">
                  <StopCircle size={12} /> {error}
              </div>
          )}

          {/* כפתור התחל ראשי (Start Button) */}
