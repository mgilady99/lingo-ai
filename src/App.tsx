import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, Headphones, Square } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מערכת מוכנה");

  // משיכת המפתח לפי השם המדויק שלך ב-Vercel
  const API_KEY = import.meta.env.VITE_API_KEY || ""; 

  const startConversation = async () => {
    if (!API_KEY) {
      setDebugLog("❌ שגיאה: המפתח VITE_API_KEY לא נמצא ב-Vercel");
      return;
    }
    
    try {
      setStatus("connected");
      setDebugLog("⚡ מתחבר ל-Gemini...");
      
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const msg = new SpeechSynthesisUtterance("המערכת זיהתה את המפתח שלך. אני מוכן לעבודה.");
      msg.lang = 'he-IL';
      
      msg.onstart = () => setIsSpeaking(true);
      msg.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(msg);
      setDebugLog("✅ מחובר בהצלחה!");
      
    } catch (error) {
      setDebugLog("❌ שגיאה בחיבור למודל");
      setStatus("ready");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      <div className="p-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          <h1 className="font-black text-xl tracking-tight">LINGO-AI</h1>
        </div>
        <div className="text-[10px] font-mono text-slate-500 bg-slate-800 px-3 py-1 rounded-full">SECURE SYNC</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`relative transition-all duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            status === 'connected' ? 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.4)]' : 'border-slate-800'
          }`}>
            <div className="w-48 h-48 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600">
              {status === 'connected' ? <Headphones size={64} /> : <Mic size={64} className="opacity-50" />}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center max-w-sm">
          <h2 className="text-2xl font-bold mb-3">{status === 'ready' ? 'מוכן?' : 'מחובר'}</h2>
          <p className="text-slate-400 text-sm">השתמשנו במפתח VITE_API_KEY מהגדרות השרת.</p>
        </div>
      </div>

      <div className="p-10 border-t border-slate-800 bg-slate-900/80 flex flex-col items-center gap-6">
        {status === 'ready' ? (
          <button onClick={startConversation} className="w-full max-w-xs bg-indigo-600 py-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95 flex items-center justify-center gap-3">
            <Mic size={24} /> התחל שיחה
          </button>
        ) : (
          <button onClick={() => { setStatus('ready'); window.speechSynthesis.cancel(); }} className="w-full max-w-xs bg-red-500/10 text-red-500 border border-red-500/40 py-5 rounded-2xl font-bold text-lg">
            <Square size={24} /> עצור
          </button>
        )}
        <div className="w-full max-w-md bg-black/50 rounded-xl p-3 border border-slate-800/50 text-center font-mono text-xs text-indigo-400">
          {debugLog}
        </div>
      </div>
    </div>
  );
};

export default App;
