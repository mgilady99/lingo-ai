
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, AlertTriangle, CheckCircle, Square, Activity, Zap, RefreshCw } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

// הגדרות קבועות
const INPUT_SAMPLE_RATE = 16000;

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);

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
  // -------------------

  const stopConversation = useCallback(() => {
    console.log("Stopping conversation cleanup...");
    
    // ניתוק המעבד קודם כל כדי למנוע את השגיאה Uncaught TypeError
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null; // ביטול הפונקציה
        processorRef.current = null;
    }

    if (activeSessionRef.current) { 
        try { activeSessionRef.current.close(); } catch (e) {} 
        activeSessionRef.current = null; 
    }

    if (micStreamRef.current) { 
        micStreamRef.current.getTracks().forEach(track => track.stop()); 
        micStreamRef.current = null; 
    }

    if (audioContextRef.current) { 
        audioContextRef.current.close(); 
        audioContextRef.current = null; 
    }

    setStatus("disconnected");
    setIsSpeaking(false);
    setMicVol(0);
    setDebugLog("מנותק (ניקוי בוצע)");
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      stopConversation(); // ניקוי יסודי לפני התחלה
      setStatus("connecting");
      setDebugLog("מתחבר...");

      const ctx = new AudioContext(); 
      await ctx.resume(); 
      audioContextRef.current = ctx;

      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          // הגדרה מינימלית
          responseModalities: [Modality.AUDIO],
        },
        callbacks: { 
            onopen: () => {
              console.log("Connected");
              setDebugLog("מחובר! (ממתין לדיבור)");
              setStatus("connected");
              
              // שליחת הודעת 'התנעה' שקטה אחרי שנייה
              setTimeout(() => {
                if(activeSessionRef.current) {
                    try {
                        activeSessionRef.current.send({ 
                            clientContent: { turns: [{ role: 'user', parts: [{ text: "Hello" }] }] }, 
                            turnComplete: true 
                        });
                    } catch(e) { console.log("Kickstart failed", e); }
                }
              }, 1000);
            },
            onmessage: () => {}, 
            onerror: (e) => {
                console.error("Server Error:", e);
                setDebugLog("שגיאה מהשרת: " + e.message);
                stopConversation();
            }, 
            onclose: (e) => {
                console.log("Closed by server", e);
                setDebugLog("השרת ניתק את השיחה");
                stopConversation();
            }
        }
      });
      
      activeSessionRef.current = session;

      // חיבור מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, sampleRate: 16000 } 
      });
      micStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        // --- ההגנה שמונעת את הקריסה ---
        if (!activeSessionRef.current) return; 
        // ---------------------------------

        const inputData = e.inputBuffer.getChannelData(0);
        
        // מד ווליום
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        setMicVol(Math.round(sum * 100));

        try {
          // המרה ושליחה
          const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);
          const pcm16 = floatTo16BitPCM(downsampled);
          
          // בדיקה נוספת לפני שליחה
          if (activeSessionRef.current) {
             activeSessionRef.current.send({ 
                realtimeInput: { 
                  mediaChunks: [{ data: pcm16, mimeType: 'audio/pcm;rate=16000' }] 
                } 
             });
          }
        } catch(err) {
            // התעלמות משגיאות שליחה כדי לא לתקוע את התוכנה
            console.warn("Send skipped");
        }
      };
      
      source.connect(processor);
      processor.connect(ctx.destination);

      // השמעת תשובות
      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              setDebugLog("🔊 שומע תשובה..."); 
              setIsSpeaking(true);
              
              const audioData = msg.serverContent.modelTurn.parts[0].inlineData.data;
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
              sourceNode.start(Math.max(nextStartTimeRef.current, ctx.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime) + audioBuffer.duration;
            }
          }
        } catch(e) { console.error("Listen Loop Error:", e); }
      })();
      
    } catch (e: any) { stopConversation(); alert(e.message); }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
      {/* לוג ומצב */}
      <div className="absolute top-4 w-full max-w-md bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-2">
            {status === "connected" ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-amber-500" />}
            <span className="font-bold uppercase tracking-wider text-sm">{status}</span>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 text-xs font-mono text-cyan-300 mb-2">
            LOG: {debugLog}
        </div>
        <div className="flex items-center justify-center gap-2">
            <Activity size={16} className={micVol > 2 ? "text-green-400 animate-pulse" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-75" style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
        </div>
      </div>

      <div className="relative">
        <Avatar state={status === "connected" ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
        
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
            <AudioVisualizer isActive={true} color={isSpeaking ? "#a78bfa" : "#34d399"} />
         </div>
      )}
    </div>
  );
};

export default App;
