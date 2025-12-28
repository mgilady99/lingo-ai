import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Activity, Square, Play, Radio } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  // --- סימן זיהוי לטעינת הקוד החדש ---
  useEffect(() => {
    console.log("%c SYSTEM RELOADED - V3 ", "background: #00ff00; color: #000; font-size: 20px; font-weight: bold;");
  }, []);

  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected">("disconnected");
  const [isMicActive, setIsMicActive] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("ממתין להפעלה ידנית..."); 
  const [micVol, setMicVol] = useState<number>(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. פונקציית ניתוק נקייה
  const disconnect = useCallback(async () => {
    console.log(">> Disconnecting...");
    setDebugLog("מתנתק...");
    
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { await audioContextRef.current.close(); audioContextRef.current = null; }

    if (sessionRef.current) {
        try { await sessionRef.current.close(); } catch(e) { console.warn(e); }
        sessionRef.current = null;
    }

    setConnectionStatus("disconnected");
    setIsMicActive(false);
    setDebugLog("מנותק.");
  }, []);

  // 2. כפתור 1: רק חיבור לשרת (בלי אודיו)
  const connectToGoogle = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      setDebugLog("מתחבר לשרת...");
      const client = new GoogleGenAI({ apiKey });
      
      const session = await client.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          generationConfig: { responseModalities: "AUDIO" }
        },
        callbacks: {
            onOpen: () => {
                console.log(">> SOCKET OPENED"); // לוג חדש
                setConnectionStatus("connected");
                setDebugLog("✅ מחובר! עכשיו לחץ על Start Mic");
                // שים לב: אין כאן Sending Hello
            },
            onMessage: (msg: any) => {
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
                console.log(">> Closed:", e);
                setConnectionStatus("disconnected");
                setIsMicActive(false);
                setDebugLog(`השרת ניתק (קוד ${e.code})`);
            },
            onError: (e: any) => {
                console.error(">> Error:", e);
                setDebugLog("שגיאה (לא מנתק)");
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

  // 3. כפתור 2: הפעלת מיקרופון (רק כשהחיבור יציב)
  const startMicrophoneStream = async () => {
      if (!sessionRef.current) return alert("קודם תתחבר!");
      if (isMicActive) return;

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
              const inputData = e.inputBuffer.getChannelData(0);
              
              // ויזואליזציה
              let sum = 0;
              for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
              setMicVol(Math.round(sum * 100));

              // שליחה
              if (sessionRef.current) {
                  const pcm16 = floatTo16BitPCM(inputData);
                  try {
                      sessionRef.current.sendRealtimeInput({
                          mediaChunks: [{
                              mimeType: "audio/pcm",
                              data: pcm16
                          }]
                      });
                  } catch (err) { console.error(err); }
              }
          };

          source.connect(processor);
          processor.connect(ctx.destination);
          
          setIsMicActive(true);
          setDebugLog("🎤 מיקרופון פעיל");

      } catch (e: any) {
          setDebugLog("שגיאת מיקרופון: " + e.message);
      }
  };

  // כפתור חילוץ
  const sendEndTurn = () => {
      if (sessionRef.current) {
          setDebugLog("שולח סימן סיום...");
          sessionRef.current.sendClientContent({ turns: [], turnComplete: true });
      }
  };

  // --- עזרים ---
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

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
      <div className="absolute top-4 w-full max-w-md bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === "connected" ? "bg-green-500" : "bg-red-500"}`} />
            <span className="font-bold uppercase tracking-wider text-sm">{connectionStatus}</span>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 text-xs font-mono text-cyan-300 mb-2">
            LOG: {debugLog}
        </div>
        <div className="flex items-center justify-center gap-2">
            <Radio size={16} className={micVol > 5 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 5 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <Avatar state={aiSpeaking ? 'speaking' : (isMicActive ? 'listening' : 'idle')} />
        
        {/* כפתורי שליטה ידניים */}
        <div className="flex flex-wrap justify-center gap-4 w-full max-w-2xl z-10">
            {connectionStatus === "disconnected" ? (
                <button 
                    onClick={connectToGoogle}
                    className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 shadow-lg border border-indigo-400/30"
                >
                    <Activity size={20} /> 1. Connect
                </button>
            ) : (
                <>
                    {!isMicActive && (
                        <button 
                            onClick={startMicrophoneStream}
                            className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 shadow-lg border border-emerald-400/30"
                        >
                            <Mic size={20} /> 2. Start Mic
                        </button>
                    )}

                    <button 
                        onClick={sendEndTurn}
                        className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 shadow-lg border border-blue-400/30"
                    >
                        <Play size={20} /> 3. Force Reply
                    </button>

                    <button 
                        onClick={disconnect}
                        className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold bg-red-600 hover:bg-red-500 shadow-lg border border-red-400/30"
                    >
                        <Square size={20} /> Disconnect
                    </button>
                </>
            )}
        </div>
      </div>
      
      {connectionStatus === "connected" && (
         <div className="fixed bottom-0 w-full h-32 pointer-events-none opacity-50">
            <AudioVisualizer isActive={true} color={aiSpeaking ? "#a78bfa" : (isMicActive ? "#34d399" : "#4b5563")} />
         </div>
      )}
    </div>
  );
};

export default App;
