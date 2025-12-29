import React, { useState, useRef, useEffect } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // פונקציה להשגת קול נשי חביב
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // ניסיון למצוא קול נשי ברשימת הקולות של המערכת שלך
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.includes('Google עברית'));
    
    if (femaleVoice) msg.voice = femaleVoice;
    msg.lang = 'he-IL';
    msg.pitch = 1.3; // טון גבוה יותר לקול נשי
    msg.rate = 1.0;

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  // חיבור אמיתי ל-Gemini 2.0
  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⚡ AI חושבת...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `User language: ${nativeLang}. Target language: ${targetLang}. Module: ${activeModule}. Instruction: Answer as a helpful female assistant. User said: ${userText}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ Gemini עונה");
      speak(aiText);
    } catch (e: any) {
      console.error(e);
      setDebugLog("❌ שגיאת חיבור - בדוק מפתח API");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 נקלט: ${transcript}`);
      getAIResponse(transcript);
    };
    recognition.onerror = () => {
      if (status === "connected" && !isSpeaking) try { recognition.start(); } catch(e) {}
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום, אני מחוברת ומוכנה לעזור לך. איך אני יכולה לסייע?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("שיחה הסתיימה");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex p-4 font-sans" dir="rtl">
      <div className="w-full max-w-[300px] flex flex-col gap-5">
        
        {/* שדות שפה */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 block mb-1">שפת אם</label>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none focus:border-indigo-500">
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="en-US">English 🇺🇸</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 block mb-1">שפת תרגום</label>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none focus:border-indigo-500">
              <option value="en-US">English 🇺🇸</option>
              <option value="he-IL">עברית 🇮🇱</option>
              <option value="fr-FR">Français 🇫🇷</option>
            </select>
          </div>
        </div>

        {/* מודולים 2+2 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "translation", icon: <Mic size={18}/>, label: "תרגום" },
            { id: "simultaneous", icon: <Headphones size={18}/>, label: "סימולטני" },
            { id: "chat", icon: <MessageSquare size={18}/>, label: "צ'אט" },
            { id: "learning", icon: <GraduationCap size={18}/>, label: "לימוד" }
          ].map(mod => (
            <button key={mod.id} onClick={()=>setActiveModule(mod.id)} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-[10px] font-bold transition-all ${activeModule === mod.id ? 'bg-indigo-600 ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-slate-900 opacity-60'}`}>
              {mod.icon} {mod.label}
            </button>
          ))}
        </div>

        {/* אווטאר עגול עם מסגרת */}
        <div className="flex justify-center items-center py-4">
          <div className={`w-52 h-52 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 animate-pulse' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 relative">
              <img 
                src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
                alt="Avatar" 
                className={`w-full h-full object-cover transition-transform duration-500 ${isSpeaking ? 'scale-110' : 'scale-100'}`}
                onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/200?text=AI+Assistant'; }}
              />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl ${
            status === 'ready' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-red-600 shadow-red-500/20'
          }`}
        >
          {status === 'ready' ? <><Mic size={28}/> START</> : <><Square size={28}/> STOP</>}
        </button>

        {/* לוג תחתון */}
        <div className="mt-auto bg-black/30 p-2 rounded-xl text-center text-[10px] font-mono text-indigo-400 uppercase tracking-widest border border-slate-900">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
