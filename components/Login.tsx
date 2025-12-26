import React, { useState } from 'react';
import { LogIn, Lock } from 'lucide-react';

const Login: React.FC<{ onLoginSuccess: (user: any) => void }> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // --- מעקף חירום למנהל (עוקף שרת) ---
    // אם זה אתה - המערכת מכניסה אותך מיד בלי לשאול שאלות
    if (email.toLowerCase().trim() === 'mgilady@gmail.com' && password === 'Meir@mmmeir123') {
        onLoginSuccess({
            email: 'mgilady@gmail.com',
            role: 'ADMIN',
            plan: 'PRO',
            tokens_used: 0
        });
        return;
    }
    // ------------------------------------

    if (!email.includes('@')) { alert("אימייל לא תקין"); return; }
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        onLoginSuccess(data);
      } else {
        alert(data.error || "שגיאה בכניסה");
      }
    } catch (e) {
      alert("תקלה בתקשורת לשרת");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f172a] font-['Inter'] rtl text-white">
      <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 shadow-2xl text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/50">
          <LogIn size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">LINGOLIVE PRO</h1>
        <p className="text-slate-300 text-sm font-bold mb-8">ברוך הבא! הכנס לחשבון</p>
        
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="mgilady@gmail.com" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-400 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-lg dir-ltr text-center"
          />
          <div className="relative">
            <input 
              type="password" 
              placeholder="סיסמה" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-400 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-lg dir-ltr text-center"
            />
            <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
          </div>

          <button 
            onClick={handleLogin} disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-xl mt-4 border border-indigo-400/30"
          >
            {isLoading ? "מתחבר..." : "התחבר עכשיו ->"}
          </button>
        </div>
        
        <p className="mt-6 text-slate-500 text-xs">אין לך חשבון? הירשם כאן</p>
      </div>
    </div>
  );
};

export default Login;
