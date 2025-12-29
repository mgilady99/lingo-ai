import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ✅ תיקון נתיב 1: services נמצאת מחוץ ל-src, לכן צריך לצאת למעלה (../)
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

// ✅ תיקון נתיב 2: components נמצאת מחוץ ל-src, לכן יוצאים למעלה (../)
// חשוב: לפי התמונה, שמות הקבצים מתחילים באות גדולה, למעט transcriptitem
import Avatar from '../components/Avatar';
import TranscriptItem from '../components/transcriptitem'; 
import AudioVisualizer from '../components/AudioVisualizer';

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'he-IL', name: 'עברית', flag: '🇮🇱' }
];

const SCENARIOS = [
  { id: 'chat', title: 'שיחה חופשית', icon: '💬', description: 'שיפור שטף הדיבור עם בינה מלאכותית' },
  { id: 'translator', title: 'מתרגם אישי', icon: '🌐', description: 'תרגום סימולטני בין שפות' }
];

const App: React.FC = () => {
  const [status, setStatus] = useState("ready");
  const [targetLang, setTargetLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית של התמלול
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const stopConversation = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    window.speechSynthesis.cancel();
    setStatus("ready");
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    if (!apiKey) {
      setError("Missing API Key. Please check Vercel environment variables.");
      return;
    }

    try {
      setError(null);
      setStatus("connecting");
      
      // אישור מיקרופון
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      setStatus("connected");
      const intro = "Hello! I am LINGO-AI. Let's practice English together.";
      handleAIResponse(intro, model);
      
    } catch (e: any) {
      setError("Microphone access denied.");
      setStatus("ready");
    }
  };

  const initListening = (model: any) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang.code;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
      
      try {
        const result = await model.generateContent(`As a female tutor, respond naturally and briefly in English to: ${text}`);
        const aiText = result.response.text();
        handleAIResponse(aiText, model);
      } catch (err) {
        setError("AI error. Please try again.");
      }
    };

    recognition.onend = () => {
      // אם השיחה פעילה וה-AI לא מדברת, פותחים מיקרופון שוב
      if (status === "connected" && !isSpeaking) {
        try { recognition.start(); } catch(e) {}
      }
    };

    try {
        recognition.start();
        recognitionRef.current = recognition;
    } catch(e) {}
  };

  const handleAIResponse = (text: string, model: any) => {
    setTranscript(prev => [...prev, { role: 'model', text, timestamp: new Date() }]);
    
    // סגירת מיקרופון בזמן שהיא מדברת
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang.code;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // רק כשהיא מסיימת לדבר, המיקרופון נפתח מחדש
      if (status === "connected") {
        initListening(model);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white">L</div>
          <h1 className="text-xl font-black tracking-tighter italic">LingoLive</h1>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">הגדרות שפה</label>
          <div className="p-3 bg-slate-800/40 rounded-2xl border border-white/5">
            <select value={targetLang.code} onChange={(e) => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs outline-none">
              {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MessageSquare size={12} /> תמלול חי
          </label>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.map((entry, i) => (
              <div key={i} className={`p-3 rounded-xl text-[11px] ${entry.role === 'user' ? 'bg-indigo-600/10 mr-4' : 'bg-white/5 ml-4'}`}>
                <span className="opacity-40 block mb-1 text-[9px] font-bold uppercase">{entry.role === 'user' ? 'אתה' : 'AI'}</span>
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Experience */}
      <main className="flex-1 h-full flex flex-col relative bg-slate-950">
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl z-10">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Avatar state={status !== 'connected' ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
          
          <div className="mt-10 text-center">
            <h2 className="text-4xl font-black text-white tracking-tight">
              {status === 'connected' ? (isSpeaking ? 'AI מדברת...' : 'אני מקשיבה...') : 'מוכנים?'}
            </h2>
          </div>

          {(isSpeaking || (status === 'connected' && !isMuted)) && (
            <div className="mt-8 h-12 flex items-center justify-center">
              <AudioVisualizer isActive={true} color={isSpeaking ? '#6366f1' : '#10b981'} />
            </div>
          )}
        </div>

        <div className="w-full border-t border-white/5 bg-slate-950/60 backdrop-blur-sm px-6 py-8 flex items-center justify-center">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            {error && <div className="text-red-400 text-xs font-bold bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">{error}</div>}
            
            <div className="flex items-center gap-6">
              {status === 'connected' ? (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full border-2 transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}>
                    {isMuted ? <MicOff /> : <Mic />}
                  </button>
                  <button onClick={stopConversation} className="bg-red-600 px-12 py-5 rounded-2xl font-black hover:bg-red-700 transition-all flex items-center gap-2">
                    <LogOut size={20} /> סיום
                  </button>
                </>
              ) : (
                <button onClick={startConversation} className="bg-indigo-600 px-24 py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-indigo-500 transition-all flex items-center gap-4">
                  <Mic size={30} /> התחל שיחה
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
