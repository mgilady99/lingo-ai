import React, { useState } from 'react';
import { LogIn, Lock, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onForgotPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // המצב החדש להצגת הסיסמה
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // ניקוי רווחים למניעת טעויות הקלדה נפוצות
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = password.trim();

    // --- מעקף חירום למנהל (Hardcoded Bypass) ---
    // סיסמה: MEIR@mmmeir12321 (שים לב ל-MEIR באותיות גדולות והמספרים בסוף)
    if (cleanEmail === 'mgilady@gmail.com' && cleanPass === 'MEIR@mmmeir12321') {
        onLoginSuccess({
            email: 'mgilady@gmail.com',
            role: 'ADMIN',
            plan: 'PRO',
            tokens_used: 0
        });
        return;
    }
    // -------------------------------------------

    if (!email.includes('@')) { alert("אימייל לא תקין"); return; }
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      const data = await res.json();
      
      if (res.ok) {
        onLoginSuccess(data);
      } else {
        alert(data.error || "שגיאה בכניסה - בדוק אימייל וסיסמה");
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
          {/* שדה אימייל */}
          <input 
            type="email" 
            placeholder="אימייל" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-400 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-lg dir-ltr text-center"
          />
          
          {/* שדה סיסמה עם כפתור עין */}
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} // כאן מתבצע השינוי בין כוכביות לטקסט
              placeholder="סיסמה" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-400 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-lg dir-ltr text-center pr-12"
            />
            
            {/* אייקון מנעול בצד שמאל */}
            <Lock className="absolute left-4 top-4 text-slate-400" size={20} />

            {/* כפתור העין בצד ימין */}
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white focus:outline-none"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            onClick={handleLogin} disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-xl mt-4 border border-indigo-400/30"
          >
            {isLoading ? "מתחבר..." : "התחבר עכשיו ->"}
          </button>
        </div>
        
        <button 
          onClick={onForgotPassword}
          className="mt-6 text-slate-400 text-sm hover:text-white flex items-center justify-center gap-1 mx-auto"
        >
          <HelpCircle size={14}/> שכחתי סיסמה
        </button>
      </div>
    </div>
  );
};

export default Login;
