// src/App.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Headphones, ExternalLink, ShieldCheck, Settings, LogOut, ArrowLeftRight } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';
import Admin from './components/Admin';
import { translations } from './translations';

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP' | 'ADMIN'>('LOGIN');
  const [userData, setUserData] = useState<any>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ads, setAds] = useState<any[]>([]);

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
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('lingolive_user');
    setUserData(null);
    setView('LOGIN');
    stopConversation();
  }, [stopConversation]);

  const handleLoginSuccess = useCallback((user: any, save = true) => {
    if (save) localStorage.setItem('lingolive_user', JSON.stringify(user));
    setUserData(user);
    if (user.role === 'ADMIN' || user.email === 'mgilady@gmail.com') { setView('APP'); return; }
    if (['PRO', 'Pro', 'BASIC', 'ADVANCED'].includes(user.plan) || user.tokens_used > 0) { setView('APP'); return; }
    setView('PRICING');
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('lingolive_user');
    if (saved) { try { handleLoginSuccess(JSON.parse(saved), false); } catch (e) { localStorage.removeItem('lingolive_user'); } }
    fetch('/api/admin/settings').then(res => res.json()).then(data => { if(data.ads) setAds(data.ads); }).catch(() => {});
  }, [handleLoginSuccess]);

  const startConversation = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") {
        alert("Critical: API Key is missing. Check Cloudflare environment variables.");
        return;
    }
    
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
          // התיקון הקריטי לשגיאת ה-Blob
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
    } catch (e) { 
        setStatus(ConnectionStatus.DISCONNECTED); 
        alert("Mic/Connection failed. Grant permissions and check API Key."); 
    }
  };

  if (view === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} nativeLang={nativeLang} setNativeLang={setNativeLang} t={t} />;
  if (view === 'PRICING') return (
    <div className={`relative h-screen ${dir}`} dir={dir}>
      <Pricing onPlanSelect={() => setView('APP')} userEmail={userData?.email} t={t} />
      <button onClick={handleLogout} className="fixed top-4 left-4 bg-slate-800 text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg">Logout</button>
    </div>
  );
  if (view === 'ADMIN') return <Admin onBack={() => window.location.reload()} />;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      <header className="p-2 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-lg"><Headphones size={14} /></div>
          <span className="font-black text-xs uppercase tracking-tighter">LingoLive Pro</span>
        </div>
        <div className="flex items-center gap-2">
          {userData?.role === 'ADMIN' && <button onClick={() => setView('ADMIN')} className="text-[10px] bg-white text-indigo-900 px-2 py-1 rounded-full font-bold">Admin</button>}
          <button onClick={handleLogout} className="text-[10px] text-slate-500 hover:text-white underline">{t('logout')}</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[400px] flex flex-col p-2 gap-2 bg-slate-900/30 border-r border-white/5 shadow-2xl">
          <div className="bg-slate-900/90 rounded-[1.5rem] border border-white/10 p-3 flex flex-col gap-2 shadow-2xl">
            <div className="bg-slate-800/40 p-2 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-1 py-1 text-[10px] font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
                <ArrowLeftRight size={12} className="text-indigo-500" />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-1 py-1 text-[10px] font-bold w-full text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}</select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => setSelectedScenario(s)} 
                  className={`py-4 rounded-xl flex flex-col items-center gap-1 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-800/40 text-slate-500 hover:bg-slate-800/70'}`}
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-[10px] font-black uppercase text-center leading-tight">{t(s.title)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-2 flex-1 justify-center relative">
            <div className="scale-75 md:scale-90">
              <Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
            </div>
            <button 
              onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
              className={`mt-4 px-10 py-4 rounded-full font-black text-xl shadow-2xl flex items-center gap-3 active:scale-95 transition-all ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
            >
                <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? t('stop_conversation') : t('start_conversation')}
            </button>
            {(isSpeaking || status === ConnectionStatus.CONNECTED) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="hidden md:flex flex-1 bg-slate-950 p-4 flex-col gap-4 overflow-y-auto items-center">
           {ads.filter(ad => ad.is_active).map(ad => (
               <div key={ad.slot_id} className="w-full max-w-sm bg-slate-900 rounded-2xl border border-white/5 p-4 text-center shadow-lg hover:border-indigo-500/30 transition-colors">
                 {ad.image_url && <img src={ad.image_url} alt={ad.title} className="w-full h-32 object-cover rounded-xl mb-2" />}
                 <h4 className="text-sm font-bold text-white mb-2">{ad.title}</h4>
                 <a href={ad.target_url} target="_blank" className="mt-2 bg-indigo-600/20 text-indigo-400 px-4 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-all hover:bg-indigo-600 hover:text-white">Visit <ExternalLink size={12} /></a>
               </div>
           ))}
        </div>
      </main>
    </div>
  );
};

export default App;
