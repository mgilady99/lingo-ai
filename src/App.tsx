
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ייבוא השירותים - יוצא מ-src לתיקיית services המקבילה לפי מבנה העץ שלך
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

// ייבוא קומפוננטות - וודא שהשמות תואמים בדיוק לקבצים ב-GitHub (אותיות גדולות/קטנות)
import Avatar from './components/Avatar'; 
import TranscriptItem from './components/TranscriptItem';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState("מנותק");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [targetLang] = useState({ code: 'en-US', name: 'English' });
  const [nativeLang] = useState({ code: 'he-IL', name: 'Hebrew' });

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // משיכת המפתח מ-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;

  // גלילה אוטומטית של התמלול
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) {
      try { activeSessionRef.current.close(); } catch (e) {}
      activeSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach((source) => {
      try { source.stop(); } catch {}
    });
    sourcesRef.current.clear();
    setStatus("מנותק");
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
  }, []);

  const startConversation = async () => {
    if (!apiKey) {
      setError("Missing API Key. Please set VITE_API_KEY in Vercel Environment Variables.");
      return;
    }

    try {
      setError(null);
      setStatus("מתחבר...");

      const ai = new GoogleGenAI({ apiKey });

      // אתחול הקשר האודיו (Audio Context)
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      const systemInstruction = `You are a friendly and patient female AI language tutor for LINGO-AI. 
      The user's native language is ${nativeLang.name} and they want to practice ${targetLang.name}. 
      Keep the conversation natural, professional, and encouraging. Correct mistakes gently.`;

      // יצירת חיבור Live רציף
      const session = await ai.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
        }
      });

      activeSessionRef.current = session;

      // טיפול בהודעות נכנסות מה-AI
      session.onmessage = async (m: any) => {
        // טיפול באודיו נכנס
        if (m.serverContent?.modelTurn?.parts) {
          const parts = m.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.inlineData?.data) {
              setIsSpeaking(true);
              const audioData = part.inlineData.data;
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const src = outputCtx.createBufferSource();
              src.buffer = buffer;
              src.connect(outputNode);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              
              sourcesRef.current.add(src);
              src.onended = () => {
                sourcesRef.current.delete(src);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
            }
          }
        }

        // עדכון תמלול מה-AI או מהמשתמש
        if (m.serverContent?.inputTranscription) {
          setTranscript(prev => [...prev, { role: 'user', text: m.serverContent.inputTranscription.text }]);
        }
        if (m.serverContent?.modelTurn?.parts?.[0]?.text) {
          setTranscript(prev => [...prev, { role: 'model', text: m.serverContent.modelTurn.parts[0].text }]);
        }
      };

      // שליחת אודיו מהמיקרופון לבינה המלאכותית בזמן אמת
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        if (!isMuted && activeSessionRef.current) {
          const pcmData = createPcmBlob(e.inputBuffer.getChannelData(0));
          activeSessionRef.current.sendRealtimeInput({ media: pcmData });
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

      setStatus("מחובר");
    } catch (e: any) {
      console.error(e);
      setError('Connection failed. Please ensure your mic is enabled and API key is valid.');
      setStatus("שגיאה");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar - תמלול השיחה */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white">L</div>
          <h1 className="text-xl font-black uppercase tracking-tighter">LINGO-AI PRO</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic text-center mt-10">השיחה שלך תופיע כאן...</div>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className={`p-3 rounded-2xl text-xs leading-relaxed ${t.role === 'user' ? 'bg-indigo-600/10 mr-4 text-indigo-300' : 'bg-white/5 ml-4 text-slate-300'}`}>
                <span className="text-[9px] font-bold uppercase opacity-40 block mb-1">{t.role === 'user' ? 'אתה' : 'LINGO-AI'}</span>
                {t.text}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Experience */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-slate-950 to-slate-950">
        <div className="absolute top-6 left-6 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "מחובר" ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          סטטוס: {status}
        </div>

        {/* האווטאר המרכזי */}
        <Avatar 
          state={status !== "מחובר" ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} 
        />

        <div className="mt-12 w-full max-w-sm">
          {status === "מחובר" ? (
            <div className="flex justify-center gap-6">
               <button 
                 onClick={() => setIsMuted(!isMuted)} 
                 className={`p-6 rounded-full transition-all shadow-xl border-2 ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}
               >
                 {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
               </button>
               <button 
                 onClick={stopConversation} 
                 className="bg-red-600 hover:bg-red-700 px-12 py-5 rounded-2xl font-black text-white shadow-2xl transition-all active:scale-95 flex items-center gap-2"
               >
                 <LogOut size={20} /> סיום שיחה
               </button>
            </div>
          ) : (
            <button 
              onClick={startConversation} 
              disabled={status === "מתחבר..."}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-6 rounded-3xl font-black text-xl text-white shadow-2xl shadow-indigo-900/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {status === "מתחבר..." ? "מתחבר לשרת..." : "התחל שיחה"}
            </button>
          )}
          
          {error && (
            <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-bold flex items-center justify-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* ויזואליזציה של קול */}
        {(isSpeaking || (status === "מחובר" && !isMuted)) && (
          <div className="absolute bottom-32">
            <AudioVisualizer isActive={true} color={isSpeaking ? '#6366f1' : '#10b981'} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
