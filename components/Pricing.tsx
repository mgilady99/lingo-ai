import React, { useState } from 'react';
import { Check, Zap, Crown, Gift } from 'lucide-react';

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
      features: ['מהירות מקסימלית (Low Latency)', 'כל המודולים פתוחים', 'תמיכה אישית 24/7'],
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
    <div className="min-h-screen bg-slate-950 p-8 font-['Inter'] rtl text-right">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">בחר את המסלול שלך</h1>
          <p className="text-slate-400 font-bold">הצטרף לאלפי משתמשים שכבר מדברים בכל שפה</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-[3rem] p-8 flex flex-col shadow-2xl hover:border-indigo-500/50 transition-all">
              <div className="mb-6 text-3xl">{plan.icon}</div>
              <h2 className="text-2xl font-black text-white mb-2">{plan.name}</h2>
              <div className="mb-6">
                <span className="text-4xl font-black text-white">${plan.price}</span>
                {plan.price !== '0' && <span className="text-slate-400 text-sm mr-2 font-bold">לחודש*</span>}
              </div>
              
              <div className="bg-indigo-600/10 rounded-2xl p-4 mb-6">
                <p className="text-indigo-400 font-black text-lg">{plan.tokens} טוקנים</p>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 text-sm font-bold">
                    <Check size={16} className="text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>

              {plan.yearly && (
                <p className="text-[10px] text-slate-500 mb-4 font-bold text-center italic">
                  * חיוב שנתי של ${plan.yearly}
                </p>
              )}

              <button 
                onClick={() => onPlanSelect(plan.id)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/10"
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* קטע קוד הטבה מעודכן */}
        <div className="mt-12 max-w-md mx-auto bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 text-center shadow-2xl">
          {!isSuccess ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4 text-slate-400 font-black">
                <Gift size={24} className="text-indigo-400" />
                <span>יש לך קוד הטבה?</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="הכנס קוד כאן" 
                  className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-indigo-500 font-bold"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
                <button onClick={handleRedeem} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-2xl font-black transition-all">הפעל</button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">קוד הטבה הופעל!</h3>
              <p className="text-slate-400 font-bold mb-6">שודרגת למסלול Premium בחינם</p>
              <button 
                onClick={() => onPlanSelect('PRO')} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all text-xl"
              >
                עבור לאתר עכשיו
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
