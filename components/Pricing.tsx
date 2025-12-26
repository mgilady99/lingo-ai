import React, { useState } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight, Loader2 } from 'lucide-react';

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    { id: 'FREE', name: 'חינם', price: '0', tokens: '5,000', icon: <Zap className="text-slate-400" /> },
    { id: 'BASIC', name: 'Standard', price: '4.90', tokens: '20,000', icon: <Crown className="text-indigo-400" /> },
    { id: 'PRO', name: 'Premium', price: '11.90', tokens: '100,000', icon: <Crown className="text-amber-400" /> }
  ];

  // לוגיקת לחיצה על מסלול
  const handlePlanClick = async (planId: string) => {
    if (planId === 'FREE') {
      onPlanSelect('FREE'); // מעבר מיידי לאפליקציה
      return;
    }

    // אם זה מסלול בתשלום - עוברים ל-Stripe
    setLoadingPlan(planId);
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: planId,
          email: 'customer@example.com' // כאן בהמשך נמשוך את האימייל האמיתי מה-Login
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // מעבר לדף התשלום המאובטח
      } else {
        throw new Error('No URL returned');
      }
    } catch (e) {
      alert("שגיאה בחיבור למערכת התשלומים. וודא שהגדרת את ה-Secret Key ב-Cloudflare.");
      setLoadingPlan(null);
    }
  };

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") setIsSuccess(true);
    else alert("קוד לא תקין.");
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-6 py-10 pb-20 flex flex-col items-center">
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic text-center">בחר את המסלול שלך</h1>
        <p className="text-slate-400 text-xs font-bold mb-8 text-center px-4">הצטרף לאלפי משתמשים שכבר מדברים בכל שפה</p>

        <div className="w-full space-y-4 mb-10">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div className="text-2xl">{plan.icon}</div>
                <div className="text-left">
                  <span className="text-3xl font-black text-white">${plan.price}</span>
                  {plan.id !== 'FREE' && <span className="text-slate-500 text-[9px] block font-bold italic">לחודש בחיוב שנתי</span>}
                </div>
              </div>
              <h2 className="text-xl font-black text-white mb-1 uppercase tracking-tighter">{plan.name}</h2>
              <p className="text-indigo-400 text-sm font-black mb-5">{plan.tokens} טוקנים</p>
              
              <button 
                onClick={() => handlePlanClick(plan.id)}
                disabled={loadingPlan !== null}
                className={`w-full font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                  plan.id === 'FREE' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : plan.id === 'FREE' ? (
                  'המשך בחינם'
                ) : (
                  'עבור לתשלום'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* קוד הטבה */}
        <div className="w-full bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 text-center shadow-2xl">
          {!isSuccess ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-slate-400 font-black text-xs mb-1">
                <Gift size={16} className="text-indigo-400" />
                <span>יש לך קוד הטבה?</span>
              </div>
              <input 
                type="text" placeholder="הכנס קוד כאן" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 font-bold text-center"
                value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
              />
              <button onClick={handleRedeem} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-black text-sm transition-all">הפעל קוד</button>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300 py-2">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-1 uppercase tracking-tighter">הופעל בהצלחה!</h3>
              <p className="text-slate-400 font-bold mb-6 text-xs uppercase text-emerald-400">Premium Activated</p>
              <button 
                onClick={() => onPlanSelect('PRO')} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl text-xl animate-pulse"
              >
                עבור לאתר <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>
        
        <p className="text-[9px] text-slate-600 mt-6 text-center font-bold px-4 italic">
          * המחירים המוצגים הם לחודש בחיוב שנתי מראש. לחיצה על "עבור לתשלום" תעביר אותך לסליקה מאובטחת ב-Stripe.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
