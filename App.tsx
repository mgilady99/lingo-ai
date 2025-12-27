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
 * ✅ IMPORTANT
 * - אנחנו נשארים ב-Frontend בלבד (Browser).
 * - לכן לא משתמשים ב-ai.live.connect() ולא ב-session.send/listen.
 * - במקום זה: מקליטים chunks ושולחים ל-Gemini כבקשות רגילות.
 */

const CHUNK_MS = 2000; // כל כמה זמן לשלוח הקלטה (אפשר 1500–3000)

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
  // נסה התאמה מדויקת
  let v = voices.find((x) => (x.lang || "").toLowerCase() === langCode.toLowerCase());
  if (v) return v;

  // נסה התאמה לפי שפה בלי אזור (he מתוך he-IL)
  const short = langCode.split("-")[0]?.toLowerCase();
  v = voices.find((x) => (x.lang || "").toLowerCase().startsWith(short));
  return v || null;
}

function speakText(text: string, langCode: string) {
  try {
    if (!("speechSynthesis" in window)) return;

    // עוצרים כל דיבור קודם
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;

    const voice = pickVoiceForLang(langCode);
    if (voice) utter.voice = voice;

    window.speechSynthesis.speak(utter);
  } catch {
    // לא חוסם
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const queueRef = useRef<Blob[]>([]);
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);

  const t = (key: string) =>
    translations[nativeLang.code]?.[key] || translations["en-US"]?.[key] || key;

  const dir = isRtlLang(nativeLang.code) ? "rtl" : "ltr";

  const stopConversation = useCallback(() => {
    stoppedRef.current = true;

    try {
      recorderRef.current?.stop();
    } catch {}

    recorderRef.current = null;

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      micStreamRef.current = null;
    }

    queueRef.current = [];
    busyRef.current = false;

    try {
      window.speechSynthesis?.cancel?.();
    } catch {}

    setIsSpeaking(false);
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const processQueue = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      busyRef.current = false;
      alert("API Key missing. Check Cloudflare variables: VITE_API_KEY");
      stopConversation();
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    while (!stoppedRef.current && queueRef.current.length > 0) {
      const blob = queueRef.current.shift()!;
      try {
        // המרה ל-base64
        const base64Audio = await blobToBase64(blob);

        // הוראות לפי התרחיש שלך
        const instructions = selectedScenario.systemInstruction
          .replace(/SOURCE_LANG/g, nativeLang.name)
          .replace(/TARGET_LANG/g, targetLang.name);

        /**
         * אנחנו מבקשים:
         * 1) לתמלל את האודיו
         * 2) לתרגם לשפת יעד
         * 3) להחזיר טקסט נקי של התרגום בלבד
         */
        const prompt = `
You are a real-time interpreter.
${instructions}

Rules:
- First, understand the spoken content.
- Then output ONLY the translation in ${targetLang.name}.
- No explanations, no quotes, no extra words.
`;

        setIsSpeaking(true);

        const res = await ai.models.generateContent({
          // מודל טקסט מהיר שמתאים לתרגום. אפשר לשנות אם תרצה.
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64Audio,
                    // MediaRecorder בכרום בד"כ מוציא webm/opus
                    mimeType: blob.type || "audio/webm",
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });

        // חילוץ טקסט
        const translated =
          (res as any)?.text?.() ||
          (res as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") ||
          "";

        const clean = (translated || "").trim();

        if (clean) {
          // משמיעים בקול (דפדפן)
          speakText(clean, targetLang.code);
        }
      } catch (e) {
        // אם נכשל, ממשיכים ל-chunk הבא
        console.error("Chunk processing failed", e);
      } finally {
        setIsSpeaking(false);
      }
    }

    busyRef.current = false;
  }, [nativeLang.name, selectedScenario.systemInstruction, stopConversation, targetLang.code, targetLang.name]);

  const startConversation = useCallback(async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      alert("API Key missing. Check Cloudflare variables: VITE_API_KEY");
      return;
    }

    try {
      stopConversation();
      stoppedRef.current = false;
      setStatus(ConnectionStatus.CONNECTING);

      // מיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // MediaRecorder
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      queueRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (stoppedRef.current) return;
        if (!ev.data || ev.data.size === 0) return;

        // דוחפים לתור ושולחים לעיבוד
        queueRef.current.push(ev.data);
        processQueue();
      };

      recorder.onerror = (ev) => {
        console.error("Recorder error", ev);
      };

      recorder.onstop = () => {
        // לא חובה
      };

      // מתחילים הקלטה ב-chunks
      recorder.start(CHUNK_MS);

      // חשוב: טעינת voices (חלק מהדפדפנים טוענים באיחור)
      try {
        window.speechSynthesis?.getVoices?.();
      } catch {}

      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) {
      console.error("Start failed", e);
      stopConversation();
      alert(`Mic/Connection failed: ${e?.message || "Check mic permissions"}`);
    }
  }, [processQueue, stopConversation]);

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
                  // נשאר כמו אצלך (אם הרכיב משתמש בזה)
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
