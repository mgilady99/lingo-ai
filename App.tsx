import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, AlertTriangle, CheckCircle, Square, Volume2, Send } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  // Ref-ים לניהול מצב ללא רינדור מחדש
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastVoiceTimeRef = useRef<number>(0);
  const isWaitingForResponseRef = useRef<boolean>(false);

  // פונקציית ניקוי (חשובה מאוד למניעת קריסות)
  const cleanupAudio = useCallback(() => {
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
  }, []);

  const disconnect = useCallback(async () => {
    cleanupAudio();
    if (sessionRef.current) {
        try {
            await sessionRef.current.close();
        } catch (e) {
            console.error("Error closing session", e);
        }
        sessionRef.current = null;
    }
    setStatus("disconnected");
    setIsSpeaking(false);
    setDebugLog("מנותק");
  }, [cleanupAudio]);

  // עזרי אודיו
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

  const playAudioData = async (b64Data: string) => {
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

  const connect = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    // ניתוק קודם אם קיים
    await disconnect();

    setStatus("connecting");
    setDebugLog("מתחבר...");

    try {
        const client = new GoogleGenAI({ apiKey });
        
        // הגדרת סשן עם כל ההגנות האפשריות
        const session = await client.live.connect({
            model: "gemini-2.0-flash-exp",
            config: {
                // ביטול כלים כדי למנוע קריסות פנימיות
                tools: [], 
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
                    }
                }
            },
            callbacks: {
                onOpen: () => {
                    setStatus("connected");
                    setDebugLog("מחובר! (מבצע אתחול...)");
                    // שליחת הודעה ראשונית לחימום המנוע
                    setTimeout(() => {
                        session.sendClientContent({
                            turns: [{ role: "user", parts: [{ text: "Hello" }] }],
                            turnComplete: true
                        });
                    }, 500);
                },
                onMessage: (msg: any) => {
                    const parts = msg.serverContent?.modelTurn?.parts || [];
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith("audio")) {
                            isWaitingForResponseRef.current = false; // קיבלנו תשובה, אפשר לשחרר את המיקרופון
                            setDebugLog("🔊 ה-AI מדבר");
                            playAudioData(part.inlineData.data);
                        }
                    }
                },
                onClose: (event: any) => {
                    console.log("Session closed", event);
                    setStatus("disconnected");
                    setDebugLog(`נותק (קוד: ${event.code || 'unknown'})`);
                },
                onError: (error: any) => {
                    console.error("Session error", error);
                    setDebugLog("שגיאה בחיבור");
                    disconnect();
                }
            }
        });

        sessionRef.current = session;

        // אתחול אודיו (מיקרופון)
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
            // אם אנחנו לא מחוברים או מחכים לתשובה - לא לשלוח כלום
            if (!sessionRef.current || isWaitingForResponseRef.current) return;

            const inputData = e.inputBuffer.getChannelData(0);
            
            // חישוב עוצמת קול (VAD)
            let sum = 0;
            for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
            const vol = Math.round(sum * 100);
            setMicVol(vol);

            // לוגיקת VAD
            if (vol > 5) {
                lastVoiceTimeRef.current = Date.now();
                if (!isUserTalking) setIsUserTalking(true);

                // שליחת אודיו בזמן אמת
                const pcm16 = floatTo16BitPCM(inputData); // קלט כבר ב-16k בגלל getUserMedia
                sessionRef.current.sendRealtimeInput({
                    mediaChunks: [{
                        mimeType: "audio/pcm",
                        data: pcm16
                    }]
                });

            } else if (isUserTalking) {
                // זיהוי שתיקה
                const timeSinceVoice = Date.now() - lastVoiceTimeRef.current;
                if (timeSinceVoice > 1200) { // 1.2 שניות שקט
                    console.log("Silence detected -> Ending turn");
                    setDebugLog("⏳ סיימת לדבר. ממתין...");
                    
                    // שליחת סימן שהתור נגמר
                    sessionRef.current.sendClientContent({
                        turns: [],
                        turnComplete: true
                    });

                    isWaitingForResponseRef.current = true; // חוסם שליחה עד שתתקבל תשובה
                    setIsUserTalking(false);
                }
            }
        };

        source.connect(processor);
        processor.connect(ctx.destination); // נדרש כדי שה-ScriptProcessor יפעל בכרום

    } catch (err: any) {
        console.error(err);
        setDebugLog("שגיאה בהתחברות: " + err.message);
        disconnect();
    }
  };

  // כפתור חילוץ ידני
  const manualStop = () => {
      if (sessionRef.current) {
          setDebugLog("⚡ שליחה ידנית");
          sessionRef.current.sendClientContent({ turns: [], turnComplete: true });
          isWaitingForResponseRef.current = true;
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
            <Volume2 size={16} className={micVol > 5 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 5 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
            <span className="text-xs text-slate-400">{micVol}</span>
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
            
            {status === "connected" && (
                <button onClick={manualStop} className="bg-gray-700 p-4 rounded-full hover:bg-gray-600">
                    <Send size={24} />
                </button>
            )}
        </div>
      </div>

      {status === "connected" && (
         <div className="fixed bottom-0 w-full h-32 pointer-events-none opacity-50">
            <AudioVisualizer isActive={true} color={isSpeaking ? "#a78bfa" : (isUserTalking ? "#34d399" : "#4b5563")} />
         </div>
      )}
    </div>
  );
};

export default App;
