import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square, Volume2 } from 'lucide-react';
import { audioService } from './services/AudioService'; // ייבוא השירות החדש

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeLang, setNativeLang] = useState("he-IL");
  const [targetLang, setTargetLang] = useState("en-US");
  const [debugLog, setDebugLog] = useState("LINGO-AI מוכנה");
  
  const apiKey = import.meta.env.VITE_API_KEY;
  const recognitionRef = useRef<any>(null);

  // פונקציית עזר לטיפול בדיבור
  const handleSpeak = async (text: string) => {
    setIsSpeaking(true);
    await audioService.speak(text, targetLang);
    setIsSpeaking(false);
    if (status === "connected") startListening();
  };

  const getAIResponse = async (userText: string) => {
    try {
      setDebugLog("⏳ LINGO-AI מעבדת...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Respond as a female assistant in ${targetLang}. User: ${userText}` }] }]
        })
      });

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ תשובה התקבלה");
      handleSpeak(aiText);
    } catch (e) {
      setDebugLog("❌ שגיאת חיבור ל-AI");
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
    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מחוברת");
        handleSpeak("שלום, אני מחוברת."); // בדיקה מיידית של הקול
      } catch (err) {
        setDebugLog("❌ המיקרופון חסום");
      }
    } else {
      setStatus("ready");
      audioService.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      setDebugLog("המערכת הופסקה");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex justify-end p-4 overflow-hidden font-sans" dir="rtl">
      <div className="w-full max-w-[320px] flex flex-col gap-4">
        
        {/* כפתור בדיקת שמע מהירה - אם זה לא עובד, שום דבר לא יעבוד */}
        <button onClick={() => audioService.speak("בדיקת רמקולים", "he-IL")} className="text-[10px] text-indigo-400 flex items-center justify-center gap-1 border border-indigo-500/30 py-1 rounded-full">
          <Volume2 size={12} /> לחץ לבדיקת רמקולים
        </button>

        {/* שדות שפה */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <label className="text-[10px] text-slate-500 block mb-1">שפת אם</label>
            <select value={nativeLang} onChange={(e)=>setNativeLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="he-IL">עברית</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <label className="text-[10px] text-slate-500 block mb-1">שפת תרגום</label>
            <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="w-full bg-transparent text-xs outline-none cursor-pointer">
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </div>
        </div>

        {/* מודולים 2X2 */}
        <div className="grid grid-cols-2 gap-2">
          {['translation', 'simultaneous', 'chat', 'learning'].map((m) => (
            <button key={m} onClick={()=>setActiveModule(m)} className={`p-4 rounded-xl flex flex-col items-center gap-1 text-[11px] font-bold ${activeModule === m ? 'bg-indigo-600 shadow-lg' : 'bg-slate-900 opacity-60'}`}>
              {m === 'translation' ? 'תרגום' : m === 'simultaneous' ? 'סימולטני' : m === 'chat' ? 'צ\'אט' : 'לימוד'}
            </button>
          ))}
        </div>

        {/* אווטאר */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-52 h-52 rounded-full p-1 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
              <img src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button onClick={toggleSession} className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}>
          {status === 'ready' ? <><Mic size={24} /> התחל שיחה</> : <><Square size={24} /> הפסק</>}
        </button>

        {/* תיבת דיבאג */}
        <div className="bg-black/40 p-2 rounded-lg text-[10px] text-center font-mono text-indigo-400 border border-slate-800">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
