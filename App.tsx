import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ArrowLeftRight, AlertTriangle, CheckCircle, Square, Activity } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import { translations } from './translations';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // משתני דיבאג
  const [keyStatus, setKeyStatus] = useState<string>("טוען...");
  const [keyColor, setKeyColor] = useState<string>("bg-gray-500");
  const [debugLog, setDebugLog] = useState<string>("מוכן"); 
  const [micVol, setMicVol] = useState<number>(0);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);

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

  // --- פונקציית המרה פשוטה ויעילה ל-PCM 16Bit ---
  const convertFloat32ToInt16 = (buffer: Float32Array) => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      // המרה לקנה מידה של 16 ביט עם הגבלת עוצמה (Clipping)
      buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7FFF;
    }
    return buf;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };
  // ------------------------------------------------

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
    
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }

    if (audioContextRef.current) { 
        audioContextRef.current.close(); 
        audioContextRef.current = null; 
    }

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    setDebugLog("מנותק.");
    setMicVol(0);
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');

    if (!apiKey) return alert("המפתח חסר.");

    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);
      setDebugLog("מתחבר לגוגל...");

      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // 1. יצירת הקשר אודיו אחד (משותף)
      const ctx = new AudioContext({ sampleRate: 16000 }); // מנסים לכפות 16k מההתחלה
      await ctx.resume();
      audioContextRef.current = ctx;

      // 2. חיבור ל-Gemini
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
                setDebugLog("השיחה הסתיימה");
                stopConversation();
            }
        }
      });
      activeSessionRef.current = session;

      // 3. הפעלת מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              sampleRate: 16000, 
              channelCount: 1,
              echoCancellation: true, // חשוב מאוד!
              autoGainControl: true,
              noiseSuppression: true
          } 
      });
      micStreamRef.current = stream;

      // 4. עיבוד אודיו (Input) - שיטה פשוטה יותר
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // עדכון מד ווליום
        let sum = 0;
        for(let i=0; i<inputData.length; i+=50) sum += Math.abs(inputData[i]);
        setMicVol(Math.round(sum * 100));

        if (activeSessionRef.current && activeSessionRef.current.send) {
          try {
              // המרה ישירה ל-PCM16 ושליחה
              const pcm16 = convertFloat32ToInt16(inputData);
              const base64Audio = arrayBufferToBase64(pcm16.buffer);
              
              activeSessionRef.current.send({ 
                realtimeInput: { 
                  mediaChunks: [{ data: base64Audio, mimeType: 'audio/pcm;rate=16000' }] 
                } 
              });
          } catch(err) {
              console.error("Send error", err);
          }
        }
      };
      
      source.connect(processor);
      processor.connect(ctx.destination); // נדרש בכרום כדי שהפרוססור יפעל

      // 5. קבלת תשובות (Output)
      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setDebugLog("שומע תשובה..."); 
              setIsSpeaking(true);
              
              // פענוח וניגון
              const binaryString = atob(audioData);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
              
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000); // גוגל שולח ב-24k בד"כ
              const channelData = audioBuffer.getChannelData(0);
              for (let i=0; i<pcm16.length; i++) {
                 channelData[i] = pcm16[i] / 32768.0;
              }

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(ctx.destination);
              sourceNode.onended = () => setIsSpeaking(false);
              
              const now = ctx.currentTime;
              const start = Math.max(nextStartTimeRef.current, now);
              sourceNode.start(start);
              nextStartTimeRef.current = start + audioBuffer.duration;
            }
          }
        } catch(e) { console.error("Listen error:", e); }
      })();
      
    } catch (e: any) { 
      stopConversation(); 
      alert(`שגיאה: ${e.message}`); 
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
