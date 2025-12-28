
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, AlertTriangle, CheckCircle, Square, Volume2 } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const lastVoiceTimeRef = useRef<number>(0);
  const isWaitingForResponseRef = useRef<boolean>(false);

  // --- עזרי אודיו ---
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  const downsampleBuffer = (buffer: Float32Array, inputRate: number, outputRate: number) => {
    if (outputRate === inputRate) return buffer;
    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const nextOffset = Math.round((i + 1) * sampleRateRatio);
      const currOffset = Math.round(i * sampleRateRatio);
      let accum = 0, count = 0;
      for (let j = currOffset; j < nextOffset && j < buffer.length; j++) {
        accum += buffer[j];
        count++;
      }
      result[i] = count > 0 ? accum / count : 0;
    }
    return result;
  };

  const stopConversation = useCallback(() => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.suspend(); }
    
    setStatus("disconnected");
    setIsSpeaking(false);
    setIsUserTalking(false);
    setMicVol(0);
    setDebugLog("מנותק");
    isWaitingForResponseRef.current = false;
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      stopConversation();
      setStatus("connecting");
      setDebugLog("מתחבר...");

      const ctx = new AudioContext();
      await ctx.resume();
      audioContextRef.current = ctx;

      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // הגדרת פונקציות דמי למניעת קריסה (ה"ביטוח")
      const safeCallbacks = {
        onopen: () => console.log("Safe: Open"),
        onmessage: () => {}, // משאירים ריק כי אנחנו משתמשים בלולאה
        onclose: () => console.log("Safe: Close"),
        onerror: (e: any) => console.error("Safe: Error", e)
      };

      // חיבור עם הזרקה כפולה של Callbacks
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
        },
        callbacks: {
            ...safeCallbacks,
            // גרסה גדולה למקרה שהספרייה דורשת CamelCase
            onOpen: safeCallbacks.onopen,
            onMessage: safeCallbacks.onmessage,
            onClose: safeCallbacks.onclose,
            onError: safeCallbacks.onerror
        }
      });

      activeSessionRef.current = session;
      setStatus("connected");
      setDebugLog("מחובר! שולח 'שלום'...");
      isWaitingForResponseRef.current = false;

      // Kickstart - שימוש ב-sendClientContent (חובה לטקסט)
      setTimeout(() => {
          if (activeSessionRef.current) {
              activeSessionRef.current.sendClientContent({ 
                  turns: [{ role: 'user', parts: [{ text: "Hello" }] }], 
                  turnComplete: true 
              });
          }
      }, 1000);

      // מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true } 
      });
      micStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0;
      source.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        if (!activeSessionRef.current || isWaitingForResponseRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        const vol = Math.round(sum * 100);
        setMicVol(vol);

        // VAD (זיהוי שתיקה)
        if (vol > 8) { 
            lastVoiceTimeRef.current = Date.now();
            if (!isUserTalking) setIsUserTalking(true);
            
            const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);
            const pcm16 = floatTo16BitPCM(downsampled);
            
            // שימוש ב-sendRealtimeInput (חובה לאודיו)
            activeSessionRef.current.sendRealtimeInput({ 
                mediaChunks: [{ data: pcm16, mimeType: 'audio/pcm;rate=16000' }] 
            });

        } else if (isUserTalking) {
            const timeSinceVoice = Date.now() - lastVoiceTimeRef.current;
            if (timeSinceVoice > 1500) { 
                console.log("Silence -> Force Reply");
                setDebugLog("שתיקה -> מבקש תשובה...");
                
                // שליחת פקודת סיום
                activeSessionRef.current.sendClientContent({ 
                    turns: [], 
                    turnComplete: true 
                });
                
                isWaitingForResponseRef.current = true;
                setIsUserTalking(false);
            }
        }
      };

      // לולאת האזנה
      (async () => {
        try {
            for await (const msg of session.listen()) {
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                    const audioData = part.inlineData?.data;
                    if (audioData) {
                        setDebugLog("🔊 ה-AI מדבר");
                        setIsSpeaking(true);
                        isWaitingForResponseRef.current = false;
                        
                        const binaryString = atob(audioData);
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
                    }
                }
            }
        } catch (e) {
            console.log("Loop Error", e);
            setDebugLog("השיחה הסתיימה");
            stopConversation();
        }
      })();
      
    } catch (e: any) { stopConversation(); alert(e.message); }
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
            <Volume2 size={16} className={micVol > 8 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 8 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
            <span className="text-xs text-slate-400">{micVol}</span>
        </div>
      </div>

      <div className="relative">
        <Avatar state={status === "connected" ? (isSpeaking ? 'speaking' : (isUserTalking ? 'listening' : 'idle')) : 'idle'} />
        
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-full flex justify-center">
            <button 
                onClick={status === "connected" ? stopConversation : startConversation}
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
