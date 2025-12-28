import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ArrowLeftRight, AlertTriangle, CheckCircle, Square } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import { translations } from './translations';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [keyStatus, setKeyStatus] = useState<string>("טוען...");
  const [keyColor, setKeyColor] = useState<string>("bg-gray-500");

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    const key = import.meta.env.VITE_API_KEY;
    if (key && key.length > 20) {
      setKeyStatus("המפתח זוהה בהצלחה ✅");
      setKeyColor("bg-green-600");
    } else {
      setKeyStatus("שגיאה: VITE_API_KEY חסר!");
      setKeyColor("bg-red-600");
    }
  }, []);

  const t = (key: string) => translations[nativeLang.code]?.[key] || translations['en-US']?.[key] || key;
  const dir = (nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA') ? 'rtl' : 'ltr';

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    
    // סגירת הקשרי אודיו כדי לשחרר את המערכת
    if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
    if (outputAudioContextRef.current) { outputAudioContextRef.current.close(); outputAudioContextRef.current = null; }

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    let apiKey = import.meta.env.VITE_API_KEY || "";
    apiKey = apiKey.trim().replace(/['"]/g, '');

    if (!apiKey) return alert("המפתח חסר.");

    try {
      stopConversation(); // ניקוי שאריות אם יש
      setStatus(ConnectionStatus.CONNECTING);

      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // יצירת הקשרי אודיו + הפעלה כפויה (Resume) לפתרון בעיות שמע
      const inCtx = new AudioContext({ sampleRate: 16000 }); // כפיית קצב דגימה לגוגל
      const outCtx = new AudioContext({ sampleRate: 24000 }); // כפיית קצב יציאה
      
      await inCtx.resume();
      await outCtx.resume();
      
      inputAudioContextRef.current = inCtx;
      outputAudioContextRef.current = outCtx;

      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          systemInstruction: selectedScenario.systemInstruction.replace(/SOURCE_LANG/g, nativeLang.name).replace(/TARGET_LANG/g, targetLang.name),
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
        callbacks: { 
            onopen: () => console.log("Connected"), 
            onmessage: () => {}, 
            onerror: (e) => {
                console.error("Gemini Error:", e);
                stopConversation();
            }, 
            onclose: () => console.log("Closed") 
        }
      });
      activeSessionRef.current = session;

      const source = inCtx.createMediaStreamSource(stream);
      // שימוש ב-ScriptProcessor בזהירות
      const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (activeSessionRef.current && activeSessionRef.current.send) {
          // שליחת המידע לגוגל
          const pcmBase64 = createPcmBlob(e.inputBuffer.getChannelData(0), inCtx.sampleRate);
          activeSessionRef.current.send({ realtimeInput: { mediaChunks: [{ data: pcmBase64, mimeType: 'audio/pcm;rate=16000' }] } });
        }
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inCtx.destination);

      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setIsSpeaking(true);
              const outCtx = outputAudioContextRef.current!;
              const buffer = decodeAudioData(decode(audio), outCtx, 24000);
              const audioSource = outCtx.createBufferSource();
              audioSource.buffer = buffer; 
              audioSource.connect(outCtx.destination);
              audioSource.onended = () => { setIsSpeaking(false); };
              audioSource.start(Math.max(nextStartTimeRef.current, outCtx.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime) + buffer.duration;
            }
          }
        } catch(e) { stopConversation(); }
      })();
      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) { 
      stopConversation(); 
      alert(`Connection failed: ${e.message}`); 
    }
  };

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      
      {/* סרגל בדיקה */}
      <div className={`w-full ${keyColor} text-white font-bold p-2 text-center text-sm flex items-center justify-center gap-2 z-50 shadow-lg`}>
        {keyColor.includes('green') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
        STATUS: {keyStatus}
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
            {/* ... שאר האלמנטים של בחירת שפה ... */}
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
            
            {/* כפתור הפעלה/עצירה עם Z-INDEX גבוה כדי שלא יוסתר */}
            <button 
                onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
                className={`mt-8 px-12 py-5 rounded-full font-black text-2xl shadow-2xl flex items-center gap-4 transition-all active:scale-95 z-20 relative ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500'}`}
            >
                {status === ConnectionStatus.CONNECTED ? <><Square size={24} fill="currentColor" /> {t('stop_conversation')}</> : <><Mic size={28} /> {t('start_conversation')}</>}
            </button>

            {/* ויזואליזציה עם POINTER-EVENTS-NONE כדי לא לחסום לחיצות */}
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
