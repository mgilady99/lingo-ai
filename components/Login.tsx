import React, { useState } from 'react';
import { LogIn, Lock, HelpCircle, Eye, EyeOff, Ticket } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onForgotPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState(''); // שדה חדש לקוד
  const [showPromo, setShowPromo] = useState(false); // האם להציג את השדה
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = password.trim();
    const cleanPromo = promoCode.trim();

    // מעקף מנהל
    if (cleanEmail === 'mgilady@gmail.com' && cleanPass === 'MEIR@mmmeir12321') {
        onLoginSuccess({ email: 'mgilady@gmail.com', role: 'ADMIN', plan: 'PRO', tokens_used: 0 });
        return;
    }

    if (!email.includes('@')) { alert("אימייל לא תקין"); return; }
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // שולחים גם את קוד ההטבה
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, promoCode: cleanPromo })
      });
      const data = await res.json();
      
      if (res.ok) {
        if(data.plan === 'PRO' && cleanPromo) alert("קוד ההטבה התקבל! קיבלת מנוי PRO");
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
            type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-4 font-bold text-lg dir-ltr text-center outline-none focus:border-indigo-500"
          />
          
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} placeholder="סיסמה" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-4 font-bold text-lg dir-ltr text-center outline-none focus:border-indigo-500 pr-12"
            />
            <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* כפתור להצגת שדה קוד הטבה */}
          {!showPromo ? (
            <button onClick={() => setShowPromo(true)} className="text-xs text-indigo-400 font-bold hover:text-indigo-300 flex items-center justify-center gap-1 w-full">
              <Ticket size={14} /> יש לי קוד הטבה
            </button>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2">
              <input 
                type="text" placeholder="הכנס קוד הטבה כאן" value={promoCode} onChange={e => setPromoCode(e.target.value)}
                className="w-full bg-indigo-900/20 border border-indigo-500/50 text-indigo-200 rounded-xl px-4 py-3 font-bold text-center outline-none focus:bg-indigo-900/40"
              />
            </div>
          )}

          <button 
            onClick={handleLogin} disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-xl mt-4 border border-indigo-400/30"
          >
            {isLoading ? "בודק..." : (promoCode ? "הפעל קוד והכנס אותי ->" : "התחבר עכשיו ->")}
          </button>
        </div>
        
        <button onClick={onForgotPassword} className="mt-6 text-slate-400 text-sm hover:text-white flex items-center justify-center gap-1 mx-auto">
          <HelpCircle size={14}/> שכחתי סיסמה
        </button>
      </div>
    </div>
  );
};

export default Login;
