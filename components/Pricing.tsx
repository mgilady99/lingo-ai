import React, { useState, useEffect, useRef } from 'react';
import { Check, Zap, Crown, Ticket, Star, Rocket } from 'lucide-react';

interface PricingProps {
  onPlanSelect: (plan: string) => void;
  userEmail?: string;
}

const Pricing: React.FC<PricingProps> = ({ onPlanSelect, userEmail }) => {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  
  const basicBtnRef = useRef<HTMLDivElement>(null);
  const advancedBtnRef = useRef<HTMLDivElement>(null);
  const premiumBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.paypal) { setPaypalLoaded(true); return; }
    const script = document.createElement("script");
    const clientId = "AWmyrNxDvPJHZjVa8ZJOaUdPZ1m5K-WnCu_jl0IYq4TGotsi0RinsrX1cV8K80H2pXrL20mUvEXnTRTY";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (paypalLoaded && window.paypal) {
        const btnStyle = { layout: 'horizontal', height: 35, tagline: false, shape: 'pill', label: 'pay' };

        // 1. BASIC ($3.90)
        if (basicBtnRef.current) {
            basicBtnRef.current.innerHTML = "";
            window.paypal.Buttons({
                style: btnStyle,
                createOrder: (d: any, actions: any) => actions.order.create({
                    purchase_units: [{ description: "Basic Plan (20k Tokens)", amount: { value: "3.90", currency_code: "USD" } }]
                }),
                onApprove: (d:any, a:any) => handlePaymentSuccess(a, 'PAYPAL_BASIC')
            }).render(basicBtnRef.current);
        }

        // 2. ADVANCED ($6.90)
        if (advancedBtnRef.current) {
            advancedBtnRef.current.innerHTML = "";
            window.paypal.Buttons({
                style: btnStyle,
                createOrder: (d: any, actions: any) => actions.order.create({
                    purchase_units: [{ description: "Advanced Plan (50k Tokens)", amount: { value: "6.90", currency_code: "USD" } }]
                }),
                onApprove: (d:any, a:any) => handlePaymentSuccess(a, 'PAYPAL_ADVANCED')
            }).render(advancedBtnRef.current);
        }

        // 3. PREMIUM ($11.90)
        if (premiumBtnRef.current) {
            premiumBtnRef.current.innerHTML = "";
            window.paypal.Buttons({
                style: btnStyle,
                createOrder: (d: any, actions: any) => actions.order.create({
                    purchase_units: [{ description: "Premium Plan (300k Tokens)", amount: { value: "11.90", currency_code: "USD" } }]
                }),
                onApprove: (d:any, a:any) => handlePaymentSuccess(a, 'PAYPAL_PREMIUM')
            }).render(premiumBtnRef.current);
        }
    }
  }, [paypalLoaded]);

  const handlePaymentSuccess = async (actions: any, type: string) => {
      await actions.order.capture();
      if (!userEmail) return;
      try {
          const res = await fetch('/api/upgrade', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, promoCode: type }) 
          });
          if (res.ok) { alert("תודה! המנוי שודרג בהצלחה."); onPlanSelect('PRO'); } 
          else { alert("שגיאה בעדכון המנוי."); }
      } catch(e) { alert("שגיאת תקשורת."); }
  };

  const handlePromoCode = async () => {
    if (!promoCode) return;
    if (!userEmail) { alert("שגיאה בזיהוי"); return; }
    setLoading(true);
    try {
      const cleanCode = promoCode.replace(/\s/g, '').toLowerCase();
      const res = await fetch('/api/upgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, promoCode: cleanCode })
      });
      if (res.ok) { alert("הקוד התקבל!"); onPlanSelect('PRO'); } 
      else { alert("קוד לא תקין"); }
    } catch (e) { alert("שגיאת תקשורת"); } finally { setLoading(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col items-center gap-6 bg-[#0f172a] rtl font-['Inter'] text-white">
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-black text-white">בחר מסלול</h2>
        <p className="text-slate-400 text-sm">גמישות מלאה. בטל בכל עת.</p>
      </div>

      {/* Grid של 4 כרטיסים */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full max-w-7xl px-2">
        
        {/* 1. FREE */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-white/10 flex flex-col items-center text-center hover:border-white/30 transition-all">
          <div className="bg-slate-800 p-3 rounded-full mb-3"><Zap size={20} className="text-slate-400"/></div>
          <h3 className="text-lg font-bold mb-1">Starter</h3>
          <div className="text-3xl font-black mb-1">₪0</div>
          <p className="text-slate-500 text-[10px] mb-4">ללא עלות</p>
          <ul className="space-y-2 mb-6 text-slate-300 text-xs w-full flex-1">
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-green-400"/> 10,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-green-400"/> התנסות במערכת</li>
          </ul>
          <button onClick={() => onPlanSelect('FREE')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl font-bold text-sm shadow-lg transition-all">התחל חינם</button>
        </div>

        {/* 2. BASIC ($3.90) */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-blue-500/30 flex flex-col items-center text-center hover:border-blue-500 transition-all">
          <div className="bg-blue-900/20 p-3 rounded-full mb-3"><Star size={20} className="text-blue-400"/></div>
          <h3 className="text-lg font-bold mb-1">Basic</h3>
          <div className="text-3xl font-black mb-1">$3.90</div>
          <p className="text-slate-500 text-[10px] mb-4">לחודש</p>
          <ul className="space-y-2 mb-6 text-slate-300 text-xs w-full flex-1">
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-blue-400"/> 20,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-blue-400"/> שימוש אישי קל</li>
          </ul>
          <div className="w-full h-[35px] relative z-0 flex justify-center"><div ref={basicBtnRef} className="w-full"></div></div>
        </div>

        {/* 3. ADVANCED ($6.90) */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-purple-500/30 flex flex-col items-center text-center hover:border-purple-500 transition-all">
          <div className="bg-purple-900/20 p-3 rounded-full mb-3"><Rocket size={20} className="text-purple-400"/></div>
          <h3 className="text-lg font-bold mb-1">Advanced</h3>
          <div className="text-3xl font-black mb-1">$6.90</div>
          <p className="text-slate-500 text-[10px] mb-4">לחודש</p>
          <ul className="space-y-2 mb-6 text-slate-300 text-xs w-full flex-1">
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-purple-400"/> 50,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-purple-400"/> ללומדים רציניים</li>
          </ul>
          <div className="w-full h-[35px] relative z-0 flex justify-center"><div ref={advancedBtnRef} className="w-full"></div></div>
        </div>

        {/* 4. PREMIUM ($11.90) */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-indigo-500 relative flex flex-col items-center text-center shadow-2xl shadow-indigo-500/20 transform scale-[1.02]">
          <div className="absolute -top-3 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">הכי משתלם</div>
          <div className="bg-indigo-600/20 p-3 rounded-full mb-3"><Crown size={20} className="text-indigo-400"/></div>
          <h3 className="text-lg font-bold mb-1 text-white">Premium</h3>
          <div className="text-3xl font-black mb-1 text-white">$11.90</div>
          <p className="text-slate-400 text-[10px] mb-4">לחודש</p>
          <ul className="space-y-2 mb-6 text-indigo-100 text-xs w-full flex-1">
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-indigo-400"/> 300,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-indigo-400"/> מודל חכם ומהיר</li>
            <li className="flex items-center gap-2 justify-center"><Check size={12} className="text-indigo-400"/> המשתלם ביותר!</li>
          </ul>
          <div className="w-full h-[35px] relative z-0 flex justify-center"><div ref={premiumBtnRef} className="w-full"></div></div>
        </div>

      </div>

      {/* קוד הטבה */}
      <div className="w-full max-w-sm bg-slate-900/80 p-4 rounded-xl border border-white/10 mt-4 backdrop-blur-sm">
        <label className="text-xs font-bold text-slate-400 mb-2 block flex items-center gap-2">
            <Ticket size={14} className="text-indigo-400"/> יש לך קוד?
        </label>
        <div className="flex gap-2">
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="home11111" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 text-center"/>
            <button onClick={handlePromoCode} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold text-white text-sm transition-all disabled:opacity-50">{loading ? '...' : 'הפעל'}</button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
