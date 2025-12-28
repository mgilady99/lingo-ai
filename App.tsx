import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Activity, Square, Play, Volume2 } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected">("disconnected");
  const [isMicActive, setIsMicActive] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("ממתין להעלאה חדשה..."); 
  const [micVol, setMicVol] = useState<number>(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. שלב ראשון: חיבור שקט בלבד
  const connectToGoogle = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      setDebugLog("מנסה להתחבר לשרת...");
      const client = new GoogleGenAI({ apiKey });
      
      const session = await client.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { generationConfig: { responseModalities: "AUDIO" } },
        callbacks: {
            onOpen: () => {
                console.log("--- STEP 1 SUCCESSFUL ---"); // לוג לזיהוי הגרסה
                setConnectionStatus("connected");
                setDebugLog("✅ החיבור יציב! כעת הפעל מיקרופון.");
            },
            onMessage: (msg: any) => {
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith("audio")) {
                        setAiSpeaking(true);
                        playAudio(part.inlineData.data);
                    }
                }
            },
            onClose: (e: any) => {
                setConnectionStatus("disconnected");
                setIsMicActive(false);
                setDebugLog(`החיבור נסגר (קוד ${e.code})`);
            },
            onError: (e: any) => {
                console.error("DEBUG ERROR:", e);
                setDebugLog("שגיאה בחיבור.");
            }
        }
      });

      sessionRef.current = session;
    } catch (e: any) {
        setDebugLog("כישלון: " + e.message);
    }
  };

  // 2. שלב שני: הפעלת מיקרופון ידנית
  const startMic = async () => {
      if (!sessionRef.current) return;
      try {
          setDebugLog("מפעיל מיקרופון...");
          const ctx = new window.AudioContext({ sampleRate: 16000 });
          await ctx.resume();
          audioContextRef.current = ctx;

          const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
          streamRef.current = stream;

          const source = ctx.createMediaStreamSource(stream);
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
              setMicVol(Math.round(sum * 100));

              if (sessionRef.current) {
                  const pcm16 = floatTo16BitPCM(inputData);
                  sessionRef.current.sendRealtimeInput({
                      mediaChunks: [{ mimeType: "audio/pcm", data: pcm16 }]
                  });
              }
          };

          source.connect(processor);
          processor.connect(ctx.destination);
          setIsMicActive(true);
          setDebugLog("🎤 מיקרופון מזרים דאטה...");
      } catch (e: any) { setDebugLog("שגיאת מיקרופון."); }
  };

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
      <div className="absolute top-4 w-full max-w-md bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center shadow-xl">
        <div className="flex items-center justify-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === "connected" ? "bg-green-500" : "bg-red-500"}`} />
            <span className="font-bold text-sm uppercase">{connectionStatus}</span>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 text-xs font-mono text-cyan-300 mb-2">LOG: {debugLog}</div>
      </div>

      <div className="relative flex flex-col items-center gap-8">
        <Avatar state={aiSpeaking ? 'speaking' : (isMicActive ? 'listening' : 'idle')} />
        
        <div className="flex gap-4">
            {connectionStatus === "disconnected" ? (
                <button 
                    onClick={connectToGoogle}
                    className="flex items-center gap-2 px-8 py-4 rounded-full font-bold bg-orange-600 hover:bg-orange-500 shadow-xl"
                >
                    <Activity size={20} /> 1. Test Connection
                </button>
            ) : (
                <>
                    {!isMicActive && (
                        <button 
                            onClick={startMic}
                            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold bg-green-600 hover:bg-green-500 shadow-xl"
                        >
                            <Mic size={20} /> 2. Start Mic
                        </button>
                    )}
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-8 py-4 rounded-full font-bold bg-red-600 hover:bg-red-500 shadow-xl"
                    >
                        <Square size={20} /> Reset
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;
