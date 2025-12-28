import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, AlertTriangle, CheckCircle, Square, Activity, Zap } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

// --- הגדרות שמע קבועות ---
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

  // --- פונקציות עזר לאודיו ---
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
  // ---------------------------

  const stopConversation = useCallback(() => {
    console.log("Stopping...");
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    setStatus("disconnected");
    setIsSpeaking(false);
    setDebugLog("מנותק");
    setMicVol(0);
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      stopConversation();
      setStatus("connecting");
      setDebugLog("מתחבר...");

      // 1. אתחול מנוע אודיו (חייב לקרות בלחיצה!)
      const ctx = new AudioContext(); 
      await ctx.resume(); // קריטי ל-Autoplay Policy
      audioContextRef.current = ctx;

      // 2. חיבור ל-Gemini
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          // פישוט מקסימלי של ההוראות למניעת קריסה
          systemInstruction: { parts: [{ text: "You are a helpful assistant. Speak briefly." }] },
          responseModalities: [Modality.AUDIO], // חובה!
        },
        callbacks: { 
            onopen: () => {
              console.log("Connected!");
              setDebugLog("מחובר! מבצע התנעה...");
              setStatus("connected");
              
              // *** התיקון הקריטי: בעיטה (Kickstart) ***
              // שולח הודעה ראשונה כדי להכריח את השרת לשלוח אודיו בחזרה
              setTimeout(() => {
                if(activeSessionRef.current) {
                    activeSessionRef.current.send({ 
                        clientContent: { 
                            turns: [{ role: 'user', parts: [{ text: "Hello! Can you hear me?" }] }] 
                        }, 
                        turnComplete: true 
                    });
                    setDebugLog("נשלח סיגנל התחלה");
                }
              }, 500);
            },
            onmessage: () => {}, 
            onerror: (e) => {
                console.error("Error:", e);
                setDebugLog("שגיאת שרת: " + e.message);
                stopConversation();
            }, 
            onclose: (e) => {
                console.log("Closed:", e);
                setDebugLog("השרת סגר את החיבור");
                stopConversation();
            }
        }
      });
      activeSessionRef.current = session;

      // 3. חיבור מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, sampleRate: INPUT_SAMPLE_RATE } 
      });
      micStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // מד ווליום
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        setMicVol(Math.round(sum * 100));

        if (activeSessionRef.current) {
          // המרה ידנית ל-16k בטוח
          const downsampled = downsampleBuffer(inputData, ctx.sampleRate, INPUT_SAMPLE_RATE);
          const pcm16 = floatTo16BitPCM(downsampled);
          
          activeSessionRef.current.send({ 
            realtimeInput: { 
              mediaChunks: [{ data: pcm16, mimeType: 'audio/pcm;rate=16000' }] 
            } 
          });
        }
      };
      
      source.connect(processor);
      processor.connect(ctx.destination);

      // 4. האזנה לתשובות (Playback)
      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              setDebugLog("🔊 מתקבל אודיו!"); 
              setIsSpeaking(true);
              
              const audioData = msg.serverContent.modelTurn.parts[0].inlineData.data;
              const binaryString = atob(audioData);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
              
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000); // ברירת מחדל של גוגל
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
        } catch(e) { console.error(e); }
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

      {/* אזור ראשי */}
      <div className="relative">
        <Avatar state={status === "connected" ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
        
        {/* כפתור ראשי */}
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
                    <> <Mic size={24} /> Start Conversation </>
                )}
            </button>
        </div>
      </div>

      {/* ויזואליזציה */}
      {(status === "connected") && (
         <div className="fixed bottom-0 w-full h-32 pointer-events-none opacity-50">
            <AudioVisualizer isActive={true} color={isSpeaking ? "#a78bfa" : "#34d399"} />
         </div>
      )}
    </div>
  );
};

export default App;
