
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ייבוא השירותים - יוצא מ-src לתיקיית services המקבילה
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

// ייבוא רכיבים
import Avatar from './components/Avatar';
import TranscriptItem from './components/TranscriptItem';
import AudioVisualizer from './components/AudioVisualizer';

// הגדרות מערכת מהגרסה המקורית
const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'he-IL', name: 'עברית', flag: '🇮🇱' },
  { code: 'es-ES', name: 'Spanish', flag: 'es' }
];

const SCENARIOS = [
  { id: 'translator', title: 'מתרגם אישי', icon: '🌐', description: 'תרגום סימולטני בין שפות' },
  { id: 'coffee', title: 'בית קפה', icon: '☕', description: 'תרגול הזמנה בבית קפה' },
  { id: 'chat', title: 'שיחה חופשית', icon: '💬', description: 'שיפור שטף הדיבור' }
];

const App: React.FC = () => {
  const [status, setStatus] = useState("disconnected");
  const [targetLang, setTargetLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[2]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית לתמלול
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) {
      try { activeSessionRef.current.close(); } catch (e) {}
      activeSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setStatus("disconnected");
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    if (!apiKey) {
      setError("Missing API Key. Please set VITE_API_KEY in Vercel.");
      return;
    }

    try {
      setError(null);
      setStatus("connecting");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      setStatus("connected");
      
      // משפט פתיחה של ה-AI לפי התרחיש
      const welcomeMsg = `Hello! I'm your ${selectedScenario.title} partner. Let's practice ${targetLang.name}.`;
      setTranscript([{ role: 'model', text: welcomeMsg, timestamp: new Date() }]);
      speak(welcomeMsg);

      // הפעלת לולאת ההקשבה
      initListening(model);

    } catch (e: any) {
      setError("Microphone error or connection failed.");
      setStatus("disconnected");
    }
  };

  const initListening = (model: any) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang.code;
    recognition.continuous = false;

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
      
      try {
        const result = await model.generateContent(`As a female tutor, respond to: ${text}`);
        const aiResponse = result.response.text();
        setTranscript(prev => [...prev, { role: 'model', text: aiResponse, timestamp: new Date() }]);
        speak(aiResponse);
      } catch (err) {
        setError("AI temporary unavailable.");
      }
    };

    recognition.onend = () => {
      if (status === "connected" && !isSpeaking) recognition.start();
    };

    recognition.start();
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang.code;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar - LingoLive Look */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Headphones className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter">LingoLive</h1>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">הגדרות שפה</label>
          <div className="p-3 bg-slate-800/40 rounded-2xl border border-white/5 space-y-3">
            <div>
              <span className="text-[10px] text-slate-400 block ml-1">למידה</span>
              <select value={targetLang.code} onChange={(e) => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs outline-none">
                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">מצב אימון</label>
          <div className="space-y-2 overflow-y-auto max-h-48">
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => setSelectedScenario(s)} className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/40 border-transparent hover:bg-slate-800'}`}>
                <span className="text-xl">{s.icon}</span>
                <div>
                  <div className="font-bold text-xs">{s.title}</div>
                  <div className="text-[9px] text-slate-500">{s.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MessageSquare size={12} /> תמלול חי
          </label>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.map((entry, i) => <TranscriptItem key={i} entry={entry} />)}
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
          
          <div className="mt-10 text-center space-y-2">
            <h2 className="text-4xl font-black text-white tracking-tight">
              {status === 'connected' ? (isSpeaking ? 'Gemini מדברת...' : 'אני מקשיבה...') : selectedScenario.title}
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">{selectedScenario.description}</p>
          </div>

          {(isSpeaking || (status === 'connected' && !isMuted)) && (
            <div className="mt-8 h-12 flex items-center justify-center">
              <AudioVisualizer isActive={true} color={isSpeaking ? '#6366f1' : '#10b981'} />
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="w-full border-t border-white/5 bg-slate-950/60 backdrop-blur-sm px-6 py-6 flex items-center justify-center">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            {error && <div className="text-red-400 text-xs font-bold bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">{error}</div>}
            
            <div className="flex items-center gap-6">
              {status === 'connected' ? (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full border-2 transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}>
                    {isMuted ? <MicOff /> : <Mic />}
                  </button>
                  <button onClick={stopConversation} className="bg-red-600 px-10 py-5 rounded-2xl font-black hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2">
                    <LogOut size={20} /> יציאה
                  </button>
                </>
              ) : (
                <button onClick={startConversation} className="bg-indigo-600 px-24 py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 flex items-center gap-4">
                  <Mic size={30} /> {status === 'connecting' ? 'מתחבר...' : 'התחל שיחה'}
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
