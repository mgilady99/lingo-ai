import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Square, Zap, Terminal } from 'lucide-react';

const App: React.FC = () => {
  const [logs, setLogs] = useState<string[]>(["ממתין לפקודה..."]);
  const [status, setStatus] = useState("idle");
  const activeSessionRef = useRef<any>(null);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

  const runDiagnostics = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return addLog("❌ שגיאה: חסר API KEY ב-Vercel");

    try {
      setStatus("connecting");
      addLog("🔄 מנסה להתחבר לגוגל...");

      const ai = new GoogleGenAI({ apiKey });
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
            onopen: () => addLog("✅ אירוע: חיבור נפתח (Open)"),
            onclose: () => addLog("⚠️ אירוע: חיבור נסגר (Close)"),
            onmessage: () => {},
            onerror: (e) => addLog(`❌ שגיאה: ${e.message}`)
        }
      });

      activeSessionRef.current = session;
      setStatus("connected");
      addLog("✅ מחובר בהצלחה! בודק פונקציות...");

      // בדיקת פונקציות קיימות באובייקט
      const methods = [];
      // בדיקה עמוקה באובייקט ובפרוטוטייפ שלו
      let obj = session;
      while (obj) {
          for (const key of Object.getOwnPropertyNames(obj)) {
              if (key !== 'constructor' && typeof (session as any)[key] === 'function') {
                  if (!methods.includes(key)) methods.push(key);
              }
          }
          obj = Object.getPrototypeOf(obj);
          if (obj === Object.prototype) break;
      }

      console.log("Full Session Object:", session);
      console.log("Methods Found:", methods);
      
      addLog(`🔍 פונקציות שנמצאו: ${methods.join(", ") || "כלום"}`);
      
      // ניסיון לשלוח הודעה לפי מה שנמצא
      if (methods.includes('send')) {
          addLog("נמצאה פונקציית send - מנסה לשלוח...");
          (session as any).send({ clientContent: { turns: [{ role: 'user', parts: [{ text: "Test" }] }] }, turnComplete: true });
      } else if (methods.includes('sendClientContent')) {
          addLog("נמצאה פונקציית sendClientContent - מנסה לשלוח...");
      } else {
          addLog("❌ לא נמצאה פונקציית שליחה מוכרת!");
      }

    } catch (e: any) {
      addLog(`❌ קריסה קריטית: ${e.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="h-screen bg-black text-green-400 font-mono p-6 flex flex-col gap-4" dir="ltr">
      <h1 className="text-xl font-bold border-b border-green-800 pb-2">Gemini Diagnostic Tool</h1>
      
      <div className="flex gap-4">
        <button onClick={runDiagnostics} className="bg-green-900 px-6 py-3 rounded flex items-center gap-2 hover:bg-green-800">
          {status === 'connecting' ? <Zap className="animate-pulse" /> : <Terminal />} Run Test
        </button>
        <button onClick={() => activeSessionRef.current?.close()} className="bg-red-900 px-6 py-3 rounded flex items-center gap-2">
          <Square size={18} /> Disconnect
        </button>
      </div>

      <div className="flex-1 bg-gray-900 p-4 rounded border border-green-900 overflow-auto font-sans text-sm">
        {logs.map((line, i) => (
          <div key={i} className="mb-1 border-b border-gray-800 pb-1">{line}</div>
        ))}
      </div>
    </div>
  );
};

export default App;
