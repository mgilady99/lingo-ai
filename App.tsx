// src/App.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ExternalLink, Settings, LogOut, ArrowLeftRight } from 'lucide-react';
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

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  const t = (key: string) => translations[nativeLang.code]?.[key] || translations['en-US']?.[key] || key;
  const dir = (nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA') ? 'rtl' : 'ltr';

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    // שחרור אקטיבי של המיקרופון כדי למנוע הודעת "בשימוש"
    if (micStreamRef.current) { 
      micStreamRef.current.getTracks().forEach(track => track.stop()); 
      micStreamRef.current = null; 
    }
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    // 1. בדיקה אם המפתח קיים
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
      alert("שגיאת מערכת: מפתח ה-API לא נמצא. וודא שהגדרת VITE_API_KEY ב-Cloudflare ובנית את האתר מחדש.");
      return;
    }
    
    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);
      
      // 2. פתיחת מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext();
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext();
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const ai = new GoogleGenAI(apiKey);
      const instructions = selectedScenario.systemInstruction
        .replace(/SOURCE_LANG/g, nativeLang.name)
        .replace(/TARGET_LANG/g, targetLang.name);

      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          systemInstruction: instructions,
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        }
      });
      activeSessionRef.current = session;

      const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        if (activeSessionRef.current) {
          const pcmData = createPcmBlob(e.inputBuffer.getChannelData(0));
          activeSessionRef.current.send({
            realtimeInput: {
              mediaChunks: [{
                data: pcmData,
                mimeType: `audio/pcm;rate=${inputAudioContextRef.current?.sampleRate || 16000}`
              }]
            }
          });
        }
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current!.destination);

      (async () => {
        try {
          for await (const msg of session.listen()) {
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setIsSpeaking(true);
              const outCtx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buffer = decodeAudioData(decode(audio), outCtx, 24000);
              const audioSource = outCtx.createBufferSource();
              audioSource.buffer = buffer; 
              audioSource.connect(outCtx.destination);
              audioSource.onended = () => { 
                sourcesRef.current.delete(audioSource); 
                if (sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(audioSource);
            }
          }
        } catch(e) { stopConversation(); }
      })();
      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) { 
        stopConversation(); // סגירת המיקרופון אם החיבור נכשל
        alert(`שגיאת חיבור: ${e.message || "נכשל החיבור לגוגל"}`); 
    }
  };

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      <header className="p-2 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center shadow-lg"><Headphones size={12} /></div>
          <span className="font-black text-[10px] uppercase tracking-tighter">LingoLive Pro</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[350px] flex flex-col p-2 gap-2 bg-slate-900/30 border-r border-white/5 shadow-2xl overflow-y-auto">
          <div className="bg-slate-900/90 rounded-2xl border border-white/10 p-2 flex flex-col gap-2">
            <div className="bg-slate-800/40 p-1.5 rounded-xl border border-white/5">
              <div className="flex items-center gap-1.5">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-1 py-3 text-[10px] font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
                <ArrowLeftRight size={12} className="text-indigo-500 shrink-0" />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-1 py-3 text-[10px] font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-3 rounded-xl flex flex-col items-center gap-0.5 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-[9px] font-black uppercase text-center leading-tight">{t(s.title)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-2 flex-1 justify-center relative min-h-[250px]">
            <div className="scale-65 md:scale-75 -mt-4"><Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} /></div>
            <button 
              onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
              className={`mt-2 px-8 py-3 rounded-full font-black text-lg shadow-2xl flex items-center gap-2 active:scale-95 transition-all z-50 ${status === ConnectionStatus.CONNECTED ? 'bg-red-500' : 'bg-indigo-600 shadow-indigo-500/40'}`}
            >
                <Mic size={20} /> 
                {status === ConnectionStatus.CONNECTED ? t('stop_conversation') : t('start_conversation')}
            </button>
            {(isSpeaking || status === ConnectionStatus.CONNECTED) && <div className="absolute bottom-4 w-full px-10"><AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} /></div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
