
import React, { useState, useRef } from 'react';
import { Mic, Headphones, MessageSquare, GraduationCap, Square } from 'lucide-react';
// ייבוא מדויק לפי מבנה העץ שלך: services מחוץ ל-src
import { audioService } from '../services/audioService';

const App = () => {
  const [status, setStatus] = useState("ready");
  const [activeModule, setActiveModule] = useState("translation");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState("מערכת מוכנה");
  
  // בדיקה אם המפתח נטען מ-Vercel
  const apiKey = import.meta.env.VITE_API_KEY;

  const getAIResponse = async (userText: string) => {
    if (!apiKey) {
      setDebugLog("❌ שגיאה: VITE_API_KEY לא הוגדר ב-Vercel או שלא בוצע Redeploy");
      return;
    }

    try {
      setDebugLog("⏳ פונה ל-Gemini 2.0...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Role: Female AI assistant for LINGO-AI. Respond naturally in English. User input: ${userText}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates[0].content.parts[0].text;
      setDebugLog("✅ AI ענתה, משמיעה קול...");
      
      setIsSpeaking(true);
      await audioService.speak(aiText, "en-US");
      setIsSpeaking(false);
      
      if (status === "connected") startListening();
    } catch (e: any) {
      setDebugLog(`❌ שגיאה: ${e.message}`);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "he-IL";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDebugLog(`🎤 שמעתי: "${transcript}"`);
      getAIResponse(transcript);
    };
    recognition.start();
  };

  const toggleSession = async () => {
    if (status === "ready") {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus("connected");
        setDebugLog("מחוברת - בודקת אודיו...");
        // משמיע הודעה ראשונית לוודא שהשירות עובד
        await audioService.speak("מערכת לינגו איי איי מחוברת", "he-IL");
        startListening();
      } catch (err) {
        setDebugLog("❌ המיקרופון חסום בדפדפן");
      }
    } else {
      setStatus("ready");
      window.speechSynthesis.cancel();
      setDebugLog("המערכת הופסקה");
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex justify-end p-4 font-sans" dir="rtl">
      <div className="w-full max-w-[320px] flex flex-col gap-4">
        <div className="text-center font-black text-xl text-indigo-500 pt-2">LINGO-AI PRO</div>

        {/* חיווי מצב מפתח - אבחון מהיר בשבילך */}
        <div className={`text-[9px] p-1 rounded text-center ${apiKey ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {apiKey ? "API KEY LOADED ✅" : "API KEY MISSING ❌"}
        </div>

        {/* אווטאר */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-60 h-60 rounded-full p-1.5 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 shadow-2xl scale-105' : 'bg-slate-800'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#020617]">
              <img src="https://raw.githubusercontent.com/mgilady99/LINGO-AI/main/אווטאר.jpg" className="w-full h-full object-cover" alt="AI" />
            </div>
          </div>
        </div>

        {/* כפתור הפעלה */}
        <button onClick={toggleSession} className={`w-full py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${status === 'ready' ? 'bg-indigo-600' : 'bg-red-600'}`}>
          {status === 'ready' ? "התחל שיחה" : "הפסק שיחה"}
        </button>

        {/* תיבת אבחון (Debug) - תסתכל עליה בזמן השימוש */}
        <div className="bg-black/40 p-3 rounded-lg text-[10px] font-mono text-indigo-300 border border-slate-800 break-words min-h-[60px]">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
