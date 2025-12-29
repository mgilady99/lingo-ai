
import React, { useState, useRef, useCallback, useEffect } from 'react';
// ייבוא מהספרייה הנכונה שהגדרנו ב-package.json
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ייבוא השירותים מהתיקייה המקבילה - שים לב לשימוש ב-a קטנה בשם הקובץ
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

const App: React.FC = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // גלילה אוטומטית של התמלול בתחתית הלוג
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  const stopConversation = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis.cancel();
    setStatus("ready");
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    if (!apiKey) {
      setError("Missing API Key. Please set VITE_API_KEY in Vercel settings.");
      return;
    }

    try {
      setError(null);
      setStatus("connecting");

      // בקשת הרשאה למיקרופון
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      setStatus("connected");
      const welcomeMsg = "Hello! I am LINGO-AI. How can I help you today?";
      setTranscript([{ role: 'model', text: welcomeMsg }]);
      speak(welcomeMsg);
      
      startListening(model);

    } catch (e: any) {
      setError("Microphone access denied or connection failed.");
      setStatus("ready");
    }
  };

  const startListening = (model: any) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(prev => [...prev, { role: 'user', text }]);
      
      try {
        const result = await model.generateContent(text);
        const responseText = result.response.text();
        setTranscript(prev => [...prev, { role: 'model', text: responseText }]);
        speak(responseText);
      } catch (err) {
        setError("AI Response error.");
      }
    };

    recognition.onend = () => {
      if (status === "connected" && !isSpeaking) {
        try { recognition.start(); } catch(e) {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (status === "connected" && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar - תמלול */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg">L</div>
          <h1 className="text-xl font-black uppercase tracking-tighter">LINGO-AI PRO</h1>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic text-center mt-10">השיחה תופיע כאן...</div>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className={`p-3 rounded-2xl text-xs leading-relaxed ${t.role === 'user' ? 'bg-indigo-600/10 mr-4' : 'bg-white/5 ml-4'}`}>
                <span className="opacity-40 block mb-1 text-[9px] uppercase font-bold">{t.role === 'user' ? 'אתה' : 'LINGO-AI'}</span>
                {t.text}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main UI */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-6 left-6 px-4 py-2 bg-slate-900 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          סטטוס: {status}
        </div>

        {/* אווטאר פשוט להצגה */}
        <div className={`w-64 h-64 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.5)] scale-105' : 'bg-slate-800'}`}>
          <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 bg-slate-900 flex items-center justify-center">
            <img 
              src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
              className="w-full h-full object-cover opacity-80"
              alt="AI Tutor"
              onError={(e) => { e.currentTarget.src = "https://www.w3schools.com/howto/img_avatar2.png"; }}
            />
          </div>
        </div>

        <div className="mt-12 w-full max-w-sm">
          {status === "connected" ? (
            <div className="flex justify-center gap-4">
              <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-full border-2 transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}>
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button onClick={stopConversation} className="bg-red-600 hover:bg-red-700 px-12 py-5 rounded-2xl font-black text-white shadow-2xl active:scale-95 transition-all">סיום שיחה</button>
            </div>
          ) : (
            <button 
              onClick={startConversation} 
              disabled={status === "connecting"}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-6 rounded-3xl font-black text-xl text-white shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              {status === "connecting" ? "מתחבר..." : "התחל שיחה"}
            </button>
          )}
          {error && <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-bold flex items-center justify-center gap-2"><AlertCircle size={14}/> {error}</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
