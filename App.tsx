
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Activity, Square, Play, ShieldCheck } from 'lucide-react';
import Avatar from './components/Avatar';

const App: React.FC = () => {
  // זיהוי גרסה בקונסול
  useEffect(() => {
    console.log("%c >>> NEW DIAGNOSTIC VERSION LOADED <<< ", "background: #f00; color: #fff; font-size: 20px;");
  }, []);

  const [status, setStatus] = useState<"disconnected" | "connected">("disconnected");
  const [isMicOn, setIsMicOn] = useState(false);
  const [log, setLog] = useState("ממתין להעלאת קוד חדש...");

  const sessionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // שלב 1: חיבור בלבד (ללא שליחת הודעות אוטומטיות)
  const connectOnly = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    
    try {
      setLog("מתחבר לשרת...");
      const genAI = new GoogleGenAI({ apiKey });
      const session = await genAI.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { generationConfig: { responseModalities: "AUDIO" } },
        callbacks: {
          onOpen: () => {
            console.log("DIAGNOSTIC: Connection opened successfully");
            setStatus("connected");
            setLog("✅ החיבור יציב! כעת נסה להפעיל מיקרופון.");
          },
          onClose: (e) => {
            setStatus("disconnected");
            setLog(`החיבור נסגר (קוד: ${e.code})`);
          },
          onError: (err) => {
            console.error("DIAGNOSTIC ERROR:", err);
            setLog("שגיאה בחיבור.");
          }
        }
      });
      sessionRef.current = session;
    } catch (e: any) { setLog("כישלון: " + e.message); }
  };

  const startMic = async () => {
    if (!sessionRef.current) return;
    try {
      setLog("מפעיל מיקרופון...");
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const buffer = new ArrayBuffer(input.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        sessionRef.current.sendRealtimeInput({ mediaChunks: [{ data: b64, mimeType: "audio/pcm" }] });
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsMicOn(true);
      setLog("🎤 מיקרופון משדר בזמן אמת.");
    } catch (e) { setLog("שגיאת מיקרופון."); }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6">
      <div className="mb-10 text-center bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ShieldCheck className={status === "connected" ? "text-green-500" : "text-red-500"} />
          <span className="font-mono text-xl uppercase tracking-tighter">{status}</span>
        </div>
        <p className="text-cyan-400 font-mono text-sm bg-black/50 p-3 rounded-lg border border-cyan-900/30">
          LOG: {log}
        </p>
      </div>

      <Avatar state={status === "connected" ? (isMicOn ? "listening" : "idle") : "idle"} />

      <div className="mt-12 flex gap-6">
        {status === "disconnected" ? (
          <button onClick={connectOnly} className="bg-orange-600 hover:bg-orange-500 px-10 py-5 rounded-full font-bold text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(234,88,12,0.4)]">
            <Activity size={24} /> 1. Connect Test
          </button>
        ) : (
          <>
            {!isMicOn && (
              <button onClick={startMic} className="bg-green-600 hover:bg-green-500 px-10 py-5 rounded-full font-bold text-lg flex items-center gap-3 transition-all shadow-[0_0_20px_rgba(22,163,74,0.4)]">
                <Mic size={24} /> 2. Start Mic
              </button>
            )}
            <button onClick={() => window.location.reload()} className="bg-zinc-800 hover:bg-zinc-700 px-8 py-5 rounded-full font-bold flex items-center gap-3 transition-all">
              <Square size={20} /> Force Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
