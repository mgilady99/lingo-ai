import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, AlertTriangle, CheckCircle, Square, Volume2, Play, Activity } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  // סטטוסים מופרדים כדי להבין איפה הבעיה
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isStreaming, setIsStreaming] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("ממתין לפקודה..."); 
  const [micVol, setMicVol] = useState<number>(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ניקוי מלא
  const disconnect = useCallback(async () => {
    console.log("Disconnecting...");
    setIsStreaming(false);
    
    // 1. עצירת מיקרופון ועיבוד
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { await audioContextRef.current.close(); audioContextRef.current = null; }

    // 2. סגירת סשן מול גוגל
    if (sessionRef.current) {
        try { await sessionRef.current.close(); } catch(e) { console.warn(e); }
        sessionRef.current = null;
    }

    setConnectionStatus("disconnected");
    setDebugLog("מנותק.");
  }, []);

  const connectToGoogle = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      setConnectionStatus("connecting");
      setDebugLog("יוצר חיבור ראשוני...");

      const client = new GoogleGenAI({ apiKey });
      
      // הגדרה בסיסית ביותר - ללא כלים, ללא קולות מיוחדים בהתחלה
      const session = await client.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          generationConfig: { responseModalities: "AUDIO" }
        },
        callbacks: {
            onOpen: () => {
                console.log("Socket Opened");
                setConnectionStatus("connected");
                setDebugLog("✅ מחובר לשרת! (המתן לפקודה)");
            },
            onMessage: (msg: any) => {
                // טיפול בתשובות
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith("audio")) {
                        setDebugLog("🔊 ה-AI מדבר");
                        setAiSpeaking(true);
                        playAudio(part.inlineData.data);
                    }
                }
            },
            onClose: (e: any) => {
                console.log("Close:", e);
                setConnectionStatus("disconnected");
                setIsStreaming(false);
                setDebugLog(`השרת סגר חיבור (קוד ${e.code})`);
            },
            onError: (e: any) => {
                console.error("Error:", e);
                setDebugLog("שגיאה ברקע (לא מנתק)");
            }
        }
      });

      sessionRef.current = session;

    } catch (e: any) {
        console.error(e);
        setDebugLog("כשל בחיבור: " + e.message);
        setConnectionStatus("disconnected");
    }
  };

  const startMicrophoneStream = async () => {
      if (!sessionRef.current) return alert("קודם כל תתחבר!");
      
      try {
          setDebugLog("מפעיל מיקרופון...");
          
          const ctx = new window.AudioContext({ sampleRate: 16000 });
          await ctx.resume();
          audioContextRef.current = ctx;

          const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                  channelCount: 1,
                  sampleRate: 16000,
                  echoCancellation: true
              }
          });
          streamRef.current = stream;

          const source = ctx.createMediaStreamSource(stream);
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
              // קריאת דאטה
              const inputData = e.inputBuffer.getChannelData(0);
              
              // ויזואליזציה
              let sum = 0;
              for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
              setMicVol(Math.round(sum * 100));

              // שליחה לגוגל - רק אם אנחנו במצב סטרימינג
              if (sessionRef.current) {
                  const pcm16 = floatTo16BitPCM(inputData);
                  try {
                      sessionRef.current.sendRealtimeInput({
                          mediaChunks: [{
                              mimeType: "audio/pcm",
                              data: pcm16
                          }]
                      });
                  } catch (err) {
                      console.error("Send Error", err);
                  }
              }
          };

          source.connect(processor);
          processor.connect(ctx.destination);
          
          setIsStreaming(true);
          setDebugLog("🎤 מזרים אודיו...");

      } catch (e: any) {
          setDebugLog("שגיאת מיקרופון: " + e.message);
      }
  };

  // --- Helpers ---
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  const playAudio = (b64Data: string) => {
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
        sourceNode.onended = () => setAiSpeaking(false);
        sourceNode.start();
    } catch (e) { console.error(e); }
  };

  // כפתור חילוץ ידני
  const sendEndTurn = () => {
      if (sessionRef.current) {
          setDebugLog("שולח סימן סיום...");
          sessionRef.current.sendClientContent({ turns: [], turnComplete: true });
      }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
      <div className="absolute top-4 w-full max-w-md bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-2">
            {connectionStatus === "connected" ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-amber-500" />}
            <span className="font-bold uppercase tracking-wider text-sm">{connectionStatus}</span>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 text-xs font-mono text-cyan-300 mb-2">
            LOG: {debugLog}
        </div>
        {/* מד ווליום */}
        <div className="flex items-center justify-center gap-2">
            <Volume2 size={16} className={micVol > 5 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 5 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-8">
        <Avatar state={aiSpeaking ? 'speaking' : (isStreaming ? 'listening' : 'idle')} />
        
        {/* כפתורי שליטה מופרדים */}
        <div className="flex gap-4">
            {connectionStatus === "disconnected" && (
                <button 
                    onClick={connectToGoogle}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-indigo-600 hover:bg-indigo-500 shadow-lg"
                >
                    <Activity size={20} /> 1. Connect
                </button>
            )}

            {connectionStatus === "connected" && !isStreaming && (
                <button 
                    onClick={startMicrophoneStream}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-green-600 hover:bg-green-500 shadow-lg"
                >
                    <Mic size={20} /> 2. Start Mic
                </button>
            )}

            {isStreaming && (
                <button 
                    onClick={sendEndTurn}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-blue-600 hover:bg-blue-500 shadow-lg"
                >
                    <Play size={20} /> Force Reply
                </button>
            )}

            {connectionStatus !== "disconnected" && (
                <button 
                    onClick={disconnect}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-red-600 hover:bg-red-500 shadow-lg"
                >
                    <Square size={20} /> Stop All
                </button>
            )}
        </div>
      </div>
      
      {connectionStatus === "connected" && (
         <div className="fixed bottom-0 w-full h-32 pointer-events-none opacity-50">
            <AudioVisualizer isActive={true} color={aiSpeaking ? "#a78bfa" : (isStreaming ? "#34d399" : "#4b5563")} />
         </div>
      )}
    </div>
  );
};

export default App;
