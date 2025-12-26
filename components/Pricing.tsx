import React, { useState } from 'react';
import { Check, Zap, Crown, CreditCard, Ticket } from 'lucide-react';

interface PricingProps {
  onPlanSelect: (plan: string) => void;
  userEmail?: string;
}

const Pricing: React.FC<PricingProps> = ({ onPlanSelect, userEmail }) => {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePromoCode = async () => {
    if (!promoCode) return;
    if (!userEmail) {
        alert("שגיאה: לא זוהה אימייל למשתמש. נסה להתנתק ולהתחבר שוב.");
        return;
    }

    setLoading(true);
    try {
      // ניקוי רווחים והמרה לאותיות קטנות
      const cleanCode = promoCode.replace(/\s/g, '').toLowerCase();

      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, promoCode: cleanCode })
      });

      const data = await res.json();

      if (res.ok) {
        alert("הקוד התקבל! המנוי שודרג ל-PRO.");
        onPlanSelect('PRO');
      } else {
        alert(data.error || "קוד לא תקין");
      }
    } catch (e) {
      alert("שגיאת תקשורת");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 flex flex-col items-center gap-8 bg-[#0f172a] rtl font-['Inter'] text-white">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white">בחר מסלול</h2>
        <p className="text-slate-400">שדרג את החוויה שלך עם LingoLive Pro</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* --- כרטיס Basic ($4.90) --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 flex flex-col items-center text-center shadow-lg hover:border-white/20 transition-all">
          <div className="bg-slate-800 p-4 rounded-full mb-4"><Zap size={24} className="text-slate-400"/></div>
          <h3 className="text-xl font-bold mb-2">Basic</h3>
          
          {/* התיקון כאן: דולר במקום שקל */}
          <div className="text-3xl font-black mb-1">$4.90</div>
          
          <p className="text-slate-400 text-xs mb-6">חיוב חודשי</p>
          
          <ul className="space-y-3 mb-8 text-slate-300 text-sm w-full">
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-green-400"/> 20,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-green-400"/> גישה למודל מהיר</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-green-400"/> תמיכה בסיסית</li>
          </ul>

          <button className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3 shadow-lg active:scale-95 transition-transform">
             <CreditCard size={18}/> PayPal
          </button>
          <button className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform border border-white/5">
             <CreditCard size={18}/> כרטיס אשראי
          </button>
        </div>

        {/* --- כרטיס PREMIUM --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-indigo-500 relative flex flex-col items-center text-center shadow-2xl shadow-indigo-500/20 transform md:-translate-y-4">
          <div className="absolute -top-4 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">מומלץ</div>
          <div className="bg-indigo-600/20 p-4 rounded-full mb-4"><Crown size={24} className="text-indigo-400"/></div>
          <h3 className="text-xl font-bold mb-2 text-white">PREMIUM</h3>
          <div className="text-3xl font-black mb-1 text-white">$142.80</div>
          <p className="text-slate-400 text-xs mb-6">חיוב שנתי (משתלם!)</p>
          
          <ul className="space-y-3 mb-8 text-indigo-100 text-sm w-full">
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> 100,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> המודל החכם ביותר</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> ללא פרסומות</li>
          </ul>

          <button className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3 shadow-lg active:scale-95 transition-transform">
             <CreditCard size={18}/> PayPal
          </button>
          <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
             <CreditCard size={18}/> כרטיס אשראי
          </button>
        </div>
      </div>

      {/* אזור קוד הטבה */}
      <div className="w-full max-w-md bg-slate-900/80 p-6 rounded-2xl border border-white/10 mt-4 backdrop-blur-sm">
        <label className="text-sm font-bold text-slate-400 mb-2 block flex items-center gap-2">
            <Ticket size={16} className="text-indigo-400"/> יש לך קוד הטבה?
        </label>
        <div className="flex gap-2">
            <input 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="למשל: gift10003"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 text-center transition-colors"
            />
            <button 
                onClick={handlePromoCode}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-bold text-white transition-all disabled:opacity-50 shadow-lg"
            >
                {loading ? 'בודק...' : 'הפעל'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
