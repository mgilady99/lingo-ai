import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, LogOut, MessageSquare, AlertCircle, Play } from 'lucide-react';

// ייבוא השירותים מהקובץ הקיים אצלך
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';

// הנחה שהקומפוננטות קיימות בתיקיית המקור
import Avatar from './components/avatar';
import TranscriptItem from './components/transcriptitem';
import AudioVisualizer from './components/audiovisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState("disconnected");
  const [targetLang, setTargetLang] = useState({ code: 'en-US', name: 'English', flag: '🇺🇸' });
  const [nativeLang, setNativeLang] = useState({ code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' });
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const apiKey = import.meta.env.VITE_API_KEY;

  // אוטו-סקרול לתמלול
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
    setStatus("disconnected");
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
  }, []);

  const startConversation = async () => {
    if (!apiKey) {
      setError('Missing API Key. Check Vercel Environment Variables.');
      return;
    }

    try {
      setError(null);
      setStatus("connecting");

      const ai = new GoogleGenAI({ apiKey });

      // אתחול האודיו
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      const systemInstruction = `You are a friendly AI tutor. Native: ${nativeLang.name}, Target: ${targetLang.name}. Correct the user gently.`;

      // חיבור Live למודל Gemini 2.0
      const session = await ai.live.connect({
        model: 'models/gemini-2.0-flash-exp', // המודל המעודכן ל-2025
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
        }
      });

      activeSessionRef.current = session;

      // טיפול בהודעות נכנסות (אודיו מה-AI)
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
        
        // תמלול (אם מופעל)
        if (m.serverContent?.inputTranscription) {
           setTranscript(prev => [...prev, { role: 'user', text: m.serverContent.inputTranscription.text }]);
        }
      };

      // שליחת קול מהמיקרופון ל-AI
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

      setStatus("connected");
    } catch (e) {
      console.error(e);
      setError('Failed to connect to LINGO-AI.');
      setStatus("error");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar - תמלול */}
      <aside className="w-full md:w-80 h-full bg-slate-900 border-r border-white/5 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg font-black">L</div>
          <h1 className="text-xl font-black uppercase tracking-tighter">LINGO-AI PRO</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2" ref={scrollRef}>
          {transcript.map((t, i) => (
            <div key={i} className={`text-xs p-2 rounded-lg ${t.role === 'user' ? 'bg-indigo-900/20 ml-4' : 'bg-slate-800 mr-4'}`}>
              {t.text}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Experience */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-6 right-6 px-4 py-2 bg-slate-900 rounded-full border border-white/10 text-[10px] font-black uppercase">
          Status: {status}
        </div>

        <Avatar 
          state={status !== "connected" ? 'idle' : isSpeaking ? 'speaking' : 'listening'} 
        />

        <div className="mt-12 w-full max-w-md">
          {status === "connected" ? (
            <div className="flex justify-center gap-4">
               <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-full ${isMuted ? 'bg-red-500' : 'bg-slate-800 border border-slate-700'}`}>
                 {isMuted ? <MicOff /> : <Mic />}
               </button>
               <button onClick={stopConversation} className="bg-red-600 px-10 py-5 rounded-2xl font-black">EXIT</button>
            </div>
          ) : (
            <button 
              onClick={startConversation} 
              disabled={status === "connecting"}
              className="w-full bg-indigo-600 py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-indigo-500 transition-all"
            >
              {status === "connecting" ? "CONNECTING..." : "START CONVERSATION"}
            </button>
          )}
          {error && <div className="mt-4 text-red-400 text-xs text-center font-bold italic">{error}</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
