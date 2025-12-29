import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, LogOut, MessageSquare } from 'lucide-react';

// ✅ נתיבים מתוקנים לפי עץ הקבצים שלך (יציאה לשורש ../)
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';
import Avatar from '../components/Avatar';
import AudioVisualizer from '../components/AudioVisualizer';
import TranscriptItem from '../components/transcriptitem';

const App: React.FC = () => {
  const [status, setStatus] = useState("ready"); 
  const [appState, setAppState] = useState("idle"); // idle, listening, processing, speaking
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // ✅ משיכה אוטומטית מ-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית
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
    setAppState("idle");
  }, []);

  const startConversation = async () => {
    // בדיקה שהמפתח קיים
    if (!apiKey) {
      setError("שגיאה: מפתח API לא נמצא. וודא שב-Vercel הגדרת VITE_API_KEY");
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
      
      // הודעת פתיחה טקסטואלית בלבד (בלי דיבור)
      const intro = "Hello! I am LINGO-AI. I'm listening...";
      setTranscript([{ role: 'model', text: intro, timestamp: new Date() }]);
      
      // מתחילים ישר להקשיב
      initListening(model);
      
    } catch (e: any) {
      console.error(e);
      setError("גישה למיקרופון נדחתה");
      setStatus("ready");
    }
  };

  const initListening = (model: any) => {
    // השתקת דיבור קודם
    window.speechSynthesis.cancel();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; 
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        setAppState("listening");
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      // 1. קלטנו דיבור -> עוברים לעיבוד
      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
      
      try {
        // 2. שליחה ל-Gemini
        const result = await model.generateContent(`You are a friendly English tutor. Reply briefly (1-2 sentences) to: "${text}"`);
        const aiText = result.response.text();
        
        setTranscript(prev => [...prev, { role: 'model', text: aiText, timestamp: new Date() }]);
        
        // 3. ה-AI מדבר
        speakResponse(aiText, model);
      } catch (err) {
        setError("שגיאת AI");
        // במקרה שגיאה חוזרים להקשיב
        setTimeout(() => initListening(model), 1000);
      }
    };

    recognition.onend = () => {
        // אם השיחה פעילה ואנחנו אמורים להקשיב (אבל המיקרופון נסגר משקט)
        if (status === "connected" && appState === "listening") {
            try { recognition.start(); } catch(e) {}
        }
    };

    try {
        recognition.start();
        recognitionRef.current = recognition;
    } catch(e) {}
  };

  const speakResponse = (text: string, model: any) => {
    // עצירת המיקרופון
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    setAppState("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    
    activeUtteranceRef.current = utterance;

    utterance.onend = () => {
      // 4. סיום דיבור -> חזרה להקשבה
      setAppState("listening");
      activeUtteranceRef.current = null;
      if (status === "connected") {
        initListening(model);
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* סרגל צד */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white">L</div>
          <h1 className="text-xl font-black tracking-tighter italic">LingoLive</h1>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MessageSquare size={12} /> תמלול
          </label>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.map((entry, i) => (
              <TranscriptItem key={i} entry={entry} />
            ))}
          </div>
        </div>
      </aside>

      {/* אזור ראשי */}
      <main className="flex-1 h-full flex flex-col relative bg-slate-950">
        {/* סטטוס עליון */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl z-10">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{appState}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Avatar state={appState === 'speaking' ? 'speaking' : appState === 'processing' ? 'thinking' : appState === 'listening' ? 'listening' : 'idle'} />
          
          <div className="mt-10 text-center">
            <h2 className="text-4xl font-black text-white tracking-tight">
              {appState === 'listening' && "אני מקשיבה..."}
              {appState === 'processing' && "חושבת..."}
              {appState === 'speaking' && "AI מדברת..."}
              {appState === 'idle' && "מוכנים?"}
            </h2>
          </div>

          {(appState === 'listening' || appState === 'speaking') && (
            <div className="mt-8 h-12 flex items-center justify-center">
              <AudioVisualizer isActive={true} color={appState === 'speaking' ? '#6366f1' : '#10b981'} />
            </div>
          )}
        </div>

        {/* כפתורים */}
        <div className="w-full border-t border-white/5 bg-slate-950/60 backdrop-blur-sm px-6 py-8 flex items-center justify-center">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            {error && <div className="text-red-400 text-xs font-bold bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">{error}</div>}
            
            <div className="flex items-center gap-6">
              {status === 'connected' ? (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full border-2 transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}>
                    {isMuted ? <MicOff /> : <Mic />}
                  </button>
                  <button onClick={stopConversation} className="bg-red-600 px-12 py-5 rounded-2xl font-black hover:bg-red-700 transition-all flex items-center gap-2 shadow-xl">
                    <LogOut size={20} /> סיום
                  </button>
                </>
              ) : (
                <button onClick={startConversation} className="bg-indigo-600 px-24 py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-4">
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
