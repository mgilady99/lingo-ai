import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

const uiTranslations: Record<string, any> = {
  'en-US': { title: 'LingoLive Pro', langPair: 'Language Pair', from: 'From', to: 'To', start: 'START SESSION', stop: 'STOP SESSION', feed: 'Live Feed', logs: 'Logs', scenarios: { simultaneous: 'LIVE TRANSLATE', translator: 'Ongoing Translation', casual: 'CHAT', learn: 'LEARN' } },
  'he-IL': { title: 'לינגו-לייב פרו', langPair: 'צמד שפות', from: 'מ-', to: 'ל-', start: 'התחל שיחה', stop: 'עצור שיחה', feed: 'תמלול חי', logs: 'לוגים', scenarios: { simultaneous: 'תרגום חי', translator: 'תרגום רציף', casual: 'צ׳אט', learn: 'למידה' } }
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
  const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);
  const [interimUserText, setInterimUserText] = useState('');
  const [interimModelText, setInterimModelText] = useState('');

  const ui = uiTranslations[nativeLang.code] || uiTranslations['en-US'];
  const isRTL = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-XA';

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimUserText, interimModelText]);

  useEffect(() => {
    const checkKey = () => {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey && apiKey.length > 5) setHasKey(true);
      else setHasKey(false);
    };
    checkKey();
  }, []);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) {
      try { activeSessionRef.current.close(); } catch (e) {}
      activeSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
    setInterimUserText('');
    setInterimModelText('');
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';
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

      // לוגיקה מחמירה לתרגום דו-כיווני מהיר
      const systemInstruction = `
        YOU ARE A HIGH-SPEED SIMULTANEOUS INTERPRETER.
        LANGUAGES: ${nativeLang.name} AND ${targetLang.name}.
        
        CRITICAL RULES:
        1. NEVER repeat the input language.
        2. IF you hear ${nativeLang.name}, IMMEDIATELY speak the translation in ${targetLang.name}.
        3. IF you hear ${targetLang.name}, IMMEDIATELY speak the translation in ${nativeLang.name}.
        4. Do NOT wait for pauses. Translate in real-time as words arrive.
        5. Provide ONLY the spoken translation. NO meta-talk.
      `;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(s => { if (!isMutedRef.current && s) s.sendRealtimeInput({ media: pcmBlob }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription) {
              currentInputTranscription.current += m.serverContent.inputTranscription.text;
              setInterimUserText(currentInputTranscription.current);
            }
            if (m.serverContent?.outputTranscription) {
              currentOutputTranscription.current += m.serverContent.outputTranscription.text;
              setInterimModelText(currentOutputTranscription.current);
            }
            if (m.serverContent?.turnComplete) {
              setTranscript(prev => {
                const newEntries: TranscriptionEntry[] = [...prev];
                if (currentInputTranscription.current) newEntries.push({ role: 'user', text: currentInputTranscription.current, timestamp: new Date() });
                if (currentOutputTranscription.current) newEntries.push({ role: 'model', text: currentOutputTranscription.current, timestamp: new Date() });
                return newEntries;
              });
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              setInterimUserText('');
              setInterimModelText('');
            }
            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => { setError('Connection Error'); stopConversation(); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e: any) { setError('Connection failed.'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] safe-area-inset ${isRTL ? 'rtl text-right' : 'ltr text-left'}`}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><Headphones size={20} /></div>
           <div className="flex flex-col">
             <span className="font-black text-sm uppercase text-white">{ui.title}</span>
             <span className={`text-[10px] font-black uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
           </div>
        </div>
        <button onClick={() => setTranscript([])} className="p-2.5 text-slate-500 hover:text-white"><Trash2 size={18} /></button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">{ui.langPair}</label>
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center w-full">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <ChevronRight size={16} className={`text-indigo-500 ${isRTL ? 'rotate-180' : ''}`} />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center w-full">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </div>
            
            {/* כפתורי מודול - כתב מקסימלי */}
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => {
                const isActive = selectedScenario.id === s.id;
                const isOngoing = s.id === 'translator';
                return (
                  <button 
                    key={s.id} 
                    onClick={() => setSelectedScenario(s)} 
                    className={`py-8 px-2 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all border-2 ${isActive ? 'bg-indigo-600 border-indigo-400 shadow-indigo-500/20' : 'bg-slate-800/40 border-transparent text-slate-400'}`}
                  >
                    <span className="text-4xl">{s.icon}</span>
                    <span className="font-black uppercase tracking-tighter text-center leading-none text-lg md:text-xl">
                      {isOngoing ? "ONGOING TRANSLATION" : ui.scenarios[s.id as keyof typeof ui.scenarios] || s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className="bg-indigo-600 px-12 py-6 rounded-full font-black text-xl shadow-2xl hover:bg-indigo-500 transition-all flex items-center gap-3">
              <Mic size={28} /> {status === ConnectionStatus.CONNECTED ? ui.stop : ui.start}
            </button>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">{ui.feed}</h3>
            <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400 font-bold">{transcript.length} {ui.logs}</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3">
            {transcript.map((entry, idx) => <transcriptitem key={idx} entry={entry} />)}
            {interimUserText && <transcriptitem entry={{role: 'user', text: interimUserText, timestamp: new Date()}} />}
            {interimModelText && <transcriptitem entry={{role: 'model', text: interimModelText, timestamp: new Date()}} />}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
