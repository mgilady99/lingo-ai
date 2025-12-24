
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, AlertCircle, XCircle, Key, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import TranscriptItem from './components/transcriptitem'; // ✅ תיקון: import בשם Component עם אות גדולה

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[1]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);

  // Transcription refs to accumulate text
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        const exists = await window.aistudio.hasSelectedApiKey();
        setHasKey(exists);
      } else {
        // ✅ תיקון: Vite env
        setHasKey(!!import.meta.env.VITE_API_KEY);
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
  }, []);

  const startConversation = async () => {
    // ✅ תיקון: Vite env
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;

    if (!apiKey) {
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

      let systemInstruction = `You are Zephyr, a language tutor.
      - SCENARIO: ${selectedScenario.title}. 
      - MISSION: Practice ${targetLang.name}. User native language: ${nativeLang.name}.
      - CORRECTION: If user makes a grammar mistake, provide a corrected version in your transcript response.
      - STYLE: Friendly, encouraging, and sophisticated.`;

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
            // Handle Transcription
            if (m.serverContent?.inputTranscription) {
              currentInputTranscription.current += m.serverContent.inputTranscription.text;
            }
            if (m.serverContent?.outputTranscription) {
              currentOutputTranscription.current += m.serverContent.outputTranscription.text;
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
            setError('Connection error. Please check your key.');
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
      setError('Failed to start session.');
      setStatus(ConnectionStatus.ERROR);
    }
  };

  if (hasKey === null) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
          <Key className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">LingoLive Pro</h1>
        <p className="text-slate-400 max-w-sm mb-10">Please connect your Gemini API key to start practicing.</p>
        <button
          onClick={handleSelectKey}
          className="bg-indigo-600 text-white px-10 py-5 rounded-full font-black text-xl flex items-center gap-3 hover:scale-105 transition-transform shadow-xl"
        >
          SELECT API KEY <ChevronRight />
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter']">
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Headphones size={20} />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-black text-sm tracking-tight">LingoLive Pro</span>
            <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">{status}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTranscript([])}
            className="p-2.5 text-slate-500 hover:text-white transition-colors"
            title="Clear History"
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={handleSelectKey}
            className="p-2.5 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>

          {status === ConnectionStatus.CONNECTED && (
            <button
              onClick={stopConversation}
              className="bg-red-500/20 text-red-400 p-2.5 rounded-lg border border-red-500/20"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side */}
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto scrollbar-thin">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
              <select
                value={targetLang.code}
                onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)}
                disabled={status !== ConnectionStatus.DISCONNECTED}
                className="flex-1 bg-slate-900 border-none rounded-xl py-3 text-xl font-bold text-center appearance-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>

              <ChevronRight size={20} className="text-slate-600" />

              <select
                value={nativeLang.code}
                onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)}
                disabled={status !== ConnectionStatus.DISCONNECTED}
                className="flex-1 bg-slate-900 border-none rounded-xl py-3 text-xl font-bold text-center appearance-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenario(s)}
                  disabled={status !== ConnectionStatus.DISCONNECTED}
                  className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                    selectedScenario.id === s.id
                      ? 'bg-indigo-600 text-white border border-indigo-400'
                      : 'bg-slate-800/40 text-slate-500 border border-transparent'
                  }`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-xs font-bold uppercase">{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />

            <div className="text-center">
              <h2 className="text-xl font-black text-white">{selectedScenario.title} Partner</h2>
              <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">
                {isSpeaking ? 'Zephyr is speaking' : status === ConnectionStatus.CONNECTED ? (isMuted ? 'Mic Paused' : 'Listening...') : 'Ready'}
              </p>
            </div>

            <div className="w-full flex justify-center">
              {status === ConnectionStatus.CONNECTED ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-5 rounded-full border-2 transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-700'}`}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <button
                    onClick={stopConversation}
                    className="bg-white text-slate-950 px-8 py-4 rounded-full font-black text-sm tracking-widest uppercase"
                  >
                    Stop Session
                  </button>
                </div>
              ) : (
                <button
                  onClick={startConversation}
                  disabled={status === ConnectionStatus.CONNECTING}
                  className="bg-indigo-600 px-10 py-5 rounded-full font-black flex items-center gap-3 text-lg shadow-2xl hover:bg-indigo-500 transition-all"
                >
                  <Mic size={24} /> {status === ConnectionStatus.CONNECTING ? 'Connecting...' : 'START PRACTICE'}
                </button>
              )}
            </div>

            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && (
              <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />
            )}
          </div>

          {error && (
            <div className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Session Transcript</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">{transcript.length} Entries</span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-2 pr-2">
            {transcript.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50 italic text-sm">
                <p>Start speaking to see the transcript here.</p>
                <p>Zephyr will correct your grammar automatically.</p>
              </div>
            ) : (
              transcript.map((entry, idx) => <transcriptitem key={idx} entry={entry} />)
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
