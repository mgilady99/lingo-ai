import React, { useState, useRef, useCallback } from "react";
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
 * ✅ Pages-only (Browser only)
 * - אין Live websocket session.send/listen
 * - מקליטים "קטע דיבור" עד שתיקה (VAD פשוט)
 * - שולחים בקשת GenerateContent אחת לקטע
 * - מעדיפים לקבל אודיו מהמודל; אם לא מגיע אודיו → fallback ל-SpeechSynthesis
 */

// טיונינג לזיהוי שתיקה
const SILENCE_MS_TO_STOP = 900; // כמה זמן של שקט כדי לעצור (ms)
const RMS_THRESHOLD = 0.012; // רגישות לשקט (0.008–0.02 תלוי במיקרופון)

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

function speakText(text: string, langCode: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    const v = pickVoiceForLang(langCode);
    if (v) utter.voice = v;
    window.speechSynthesis.speak(utter);
  } catch {}
}

function playBase64AudioWav(base64: string) {
  const a = new Audio(`data:audio/wav;base64,${base64}`);
  a.play().catch(() => {});
}

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // VAD (silence detect)
  const vadAudioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<number | null>(null);
  const lastVoiceTsRef = useRef<number>(0);

  const t = (key: string) =>
    translations[nativeLang.code]?.[key] || translations["en-US"]?.[key] || key;

  const dir = isRtlLang(nativeLang.code) ? "rtl" : "ltr";

  const cleanupVad = useCallback(() => {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;

    if (vadAudioCtxRef.current) {
      try {
        vadAudioCtxRef.current.close();
      } catch {}
      vadAudioCtxRef.current = null;
    }
  }, []);

  const stopConversation = useCallback(() => {
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);

    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      micStreamRef.current = null;
    }

    chunksRef.current = [];
    cleanupVad();

    try {
      window.speechSynthesis?.cancel?.();
    } catch {}
  }, [cleanupVad]);

  const sendRecordingToGemini = useCallback(
    async (audioBlob: Blob) => {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey || apiKey === "undefined") {
        alert("API Key missing. Check Cloudflare Variables: VITE_API_KEY");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const instructions = selectedScenario.systemInstruction
        .replace(/SOURCE_LANG/g, nativeLang.name)
        .replace(/TARGET_LANG/g, targetLang.name);

      // בקשה שמחזירה "עדיף אודיו", ואם לא—לפחות טקסט
      const prompt = `
You are a real-time interpreter.
${instructions}

Rules:
- Understand the spoken content in ${nativeLang.name}.
- Produce ONLY the translation in ${targetLang.name}.
- No quotes, no explanations, no extra text.

If you can respond with audio, do it.
`;

      const base64Audio = await blobToBase64(audioBlob);

      setIsSpeaking(true);
      try {
        // ⚠️ הערה: לא כל מודל מחזיר אודיו. לכן יש fallback.
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
          // מנסים לבקש אודיו. אם המודל לא תומך, פשוט לא נקבל inlineData.
          generationConfig: {
            responseMimeType: "audio/wav",
          },
        });

        // 1) ניסיון לקבל אודיו
        const audioData =
          (res as any)?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)
            ?.inlineData?.data;

        if (audioData) {
          playBase64AudioWav(audioData);
          return;
        }

        // 2) אם אין אודיו—נחלץ טקסט ונדבר עם SpeechSynthesis
        const text =
          (res as any)?.text?.() ||
          (res as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") ||
          "";

        const clean = (text || "").trim();
        if (clean) {
          speakText(clean, targetLang.code);
        } else {
          console.warn("Gemini returned empty text/audio for this segment.");
        }
      } catch (e) {
        console.error("Gemini request failed:", e);
      } finally {
        setIsSpeaking(false);
      }
    },
    [nativeLang.name, selectedScenario.systemInstruction, targetLang.code, targetLang.name]
  );

  const startVAD = useCallback((stream: MediaStream) => {
    cleanupVad();

    const ctx = new AudioContext();
    vadAudioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    source.connect(analyser);

    const data = new Float32Array(analyser.fftSize);
    lastVoiceTsRef.current = Date.now();

    vadTimerRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getFloatTimeDomainData(data);

      // RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);

      const now = Date.now();
      if (rms > RMS_THRESHOLD) {
        lastVoiceTsRef.current = now; // יש קול
      }

      // אם יש שקט מספיק זמן → עוצרים הקלטה ו"שולחים"
      if (now - lastVoiceTsRef.current > SILENCE_MS_TO_STOP) {
        // stop once
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }
    }, 120);
  }, [cleanupVad]);

  const startConversation = useCallback(async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      alert("API Key missing. Check Cloudflare Variables: VITE_API_KEY");
      return;
    }

    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // טוען voices (דפדפנים לעיתים טוענים באיחור)
      try {
        window.speechSynthesis?.getVoices?.();
      } catch {}

      chunksRef.current = [];

      // חשוב: mimeType מפורש עוזר לעקביות
      // אם הדפדפן לא תומך בזה, MediaRecorder יבחר לבד.
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // עצירה בגלל שקט או בגלל Stop ידני
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];

        // אם כבר מנותק – לא שולחים
        if (status === ConnectionStatus.DISCONNECTED) return;

        // אם יש קטע קצרצר (למשל לא דיברו) לא שולחים
        if (blob.size < 2000) {
          // התחל מחדש להקשבה
          if (mediaRecorderRef.current && status === ConnectionStatus.CONNECTED) {
            try {
              // reset VAD "שעון קול"
              lastVoiceTsRef.current = Date.now();
              mediaRecorderRef.current.start();
            } catch {}
          }
          return;
        }

        await sendRecordingToGemini(blob);

        // מתחילים הקלטה מחדש כדי להמשיך "כמעט-לייב"
        if (mediaRecorderRef.current && status === ConnectionStatus.CONNECTED) {
          try {
            lastVoiceTsRef.current = Date.now();
            mediaRecorderRef.current.start();
          } catch {}
        }
      };

      // מתחילים
      recorder.start();
      startVAD(stream);

      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) {
      console.error(e);
      stopConversation();
      alert(`Mic/Connection failed: ${e?.message || "Check permissions"}`);
    }
  }, [sendRecordingToGemini, startVAD, status, stopConversation]);

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
