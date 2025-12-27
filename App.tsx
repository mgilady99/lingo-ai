import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import { Mic, Headphones, ArrowLeftRight } from "lucide-react";
import {
  ConnectionStatus,
  SUPPORTED_LANGUAGES,
  SCENARIOS,
  Language,
  PracticeScenario,
} from "./types";
import Avatar from "./components/Avatar";
import AudioVisualizer from "./components/AudioVisualizer";
import { translations } from "./translations";

/**
 * ✅ Pages-only (Browser)
 * - No live session.send/listen.
 * - Record audio continuously into chunks (MediaRecorder timeslice).
 * - Detect voice + silence (VAD), then send ONE combined clip.
 * - Gemini returns text; we speak with SpeechSynthesis.
 * - Debug UI shows what happens.
 */

// VAD tuning
const RMS_THRESHOLD = 0.012; // 0.008–0.02 (depends mic)
const SILENCE_MS_TO_STOP = 900; // silence duration to trigger send
const MIN_SPEECH_MS = 450; // require at least this much voice time
const TIMESLICE_MS = 250; // MediaRecorder chunk interval

function isRtlLang(code: string) {
  return code === "he-IL" || code === "ar-SA";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arr = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function pickVoiceForLang(langCode: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const exact = voices.find((x) => (x.lang || "").toLowerCase() === langCode.toLowerCase());
  if (exact) return exact;

  const short = langCode.split("-")[0]?.toLowerCase();
  const partial = voices.find((x) => (x.lang || "").toLowerCase().startsWith(short));
  return partial || null;
}

function speakText(text: string, langCode: string, onEnd?: () => void) {
  try {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;

    const v = pickVoiceForLang(langCode);
    if (v) utter.voice = v;

    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utter);
  } catch {
    onEnd?.();
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Debug/UX
  const [debugLine, setDebugLine] = useState<string>("");
  const [lastTranslation, setLastTranslation] = useState<string>("");

  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // VAD
  const vadCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<number | null>(null);

  const lastVoiceTsRef = useRef<number>(0);
  const voiceStartedTsRef = useRef<number | null>(null);
  const hasVoiceRef = useRef(false);

  // to avoid stale state in callbacks
  const connectedRef = useRef(false);
  useEffect(() => {
    connectedRef.current = status === ConnectionStatus.CONNECTED;
  }, [status]);

  const t = useCallback(
    (key: string) =>
      translations[nativeLang.code]?.[key] || translations["en-US"]?.[key] || key,
    [nativeLang.code]
  );

  const dir = useMemo(() => (isRtlLang(nativeLang.code) ? "rtl" : "ltr"), [nativeLang.code]);

  // Load voices (some browsers load async)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const handler = () => {
      // trigger load
      window.speechSynthesis.getVoices();
    };
    handler();
    window.speechSynthesis.onvoiceschanged = handler;
    return () => {
      // @ts-ignore
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const cleanupVAD = useCallback(() => {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;

    if (vadCtxRef.current) {
      try {
        vadCtxRef.current.close();
      } catch {}
      vadCtxRef.current = null;
    }
  }, []);

  const stopConversation = useCallback(() => {
    setDebugLine("Stopped.");
    connectedRef.current = false;

    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      micStreamRef.current = null;
    }

    chunksRef.current = [];
    hasVoiceRef.current = false;
    voiceStartedTsRef.current = null;

    cleanupVAD();

    try {
      window.speechSynthesis?.cancel?.();
    } catch {}

    setIsSpeaking(false);
    setStatus(ConnectionStatus.DISCONNECTED);
  }, [cleanupVAD]);

  const startVAD = useCallback((stream: MediaStream) => {
    cleanupVAD();

    const ctx = new AudioContext();
    vadCtxRef.current = ctx;

    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    src.connect(analyser);

    const data = new Float32Array(analyser.fftSize);

    lastVoiceTsRef.current = Date.now();
    voiceStartedTsRef.current = null;
    hasVoiceRef.current = false;

    vadTimerRef.current = window.setInterval(() => {
      const an = analyserRef.current;
      const rec = recorderRef.current;
      if (!an || !rec) return;
      if (!connectedRef.current) return;

      an.getFloatTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);

      const now = Date.now();

      if (rms > RMS_THRESHOLD) {
        lastVoiceTsRef.current = now;
        if (!hasVoiceRef.current) {
          hasVoiceRef.current = true;
          voiceStartedTsRef.current = now;
          setDebugLine("Voice detected…");
        }
      }

      // Only stop if we had voice, and silence long enough
      if (hasVoiceRef.current && now - lastVoiceTsRef.current > SILENCE_MS_TO_STOP) {
        const voiceStart = voiceStartedTsRef.current ?? now;
        const voiceMs = lastVoiceTsRef.current - voiceStart;

        if (voiceMs >= MIN_SPEECH_MS && rec.state === "recording") {
          setDebugLine("Silence detected → sending segment…");
          try {
            rec.stop();
          } catch {}
        } else {
          // reset if too short
          hasVoiceRef.current = false;
          voiceStartedTsRef.current = null;
        }
      }
    }, 120);
  }, [cleanupVAD]);

  const sendToGemini = useCallback(
    async (audioBlob: Blob) => {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey || apiKey === "undefined") {
        setDebugLine("API Key missing (VITE_API_KEY).");
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey });

        const instructions = selectedScenario.systemInstruction
          .replace(/SOURCE_LANG/g, nativeLang.name)
          .replace(/TARGET_LANG/g, targetLang.name);

        const prompt = `
You are a real-time interpreter.
${instructions}

Rules:
- Understand the spoken content in ${nativeLang.name}.
- Output ONLY the translation in ${targetLang.name}.
- No quotes, no explanations, no extra words.
`;

        const base64Audio = await blobToBase64(audioBlob);

        const res = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64Audio,
                    mimeType: audioBlob.type || "audio/webm",
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });

        const text =
          // some SDK builds provide text()
          (res as any)?.text?.() ||
          (res as any)?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text)
            .filter(Boolean)
            .join("") ||
          "";

        const clean = (text || "").trim();

        if (!clean) {
          setDebugLine("Gemini returned empty text. Try speaking longer/clearer.");
          return;
        }

        setLastTranslation(clean);
        setDebugLine("Speaking…");
        setIsSpeaking(true);

        speakText(clean, targetLang.code, () => {
          setIsSpeaking(false);
          setDebugLine("Listening…");
        });
      } catch (e: any) {
        console.error(e);
        setDebugLine(`Gemini error: ${e?.message || "unknown"}`);
      }
    },
    [nativeLang.name, selectedScenario.systemInstruction, targetLang.code, targetLang.name]
  );

  const startConversation = useCallback(async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      alert("API Key missing. Check Cloudflare Variables: VITE_API_KEY");
      return;
    }

    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);
      setDebugLine("Requesting microphone…");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // MediaRecorder options
      const opts: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        opts.mimeType = "audio/webm;codecs=opus";
      }

      const rec = new MediaRecorder(stream, opts);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onerror = (e) => {
        console.error("Recorder error", e);
        setDebugLine("Recorder error.");
      };

      rec.onstop = async () => {
        // combine chunks
        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const size = blob.size;

        chunksRef.current = [];
        hasVoiceRef.current = false;
        voiceStartedTsRef.current = null;

        // If disconnected, do nothing
        if (!connectedRef.current) return;

        // If too small, restart recording and keep listening
        if (size < 3000) {
          setDebugLine("Segment too short… keep listening.");
          try {
            rec.start(TIMESLICE_MS);
          } catch {}
          return;
        }

        // send this segment
        await sendToGemini(blob);

        // restart recording for next segment
        if (connectedRef.current) {
          try {
            rec.start(TIMESLICE_MS);
            setDebugLine("Listening…");
          } catch {}
        }
      };

      // Start
      connectedRef.current = true;
      setStatus(ConnectionStatus.CONNECTED);
      setDebugLine("Listening…");

      // Start recording with timeslice so we always get chunks
      rec.start(TIMESLICE_MS);

      // Start VAD
      startVAD(stream);

      // trigger voices load
      try {
        window.speechSynthesis?.getVoices?.();
      } catch {}
    } catch (e: any) {
      console.error(e);
      stopConversation();
      alert(`Mic/Connection failed: ${e?.message || "Check permissions"}`);
    }
  }, [sendToGemini, startVAD, stopConversation]);

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
          <span className="font-black text-xl uppercase tracking-tighter">LingoLive Pro</span>
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
                    setNativeLang(SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value)!)
                  }
                  className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold w-full text-center"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>

                <ArrowLeftRight size={20} className="text-indigo-500 shrink-0" />

                <select
                  value={targetLang.code}
                  onChange={(e) =>
                    setTargetLang(SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value)!)
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
                  <span className="text-xs font-black uppercase tracking-widest">{t(s.title)}</span>
                </button>
              ))}
            </div>

            {/* ✅ Debug panel (small, helpful) */}
            <div className="bg-slate-800/30 border border-white/10 rounded-2xl p-4 text-sm">
              <div className="font-bold text-slate-200">Status:</div>
              <div className="text-slate-300">{debugLine || "—"}</div>
              {lastTranslation ? (
                <>
                  <div className="mt-3 font-bold text-slate-200">Last translation:</div>
                  <div className="text-slate-100 whitespace-pre-wrap">{lastTranslation}</div>
                </>
              ) : null}
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
              onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation}
              className={`mt-8 px-12 py-5 rounded-full font-black text-2xl shadow-2xl flex items-center gap-4 transition-all active:scale-95 ${
                status === ConnectionStatus.CONNECTED
                  ? "bg-red-500"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40"
              }`}
            >
              <Mic size={28} />{" "}
              {status === ConnectionStatus.CONNECTED ? t("stop_conversation") : t("start_conversation")}
            </button>

            {(isSpeaking || status === ConnectionStatus.CONNECTED) && (
              <div className="absolute bottom-8 w-full px-12">
                <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
