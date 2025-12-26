import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';

const uiTranslations: Record<string, any> = {
  'en-US': { title: 'LingoLive Pro', native: 'Native Language', target: 'Learning Language', start: 'START', stop: 'STOP', adSpace: 'ADVERTISING SPACE', scenarios: { simultaneous: 'LIVE TRANSLATE', translator: 'Simultaneous Translation', casual: 'CHAT', learn: 'LEARN' } },
  'he-IL': { title: 'לינגו-לייב פרו', native: 'שפת אם', target: 'שפה נלמדת', start: 'התחל', stop: 'הפסק', adSpace: 'מרחב פרסום', scenarios: { simultaneous: 'תרגום חי', translator: 'תרגום סימולטני', casual: 'צ׳אט', learn: 'לימוד שפה' } },
};

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // זיהוי שפת מכשיר אוטומטית בעת הטעינה הראשונה
  useEffect(() => {
    const sysLangCode = navigator.language.split('-')[0]; // למשל 'he' או 'en'
    const detected = SUPPORTED_LANGUAGES.find(l => l.code.startsWith(sysLangCode)) || SUPPORTED_LANGUAGES[1];
    setNativeLang(detected);
  }, []);

  const ui = uiTranslations[nativeLang.code] || uiTranslations['en-US'];
  const isRTL = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-XA';

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    const checkKey = () => {
      const apiKey = import.meta.env.VITE_API_KEY;
      setHasKey(!!(apiKey && apiKey.length > 5));
    };
    checkKey();
  }, []);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) {
      try { activeSessionRef.current.close(); } catch (e) {}
      activeSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return;

    try {
      setError(null);
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey });
      
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // הנחיות קשיחות למודל למניעת "שכחת" שפות
      const nName = nativeLang.name;
      const tName = targetLang.name;
      let sysInst = "";

      if (selectedScenario.id === 'simultaneous') {
        sysInst = `STRICT TRANSLATOR between ${nName} and ${tName}. 
        If input is ${nName}, translate ONLY to ${tName}. 
        If input is ${tName}, translate ONLY to ${nName}. 
        Do not talk to me. Do not ask questions. Only spoken translation output.`;
      } else if (selectedScenario.id === 'translator') {
        sysInst = `LECTURE MODE: Translate everything you hear into ${nName} immediately and continuously. DO NOT stop or ask for help. Output ONLY the translation.`;
      } else if (selectedScenario.id === 'casual') {
        sysInst = `CHAT PARTNER: Speak ONLY in ${tName}. Keep responses very short and natural. Do not translate.`;
      } else if (selectedScenario.id === 'learn') {
        sysInst = `TUTOR: Speak in ${tName}. Be very brief. After speaking, provide a tiny correction for any mistakes I made in brackets [].`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED); // כאן אנחנו מעדכנים את הסטטוס להפעלת הכפתור
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(2048, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              if (!isMuted && activeSessionRef.current) {
                activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(inputData) });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer; source.connect(outputNode);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => { setError('Error'); stopConversation(); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: sysInst,
          generationConfig: { temperature: 0.1 },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setError('Mic error'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${isRTL ? 'rtl' : 'ltr'}`}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
          <div className="flex flex-col">
            <span className="font-black text-sm uppercase">{ui.title}</span>
            <span className={`text-[10px] font-black uppercase ${status === ConnectionStatus.CONNECTED ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[480px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
              <div className="flex-1 text-center">
                <label className="text-[10px] font-black uppercase text-indigo-400 block mb-1">{ui.native}</label>
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
              <ChevronRight size={16} className={`text-indigo-500 mt-4 ${isRTL ? 'rotate-180' : ''}`} />
              <div className="flex-1 text-center">
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{ui.target}</label>
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => {
                const label = ui.scenarios[s.id as keyof typeof ui.scenarios] || s.title;
                return (
                  <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-10 px-2 rounded-3xl flex flex-col items-center gap-3 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'bg-slate-800/40 text-slate-500'}`}>
                    <span className="text-4xl">{s.icon}</span>
                    <span className="font-black uppercase text-2xl text-center leading-none tracking-tighter">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <button 
              onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
              className={`px-12 py-6 rounded-full font-black text-2xl shadow-xl flex items-center gap-3 transition-all active:scale-95 ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            >
              <Mic size={32} /> {status === ConnectionStatus.CONNECTED ? ui.stop : ui.start}
            </button>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        {/* מרחב הפרסום */}
        <div className="flex-1 bg-slate-950 p-6 overflow-hidden flex flex-col gap-6">
          <div className="grid grid-cols-2 grid-rows-2 flex-1 gap-6">
             <div className="bg-slate-900 rounded-[3rem] border border-white/5 p-8 flex flex-col items-center justify-center text-center shadow-2xl">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4 text-white font-black text-2xl">MG</div>
                <h4 className="text-3xl font-black text-white mb-2">מאיר גלעדי</h4>
                <p className="text-indigo-400 font-bold text-xl mb-4">מומחה לנדל"ן מסחרי</p>
                <div className="flex flex-col gap-2">
                  <span className="text-slate-300 font-black text-2xl tracking-widest">052-2530087</span>
                  <a href="https://mgilady.wixsite.com/meirgilady" target="_blank" className="text-indigo-500 hover:text-white underline text-lg mt-4 flex items-center gap-1 font-bold">לאתר האינטרנט <ExternalLink size={16}/></a>
                </div>
             </div>
             {[1, 2, 3].map(i => (
               <div key={i} className="bg-slate-900/30 rounded-[3rem] border border-white/5 flex items-center justify-center text-slate-700 font-black text-3xl uppercase tracking-tighter rotate-12">
                  {ui.adSpace}
               </div>
             ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
