import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Globe, Users, Lock, ArrowRight } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ads, setAds] = useState<any[]>([]);
  const [seoTitle, setSeoTitle] = useState('');
  const [stats, setStats] = useState({ total_users: 0 });
  const [newPass, setNewPass] = useState('');

  // טעינת הנתונים בעליית הדף
  useEffect(() => {
    fetch('/api/admin/settings').then(res => res.json()).then(data => {
      setAds(data.ads || []);
      const title = data.settings?.find((s: any) => s.key === 'seo_title');
      if (title) setSeoTitle(title.value);
      if (data.stats) setStats(data.stats);
    });
  }, []);

  // שמירת פרסומת
  const saveAd = async (ad: any) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ type: 'AD', data: ad })
    });
    alert('הפרסומת עודכנה בהצלחה!');
  };

  // שמירת SEO
  const saveSEO = async () => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ type: 'SETTING', data: { key: 'seo_title', value: seoTitle } })
    });
    alert('הגדרות SEO נשמרו!');
  };

  // שינוי סיסמה
  const changePassword = async () => {
    if(!newPass || newPass.length < 4) {
      alert("סיסמה חייבת להכיל לפחות 4 תווים");
      return;
    }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'mgilady@gmail.com', newPassword: newPass })
    });
    if(res.ok) {
      alert('הסיסמה שונתה בהצלחה!');
      setNewPass('');
    } else {
      alert('שגיאה בשינוי סיסמה');
    }
  };

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-200 rtl font-['Inter'] overflow-y-auto">
      {/* כפתור חזרה לאתר */}
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
        <ArrowRight size={18}/> חזרה לאתר
      </button>
      
      <h1 className="text-3xl font-black mb-8 flex items-center gap-2 text-indigo-400">
        <Users className="text-indigo-500" /> פאנל ניהול ראשי
      </h1>

      {/* קוביות סטטיסטיקה */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 mb-8 inline-block shadow-lg">
        <p className="text-slate-400 text-xs font-bold uppercase mb-1">סה"כ משתמשים רשומים</p>
        <p className="text-4xl font-black text-white">{stats.total_users}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* הגדרות SEO */}
        <section className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe size={20} className="text-blue-400"/> הגדרות SEO</h2>
          <div className="flex gap-2">
            <input 
              value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
              placeholder="כותרת האתר (Page Title)"
            />
            <button onClick={saveSEO} className="bg-blue-600 hover:bg-blue-500 px-6 rounded-xl font-bold text-white shadow-lg">שמור</button>
          </div>
        </section>

        {/* אבטחה וסיסמה */}
        <section className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock size={20}/> אבטחה</h2>
          <div className="flex gap-2">
            <input 
              type="password" placeholder="הזן סיסמה חדשה" 
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors"
              value={newPass} onChange={(e) => setNewPass(e.target.value)}
            />
            <button onClick={changePassword} className="bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white px-6 rounded-xl font-bold transition-all">שנה</button>
          </div>
        </section>
      </div>

      {/* ניהול פרסומות */}
      <section>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-emerald-400"/> ניהול פרסומות (סרגל צד)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(id => {
            const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
            return (
              <div key={id} className="bg-slate-900 p-5 rounded-3xl border border-white/10 flex flex-col gap-3 shadow-xl hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">מיקום פרסומת {id}</span>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">כותרת</label>
                  <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-white focus:border-emerald-500 outline-none" 
                         defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="למשל: נדלן מסחרי" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">לינק לתמונה (URL)</label>
                  <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 focus:border-emerald-500 outline-none dir-ltr" 
                         defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="https://..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">לינק לאתר (יעד)</label>
                  <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 focus:border-emerald-500 outline-none dir-ltr" 
                         defaultValue={ad.target_url} onBlur={e => ad.target_url = e.target.value} placeholder="https://..." />
                </div>

                <button onClick={() => saveAd(ad)} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black shadow-lg active:scale-95 transition-all">
                  עדכן פרסומת
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Admin;
