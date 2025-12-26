import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight } from 'lucide-react';

// ה-Client ID האישי שלך מפייפאל כבר מושתל כאן
const PAYPAL_CLIENT_ID = "AWmyrNxDvPJHZjVa8ZJOaUdPZ1m5K-WnCu_jl0IYq4TGotsi0RinsrX1cV8K80H2pXrL20mUvEXnTRTY";

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const plans = [
    { id: 'FREE', name: 'חינם', price: '0', tokens: '5,000', icon: <Zap className="text-slate-400" /> },
    { id: 'BASIC', name: 'Standard', price: '58.80', tokens: '20,000', icon: <Crown className="text-indigo-400" />, desc: 'חיוב שנתי ($4.90 לחודש)' },
    { id: 'PRO', name: 'Premium', price: '142.80', tokens: '100,000', icon: <Crown className="text-amber-400" />, desc: 'חיוב שנתי ($11.90 לחודש)' }
  ];

  // טעינת פייפאל לדף
  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => console.log("PayPal Ready");
    document.body.appendChild(script);
  }, []);

  const renderPayPalButton = (plan: any) => {
    // @ts-ignore
    if (window.paypal && !document.getElementById(`paypal-container-${plan.id}`)?.hasChildNodes()) {
        // @ts-ignore
        window.paypal.Buttons({
            style: { layout: 'vertical', color: 'blue', shape: 'pill', label: 'pay' },
            createOrder: (data: any, actions: any) => {
                return actions.order.create({
                    purchase_units: [{
                        description: `LingoLive Pro - ${plan.name}`,
                        amount: { value: plan.price }
                    }]
                });
            },
            onApprove: async (data: any, actions: any) => {
                await actions.order.capture();
                onPlanSelect(plan.id); // מעבר לאתר לאחר תשלום
            },
            onError: () => alert("שגיאה בתשלום פייפאל")
        }).render(`#paypal-container-${plan.id}`);
    }
  };

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") setIsSuccess(true);
    else alert("קוד לא תקין.");
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto pb-20">
      <div className="w-full max-w-md mx-auto px-6 py-10 flex flex-col items-center">
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic">שדרוג מנוי</h1>
        <p className="text-slate-400 text-[10px] font-bold mb-8 text-center uppercase tracking-widest">Secure Payment via PayPal</p>

        <div className="w-full space-y-4 mb-10">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="text-2xl">{plan.icon}</div>
                <div className="text-left font-black text-2xl text-white">${plan.price}</div>
              </div>
              <h2 className="text-xl font-black text-white mb-1 uppercase">{plan.name}</h2>
              <p className="text-indigo-400 text-sm font-black mb-1">{plan.tokens} טוקנים</p>
              {plan.desc && <p className="text-slate-500 text-[9px] mb-4 font-bold italic">{plan.desc}</p>}
              
              {plan.id === 'FREE' ? (
                <button onClick={() => onPlanSelect('FREE')} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black transition-all">המשך בחינם</button>
              ) : (
                <div 
                  id={`paypal-container-${plan.id}`} 
                  className="mt-2 min-h-[50px]" 
                  onMouseEnter={() => renderPayPalButton(plan)}
                  onTouchStart={() => renderPayPalButton(plan)}
                >
                    <div className="bg-indigo-600/10 text-indigo-400 py-3 rounded-xl text-center text-[10px] font-black cursor-pointer">
                        לחץ כאן לתשלום מאובטח
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* קוד הטבה */}
        <div className="w-full bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 text-center">
          {!isSuccess ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-slate-400 font-black text-xs mb-1">
                <Gift size={16} className="text-indigo-400" /> <span>קוד הטבה?</span>
              </div>
              <input 
                type="text" placeholder="הכנס קוד" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-bold"
                value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
              />
              <button onClick={handleRedeem} className="w-full bg-slate-800 py-3 rounded-xl font-black text-sm">הפעל</button>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-emerald-500" />
              </div>
              <button onClick={() => onPlanSelect('PRO')} className="w-full bg-indigo-600 py-5 rounded-2xl flex items-center justify-center gap-2 font-black text-xl">
                עבור לאתר <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
