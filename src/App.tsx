
import React, { useState, useRef, useCallback, useEffect } from 'react';
// ייבוא מהספרייה הנכונה
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ייבוא השירותים מהתיקייה המקבילה
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

// ייבוא קומפוננטות (וודא שהן קיימות בתיקיית src/components)
import Avatar from './components/Avatar'; 
import TranscriptItem from './components/TranscriptItem';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // גלילה אוטומטית של התמלול
  const scrollRef = useRef<HTMLDivElement>(null);
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
      setError("Missing API Key in Vercel settings.");
      return;
    }

    try {
      setError(null);
      setStatus("connecting");

      // בקשת אישור מיקרופון
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      setStatus("connected");
      setTranscript([{ role: 'model', text: 'Hello! I am LINGO-AI. How can I help you today?' }]);
      
      // הפעלת זיהוי הדיבור
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
      
      // שליחה ל-Gemini
      try {
        const result = await model.generateContent(text);
        const responseText = result.response.text();
        setTranscript(prev => [...prev, { role: 'model', text: responseText }]);
        speak(responseText, model);
      } catch (err) {
        setError("AI Response error.");
      }
    };

    recognition.onend = () => {
      if (status === "connected" && !isSpeaking) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const speak = (text: string, model: any) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") recognitionRef.current.start();
    };
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar - תמלול */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white">L</div>
          <h1 className="text-xl font-black uppercase tracking-tighter">LINGO-AI PRO</h1>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3" ref={scrollRef}>
          {transcript.map((t, i) => (
            <div key={i} className={`p-3 rounded-2xl text-xs ${t.role === 'user' ? 'bg-indigo-600/10 mr-4' : 'bg-white/5 ml-4'}`}>
              <span className="opacity-40 block mb-1 text-[9px] uppercase font-bold">{t.role === 'user' ? 'אתה' : 'LINGO-AI'}</span>
              {t.text}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Experience */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-6 left-6 px-4 py-2 bg-slate-900 rounded-full border border-white/10 text-[10px] font-black uppercase">
          Status: {status}
        </div>

        <Avatar state={status !== "connected" ? 'idle' : isSpeaking ? 'speaking' : 'listening'} />

        <div className="mt-12 w-full max-w-sm">
          {status === "connected" ? (
            <button onClick={stopConversation} className="w-full bg-red-600 py-6 rounded-3xl font-black text-xl text-white">סיום שיחה</button>
          ) : (
            <button onClick={startConversation} className="w-full bg-indigo-600 py-6 rounded-3xl font-black text-xl text-white shadow-2xl">
              {status === "connecting" ? "מתחבר..." : "התחל שיחה"}
            </button>
          )}
          {error && <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">{error}</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
