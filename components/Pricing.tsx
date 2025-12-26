import React, { useState } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight } from 'lucide-react';

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const plans = [
    {
      id: 'FREE',
      name: 'חינם',
      price: '0',
      tokens: '5,000',
      features: ['תרגום חי בסיסי', 'קול סטנדרטי', 'ללא עלות'],
      icon: <Zap className="text-slate-400" />,
      buttonText: 'המשך בחינם'
    },
    {
      id: 'BASIC',
      name: 'Standard',
      price: '4.90',
      yearly: '58.80',
      tokens: '20,000',
      features: ['עדיפות במהירות תגובה', 'תרגום סימולטני', 'תמיכה במייל'],
      icon: <Crown className="text-indigo-400" />,
      buttonText: 'בחר במסלול'
    },
    {
      id: 'PRO',
      name: 'Premium',
      price: '11.90',
      yearly: '142.80',
      tokens: '100,000',
      features: ['מהירות מקסימלית', 'כל המודולים פתוחים', 'תמיכה אישית 24/7'],
      icon: <Crown className="text-amber-400" />,
      buttonText: 'בחר בפרמיום'
    }
  ];

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") {
      setIsSuccess(true);
    } else {
      alert("קוד לא תקין.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto pb-10">
      <div className="max-w-6xl mx-auto px-6 pt-10">
        
        {/* כותרת דף */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-3 uppercase tracking-tighter">
            בחר את המסלול שלך
          </h1>
          <p className="text-slate-400 text-sm md:text-lg font-bold">
            הצטרף לאלפי משתמשים שכבר מדברים בכל שפה
          </p>
        </div>

        {/* רשת המסלולים - מותאם למובייל (grid-cols-1) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 md:p-8 flex flex-col shadow-2xl hover:border-indigo-500/50 transition-all relative overflow-hidden group"
            >
              <div className="mb-4 text-3xl">{plan.icon}</div>
              <h2 className="text-2xl font-black text-white mb-1">{plan.name}</h2>
              <div className="mb-4">
                <span className="text-4xl font-black text-white">${plan.price}</span>
                {plan.price !== '0' && <span className="text-slate-400 text-xs mr-2 font-bold italic">לחודש*</span>}
              </div>
              
              <div className="bg-indigo-600/10 rounded-2xl p-3 mb-6">
                <p className="text-indigo-400 font-black text-center text-base">{plan.tokens} טוקנים</p>
              </div>

              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300 text-sm font-bold">
                    <Check size={14} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              {plan.yearly && (
                <p className="text-[9px] text-slate-500 mb-4 font-bold text-center italic">
                  * חיוב שנתי של ${plan.yearly}
                </p>
              )}

              <button 
                onClick={() => onPlanSelect(plan.id)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* אזור קוד הטבה / הודעת הצלחה */}
        <div className="max-w-md mx-auto bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 text-center shadow-2xl mb-10">
          {!isSuccess ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4 text-slate-400 font-black text-sm">
                <Gift size={20} className="text-indigo-400" />
                <span>יש לך קוד הטבה?</span>
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="הכנס קוד כאן" 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-indigo-500 font-bold text-center"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
                <button 
                  onClick={handleRedeem} 
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-2xl font-black transition-all"
                >
                  הפעל קוד
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">קוד הטבה הופעל!</h3>
              <p className="text-slate-400 font-bold mb-6 text-sm">שודרגת למסלול Premium בחינם</p>
              
              {/* הכפתור הגדול שביקשת למעבר לאתר */}
              <button 
                onClick={() => onPlanSelect('PRO')} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all text-xl flex items-center justify-center gap-3 animate-pulse"
              >
                עבור לאתר עכשיו
                <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>

        {/* הערות שוליים */}
        <p className="text-center text-[10px] text-slate-600 font-bold px-4">
          באותיות קטנות: המחירים הם לחודש בחיוב שנתי. החיוב יתבצע מראש עבור 12 חודשים.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
