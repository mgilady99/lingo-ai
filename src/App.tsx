import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Play, Square, Languages } from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  const apiKey = (import.meta as any).env.VITE_API_KEY || "";
  const recognitionRef = useRef<any>(null);

  // פונקציית הדיבור עם הקול הנשי
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    
    // הגדרת קול נשי חביב
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('he')) || voices.find(v => v.name.includes('Female'));
    if (femaleVoice) msg.voice = femaleVoice;
    
    msg.lang = 'he-IL';
    msg.pitch = 1.2; // טון גבוה יותר לקול נשי
    msg.rate = 0.95; // קצב נעים

    msg.onstart = () => setIsSpeaking(true);
    msg.onend = () => {
      setIsSpeaking(false);
      if (status === "connected") startListening();
    };
    window.speechSynthesis.speak(msg);
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⚡ Gemini 2 מעבדת...");
      let prompt = userText;
      if (activeModule === "translation") prompt = `Translate to ${targetLang}: ${userText}`;
      if (activeModule === "learning") prompt = `Correct my Hebrew and explain in ${targetLang}: ${userText}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      speak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת תקשורת");
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = nativeLang;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      getAIResponse(transcript);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = () => {
    if (status === "ready") {
      setStatus("connected");
      speak("שלום! אני העוזרת האישית שלך. איך אני יכולה לעזור?");
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex p-4 overflow-hidden" dir="rtl">
      {/* כל התוכן מרוכז בצד שמאל של המסך */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        
        {/* 1. שדות בחירת שפה */}
        <div className="flex gap-2">
          <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded text-xs">
            <option value="he-IL">עברית</option>
            <option value="en-US">אנגלית</option>
          </select>
          <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded text-xs">
            <option value="en-US">אנגלית</option>
            <option value="fr-FR">צרפתית</option>
          </select>
        </div>

        {/* 2. ארבעת המודולים (2+2) */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setActiveModule("translation")} className={`p-3 rounded-lg flex flex-col items-center text-[10px] ${activeModule === 'translation' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
            <Languages size={18} /> תרגום
          </button>
          <button onClick={()=>setActiveModule("simultaneous")} className={`p-3 rounded-lg flex flex-col items-center text-[10px] ${activeModule === 'simultaneous' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
            <Headphones size={18} /> סימולטני
          </button>
          <button onClick={()=>setActiveModule("chat")} className={`p-3 rounded-lg flex flex-col items-center text-[10px] ${activeModule === 'chat' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
            <MessageSquare size={18} /> צ'אט
          </button>
          <button onClick={()=>setActiveModule("learning")} className={`p-3 rounded-lg flex flex-col items-center text-[10px] ${activeModule === 'learning' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
            <GraduationCap size={18} /> לימוד
          </button>
        </div>

        {/* 3. תמונת האווטאר */}
        <div className="flex justify-center py-2">
          <div className={`w-48 h-48 rounded-full overflow-hidden border-4 transition-all ${isSpeaking ? 'border-indigo-500 shadow-lg shadow-indigo-500/50' : 'border-slate-800'}`}>
            <img 
              src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* 4. כפתור התחל שיחה */}
        <button 
          onClick={toggleSession}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}
        >
          {status === 'ready' ? <><Mic size={20}/> התחל שיחה</> : <><Square size={20}/> עצור</>}
        </button>

        {/* לוג מערכת בתחתית */}
        <div className="text-[10px] text-center opacity-50 font-mono mt-auto uppercase">
          {debugLog}
        </div>
      </div>
      
      {/* שאר המסך נשאר ריק/כהה לעיצוב נקי */}
      <div className="flex-1"></div>
    </div>
  );
};

export default App;
