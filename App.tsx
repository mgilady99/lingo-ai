import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

// מילון תרגום אוניברסלי לממשק המשתמש (UI)
const getTranslations = (langCode: string) => {
  const dicts: Record<string, any> = {
    'he-IL': { start: 'התחל', stop: 'עצור', feed: 'תמלול חי', pair: 'צמד שפות', from: 'מ-', to: 'ל-', logs: 'לוגים', ongoing: 'תרגום רציף' },
    'en-US': { start: 'START', stop: 'STOP', feed: 'Live Feed', pair: 'Language Pair', from: 'From', to: 'To', logs: 'Logs', ongoing: 'Ongoing Translation' },
    'fr-FR': { start: 'DÉMARRER', stop: 'ARRÊTER', feed: 'Flux en direct', pair: 'Paire de langues', from: 'De', to: 'À', logs: 'Logs', ongoing: 'Traduction Continue' },
    'es-ES': { start: 'INICIAR', stop: 'DETENER', feed: 'Transmisión en vivo', pair: 'Par de idiomas', from: 'De', to: 'A', logs: 'Registros', ongoing: 'Traducción Continua' },
    'zh-CN': { start: '开始', stop: '停止', feed: '实时馈送', pair: '语言配对', from: '从', to: '到', logs: '日志', ongoing: '持续翻译' }
  };
  return dicts[langCode] || dicts['en-US'];
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

  const ui = getTranslations(nativeLang.code);
  const isRTL = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-XA';

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, interimUserText, interimModelText]);

  useEffect(() => {
    const checkKey = () => {
      const apiKey = import.meta.env.VITE_API_KEY;
      setHasKey(!!(apiKey && apiKey.length > 5));
    };
    checkKey();
  }, []);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    setInterimUserText('');
    setInterimModelText('');
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

      let sysInst = "";
      if (selectedScenario.id === 'simultaneous' || selectedScenario.id === 'translator') {
        sysInst = `SIMULTANEOUS INTERPRETER. Translate from ${nativeLang.name} to ${targetLang.name} and vice versa. Translate chunks immediately. Do not wait for pauses.`;
      } else if (selectedScenario.id === 'casual') {
        sysInst = `Chat partner. Speak only ${targetLang.name}.`;
      } else {
        sysInst = `Language tutor in ${targetLang.name}. Correct my grammar and pronunciation in brackets.`;
      }

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
              if (!isMutedRef.current && activeSessionRef.current) {
                activeSessionRef.current.sendRealtimeInput({ media: pcmBlob });
              }
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
              setTranscript(prev => [...prev, 
                { role: 'user', text: currentInputTranscription.current, timestamp: new Date() },
                { role: 'model', text: currentOutputTranscription.current, timestamp: new Date() }
              ]);
              currentInputTranscription.current = ''; currentOutputTranscription.current = '';
              setInterimUserText(''); setInterimModelText('');
            }
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
        config: { responseModalities: [Modality.AUDIO], systemInstruction: sysInst }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setError('Failed to start.'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${isRTL ? 'rtl' : 'ltr'}`}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
          <div className="flex flex-col">
            <span className="font-black text-sm uppercase">LingoLive Pro</span>
            <span className={`text-[10px] font-black uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
          </div>
        </div>
        <button onClick={() => setTranscript([])} className="p-2 text-slate-500 hover:text-white"><Trash2 size={18} /></button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-500 px-1">{ui.pair}</label>
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <div className="flex-1 text-center">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">{ui.from}</span>
                  <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent border-none font-bold text-sm outline-none w-full text-center">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <ChevronRight size={16} className={`text-indigo-500 ${isRTL ? 'rotate-180' : ''}`} />
                <div className="flex-1 text-center">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">{ui.to}</span>
                  <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent border-none font-bold text-sm outline-none w-full text-center">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => {
                const isOngoing = s.id === 'translator';
                return (
                  <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-5 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/40 text-slate-500'}`}>
                    <span className="text-xl">{s.icon}</span>
                    <span className="font-black uppercase tracking-tighter text-center leading-none text-sm">
                      {isOngoing ? ui.ongoing : s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <div className="flex items-center gap-4">
               {status === ConnectionStatus.CONNECTED && (
                 <button onClick={() => setIsMuted(!isMuted)} className={`p-4 rounded-full border-2 ${isMuted ? 'bg-red-500' : 'bg-slate-800'}`}><MicOff size={20} /></button>
               )}
               <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className="bg-indigo-600 px-10 py-5 rounded-full font-black text-lg shadow-xl flex items-center gap-3">
                 <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? ui.stop : ui.start}
               </button>
            </div>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase text-slate-500">{ui.feed}</h3>
            <span className="text-[10px] font-black bg-slate-800 px-2 py-1 rounded text-slate-400">{transcript.length} {ui.logs}</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
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
