
import React, { useState } from 'react';
import { LogIn, Lock, HelpCircle, Eye, EyeOff, Ticket, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../types';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onForgotPassword: () => void;
  nativeLang: any;
  setNativeLang: (lang: any) => void;
  t: (key: string) => string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onForgotPassword, nativeLang, setNativeLang, t }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dir = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA' ? 'rtl' : 'ltr';

  const handleLogin = async () => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = password.trim();
    const cleanPromo = promoCode.trim();

    if (!email.includes('@')) { alert("Email invalid"); return; }
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, promoCode: cleanPromo })
      });
      const data = await res.json();
      
      if (res.ok) {
        onLoginSuccess(data);
      } else {
        alert(data.error || "Login Error");
      }
    } catch (e) {
      alert("Server Error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex h-screen items-center justify-center bg-[#0f172a] font-['Inter'] text-white ${dir}`} dir={dir}>
      {/* החזרתי את הקונטיינר לגודל סביר */}
      <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 shadow-2xl text-center relative">
        
        {/* בחירת שפה */}
        <div className="absolute top-4 left-4 z-10">
            <div className="relative group">
                <button className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold">
                    <Globe size={14}/> {nativeLang.flag}
                </button>
                <div className="absolute top-full left-0 mt-2 bg-slate-800 border border-white/10 rounded-xl p-2 hidden group-hover:block min-w-[120px] shadow-xl z-20">
                    {SUPPORTED_LANGUAGES.map(l => (
                        <button key={l.code} onClick={() => setNativeLang(l)} className="flex items-center gap-2 w-full p-2 hover:bg-white/10 rounded-lg text-xs text-left">
                            {l.flag} {l.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/50">
          <LogIn size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">LINGOLIVE PRO</h1>
        <p className="text-slate-300 text-sm font-bold mb-8">{t('login_title')}</p>
        
        <div className="space-y-4">
          <input 
            type="email" placeholder={t('email_placeholder')} value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-4 font-bold text-lg text-center outline-none focus:border-indigo-500"
            dir="ltr"
          />
          
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} placeholder={t('password_placeholder')} value={password} onChange={e => setPassword(e.target.value)}
              className={`w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-4 font-bold text-lg text-center outline-none focus:border-indigo-500 ${dir === 'rtl' ? 'pl-12' : 'pr-12'}`}
              dir="ltr"
            />
            <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-400`} size={20} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-slate-400 hover:text-white`}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {!showPromo ? (
            <button onClick={() => setShowPromo(true)} className="text-xs text-indigo-400 font-bold hover:text-indigo-300 flex items-center justify-center gap-1 w-full">
              <Ticket size={14} /> {t('have_promo')}
            </button>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2">
              <input 
                type="text" placeholder={t('enter_promo')} value={promoCode} onChange={e => setPromoCode(e.target.value)}
                className="w-full bg-indigo-900/20 border border-indigo-500/50 text-indigo-200 rounded-xl px-4 py-3 font-bold text-center outline-none focus:bg-indigo-900/40"
              />
            </div>
          )}

          {/* כפתור בגודל רגיל (py-4) אבל טקסט גדול (text-2xl) */}
          <button 
            onClick={handleLogin} disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-2xl mt-4 border border-indigo-400/30"
          >
            {isLoading ? "..." : t('login_btn')}
          </button>
        </div>
        
        <button onClick={onForgotPassword} className="mt-6 text-slate-400 text-sm hover:text-white flex items-center justify-center gap-1 mx-auto">
          <HelpCircle size={14}/> {t('forgot_password')}
        </button>
      </div>
    </div>
  );
};

export default Login;
