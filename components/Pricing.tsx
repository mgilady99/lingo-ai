import React, { useState, useEffect, useRef } from 'react';
import { Check, Zap, Crown, Ticket, ArrowLeft } from 'lucide-react';

interface PricingProps {
  onPlanSelect: (plan: string) => void;
  userEmail?: string;
}

const Pricing: React.FC<PricingProps> = ({ onPlanSelect, userEmail }) => {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  
  const premiumBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.paypal) {
        setPaypalLoaded(true);
        return;
    }
    const script = document.createElement("script");
    const clientId = "AWmyrNxDvPJHZjVa8ZJOaUdPZ1m5K-WnCu_jl0IYq4TGotsi0RinsrX1cV8K80H2pXrL20mUvEXnTRTY";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (paypalLoaded && window.paypal && premiumBtnRef.current) {
        premiumBtnRef.current.innerHTML = "";
        window.paypal.Buttons({
            style: { layout: 'horizontal', height: 45, tagline: false, shape: 'pill', label: 'pay' },
            createOrder: (data: any, actions: any) => {
                return actions.order.create({
                    purchase_units: [{
                        description: "LingoLive Premium (Monthly)",
                        // כאן שינינו למחיר חודשי
                        amount: { value: "11.90", currency_code: "USD" }
                    }]
                });
            },
            onApprove: handlePaymentSuccess,
            onError: (err: any) => console.error(err)
        }).render(premiumBtnRef.current);
    }
  }, [paypalLoaded]);

  const handlePaymentSuccess = async (data: any, actions: any) => {
      await actions.order.capture();
      if (!userEmail) return;
      try {
          const res = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, promoCode: 'PAYPAL_SUCCESS_BYPASS' }) 
          });
          
          if (res.ok) {
              alert("תודה! המנוי שודרג.");
              onPlanSelect('PRO');
          } else {
              alert("התשלום עבר, אך הייתה שגיאה בעדכון המנוי.");
          }
      } catch(e) { alert("שגיאת תקשורת."); }
  };

  const handlePromoCode = async () => {
    if (!promoCode) return;
    if (!userEmail) { alert("שגיאה בזיהוי משתמש"); return; }
    setLoading(true);
    try {
      const cleanCode = promoCode.replace(/\s/g, '').toLowerCase();
      const res = await fetch('/api/upgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, promoCode: cleanCode })
      });
      if (res.ok) {
        alert("הקוד התקבל!");
        onPlanSelect('PRO');
      } else {
        alert("קוד לא תקין");
      }
    } catch (e) { alert("שגיאת תקשורת"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-8 flex flex-col items-center gap-8 bg-[#0f172a] rtl font-['Inter'] text-white">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white">בחר מסלול</h2>
        <p className="text-slate-400">התחל בחינם או שדרג למקצוענים</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* --- כרטיס FREE (הוחזר) --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 flex flex-col items-center text-center shadow-lg hover:border-white/20 transition-all">
          <div className="bg-slate-800 p-4 rounded-full mb-4"><Zap size={24} className="text-slate-400"/></div>
          <h3 className="text-xl font-bold mb-2">Free Starter</h3>
          <div className="text-3xl font-black mb-1">₪0</div>
          <p className="text-slate-400 text-xs mb-6">ללא עלות</p>
          <ul className="space-y-3 mb-8 text-slate-300 text-sm w-full">
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-green-400"/> 10,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-green-400"/> התנסות במערכת</li>
          </ul>
          {/* כפתור כניסה חינם */}
          <button 
            onClick={() => onPlanSelect('FREE')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
          >
             התחל בחינם <ArrowLeft size={16}/>
          </button>
        </div>

        {/* --- כרטיס PREMIUM (חודשי) --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-indigo-500 relative flex flex-col items-center text-center shadow-2xl shadow-indigo-500/20 transform md:-translate-y-4">
          <div className="absolute -top-4 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">מומלץ</div>
          <div className="bg-indigo-600/20 p-4 rounded-full mb-4"><Crown size={24} className="text-indigo-400"/></div>
          <h3 className="text-xl font-bold mb-2 text-white">PREMIUM</h3>
          {/* מחיר חודשי */}
          <div className="text-3xl font-black mb-1 text-white">$11.90</div>
          <p className="text-slate-400 text-xs mb-6">חיוב חודשי</p>
          <ul className="space-y-3 mb-8 text-indigo-100 text-sm w-full">
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> 100,000 טוקנים</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> מודל חכם ומהיר</li>
            <li className="flex items-center gap-2 justify-center"><Check size={14} className="text-indigo-400"/> ללא פרסומות</li>
          </ul>
           {/* כפתור פייפל */}
           <div className="w-full h-[45px] relative z-0 flex justify-center">
             <div ref={premiumBtnRef} className="w-full"></div>
             {!paypalLoaded && <span className="text-xs text-slate-500">טוען...</span>}
          </div>
        </div>
      </div>

      {/* אזור קוד הטבה */}
      <div className="w-full max-w-md bg-slate-900/80 p-6 rounded-2xl border border-white/10 mt-4 backdrop-blur-sm">
        <label className="text-sm font-bold text-slate-400 mb-2 block flex items-center gap-2">
            <Ticket size={16} className="text-indigo-400"/> קוד הטבה
        </label>
        <div className="flex gap-2">
            <input 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="home11111"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 text-center"
            />
            <button onClick={handlePromoCode} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-bold text-white transition-all disabled:opacity-50">
                {loading ? '...' : 'הפעל'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
