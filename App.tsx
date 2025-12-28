import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, AlertTriangle, CheckCircle, Square, Volume2, Radio } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

// משתנה גלובלי למניעת חיבור כפול ב-React StrictMode
let isSessionActive = false;

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastVoiceTimeRef = useRef<number>(0);
  const isWaitingForResponseRef = useRef<boolean>(false);

  // פונקציית ניקוי יסודית
  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...");
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (sessionRef.current) {
        sessionRef.current.close().catch(() => {});
        sessionRef.current = null;
    }
    isSessionActive = false;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("disconnected");
    setIsSpeaking(false);
    setDebugLog("מנותק");
  }, [cleanup]);

  const connect = async () => {
    if (isSessionActive) {
        console.log("Session already active, ignoring connect request");
        return;
    }
    
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      isSessionActive = true;
      setStatus("connecting");
      setDebugLog("מתחבר...");

      const client = new GoogleGenAI({ apiKey });
      
      const session = await client.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          tools: [], // ביטול כלים למניעת קריסות פנימיות
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
            }
          }
        },
        callbacks: {
            onOpen: () => {
                console.log("Session Opened");
                setStatus("connected");
                setDebugLog("מחובר! (דבר חופשי...)");
                // ביטלנו את ה-Hello האוטומטי שגרם לקריסה
            },
            onMessage: (msg: any) => {
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith("audio")) {
                        // ה-AI מדבר
                        isWaitingForResponseRef.current = false;
                        setDebugLog("🔊 ה-AI מדבר");
                        playAudioData(part.inlineData.data);
                    }
                }
            },
            onClose: (event: any) => {
                console.log("Session Closed:", event);
                setStatus("disconnected");
                setDebugLog(`נותק (קוד: ${event.code})`);
                isSessionActive = false;
            },
            onError: (error: any) => {
                console.error("Session Error:", error);
                setDebugLog("שגיאה בחיבור");
                disconnect();
            }
        }
      });

      sessionRef.current = session;

      // הגדרת אודיו (מיקרופון)
      const ctx = new window.AudioContext();
      await ctx.resume();
      audioContextRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
              channelCount: 1,
              sampleRate: 16000,
          }
      });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
          if (!sessionRef.current || isWaitingForResponseRef.current) return;

          const inputData = e.inputBuffer.getChannelData(0);
          
          // חישוב ווליום
          let sum = 0;
          for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
          const vol = Math.round(sum * 100);
          setMicVol(vol);

          // זיהוי דיבור (VAD)
          if (vol > 10) {
              lastVoiceTimeRef.current = Date.now();
              if (!isUserTalking) {
                  setIsUserTalking(true);
              }

              // המרת אודיו ושליחה
              const pcm16 = floatTo16BitPCM(inputData);
              sessionRef.current.sendRealtimeInput({
                  mediaChunks: [{
                      mimeType: "audio/pcm",
                      data: pcm16
                  }]
              });

          } else if (isUserTalking) {
              // בדיקת שתיקה
              const timeSinceVoice = Date.now() - lastVoiceTimeRef.current;
              if (timeSinceVoice > 1200) { // 1.2 שניות שקט
                  console.log("Silence detected -> Ending turn");
                  setDebugLog("⏳ ממתין לתשובה...");
                  
                  sessionRef.current.sendClientContent({
                      turns: [],
                      turnComplete: true
                  });

                  isWaitingForResponseRef.current = true;
                  setIsUserTalking(false);
              }
          }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

    } catch (err: any) {
        console.error(err);
        setDebugLog("שגיאה: " + err.message);
        disconnect();
    }
  };

  // עזרים
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  const playAudioData = (b64Data: string) => {
    if (!audioContextRef.current) return;
    try {
        const ctx = audioContextRef.current;
        const binaryString = atob(b64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        const pcm16 = new Int16Array(bytes.buffer);
        
        const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i=0; i<pcm16.length; i++) channelData[i] = pcm16[i] / 32768.0;

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(ctx.destination);
        sourceNode.onended = () => setIsSpeaking(false);
        sourceNode.start();
        setIsSpeaking(true);
    } catch (e) {
        console.error("Audio playback error:", e);
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
      <div className="absolute top-4 w-full max-w-md bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-2">
            {status === "connected" ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-amber-500" />}
            <span className="font-bold uppercase tracking-wider text-sm">{status}</span>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 text-xs font-mono text-cyan-300 mb-2">
            LOG: {debugLog}
        </div>
        <div className="flex items-center justify-center gap-2">
            <Radio size={16} className={micVol > 10 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 10 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
        </div>
      </div>

      <div className="relative">
        <Avatar state={status === "connected" ? (isSpeaking ? 'speaking' : (isUserTalking ? 'listening' : 'idle')) : 'idle'} />
        
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-full flex justify-center gap-4">
            <button 
                onClick={status === "connected" ? disconnect : connect}
                className={`flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl shadow-2xl transition-all active:scale-95 ${
                    status === "connected" 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
                }`}
            >
                {status === "connected" ? (
                    <> <Square fill="currentColor" size={20} /> Stop </>
                ) : (
                    <> <Mic size={24} /> Start </>
                )}
            </button>
        </div>
      </div>
      
      {(status === "connected") && (
         <div className="fixed bottom-0 w-full h-32 pointer-events-none opacity-50">
            <AudioVisualizer isActive={true} color={isSpeaking ? "#a78bfa" : (isUserTalking ? "#34d399" : "#4b5563")} />
         </div>
      )}
    </div>
  );
};

export default App;
