import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mic, Headphones, AlertTriangle, CheckCircle, Square } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugLog, setDebugLog] = useState<string>("מערכת מוכנה");

  // הכנס כאן את ה-API Key שלך אם תרצה לבדוק מקצה לקצה
  const API_KEY = "YOUR_API_KEY_HERE"; 

  const startConversation = () => {
    setStatus("connected");
    setDebugLog("מתחבר לבינה המלאכותית...");
    
    // בדיקת קול ראשונית
    const msg = new SpeechSynthesisUtterance("שלום, אני מוכן לדבר איתך");
    msg.lang = 'he-IL';
    window.speechSynthesis.speak(msg);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="p-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          <h1 className="font-black text-xl tracking-tight">LINGO-AI</h1>
        </div>
        <div className="text-xs font-mono text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
          V2.0.0-PROD
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className={`relative transition-all duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          {/* האנימציה המרכזית */}
          <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            status === 'connected' ? 'border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.3)]' : 'border-slate-800'
          }`}>
            <div className={`w-48 h-48 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl`}>
              {status === 'connected' ? <Headphones size={64} /> : <Mic size={64} />}
            </div>
          </div>
          
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-4 border-indigo-400 animate-ping opacity-20" />
          )}
        </div>

        <div className="mt-12 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">
            {status === 'ready' ? 'מוכן להתחלה?' : 'אני מקשיב לך...'}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            לחץ על הכפתור למטה והתחל לדבר באנגלית או בעברית. ה-AI יגיב לך בקול בזמן אמת.
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-10 border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl flex flex-col items-center gap-6">
        {status === 'ready' ? (
          <button 
            onClick={startConversation}
            className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            <Mic size={24} /> התחל שיחה
          </button>
        ) : (
          <button 
            onClick={() => setStatus('ready')}
            className="w-full max-w-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            <Square size={24} /> סיום שיחה
          </button>
        )}
        
        <div className="w-full max-w-md bg-black/40 rounded-xl p-3 border border-slate-800">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold text-center">System Log</p>
          <p className="text-xs font-mono text-indigo-400 text-center uppercase tracking-tighter">{debugLog}</p>
        </div>
      </div>
    </div>
  );
};

export default App;
