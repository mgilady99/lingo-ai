import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Globe, Users, Lock, ArrowRight, BarChart, Search } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ads, setAds] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_users: 0 });
  const [newPass, setNewPass] = useState('');

  // שדות SEO וניהול
  const [seoSettings, setSeoSettings] = useState({
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    google_analytics_id: '',
    google_console_id: ''
  });

  // טעינת נתונים
  useEffect(() => {
    fetch('/api/admin/settings').then(res => res.json()).then(data => {
      setAds(data.ads || []);
      if (data.stats) setStats(data.stats);
      
      const newSettings = { ...seoSettings };
      data.settings?.forEach((s: any) => {
        if (Object.keys(newSettings).includes(s.key)) {
          // @ts-ignore
          newSettings[s.key] = s.value;
        }
      });
      setSeoSettings(newSettings);
    });
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ type: 'SETTING', data: { key, value } })
    });
  };

  const saveAllSEO = async () => {
    for (const [key, value] of Object.entries(seoSettings)) {
      await saveSetting(key, value);
    }
    alert('כל הגדרות ה-SEO והקודים נשמרו בהצלחה!');
  };

  const saveAd = async (ad: any) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ type: 'AD', data: ad })
    });
    alert('הפרסומת עודכנה!');
  };

  const changePassword = async () => {
    if(!newPass || newPass.length < 4) { alert("סיסמה קצרה מדי"); return; }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST', body: JSON.stringify({ email: 'mgilady@gmail.com', newPassword: newPass })
    });
    if(res.ok) { alert('הסיסמה שונתה!'); setNewPass(''); }
    else alert('שגיאה');
  };

  return (
    // התיקון נמצא בשורה הזו: h-screen overflow-y-auto
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 rtl font-['Inter'] p-8 scrollbar-thin scrollbar-thumb-indigo-600 scrollbar-track-slate-900">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
        <ArrowRight size={18}/> חזרה לאתר
      </button>
      
      <h1 className="text-3xl font-black mb-8 flex items-center gap-2 text-indigo-400">
        <Users className="text-indigo-500" /> פאנל ניהול מתקדם
      </h1>

      <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 mb-8 inline-block shadow-lg">
        <p className="text-slate-400 text-xs font-bold uppercase mb-1">סה"כ משתמשים רשומים</p>
        <p className="text-4xl font-black text-white">{stats.total_users}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* אזור SEO ואינטגרציות */}
        <section className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 space-y-4">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe size={20} className="text-blue-400"/> SEO וכלים לניהול אתרים</h2>
          
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">כותרת האתר (Title)</label>
            <input 
              value={seoSettings.seo_title} 
              onChange={e => setSeoSettings({...seoSettings, seo_title: e.target.value})}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">תיאור האתר (Meta Description)</label>
            <textarea 
              value={seoSettings.seo_description} 
              onChange={e => setSeoSettings({...seoSettings, seo_description: e.target.value})}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none h-20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">מילות מפתח (Keywords)</label>
            <input 
              value={seoSettings.seo_keywords} 
              onChange={e => setSeoSettings({...seoSettings, seo_keywords: e.target.value})}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none"
              placeholder="לימוד אנגלית, AI, תרגום סימולטני..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
            <div>
               <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><BarChart size={12}/> Google Analytics ID</label>
               <input 
                 value={seoSettings.google_analytics_id} 
                 onChange={e => setSeoSettings({...seoSettings, google_analytics_id: e.target.value})}
                 className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-orange-500 outline-none dir-ltr"
                 placeholder="G-XXXXXXXXXX"
               />
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Search size={12}/> Google Verification Token</label>
               <input 
                 value={seoSettings.google_console_id} 
                 onChange={e => setSeoSettings({...seoSettings, google_console_id: e.target.value})}
                 className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-green-500 outline-none dir-ltr"
                 placeholder="קוד אימות מ-Search Console"
               />
            </div>
          </div>

          <button onClick={saveAllSEO} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white shadow-lg mt-4">שמור הגדרות SEO וקודים</button>
        </section>

        {/* אבטחה וסיסמה */}
        <section className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 h-fit">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock size={20}/> אבטחת מנהל</h2>
          <div className="flex gap-2 flex-col">
            <input 
              type="password" placeholder="הזן סיסמה חדשה" 
              className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors"
              value={newPass} onChange={(e) => setNewPass(e.target.value)}
            />
            <button onClick={changePassword} className="bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white px-6 py-3 rounded-xl font-bold transition-all">עדכן סיסמה</button>
          </div>
        </section>
      </div>

      {/* ניהול פרסומות */}
      <section className="pb-20"> {/* הוספתי ריפוד למטה כדי שיהיה נוח לגלול עד הסוף */}
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-emerald-400"/> ניהול פרסומות (סרגל צד)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(id => {
            const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
            return (
              <div key={id} className="bg-slate-900 p-5 rounded-3xl border border-white/10 flex flex-col gap-3 shadow-xl hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">מיקום {id}</span>
                <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-white" defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="כותרת" />
                <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="URL תמונה" />
                <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.target_url} onBlur={e => ad.target_url = e.target.value} placeholder="URL יעד" />
                <button onClick={() => saveAd(ad)} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black shadow-lg">עדכן</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Admin;
