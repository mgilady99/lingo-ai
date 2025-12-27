import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ArrowLeftRight } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Admin from './components/Admin';
import { translations } from './translations';

const App: React.FC = () => {
  const [view, setView] = useState<'APP' | 'ADMIN'>('APP');
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  // פונקציית תרגום מוגנת למניעת שגיאות קונסול
  const t = useCallback((key: string) => {
    try {
      return translations[nativeLang.code]?.[key] || translations['en-US']?.[key] || key;
    } catch { return key; }
  }, [nativeLang.code]);

  const dir = (nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA') ? 'rtl' : 'ltr';

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") return alert("API Key missing. Check Cloudflare variables.");
    
    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext();
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext();
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const ai = new GoogleGenAI(apiKey);
      // יצירת החיבור ושימור הרפרנס
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          systemInstruction: selectedScenario.systemInstruction.replace(/SOURCE_LANG/g, nativeLang.name).replace(/TARGET_LANG/g, targetLang.name),
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        }
      });
      activeSessionRef.current = session;

      const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        // וידוא שהפונקציה קיימת לפני הפעלה למניעת שגיאת d.current.send
        if (activeSessionRef.current && typeof activeSessionRef.current.send === 'function') {
          activeSessionRef.current.send({
            realtimeInput: { mediaChunks: [{ data: createPcmBlob(e.inputBuffer.getChannelData(0)), mimeType: `audio/pcm;rate=16000` }] }
          });
        }
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current!.destination);

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
    } catch (e: any) { stopConversation(); alert(`Connection failed: ${e.message}`); }
  };

  if (view === 'ADMIN') return <Admin onBack={() => setView('APP')} />;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      <header className="p-3 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-lg"><Headphones size={14} /></div>
          <span className="font-black text-sm uppercase tracking-tighter">LingoLive Pro</span>
        </div>
        <button onClick={() => setView('ADMIN')} className="text-[10px] bg-white text-indigo-900 px-3 py-1 rounded-full font-bold">Admin</button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[360px] flex flex-col p-3 gap-3 bg-slate-900/30 border-r border-white/5 shadow-2xl overflow-y-auto">
          <div className="bg-slate-900/90 rounded-[1.5rem] border border-white/10 p-4 flex flex-col gap-3">
            <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-3 text-xs font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
                <ArrowLeftRight size={16} className="text-indigo-500 shrink-0" />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-3 text-xs font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
            </div>
            
            {/* כפתורי מודולים - כיווץ אגרסיבי py-2.5 */}
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-2.5 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-tight leading-none">{t(s.title)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-2 flex-1 justify-center relative min-h-[250px]">
            <div className="scale-75"><Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} /></div>
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className={`mt-4 px-10 py-4 rounded-full font-black text-xl shadow-2xl flex items-center gap-3 active:scale-95 transition-all ${status === ConnectionStatus.CONNECTED ? 'bg-red-500' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
                <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? t('stop_conversation') : t('start_conversation')}
            </button>
            {(isSpeaking || status === ConnectionStatus.CONNECTED) && <div className="absolute bottom-4 w-full px-12"><AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} /></div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
