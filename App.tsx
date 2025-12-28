import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, AlertTriangle, CheckCircle, Square, Activity, Volume2 } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

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

  // --- ניתוק ---
  const stopConversation = useCallback(() => {
    console.log("Stopping...");
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
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
        audioContextRef.current.suspend();
    }
    setStatus("disconnected");
    setIsSpeaking(false);
    setMicVol(0);
    setDebugLog("מנותק");
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      stopConversation();
      setStatus("connecting");
      setDebugLog("מתחבר...");

      // 1. אתחול AudioContext
      let ctx = audioContextRef.current;
      if (!ctx) {
          ctx = new AudioContext();
          audioContextRef.current = ctx;
      }
      await ctx.resume();

      // 2. חיבור ל-Gemini
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
          }
        },
        callbacks: { 
            onopen: () => {
              console.log("Connected");
              setDebugLog("מחובר! מבצע התנעה...");
              setStatus("connected");
              
              // *** התיקון שלך: שימוש ב-sendClientContent ***
              setTimeout(() => {
                 const s = activeSessionRef.current;
                 if (s) {
                     console.log("Sending Hello...");
                     // בדיקה אם הפונקציה קיימת לפני קריאה (ליתר ביטחון)
                     if (typeof s.sendClientContent === 'function') {
                         s.sendClientContent({
                             turns: [{ role: 'user', parts: [{ text: "Hello, can you hear me?" }] }],
                             turnComplete: true
                         });
                     } else {
                         // Fallback למקרה שזה גרסה אחרת
                         console.warn("sendClientContent missing, trying .send");
                         s.send({
                             clientContent: { turns: [{ role: 'user', parts: [{ text: "Hello" }] }] },
                             turnComplete: true
                         });
                     }
                 }
              }, 500);
            },
            onmessage: () => {}, 
            onerror: (e) => {
                console.error("Error:", e);
                setDebugLog("שגיאה: " + e.message);
            }, 
            onclose: (e) => {
                console.log("Closed:", e);
                setDebugLog(`נותק (Code: ${e.code})`);
                stopConversation();
            }
        }
      });
      activeSessionRef.current = session;

      // 3. מיקרופון + מניעת ECHO
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true } 
      });
      micStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      // *** התיקון שלך: Zero Gain למניעת פידבק ***
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0;

      source.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(ctx.destination); // חיבור "שקט" כדי להפעיל את הפרוססור

      processor.onaudioprocess = (e) => {
        const s = activeSessionRef.current;
        if (!s) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // ווליום
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        const vol = Math.round(sum * 100);
        setMicVol(vol);

        // שליחה רק אם יש ווליום
        if (vol > 0) {
            try {
               const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);
               const pcm16 = floatTo16BitPCM(downsampled);
               
               // *** התיקון שלך: שימוש ב-sendRealtimeInput ***
               if (typeof s.sendRealtimeInput === 'function') {
                   s.sendRealtimeInput({
                       mediaChunks: [{ data: pcm16, mimeType: 'audio/pcm;rate=16000' }]
                   });
               } else {
                   // Fallback
                   s.send({
                       realtimeInput: {
                           mediaChunks: [{ data: pcm16, mimeType: 'audio/pcm;rate=16000' }]
                       }
                   });
               }
            } catch(err) {
                // שגיאות בודדות לא מעניינות
            }
        }
      };

      // 4. לולאת האזנה (Playback)
      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            const parts = msg.serverContent?.modelTurn?.parts || [];
            
            for (const part of parts) {
                const audioData = part.inlineData?.data;
                if (audioData) {
                    setDebugLog("🔊 אודיו התקבל!"); 
                    setIsSpeaking(true);
                    
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
        } catch(e) { console.error("Listen Error:", e); }
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
            <Volume2 size={16} className={micVol > 2 ? "text-green-400" : "text-slate-600"} />
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
