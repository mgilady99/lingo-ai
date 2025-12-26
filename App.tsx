import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Pricing from './components/Pricing';
// ... שאר הייבואים הקיימים שלך (GoogleGenAI, etc.)

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP'>('LOGIN');
  const [userPlan, setUserPlan] = useState<string>('FREE');

  // פונקציות מעבר בין מסכים
  const handleLoginSuccess = () => setView('PRICING');
  const handlePlanSelect = (plan: string) => {
    setUserPlan(plan);
    setView('APP');
  };

  // כאן נכנס כל הקוד הקיים של האפליקציה שלך (startConversation, וכו')
  // אבל ה-return בסוף משתנה כדי להציג את המסך הנכון:

  if (view === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} />;
  if (view === 'PRICING') return <Pricing onPlanSelect={handlePlanSelect} />;

  return (
    // כאן נשאר כל ה-HTML הקיים של האפליקציה (ה-header, המודולים והפרסומת של מאיר)
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden">
       {/* האפליקציה שלך כאן */}
       <p className="absolute top-2 left-2 text-[10px] text-indigo-500 font-bold">מסלול: {userPlan}</p>
       {/* שאר קוד ה-HTML של ה-App */}
    </div>
  );
};

export default App;
