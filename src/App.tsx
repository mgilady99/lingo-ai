import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, LogOut, MessageSquare, Settings, Globe } from 'lucide-react';

// ✅ נתיבים מותאמים לעץ הקבצים שלך
import Avatar from '../components/Avatar';
import AudioVisualizer from '../components/AudioVisualizer';
import TranscriptItem from '../components/transcriptitem';

// --- הגדרות שפה ומודולים ---
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
    name: 'Live Translation', 
    icon: '🌐',
    getPrompt: (src: string, trg: string) => `You are a professional translator. Translate the user's input from ${src} to ${trg}. Output ONLY the translated text.` 
  },
  { 
    id: 'chat', 
    name: 'Chat Conversation', 
    icon: '💬',
    getPrompt: (src: string, trg: string) => `You are a conversational partner. User speaks ${src}, you reply in ${trg}. Keep it natural and short.` 
  },
  { 
    id: 'tutor', 
    name: 'Language Learning', 
    icon: '🎓',
    getPrompt: (src: string, trg: string) => `You are a language tutor. User speaks ${src}. Reply in ${trg} and correct their grammar if needed.` 
  },
  { 
    id: 'simultaneous', 
    name: 'Simultaneous Trans', 
    icon: '🎧',
    getPrompt: (src: string, trg: string) => `Simultaneous interpreter mode. Translate ${src} to ${trg} instantly and accurately.` 
  }
];

const App: React.FC = () => {
  // --- מצבי מערכת ---
  const [isActive, setIsActive] = useState(false); // האם הסשן פעיל?
  const [appState, setAppState] = useState("idle"); // idle, listening, processing, speaking
  const [transcript, setTranscript] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- הגדרות משתמש (ברירת מחדל) ---
  const [sourceLangCode, setSourceLangCode] = useState('he-IL'); // אני מדבר עברית
  const [targetLangCode, setTargetLangCode] = useState('en-US'); // ה-AI עונה באנגלית
  const [selectedModuleId, setSelectedModuleId] = useState('translator');

  // --- Refs ---
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // מפתח ה-API מ-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית לתמלול
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // --- פונקציות שליטה ---

  const stopSession = useCallback(() => {
    setIsActive(false);
    setAppState("idle");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
    window.speechSynthesis.cancel();
  }, []);

  const startSession = async () => {
    if (!apiKey) {
      setError("שגיאה: חסר מפתח VITE_API_KEY ב-Vercel");
      return;
    }
    setError(null);
    setIsActive(true);
    
    // התחלת הלולאה
    startListening();
  };

  // --- מנוע הדיבור וההקשבה (הלולאה) ---

  const startListening = () => {
    // השתקת דיבור קודם
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("דפדפן זה לא תומך בדיבור. אנא השתמש ב-Chrome.");
      return;
    }

    // איפוס מופע קודם
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLangCode; // ✅ מקשיב לשפה שבחרת
    recognition.continuous = false;    // ✅ עוצר אוטומטית כשיש שקט (סוף משפט)
    recognition.interimResults = false;

    recognition.onstart = () => setAppState("listening");

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      // 1. קלטנו דיבור -> עוברים לעיבוד
      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
      
      // 2. שולחים ל-Gemini
      await processWithGemini(text);
    };

    recognition.onend = () => {
      // אם המיקרופון נסגר בגלל שקט, אבל אנחנו עדיין במצב הקשבה -> פתח מחדש
      // (זה קורה לפעמים אם יש שתיקה ארוכה)
      // הערה: את הלולאה הראשית אנחנו עושים ב-speakResponse
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) {
      console.error("Mic error", e);
    }
  };

  const processWithGemini = async (text: string) => {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const srcName = LANGUAGES.find(l => l.code === sourceLangCode)?.name;
      const trgName = LANGUAGES.find(l => l.code === targetLangCode)?.name;
      const module = MODULES.find(m => m.id === selectedModuleId);

      // בניית ההוראה ל-AI
      const prompt = `${module?.getPrompt(srcName || '', trgName || '')}\nInput: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      setTranscript(prev => [...prev, { role: 'model', text: responseText, timestamp: new Date() }]);
      
      // 3. ה-AI מדבר את התשובה
      speakResponse(responseText);

    } catch (err) {
      setError("תקלת תקשורת עם ה-AI");
      // אם נכשל, נסה לחזור להקשיב
      if (isActive) startListening();
    }
  };

  const speakResponse = (text: string) => {
    if (!isActive) return;

    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLangCode; // ✅ מדבר בשפת היעד
    
    // 🔥 כאן הקסם: כשהוא מסיים לדבר -> הוא פותח מיקרופון מיד
    utterance.onend = () => {
      if (isActive) {
        setAppState("listening");
        startListening(); // <--- הלולאה הרציפה
      }
    };

    // טיפול בשגיאות דיבור (למשל אם השפה לא מותקנת)
    utterance.onerror = () => {
      if (isActive) startListening(); // גם אם נכשל לדבר, תחזור להקשיב
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- UI (LingoLive Pro Design) ---
  
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="ltr">
      
      {/* סרגל צד שמאלי - הגדרות ותמלול */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-r border-white/5 p-5 flex flex-col gap-4 shadow-2xl z-20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white text-xl">L</div>
          <h1 className="text-xl font-black tracking-tighter italic">LINGOLIVE PRO</h1>
        </div>

        {/* בחירת שפות ומודולים (כפתורים יפים) */}
        <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 space-y-4">
          
          <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Source (Mic)</span>
                <select 
                  value={sourceLangCode}
                  onChange={(e) => setSourceLangCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Target (AI)</span>
                <select 
                  value={targetLangCode}
                  onChange={(e) => setTargetLangCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
             </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Select Module</span>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map(m => (
                <button 
                  key={m.id}
                  onClick={() => setSelectedModuleId(m.id)}
                  className={`p-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 text-center ${
                    selectedModuleId === m.id 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* אזור התמלול */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-slate-800/30">
            <MessageSquare size={14} className="text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Transcript</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.map((entry, i) => (
              <TranscriptItem key={i} entry={entry} />
            ))}
          </div>
        </div>
      </aside>

      {/* מסך ראשי */}
      <main className="flex-1 h-full flex flex-col relative bg-slate-950">
        
        {/* אינדיקטור סטטוס */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl z-10">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isActive ? appState : "OFFLINE"}
          </span>
        </div>

        {/* מרכז המסך - אווטאר */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative group">
            {/* אפקט הילה סביב האווטאר כשהוא מדבר */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${appState === 'speaking' ? 'opacity-75 animate-pulse' : ''}`}></div>
            
            <div className="relative">
               <Avatar state={appState === 'speaking' ? 'speaking' : appState === 'processing' ? 'thinking' : appState === 'listening' ? 'listening' : 'idle'} />
            </div>
          </div>
          
          <div className="mt-12 text-center space-y-4">
            <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-2xl">
              {appState === 'listening' && "I'm Listening..."}
              {appState === 'processing' && "Translating..."}
              {appState === 'speaking' && "Speaking..."}
              {appState === 'idle' && "Ready to Start?"}
            </h2>
            
            <div className="flex items-center justify-center gap-3 text-slate-400 bg-slate-900/50 py-2 px-4 rounded-full border border-white/5">
              <Globe size={14} />
              <span className="text-xs font-bold tracking-wide">
                {LANGUAGES.find(l => l.code === sourceLangCode)?.name} ➔ {LANGUAGES.find(l => l.code === targetLangCode)?.name}
              </span>
            </div>
          </div>

          <div className="mt-10 h-16 flex items-center justify-center w-full max-w-sm">
            {(appState === 'listening' || appState === 'speaking') && (
              <AudioVisualizer isActive={true} color={appState === 'speaking' ? '#818cf8' : '#34d399'} />
            )}
          </div>
        </div>

        {/* כפתור שליטה ראשי */}
        <div className="w-full border-t border-white/5 bg-slate-900/50 backdrop-blur-sm px-6 py-8 flex items-center justify-center z-20">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            {error && (
               <div className="w-full text-center bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold py-2 px-4 rounded-lg animate-pulse">
                 {error}
               </div>
            )}
            
            {isActive ? (
               <button 
                 onClick={stopSession} 
                 className="group relative w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-3"
               >
                 <LogOut size={24} className="group-hover:scale-110 transition-transform"/> 
                 STOP SESSION
               </button>
            ) : (
              <button 
                onClick={startSession} 
                className="group relative w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-5 rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-900/30 active:scale-95 flex items-center justify-center gap-3"
              >
                <Mic size={28} className="animate-bounce" /> 
                START CONVERSATION
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
