// קובץ: src/App.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ArrowLeftRight, AlertTriangle, CheckCircle, Square, Activity } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import { translations } from './translations';

// --- מנוע המרת אודיו (Audio Utils) ---
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

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // דיבאג
  const [keyStatus, setKeyStatus] = useState<string>("טוען...");
  const [keyColor, setKeyColor] = useState<string>("bg-gray-500");
  const [debugLog, setDebugLog] = useState<string>("ממתין..."); 
  const [micVol, setMicVol] = useState<number>(0);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  // בדיקת מפתח בעלייה
  useEffect(() => {
    const key = import.meta.env.VITE_API_KEY;
    if (key && key.length > 20) {
      setKeyStatus("המפתח תקין ✅");
      setKeyColor("bg-green-600");
    } else {
      setKeyStatus("שגיאה: VITE_API_KEY חסר!");
      setKeyColor("bg-red-600");
    }
  }, []);

  const t = (key: string) => translations[nativeLang.code]?.[key] || translations['en-US']?.[key] || key;
  const dir = (nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA') ? 'rtl' : 'ltr';

  // פונקציית ניתוק מסודרת
  const stopConversation = useCallback(() => {
    console.log("Stopping conversation...");
    
    if (activeSessionRef.current) { 
        try { activeSessionRef.current.close(); } catch (e) {} 
        activeSessionRef.current = null; 
    }
    
    if (micStreamRef.current) { 
        micStreamRef.current.getTracks().forEach(track => track.stop()); 
        micStreamRef.current = null; 
    }
    
    if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
    if (outputAudioContextRef.current) { outputAudioContextRef.current.close(); outputAudioContextRef.current = null; }

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    setDebugLog("מנותק.");
    setMicVol(0);
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');

    if (!apiKey) return alert("המפתח חסר בהגדרות Vercel.");

    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);
      setDebugLog("מתחבר לגוגל...");

      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // 1. בקשת מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              sampleRate: 16000, // ניסיון לבקש 16k מהחומרה
              channelCount: 1,
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true
          } 
      });
      micStreamRef.current = stream;

      // 2. הכנת AudioContext
      const inCtx = new AudioContext(); 
      const outCtx = new AudioContext();
      await inCtx.resume();
      await outCtx.resume();
      
      inputAudioContextRef.current = inCtx;
      outputAudioContextRef.current = outCtx;

      // 3. חיבור ל-WebSocket של גוגל
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          systemInstruction: selectedScenario.systemInstruction.replace(/SOURCE_LANG/g, nativeLang.name).replace(/TARGET_LANG/g, targetLang.name),
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
        callbacks: { 
            onopen: () => {
              console.log("Connected");
              setDebugLog("מחובר! דבר עכשיו...");
              setStatus(ConnectionStatus.CONNECTED);
            },
            onmessage: () => {}, 
            onerror: (e) => {
                console.error("Gemini Error:", e);
                setDebugLog("שגיאה בחיבור");
                stopConversation();
            }, 
            onclose: () => {
                console.log("Closed by server");
                setDebugLog("השיחה נותקה ע״י השרת");
                stopConversation(); // חשוב! מונע תקיעה של האווטאר
            }
        }
      });
      activeSessionRef.current = session;

      // 4. עיבוד אודיו מהמיקרופון ושליחה
      const source = inCtx.createMediaStreamSource(stream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // מד ווליום ויזואלי
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        setMicVol(Math.round(sum * 100));

        if (activeSessionRef.current && activeSessionRef.current.send) {
          try {
              // המרה ל-16,000Hz אם צריך
              const downsampledData = downsampleBuffer(inputData, inCtx.sampleRate, 16000);
              const pcm64 = floatTo16BitPCM(downsampledData);
              
              activeSessionRef.current.send({ 
                realtimeInput: { 
                  mediaChunks: [{ data: pcm64, mimeType: 'audio/pcm;rate=16000' }] 
                } 
              });
          } catch(err) {
              console.error("Audio send error", err);
          }
        }
      };
      
      source.connect(processor);
      processor.connect(inCtx.destination);

      // 5. קבלת תשובות והשמעה
      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setDebugLog("שומע תשובה..."); 
              setIsSpeaking(true);
              
              // המרה מ-Base64 ל-AudioBuffer
              const binaryString = atob(audioData);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
              
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = outCtx.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i=0; i<pcm16.length; i++) {
                 channelData[i] = pcm16[i] / 32768.0;
              }

              const sourceNode = outCtx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outCtx.destination);
              sourceNode.onended = () => setIsSpeaking(false);
              
              const now = outCtx.currentTime;
              const start = Math.max(nextStartTimeRef.current, now);
              sourceNode.start(start);
              nextStartTimeRef.current = start + audioBuffer.duration;
            }
          }
        } catch(e) { console.error("Listen error:", e); }
      })();
      
    } catch (e: any) { 
      stopConversation(); 
      alert(`שגיאת אתחול: ${e.message}`); 
    }
  };

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      
      {/* סרגל בדיקה */}
      <div className={`w-full ${keyColor} text-white font-bold p-2 text-center text-sm flex items-center justify-center gap-4 z-50 shadow-lg`}>
        <div className="flex items-center gap-2">
            {keyColor.includes('green') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            STATUS: {keyStatus} 
        </div>
        <div className="bg-black/20 px-3 py-1 rounded-full">LOG: {debugLog}</div>
        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full min-w-[80px]">
            <Activity size={16} className={micVol > 2 ? "text-green-400 animate-pulse" : "text-gray-500"} />
            <span>MIC: {micVol}</span>
        </div>
      </div>

      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
          <span className="font-black text-xl uppercase tracking-tighter">LingoLive Pro</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[400px] flex flex-col p-4 gap-4 bg-slate-900/30 border-r border-white/5 shadow-2xl overflow-y-auto">
          <div className="bg-slate-900/90 rounded-[2rem] border border-white/10 p-6 flex flex-col gap-4">
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
                <ArrowLeftRight size={20} className="text-indigo-500 shrink-0" />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-6 rounded-3xl flex flex-col items-center gap-2 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-3xl">{s.icon}</span>
                  <span className="text-xs font-black uppercase tracking-widest">{t(s.title)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-4 flex-1 justify-center relative min-h-[300px]">
            <Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
            
            <button 
                onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
                className={`mt-8 px-12 py-5 rounded-full font-black text-2xl shadow-2xl flex items-center gap-4 transition-all active:scale-95 z-20 relative ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500'}`}
            >
                {status === ConnectionStatus.CONNECTED ? <><Square size={24} fill="currentColor" /> {t('stop_conversation')}</> : <><Mic size={28} /> {t('start_conversation')}</>}
            </button>

            {(isSpeaking || status === ConnectionStatus.CONNECTED) && 
             <div className="absolute bottom-8 w-full px-12 z-10 pointer-events-none">
                <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />
             </div>
            }
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
