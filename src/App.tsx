
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// הגדרת מפתח וסביבה
const API_KEY = import.meta.env.VITE_API_KEY;

const App = () => {
  const [isActive, setIsActive] = useState(false);
  const [appState, setAppState] = useState("idle"); // idle, listening, processing, speaking
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  
  // הגדרות שפה (ניתן לשנות מה-UI)
  const [sourceLang, setSourceLang] = useState('he-IL');
  const [targetLang, setTargetLang] = useState('en-US');

  const recognitionRef = useRef<any>(null);
  const isSessionActive = useRef(false);

  // --- שלב 1: פתיחת המיקרופון ---
  const startListening = useCallback(() => {
    if (!isSessionActive.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setAppState("listening");

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (!text.trim()) return;

      setAppState("processing");
      setTranscript(prev => [...prev, { role: 'user', text }]);
      
      // שלב 2: שליחה ל-AI
      await connectToGemini(text);
    };

    recognition.onerror = () => {
      if (isSessionActive.current) setTimeout(startListening, 1000);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [sourceLang]);

  // --- שלב 2: חיבור ל-Gemini AI ---
  const connectToGemini = async (userInput: string) => {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `Translate the following from ${sourceLang} to ${targetLang}. Output ONLY the translation: "${userInput}"`;
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text();

      setTranscript(prev => [...prev, { role: 'ai', text: translatedText }]);
      
      // שלב 3: הפעלת הקול
      speakText(translatedText);
    } catch (error) {
      console.error("Gemini Connection Failed:", error);
      if (isSessionActive.current) startListening();
    }
  };

  // --- שלב 3: השמעת התשובה וחזרה להקשבה ---
  const speakText = (text: string) => {
    setAppState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;

    utterance.onend = () => {
      // כאן נסגרת הלולאה - רק כשסיים לדבר, חוזר להקשיב
      if (isSessionActive.current) {
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleSession = () => {
    if (isActive) {
      isSessionActive.current = false;
      setIsActive(false);
      setAppState("idle");
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    } else {
      isSessionActive.current = true;
      setIsActive(true);
      startListening();
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-10 font-sans">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black mb-2 text-indigo-500">LINGOLIVE PRO</h1>
        <p className="text-slate-400">הלולאה פעילה: דיבור -> תרגום -> תשובה קולית</p>
      </div>

      {/* האווטאר המרכזי */}
      <div className={`w-64 h-64 rounded-full border-8 flex items-center justify-center transition-all duration-500 ${
        appState === 'listening' ? 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)]' :
        appState === 'speaking' ? 'border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.3)]' :
        appState === 'processing' ? 'border-yellow-500 animate-pulse' : 'border-slate-800'
      }`}>
        <span className="text-xl font-bold uppercase tracking-widest">{appState}</span>
      </div>

      <div className="mt-12 w-full max-w-md">
        <button 
          onClick={toggleSession}
          className={`w-full py-6 rounded-3xl font-black text-2xl transition-all ${
            isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-900/40'
          }`}
        >
          {isActive ? 'עצור שיחה' : 'התחל שיחה רציפה'}
        </button>
      </div>

      {/* תצוגת תמלול קטנה לבדיקה */}
      <div className="mt-8 w-full max-w-lg h-32 overflow-y-auto bg-slate-900/50 p-4 rounded-xl border border-white/5 text-xs text-slate-500">
        {transcript.map((t, i) => (
          <div key={i} className="mb-1">
            <span className="font-bold uppercase mr-2">{t.role}:</span> {t.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
