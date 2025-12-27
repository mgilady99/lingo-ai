import React, { useState, useRef, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, Headphones, ArrowLeftRight } from "lucide-react";
import {
  ConnectionStatus,
  SUPPORTED_LANGUAGES,
  SCENARIOS,
  Language,
  PracticeScenario,
} from "./types";
import { decode, decodeAudioData, createPcmBlob } from "./services/audioService";
import Avatar from "./components/Avatar";
import AudioVisualizer from "./components/AudioVisualizer";
import { translations } from "./translations";

const LIVE_MODEL =
  // מודל Live Audio מומלץ. אם אצלך לא עובד, תגיד לי ונחליף למודל אחר שתומך בחשבון שלך.
  "gemini-2.5-flash-native-audio-preview-12-2025";

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(
    SCENARIOS[0]
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeSessionRef = useRef<any>(null);

  const micStreamRef = useRef<MediaStream | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);

  const mediaSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  const t = (key: string) =>
    translations[nativeLang.code]?.[key] ||
    translations["en-US"]?.[key] ||
    key;

  const dir =
    nativeLang.code === "he-IL" || nativeLang.code === "ar-SA" ? "rtl" : "ltr";

  const hardCleanupAudioGraph = useCallback(() => {
    try {
      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect();
        } catch {}
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current = null;
      }

      if (mediaSourceNodeRef.current) {
        try {
          mediaSourceNodeRef.current.disconnect();
        } catch {}
        mediaSourceNodeRef.current = null;
      }

      // stop all currently playing audio buffers
      for (const src of sourcesRef.current) {
        try {
          src.stop();
        } catch {}
        try {
          src.disconnect();
        } catch {}
      }
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    } catch {}
  }, []);

  const stopConversation = useCallback(() => {
    // close session
    if (activeSessionRef.current) {
      try {
        activeSessionRef.current.close?.();
      } catch {}
      activeSessionRef.current = null;
    }

    // stop mic stream
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      micStreamRef.current = null;
    }

    hardCleanupAudioGraph();

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, [hardCleanupAudioGraph]);

  const startConversation = useCallback(async () => {
    const apiKey = import.meta.env.VITE_API_KEY;

    if (!apiKey || apiKey === "undefined") {
      alert("API Key missing. Check Cloudflare Variables (VITE_API_KEY).");
      return;
    }

    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);

      // Ask for microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Create contexts
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new AudioContext();
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new AudioContext();
      }

      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      // ✅ Correct client init
      const ai = new GoogleGenAI({ apiKey });

      const instructions = selectedScenario.systemInstruction
        .replace(/SOURCE_LANG/g, nativeLang.name)
        .replace(/TARGET_LANG/g, targetLang.name);

      // ✅ Connect to Live
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          systemInstruction: instructions,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
        },
        callbacks: {
          onopen: () => console.log("✅ Live session opened"),
          onclose: (e: any) => console.log("ℹ️ Live session closed", e),
          onerror: (e: any) => console.error("❌ Live session error", e),
        },
      });

      activeSessionRef.current = session;

      // Build mic processing graph -> send PCM chunks
      const inCtx = inputAudioContextRef.current!;
      const outCtx = outputAudioContextRef.current!;

      hardCleanupAudioGraph();

      const mediaSource = inCtx.createMediaStreamSource(stream);
      mediaSourceNodeRef.current = mediaSource;

      // ScriptProcessor is old but works in many browsers.
      // If needed later, we can upgrade to AudioWorklet.
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        try {
          if (!activeSessionRef.current) return;

          const channel0 = e.inputBuffer.getChannelData(0);
          const pcmData = createPcmBlob(channel0);

          activeSessionRef.current.send({
            realtimeInput: {
              mediaChunks: [
                {
                  data: pcmData,
                  mimeType: `audio/pcm;rate=${inCtx.sampleRate || 16000}`,
                },
              ],
            },
          });
        } catch (err) {
          console.error("❌ Audio send error", err);
        }
      };

      mediaSource.connect(processor);
      processor.connect(inCtx.destination);

      // Listen to responses (audio)
      (async () => {
        try {
          for await (const msg of session.listen()) {
            const audio =
              msg?.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

            if (!audio) continue;

            setIsSpeaking(true);

            nextStartTimeRef.current = Math.max(
              nextStartTimeRef.current,
              outCtx.currentTime
            );

            const buffer = decodeAudioData(decode(audio), outCtx, 24000);

            const audioSource = outCtx.createBufferSource();
            audioSource.buffer = buffer;
            audioSource.connect(outCtx.destination);

            audioSource.onended = () => {
              sourcesRef.current.delete(audioSource);
              if (sourcesRef.current.size === 0) setIsSpeaking(false);
            };

            sourcesRef.current.add(audioSource);

            audioSource.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
          }
        } catch (e) {
          console.error("❌ Listen loop crashed", e);
          stopConversation();
        }
      })();

      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) {
      console.error("❌ Connection failed", e);
      stopConversation();

      // show more useful error
      const msg =
        e?.message ||
        e?.toString?.() ||
        "Mic/Connection failed. Check permissions and API Key/model.";
      alert(`Connection failed: ${msg}`);
    }
  }, [
    nativeLang.name,
    selectedScenario.systemInstruction,
    stopConversation,
    targetLang.name,
    hardCleanupAudioGraph,
  ]);

  return (
    <div
      className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`}
      dir={dir}
    >
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Headphones size={20} />
          </div>
          <span className="font-black text-xl uppercase tracking-tighter">
            LingoLive Pro
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[400px] flex flex-col p-4 gap-4 bg-slate-900/30 border-r border-white/5 shadow-2xl">
          <div className="bg-slate-900/90 rounded-[2rem] border border-white/10 p-6 flex flex-col gap-4">
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <select
                  value={nativeLang.code}
                  onChange={(e) =>
                    setNativeLang(
                      SUPPORTED_LANGUAGES.find(
                        (l) => l.code === e.target.value
                      )!
                    )
                  }
                  className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold w-full text-center"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>

                <ArrowLeftRight
                  size={20}
                  className="text-indigo-500 shrink-0"
                />

                <select
                  value={targetLang.code}
                  onChange={(e) =>
                    setTargetLang(
                      SUPPORTED_LANGUAGES.find(
                        (l) => l.code === e.target.value
                      )!
                    )
                  }
                  className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold w-full text-center"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenario(s)}
                  className={`py-6 rounded-3xl flex flex-col items-center gap-2 transition-all duration-300 ${
                    selectedScenario.id === s.id
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-105"
                      : "bg-slate-800/40 text-slate-500 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="text-3xl">{s.icon}</span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {t(s.title)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-4 flex-1 justify-center relative">
            <Avatar
              state={
                status === ConnectionStatus.CONNECTED
                  ? isSpeaking
                    ? "speaking"
                    : "listening"
                  : "idle"
              }
            />

            <button
              onClick={
                status === ConnectionStatus.CONNECTED
                  ? stopConversation
                  : startConversation
              }
              className={`mt-8 px-12 py-5 rounded-full font-black text-2xl shadow-2xl flex items-center gap-4 transition-all active:scale-95 ${
                status === ConnectionStatus.CONNECTED
                  ? "bg-red-500"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40"
              }`}
            >
              <Mic size={28} />{" "}
              {status === ConnectionStatus.CONNECTED
                ? t("stop_conversation")
                : t("start_conversation")}
            </button>

            {(isSpeaking || status === ConnectionStatus.CONNECTED) && (
              <div className="absolute bottom-8 w-full px-12">
                <AudioVisualizer
                  isActive={true}
                  color={isSpeaking ? "#6366f1" : "#10b981"}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
