import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Activity, Square, ShieldCheck } from 'lucide-react';
import Avatar from './components/Avatar';

const App: React.FC = () => {
  // אימות ויזואלי בקונסול שהקוד החדש נטען
  useEffect(() => {
    console.log("%c >>> DIAGNOSTIC MODE ACTIVE - V4 <<< ", "background: #22c55e; color: #fff; font-size: 18px; font-weight: bold;");
  }, []);

  const [status, setStatus] = useState<"disconnected" | "connected">("disconnected");
  const [log, setLog] = useState("ממתין להתחלת חיבור...");

  const sessionRef = useRef<any>(null);

  // חיבור בלבד - ללא שליחת הודעות אוטומטיות
  const connectOnly = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    
    try {
      setLog("מתחבר ל-Gemini API...");
      const genAI = new GoogleGenAI({ apiKey });
      const session = await genAI.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { generationConfig: { responseModalities: "AUDIO" } },
        callbacks: {
          onOpen: () => {
            console.log("SUCCESS: WebSocket connection established.");
            setStatus("connected");
            setLog("✅ מחובר בהצלחה! החיבור יציב.");
          },
          onClose: (e) => {
            console.log("INFO: Connection closed.", e);
            setStatus("disconnected");
            setLog(`החיבור נסגר (קוד: ${e.code}).`);
          },
          onError: (err) => {
            console.error("CRITICAL ERROR:", err);
            setLog("שגיאה בחיבור.");
          }
        }
      });
      sessionRef.current = session;
    } catch (e: any) { 
      setLog("כישלון בחיבור: " + e.message); 
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
      <div className="mb-10 text-center bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ShieldCheck className={status === "connected" ? "text-emerald-500" : "text-rose-500"} size={32} />
          <span className="font-mono text-2xl uppercase tracking-widest font-bold">{status}</span>
        </div>
        <p className="text-emerald-400 font-mono text-sm bg-black/40 p-4 rounded-xl border border-emerald-900/20">
          LOG: {log}
        </p>
      </div>

      <Avatar state={status === "connected" ? "idle" : "idle"} />

      <div className="mt-12">
        {status === "disconnected" ? (
          <button 
            onClick={connectOnly} 
            className="bg-blue-600 hover:bg-blue-500 px-12 py-6 rounded-full font-black text-xl flex items-center gap-4 transition-all transform hover:scale-105 shadow-2xl"
          >
            <Activity size={28} /> INIT STAGE 1: CONNECT
          </button>
        ) : (
          <button 
            onClick={() => window.location.reload()} 
            className="bg-slate-800 hover:bg-slate-700 px-10 py-5 rounded-full font-bold flex items-center gap-3 transition-all"
          >
            <Square size={20} /> FORCE SYSTEM RESET
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
