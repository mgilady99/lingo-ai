import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Play, Square, Languages, Sparkles } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  const speak = (text: string, lang: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = lang;
    msg.pitch = 1.1;
    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") setTimeout(() => startListening(activeModule === "simultaneous" ? targetLang : nativeLang), 400);
    };
    window.speechSynthesis.speak(msg);
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⚡ Gemini 2.0 מעבד...");
      let prompt = userText;
      if (activeModule === "translation") prompt = `Translate this to ${targetLang}: ${userText}`;
      if (activeModule === "learning") prompt = `Correct my grammar mistakes in this sentence and then answer me in ${targetLang}: ${userText}`;
      if (activeModule === "chat") prompt = `Conversational response in ${targetLang}: ${userText}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      speak(aiText, targetLang);
      setDebugLog("✅ עונה לך");
    } catch (e) {
      setDebugLog("❌ שגיאת API - בדוק מפתח");
    }
  };

  const startListening = (lang: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: ${transcript}`);
      getAIResponse(transcript);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מוכנה לעזור. במה נתחיל?", nativeLang);
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("שיחה הסתיימה");
    }
  };

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden rtl" style={{direction: 'rtl'}}>
      {/* Sidebar - מודולים */}
      <div className="w-24 md:w-28 flex flex-col gap-4 p-2 border-l border-slate-800 bg-slate-900/80 items-center pt-10">
        <div className="mb-4 text-indigo-500"><Sparkles size={32} /></div>
        <button onClick={() => setActiveModule("translation")} className={`p-3 rounded-2xl flex flex-col items-center gap-1 w-full ${activeModule === 'translation' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-800 opacity-60'}`}>
          <Languages size={22} /> <span className="text-[10px] font-bold">תרגום</span>
        </button>
        <button onClick={() => setActiveModule("simultaneous")} className={`p-3 rounded-2xl flex flex-col items-center gap-1 w-full ${activeModule === 'simultaneous' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-800 opacity-60'}`}>
          <Headphones size={22} /> <span className="text-[10px] font-bold">סימולטני</span>
        </button>
        <button onClick={() => setActiveModule("chat")} className={`p-3 rounded-2xl flex flex-col items-center gap-1 w-full ${activeModule === 'chat' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-800 opacity-60'}`}>
          <MessageSquare size={22} /> <span className="text-[10px] font-bold">צ'אט</span>
        </button>
        <button onClick={() => setActiveModule("learning")} className={`p-3 rounded-2xl flex flex-col items-center gap-1 w-full ${activeModule === 'learning' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-800 opacity-60'}`}>
          <GraduationCap size={22} /> <span className="text-[10px] font-bold">לימוד</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-6">
        {/* Language Selectors */}
        <div className="flex justify-center gap-6 mb-10">
          <div className="text-center">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">שפת אם</span>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm outline-none">
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="en-US">English 🇺🇸</option>
            </select>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">שפת יעד</span>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm outline-none">
              <option value="en-US">English 🇺🇸</option>
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="fr-FR">Français 🇫🇷</option>
            </select>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`relative p-1 rounded-full transition-all duration-500 ${isSpeaking ? 'bg-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.6)]' : 'bg-slate-800'}`}>
            <div className="w-60 h-60 rounded-full overflow-hidden border-4 border-slate-950 shadow-2xl">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="Avatar" 
                className={`w-full h-full object-cover transition-all duration-300 ${status === 'connected' ? 'grayscale-0' : 'grayscale'}`}
              />
            </div>
            {status === 'connected' && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 px-6 py-1 rounded-full text-xs font-black tracking-widest animate-pulse">
                {isSpeaking ? 'עונה...' : 'מקשיבה...'}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button 
            onClick={toggleSession}
            className={`w-full max-w-xs py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all active:scale-95 ${
              status === 'ready' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/20' : 'bg-red-500 shadow-xl shadow-red-500/20'
            }`}
          >
            {status === 'ready' ? <><Mic size={28} /> START</> : <><Square size={28} /> STOP</>}
          </button>
          <div className="bg-black/40 border border-slate-800 px-6 py-2 rounded-full font-mono text-[10px] text-indigo-400 uppercase tracking-widest">
            {debugLog}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
