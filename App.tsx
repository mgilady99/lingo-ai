import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, AlertTriangle, CheckCircle, Square, Volume2 } from 'lucide-react';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // הגדרות VAD (זיהוי שתיקה)
  const isUserTalkingRef = useRef<boolean>(false);
  const lastVoiceTimeRef = useRef<number>(0);
  const isWaitingForResponseRef = useRef<boolean>(false);

  // פונקציית ניקוי
  const disconnect = useCallback(() => {
    console.log("Disconnecting...");
    
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
        // מנסים לסגור בעדינות
        try { sessionRef.current.close(); } catch(e) {}
        sessionRef.current = null;
    }

    setStatus("disconnected");
    setIsSpeaking(false);
    setDebugLog("מנותק");
  }, []);

  const connect = async () => {
    // אם כבר מחובר, לא עושים כלום
    if (status === "connected" || status === "connecting") return;
    
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');
    if (!apiKey) return alert("חסר API KEY");

    try {
      setStatus("connecting");
      setDebugLog("מתחבר...");

      const client = new GoogleGenAI({ apiKey });
      
      const session = await client.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          generationConfig: {
            responseModalities: "AUDIO",
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
            }
          }
        },
        callbacks: {
            onOpen: () => {
                console.log("Connected successfully");
                setStatus("connected");
                setDebugLog("מחובר! דבר למיקרופון...");
                // שינוי קריטי: לא שולחים הודעת Hello אוטומטית כדי לא להקריס
            },
            onMessage: (msg: any) => {
                // בדיקה אם קיבלנו אודיו
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith("audio")) {
                        isWaitingForResponseRef.current = false;
                        setDebugLog("🔊 ה-AI עונה");
                        playAudioData(part.inlineData.data);
                    }
                }
            },
            onClose: (event: any) => {
                console.log("Server Closed Connection:", event);
                // רק אם השרת סגר באמת, נעדכן סטטוס
                setStatus("disconnected");
                setDebugLog(`נותק ע"י שרת (${event.code})`);
            },
            onError: (error: any) => {
                console.error("Session Error:", error);
                // שינוי קריטי: לא מנתקים את השיחה בשגיאה!
                setDebugLog("שגיאת תקשורת (ממשיך...)");
            }
        }
      });

      sessionRef.current = session;

      // אתחול אודיו - ללא כפיית קצב דגימה בהתחלה (ניתן לדפדפן להחליט)
      const ctx = new window.AudioContext();
      await ctx.resume();
      audioContextRef.current = ctx;
      
      console.log(`Audio Sample Rate: ${ctx.sampleRate}`); // לוג חשוב

      const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
              channelCount: 1,
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true
          }
      });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      // ScriptProcessor חייב buffer size גדול כדי לא לחנוק את ה-CPU
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
          if (!sessionRef.current || isWaitingForResponseRef.current) return;

          const inputData = e.inputBuffer.getChannelData(0);
          
          // חישוב ווליום לתצוגה
          let sum = 0;
          for (let i = 0; i < inputData.length; i += 50) sum += Math.abs(inputData[i]);
          const vol = Math.round(sum * 100);
          setMicVol(vol);

          // לוגיקת VAD (זיהוי דיבור)
          if (vol > 8) { // סף רגישות
              lastVoiceTimeRef.current = Date.now();
              if (!isUserTalkingRef.current) {
                  isUserTalkingRef.current = true;
                  // setDebugLog("שומע...");
              }

              // המרה קריטית: אם הדפדפן הוא 48k, חייבים להוריד ל-16k לגוגל
              const pcm16 = downsampleTo16k(inputData, ctx.sampleRate);
              
              // שליחה "מוגנת" - לא תפיל את האפליקציה אם תכשל
              try {
                  sessionRef.current.sendRealtimeInput({
                      mediaChunks: [{
                          mimeType: "audio/pcm",
                          data: pcm16
                      }]
                  });
              } catch (err) {
                  console.error("Send Audio Error (Ignored)", err);
              }

          } else if (isUserTalkingRef.current) {
              // בדיקת שתיקה
              const timeSinceVoice = Date.now() - lastVoiceTimeRef.current;
              if (timeSinceVoice > 1200) { // 1.2 שניות שקט
                  console.log("Silence detected -> Ending turn");
                  setDebugLog("⏳ סיימת לדבר...");
                  
                  try {
                      sessionRef.current.sendClientContent({
                          turns: [],
                          turnComplete: true
                      });
                  } catch (err) { console.error("Send TurnComplete Error", err); }

                  isWaitingForResponseRef.current = true;
                  isUserTalkingRef.current = false;
              }
          }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

    } catch (err: any) {
        console.error("Connection Failed:", err);
        setDebugLog("כישלון בחיבור: " + err.message);
        // לא קוראים ל-disconnect כאן כדי לא ליצור לופ
    }
  };

  // פונקציית עזר: המרה נכונה ל-16k ומקודד base64
  const downsampleTo16k = (buffer: Float32Array, inputRate: number) => {
      if (inputRate === 16000) {
          return floatTo16BitPCM(buffer);
      }
      
      const ratio = inputRate / 16000;
      const newLength = Math.round(buffer.length / ratio);
      const result = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
          const offset = Math.floor(i * ratio);
          // הגנה מפני חריגה מהמערך
          if (offset < buffer.length) {
              result[i] = buffer[offset];
          }
      }
      return floatTo16BitPCM(result);
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

  const playAudioData = (b64Data: string) => {
    if (!audioContextRef.current) return;
    try {
        const ctx = audioContextRef.current;
        const binaryString = atob(b64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        const pcm16 = new Int16Array(bytes.buffer);
        
        // Gemini שולח ב-24k
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
            <Volume2 size={16} className={micVol > 8 ? "text-green-400" : "text-slate-600"} />
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${micVol > 8 ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(micVol, 100)}%` }} />
            </div>
        </div>
      </div>

      <div className="relative">
        <Avatar state={status === "connected" ? (isSpeaking ? 'speaking' : (isUserTalkingRef.current ? 'listening' : 'idle')) : 'idle'} />
        
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
            <AudioVisualizer isActive={true} color={isSpeaking ? "#a78bfa" : (isUserTalkingRef.current ? "#34d399" : "#4b5563")} />
         </div>
      )}
    </div>
  );
};

export default App;
