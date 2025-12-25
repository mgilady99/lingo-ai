
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import TranscriptItem from './components/TranscriptItem';

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
    const checkKey = async () => {
      const envKey = process.env.API_KEY;
      if (envKey && envKey !== 'undefined' && envKey !== '') {
        setHasKey(true);
        return;
      }
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        const exists = await window.aistudio.hasSelectedApiKey();
        setHasKey(exists);
      } else {
        setHasKey(false);
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setError(null);
    } else {
      setError("Please set the API_KEY in your environment variables.");
    }
  };

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
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
    setInterimUserText('');
    setInterimModelText('');
  }, []);

  const startConversation = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      handleSelectKey();
      return;
    }

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

      let systemInstruction = "";
      
      if (selectedScenario.id === 'simultaneous') {
        systemInstruction = `STRICT MODE: SIMULTANEOUS INTERPRETER.
        FROM: ${nativeLang.name} TO: ${targetLang.name}.
        RULE 1: Translate IMMEDIATELY. Do not wait for silence.
        RULE 2: Output ONLY the translated audio and text in ${targetLang.name}.
        RULE 3: Do not reply or chat. Be a live feed interpreter.`;
      } else if (selectedScenario.id === 'translator') {
        systemInstruction = `STRICT MODE: DIALOGUE TRANSLATOR.
        LANGUAGES: ${nativeLang.name} and ${targetLang.name}.
        RULE 1: Wait for a complete sentence or pause before translating.
        RULE 2: Translate between ${nativeLang.name} and ${targetLang.name}.
        RULE 3: Only output the translation. No conversation.`;
      } else if (selectedScenario.id === 'casual') {
        systemInstruction = `STRICT MODE: CHAT PARTNER.
        TARGET LANGUAGE: ${targetLang.name}.
        RULE 1: Talk naturally ONLY in ${targetLang.name}.
        RULE 2: If user speaks ${nativeLang.name}, encourage them to switch back to ${targetLang.name}.`;
      } else if (selectedScenario.id === 'learn') {
        systemInstruction = `STRICT MODE: LANGUAGE TEACHER.
        TARGET LANGUAGE: ${targetLang.name}. NATIVE LANGUAGE: ${nativeLang.name}.
        RULE 1: Always speak in ${targetLang.name}.
        RULE 2: Provide corrections in brackets [Correction: ...] if user makes mistakes.
        RULE 3: Guide the user to improve their ${targetLang.name}.`;
      }
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(s => {
                if (!isMutedRef.current && s) {
                  s.sendRealtimeInput({ media: pcmBlob });
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription) {
              const text = m.serverContent.inputTranscription.text;
              currentInputTranscription.current += text;
              setInterimUserText(currentInputTranscription.current);
            }
            if (m.serverContent?.outputTranscription) {
              const text = m.serverContent.outputTranscription.text;
              currentOutputTranscription.current += text;
              setInterimModelText(currentOutputTranscription.current);
            }

            if (m.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                setTranscript(prev => [...prev, {
                  role: 'user',
                  text: currentInputTranscription.current,
                  timestamp: new Date()
                }]);
              }
              if (currentOutputTranscription.current) {
                setTranscript(prev => [...prev, {
                  role: 'model',
                  text: currentOutputTranscription.current,
                  timestamp: new Date()
                }]);
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              setInterimUserText('');
              setInterimModelText('');
            }

            if (m.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }

            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode);
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if (sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: any) => { 
            setError('Connection failed. Check API key.');
            stopConversation(); 
          },
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
    } catch (e: any) { 
      setError('Error connecting.'); 
      setStatus(ConnectionStatus.ERROR); 
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter']">
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
           <div className="flex flex-col text-left">
             <span className="font-black text-sm tracking-tight uppercase">LingoLive Pro</span>
             <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">{status}</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setTranscript([])} className="p-2.5 text-slate-500 hover:text-white transition-colors" title="Clear History"><Trash2 size={18} /></button>
           <button onClick={handleSelectKey} className="p-2.5 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg transition-colors"><RefreshCw size={18} /></button>
           {status === ConnectionStatus.CONNECTED && (
             <button onClick={stopConversation} className="bg-red-500/20 text-red-400 p-2.5 rounded-lg border border-red-500/20"><XCircle size={18} /></button>
           )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto scrollbar-thin">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Language Setup</label>
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[8px] text-center text-slate-400 font-black mb-1 uppercase">Native</span>
                  <select 
                    value={nativeLang.code} 
                    onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} 
                    disabled={status !== ConnectionStatus.DISCONNECTED}
                    className="bg-slate-900 border-none rounded-xl py-2 text-sm md:text-lg font-bold text-center appearance-none cursor-pointer outline-none w-full"
                  >
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-center items-center mt-3">
                  <ChevronRight size={16} className="text-indigo-500" />
                  <ChevronRight size={16} className="text-indigo-500 -mt-2 rotate-180" />
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[8px] text-center text-slate-400 font-black mb-1 uppercase">Target</span>
                  <select 
                    value={targetLang.code} 
                    onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} 
                    disabled={status !== ConnectionStatus.DISCONNECTED}
                    className="bg-slate-900 border-none rounded-xl py-2 text-sm md:text-lg font-bold text-center appearance-none cursor-pointer outline-none w-full"
                  >
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => setSelectedScenario(s)} 
                  disabled={status !== ConnectionStatus.DISCONNECTED}
                  className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg' : 'bg-slate-800/40 text-slate-500 border border-transparent hover:bg-slate-800'}`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter">{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <div className="text-center px-4">
               <h2 className="text-xl font-black text-white">{selectedScenario.title}</h2>
               <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">{selectedScenario.description}</p>
            </div>
            
            <div className="w-full flex justify-center">
              {status === ConnectionStatus.CONNECTED ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full border-2 ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700'}`}>
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <button onClick={stopConversation} className="bg-white text-slate-950 px-8 py-4 rounded-full font-black text-sm uppercase">Stop Session</button>
                </div>
              ) : (
                <button 
                  onClick={startConversation} 
                  disabled={status === ConnectionStatus.CONNECTING} 
                  className="bg-indigo-600 px-10 py-5 rounded-full font-black flex items-center gap-3 text-lg shadow-2xl hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Mic size={24} /> {status === ConnectionStatus.CONNECTING ? 'Connecting...' : 'START SESSION'}
                </button>
              )}
            </div>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
          {error && <div className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center flex items-center gap-2 justify-center"><AlertCircle size={14} /> {error}</div>}
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Live Transcript</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-bold">{transcript.length} Logs</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-2 pr-2">
            {transcript.map((entry, idx) => <TranscriptItem key={idx} entry={entry} />)}
            
            {interimUserText && (
              <div className="opacity-60 transition-opacity">
                <TranscriptItem entry={{role: 'user', text: interimUserText, timestamp: new Date()}} />
              </div>
            )}
            {interimModelText && (
              <div className="opacity-90 transition-opacity scale-105 origin-left">
                <TranscriptItem entry={{role: 'model', text: interimModelText, timestamp: new Date()}} />
              </div>
            )}

            {transcript.length === 0 && !interimUserText && !interimModelText && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-40 italic text-sm text-center max-w-xs mx-auto">
                <p className="mb-2 font-bold">Waiting for input...</p>
                <p className="text-xs">
                  {selectedScenario.id === 'simultaneous' 
                    ? `Simultaneous interpretation enabled. Speak freely in ${nativeLang.name}.`
                    : `Speak in ${nativeLang.name} or ${targetLang.name} to begin.`}
                </p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
