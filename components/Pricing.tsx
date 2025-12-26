import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight, Loader2 } from 'lucide-react';

// ה-Client ID שלך כבר מוטמע כאן
const PAYPAL_CLIENT_ID = "AWmyrNxDvPJHZjVa8ZJOaUdPZ1m5K-WnCu_jl0IYq4TGotsi0RinsrX1cV8K80H2pXrL20mUvEXnTRTY";

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const plans = [
    { id: 'FREE', name: 'חינם', price: '0', tokens: '5,000', icon: <Zap className="text-slate-400" /> },
    { id: 'BASIC', name: 'Standard', price: '58.80', tokens: '20,000', icon: <Crown className="text-indigo-400" />, desc: 'חיוב שנתי ($4.90 לחודש)' },
    { id: 'PRO', name: 'Premium', price: '142.80', tokens: '100,000', icon: <Crown className="text-amber-400" />, desc: 'חיוב שנתי ($11.90 לחודש)' }
  ];

  // טעינת ה-SDK של פייפאל ברגע שהדף עולה
  useEffect(() => {
    const scriptId = "paypal-sdk-script";
    if (document.getElementById(scriptId)) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, []);

  // פונקציה ליצירת הכפתור עבור כל מסלול
  const initPayPalButton = (planId: string, price: string) => {
    const container = document.getElementById(`paypal-container-${planId}`);
    // @ts-ignore
    if (window.paypal && container && !container.hasChildNodes()) {
      // @ts-ignore
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
        createOrder: (data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{
              description: `LingoLive Pro - ${planId}`,
              amount: { value: price }
            }]
          });
        },
        onApprove: async (data: any, actions: any) => {
          await actions.order.capture();
          onPlanSelect(planId); // מעבר לאתר לאחר תשלום מוצלח
        },
        onError: () => alert("שגיאה בתשלום פייפאל")
      }).render(`#paypal-container-${planId}`);
    }
  };

  // מפעיל את הכפתורים ברגע שה-SDK מוכן
  useEffect(() => {
    if (sdkReady) {
      plans.filter(p => p.id !== 'FREE').forEach(p => initPayPalButton(p.id, p.price));
    }
  }, [sdkReady]);

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") setIsSuccess(true);
    else alert("קוד לא תקין.");
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto pb-20">
      <div className="w-full max-w-[340px] mx-auto py-10 flex flex-col items-center">
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">שדרוג מנוי</h1>
        <p className="text-slate-400 text-[9px] font-bold mb-8 text-center uppercase tracking-widest">Secure Payment via PayPal</p>

        <div className="w-full space-y-4 mb-10">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-[2rem] p-5 shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xl">{plan.icon}</div>
                <div className="text-left font-black text-xl text-white">${plan.price}</div>
              </div>
              <h2 className="text-lg font-black text-white mb-1 uppercase tracking-tight">{plan.name}</h2>
              <p className="text-indigo-400 text-[11px] font-black mb-1">{plan.tokens} טוקנים</p>
              {plan.desc && <p className="text-slate-500 text-[8px] mb-4 font-bold italic">{plan.desc}</p>}
              
              {plan.id === 'FREE' ? (
                <button 
                  onClick={() => onPlanSelect('FREE')} 
                  className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-black text-sm transition-all active:scale-95"
                >
                  המשך בחינם
                </button>
              ) : (
                <div id={`paypal-container-${plan.id}`} className="mt-2 min-h-[45px]">
                  {!sdkReady && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="animate-spin text-indigo-500" size={20} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* קוד הטבה */}
        <div className="w-full bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 text-center">
          {!isSuccess ? (
            <div className="flex flex-col gap-3">
              <span className="text-slate-400 font-black text-[10px] mb-1">יש לך קוד הטבה?</span>
              <input 
                type="text" placeholder="הכנס קוד" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-center font-bold text-sm"
                value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
              />
              <button onClick={handleRedeem} className="w-full bg-slate-800 py-2 rounded-xl font-black text-xs">הפעל</button>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={20} className="text-emerald-500" />
              </div>
              <button onClick={() => onPlanSelect('PRO')} className="w-full bg-indigo-600 py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg shadow-lg shadow-indigo-500/30">
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
