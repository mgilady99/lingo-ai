import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight, Loader2 } from 'lucide-react';

// נכניס כאן את ה-Client ID שלך שקיבלת מפייפאל
const PAYPAL_CLIENT_ID = "YOUR_PAYPAL_CLIENT_ID_HERE";

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const plans = [
    { id: 'FREE', name: 'חינם', price: '0', tokens: '5,000', icon: <Zap className="text-slate-400" /> },
    { id: 'BASIC', name: 'Standard', price: '58.80', tokens: '20,000', icon: <Crown className="text-indigo-400" />, desc: 'חיוב שנתי ($4.90 לחודש)' },
    { id: 'PRO', name: 'Premium', price: '142.80', tokens: '100,000', icon: <Crown className="text-amber-400" />, desc: 'חיוב שנתי ($11.90 לחודש)' }
  ];

  // טעינת ה-SDK של פייפאל
  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => console.log("PayPal Loaded");
    document.body.appendChild(script);
  }, []);

  const handleFreeStart = () => onPlanSelect('FREE');

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") setIsSuccess(true);
    else alert("קוד לא תקין.");
  };

  // פונקציה ליצירת כפתור פייפאל עבור מסלול ספציפי
  const renderPayPalButton = (plan: any) => {
    // @ts-ignore
    if (window.paypal) {
        // @ts-ignore
        window.paypal.Buttons({
            createOrder: (data: any, actions: any) => {
                return actions.order.create({
                    purchase_units: [{
                        description: plan.name,
                        amount: { value: plan.price }
                    }]
                });
            },
            onApprove: async (data: any, actions: any) => {
                const order = await actions.order.capture();
                console.log("Payment Success", order);
                onPlanSelect(plan.id); // מעבר לאתר לאחר תשלום מוצלח
            },
            onError: (err: any) => {
                alert("חלה שגיאה בתשלום פייפאל");
            }
        }).render(`#paypal-button-${plan.id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto pb-20">
      <div className="w-full max-w-md mx-auto px-6 py-10 flex flex-col items-center">
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter text-center italic">שדרג את החוויה</h1>
        <p className="text-slate-400 text-xs font-bold mb-8 text-center px-4">תשלום מאובטח באמצעות פייפאל</p>

        <div className="w-full space-y-6 mb-10">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="text-2xl">{plan.icon}</div>
                <div className="text-left text-white">
                  <span className="text-3xl font-black">${plan.price}</span>
                </div>
              </div>
              <h2 className="text-xl font-black text-white mb-1">{plan.name}</h2>
              <p className="text-indigo-400 text-sm font-black mb-1">{plan.tokens} טוקנים</p>
              {plan.desc && <p className="text-slate-500 text-[10px] mb-4 font-bold italic">{plan.desc}</p>}
              
              {plan.id === 'FREE' ? (
                <button 
                  onClick={handleFreeStart}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all"
                >
                  המשך בחינם
                </button>
              ) : (
                <div id={`paypal-button-${plan.id}`} className="mt-2" onMouseEnter={() => renderPayPalButton(plan)}>
                    {/* כאן יופיע הכפתור של פייפאל */}
                    <div className="bg-indigo-600/20 text-indigo-400 py-3 rounded-xl text-center text-xs font-bold">
                        לחץ כאן להצגת כפתור פייפאל
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* קוד הטבה (נשאר ללא שינוי) */}
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
              <button onClick={handleRedeem} className="w-full bg-slate-800 py-3 rounded-xl font-black text-sm">הפעל קוד</button>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-1">הופעל בהצלחה!</h3>
              <button 
                onClick={() => onPlanSelect('PRO')} 
                className="w-full bg-indigo-600 py-5 rounded-2xl flex items-center justify-center gap-3 text-xl font-black"
              >
                עבור לאתר <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
