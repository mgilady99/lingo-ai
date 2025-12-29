import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle } from 'lucide-react';

// ייבוא השירותים - יוצא מ-src לתיקיית services המקבילה
import { decode, decodeAudioData, createPcmBlob } from '../services/audioService';

// ייבוא קומפוננטות - וודא שהשמות תואמים בדיוק לקבצים ב-GitHub
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
      setError("Missing API Key. Please set VITE_API_KEY in Vercel.");
      return;
    }

    try {
      setError(null);
      setStatus("מתחבר...");

      const ai = new GoogleGenAI({ apiKey });

      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      const systemInstruction = `You are a friendly female AI tutor for LINGO-AI. 
      Help the user practice ${targetLang.name}. Respond naturally.`;

      const session = await ai.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
        }
      });

      activeSessionRef.current = session;

      session.onmessage = async (m: any) => {
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

        if (m.serverContent?.inputTranscription) {
          setTranscript(prev => [...prev, { role: 'user', text: m.serverContent.inputTranscription.text }]);
        }
      };

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
      setError('Connection failed. Please try again.');
      setStatus("שגיאה");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row" dir="rtl">
      <aside className="w-full md:w-80 h-full bg-slate-900 border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black text-white">L</div>
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

      <main className="flex-1 flex flex-col items-center justify-center relative p-8 bg-slate-950">
        <div className="absolute top-6 left-6 px-4 py-2 bg-slate-900 rounded-full border border-white/10 text-[10px] font-black uppercase">
          סטטוס: {status}
        </div>

        <Avatar state={status !== "מחובר" ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />

        <div className="mt-12 w-full max-w-sm">
          {status === "מחובר" ? (
            <div className="flex justify-center gap-6">
               <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-full border-2 ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700'}`}>
                 {isMuted ? <MicOff /> : <Mic />}
               </button>
               <button onClick={stopConversation} className="bg-red-600 px-12 py-5 rounded-2xl font-black text-white">סיום</button>
            </div>
          ) : (
            <button onClick={startConversation} className="w-full bg-indigo-600 py-6 rounded-3xl font-black text-xl text-white shadow-2xl">
              {status === "מתחבר..." ? "מתחבר..." : "התחל שיחה"}
            </button>
          )}
          {error && <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">{error}</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
