import React, { useState } from 'react';
import Login from './components/Login';
import Pricing from './components/Pricing';
// כאן נשארים כל ה-imports האחרים שלך (GoogleGenAI וכו')

const App: React.FC = () => {
  // המשתנים ששולטים באיזה דף רואים
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP'>('LOGIN');
  const [userPlan, setUserPlan] = useState<string>('FREE');

  // פונקציות למעבר בין מסכים
  const handleLoginSuccess = () => setView('PRICING');
  const handlePlanSelect = (plan: string) => {
    setUserPlan(plan);
    setView('APP');
  };

  // --- כאן נכנס כל הקוד הלוגי הקיים של האפליקציה שלך (startConversation וכו') ---
  // (דאג להעתיק לכאן את הפונקציות startConversation, stopConversation וכו' מהגרסה הקודמת)

  // בחירת המסך להצגה
  if (view === 'LOGIN') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (view === 'PRICING') {
    return <Pricing onPlanSelect={handlePlanSelect} />;
  }

  // דף האפליקציה הראשי (זה מה שרואים אחרי שהתחברנו)
  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden rtl">
       {/* כאן נמצא כל ה-HTML המעוצב של האפליקציה שלך */}
       {/* המיקרופון, ה-Avatar, הפרסומת של מאיר גלעדי וכו' */}
       
       {/* תגית קטנה שמראה את סוג המנוי בצד */}
       <div className="absolute top-4 left-4 z-50 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full">
         <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Plan: {userPlan}</span>
       </div>

       {/* שאר הקוד של האפליקציה... */}
    </div>
  );
};

export default App;
