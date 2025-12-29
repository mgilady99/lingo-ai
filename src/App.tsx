import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, LogOut, MessageSquare, Globe, Settings } from 'lucide-react';

// נתיבים מותאמים לעץ הקבצים שלך
import Avatar from '../components/Avatar';
import AudioVisualizer from '../components/AudioVisualizer';
import TranscriptItem from '../components/transcriptitem';

const LANGUAGES = [
  { code: 'en-US', name: 'English', label: 'English 🇺🇸' },
  { code: 'he-IL', name: 'Hebrew', label: 'עברית 🇮🇱' },
  { code: 'es-ES', name: 'Spanish', label: 'Español 🇪🇸' },
  { code: 'fr-FR', name: 'French', label: 'Français 🇫🇷' },
  { code: 'ru-RU', name: 'Russian', label: 'Русский 🇷🇺' },
];

const MODULES = [
  { 
    id: 'translator', 
    name: 'Translator / מתרגם', 
    getPrompt: (src: string, trg: string) => `You are a professional translator. Translate the user's input from ${src} to ${trg}. Output ONLY the translated text.` 
  },
  { 
    id: 'chat', 
    name: 'Chat / שיחה', 
    getPrompt: (src: string, trg: string) => `You are a friend. User speaks ${src}, reply in ${trg}. Keep it short.` 
  }
];

const App: React.FC = () => {
  // --- מצבי מערכת ---
  const [isActive, setIsActive] = useState(false); // האם השיחה פעילה?
  const [appState, setAppState] = useState("idle"); // idle, listening, processing, speaking
  const [transcript, setTranscript] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- הגדרות משתמש ---
  const [sourceLangCode, setSourceLangCode] = useState('he-IL'); // אני מדבר עברית
  const [targetLangCode, setTargetLangCode] = useState('en-US'); // הוא עונה באנגלית
  const [selectedModuleId, setSelectedModuleId] = useState('translator');

  // --- Refs ---
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // עצירת חירום
  const stopConversation = useCallback(() => {
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
    window.speechSynthesis.cancel();
  }, []);

  // התחלת שיחה
  const startConversation = async () => {
    if (!apiKey) {
      setError("שגיאה: חסר VITE_API_KEY ב-Vercel");
      return;
    }
    setError(null);
    setIsActive(true);
    
    // התחלת הלולאה
    startListening();
  };

  // --- המנוע: הקשבה ---
  const startListening = () => {
    if (!isActive) return; // בדיקת ביטחון

    // השתקת דיבור קודם
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("דפדפן לא נתמך. השתמש ב-Chrome");
      return;
    }

    // ניקוי
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLangCode; // השפה שאני מדבר בה
    recognition.continuous = false;    // חשוב: עוצר לבד בסוף משפט
    recognition.interimResults = false;

    recognition.onstart = () => setAppState("listening");

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      // 1. קלטנו דיבור -> עוצרים מיקרופון ועוברים לעיבוד
      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
      
      // 2. שולחים ל-Gemini
      await processWithGemini(text);
    };

    recognition.onend = () => {
      // אם המיקרופון נסגר אבל עדיין לא עיבדנו כלום (שקט) והשיחה פעילה -> פתח שוב
      if (isActive && appState === "listening") {
        try { recognition.start(); } catch(e) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {
      console.error("Mic error", e);
    }
  };

  // --- המנוע: חשיבה ---
  const processWithGemini = async (text: string) => {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLangCode)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLangCode)?.name;
      const module = MODULES.find(m => m.id === selectedModuleId);

      const prompt = `${module?.getPrompt(srcName || '', trgName || '')}\nInput: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      setTranscript(prev => [...prev, { role: 'model', text: responseText, timestamp: new Date() }]);
      
      // 3. עוברים לדיבור
      speakResponse(responseText);

    } catch (err) {
      setError("שגיאת תרגום");
      // במקרה שגיאה - חוזרים להקשיב
      if (isActive) startListening();
    }
  };

  // --- המנוע: דיבור ---
  const speakResponse = (text: string) => {
    if (!isActive) return;

    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLangCode; // מדבר בשפת היעד
    
    utterance.onend = () => {
      // 4. סיום דיבור -> החלק הכי חשוב: חזרה אוטומטית להקשבה
      if (isActive) {
        setAppState("listening");
        startListening(); // <--- הנה הלולאה
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- UI ---
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="ltr">
      
      {/* סרגל צד */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-r border-white/5 p-5 flex flex-col gap-4 shadow-2xl z-20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white">L</div>
          <h1 className="text-xl font-black tracking-tighter italic">LingoLive</h1>
        </div>

        {/* הגדרות */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <Settings size={14} /> <span className="text-[10px] font-bold uppercase">Settings</span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Module</label>
            <select 
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
            >
              {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">I Speak (Input)</label>
            <select 
              value={sourceLangCode}
              onChange={(e) => setSourceLangCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">AI Speaks (Output)</label>
            <select 
              value={targetLangCode}
              onChange={(e) => setTargetLangCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* תמלול */}
        <div className="flex-1 flex flex-col min-h-0">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <MessageSquare size={12} /> Live Transcript
          </label>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.map((entry, i) => (
              <TranscriptItem key={i} entry={entry} />
            ))}
          </div>
        </div>
      </aside>

      {/* מסך ראשי */}
      <main className="flex-1 h-full flex flex-col relative bg-slate-950">
        
        {/* סטטוס עליון */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl z-10">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isActive ? appState : "READY"}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Avatar state={appState === 'speaking' ? 'speaking' : appState === 'processing' ? 'thinking' : appState === 'listening' ? 'listening' : 'idle'} />
          
          <div className="mt-8 text-center space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">
              {appState === 'listening' && "I'm Listening..."}
              {appState === 'processing' && "Translating..."}
              {appState === 'speaking' && "Speaking..."}
              {appState === 'idle' && "Ready to Translate?"}
            </h2>
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <Globe size={14} />
              <span>{LANGUAGES.find(l => l.code === sourceLangCode)?.name} ➔ {LANGUAGES.find(l => l.code === targetLangCode)?.name}</span>
            </div>
          </div>

          <div className="mt-8 h-12 flex items-center justify-center w-full max-w-xs">
            {(appState === 'listening' || appState === 'speaking') && (
              <AudioVisualizer isActive={true} color={appState === 'speaking' ? '#6366f1' : '#10b981'} />
            )}
          </div>
        </div>

        {/* כפתורים */}
        <div className="w-full border-t border-white/5 bg-slate-900/50 backdrop-blur-sm px-6 py-8 flex items-center justify-center">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            {error && <div className="text-red-400 text-xs font-bold bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">{error}</div>}
            
            {isActive ? (
               <button onClick={stopConversation} className="bg-red-500 hover:bg-red-600 px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 shadow-lg w-full justify-center">
                 <LogOut size={20} /> Stop Session
               </button>
            ) : (
              <button onClick={startConversation} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center gap-3 shadow-lg w-full justify-center active:scale-95">
                <Mic size={24} /> Start Translation Loop
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
