import React, { useEffect } from 'react';

const App: React.FC = () => {
  useEffect(() => { console.log("SYSTEM V13 ONLINE"); }, []);

  const testAudio = () => {
    const speech = new SpeechSynthesisUtterance("System connected successfully");
    window.speechSynthesis.speak(speech);
  };

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <div className="w-full bg-yellow-400 text-black py-8 text-center font-black text-3xl">
        ⚠️ V13 - YELLOW BAR ACTIVE ⚠️
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <button onClick={testAudio} className="bg-blue-600 px-12 py-6 rounded-2xl text-2xl font-bold">
          🔊 לחץ לבדיקת קול
        </button>
        <p className="text-xl">אם אתה רואה צהוב ושומע קול - הצלחנו</p>
      </div>
    </div>
  );
};

export default App;
