import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Globe, Users, Lock, ArrowRight, Ticket, AlertTriangle, Settings, Activity, Download, FileSpreadsheet } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'CODES' | 'USERS'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // נתונים
  const [ads, setAds] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]); // רשימת המשתמשים
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  
  // שדות SEO
  const [seoSettings, setSeoSettings] = useState({
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    google_analytics_id: '',
    google_console_id: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // טעינת הגדרות ומשתמשים
        const settingsRes = await fetch('/api/admin/settings');
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            setAds(Array.isArray(data.ads) ? data.ads : []);
            setUsersList(Array.isArray(data.users) ? data.users : []); // שמירת רשימת המשתמשים
            
            const newSettings = { ...seoSettings };
            if (data.settings && Array.isArray(data.settings)) {
                data.settings.forEach((s: any) => {
                    // @ts-ignore
                    if (newSettings[s.key] !== undefined) newSettings[s.key] = s.value;
                });
            }
            setSeoSettings(newSettings);
        }
        // טעינת קודים
        try {
            const codesRes = await fetch('/api/admin/codes');
            if (codesRes.ok) setPromoCodes(await codesRes.json());
        } catch (e) {}

      } catch (err: any) { setError(err.message); } 
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  const saveAd = async (ad: any) => {
    await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'AD', data: ad }) });
    alert('הפרסומת עודכנה!');
  };

  const saveAllSEO = async () => {
      for (const [key, value] of Object.entries(seoSettings)) {
          await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'SETTING', data: { key, value } }) });
      }
      alert('הגדרות SEO נשמרו בהצלחה!');
  };

  // --- פונקציה לייצוא לאקסל (CSV) ---
  const downloadUsersCSV = () => {
    // כותרות
    const headers = ['Email', 'Plan', 'Role', 'Tokens Used'];
    
    // המרת הנתונים לשורות
    const csvContent = [
      headers.join(','), // שורת כותרת
      ...usersList.map(u => [u.email, u.plan, u.role, u.tokens_used].join(',')) // שורות מידע
    ].join('\n');

    // יצירת קובץ להורדה
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lingolive_users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">טוען...</div>;

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 rtl font-['Inter'] p-8">
      {/* כותרת */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-indigo-400">פאנל ניהול</h1>
        <button onClick={onBack} className="bg-slate-800 px-4 py-2 rounded-xl border border-white/10 hover:bg-slate-700">חזרה לאתר</button>
      </div>

      {/* תפריט */}
      <div className="flex gap-4 mb-8 border-b border-white/10 pb-4 overflow-x-auto">
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Settings size={18}/> הגדרות
        </button>
        <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Users size={18}/> משתמשים ({usersList.length})
        </button>
        <button onClick={() => setActiveTab('CODES')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'CODES' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Ticket size={18}/> קודים ({promoCodes.length})
        </button>
      </div>

      {/* לשונית משתמשים (חדשה) */}
      {activeTab === 'USERS' && (
        <div className="animate-in fade-in">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">רשימת משתמשים</h2>
              <button onClick={downloadUsersCSV} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                  <FileSpreadsheet size={20}/> ייצוא לאקסל
              </button>
           </div>
           
           <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
               <div className="overflow-x-auto">
                   <table className="w-full text-right">
                       <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-bold">
                           <tr>
                               <th className="px-6 py-4">אימייל</th>
                               <th className="px-6 py-4">תוכנית</th>
                               <th className="px-6 py-4">תפקיד</th>
                               <th className="px-6 py-4">שימוש (Tokens)</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                           {usersList.map((user, idx) => (
                               <tr key={idx} className="hover:bg-slate-800/50 transition-colors text-sm font-medium">
                                   <td className="px-6 py-4 dir-ltr text-right font-mono text-indigo-300">{user.email}</td>
                                   <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${user.plan === 'PRO' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-300'}`}>{user.plan}</span></td>
                                   <td className="px-6 py-4 text-slate-400">{user.role}</td>
                                   <td className="px-6 py-4 text-slate-400 font-mono">{user.tokens_used}</td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           </div>
        </div>
      )}

      {/* לשונית קודים */}
      {activeTab === 'CODES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in">
            {promoCodes.map((c) => (
                <div key={c.code} className={`p-4 border rounded-xl flex justify-between items-center ${c.is_used ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
                    <span className="font-mono font-bold text-lg">{c.code}</span>
                    <span className="text-xs font-bold uppercase">{c.is_used ? 'משומש' : 'פנוי'}</span>
                </div>
            ))}
        </div>
      )}

      {/* לשונית הגדרות */}
      {activeTab === 'SETTINGS' && (
        <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in">
            
            {/* סטטיסטיקה מקוצרת */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-white/10 flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={() => setActiveTab('USERS')}>
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-full text-blue-400"><Users size={24}/></div>
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase">סה"כ רשומים</p>
                        <p className="text-3xl font-black text-white">{usersList.length}</p>
                    </div>
                </div>
                <ArrowRight className="text-slate-600"/>
            </div>

            {/* SEO */}
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Globe/> הגדרות SEO וכלים</h3>
                <div className="space-y-5">
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">כותרת האתר (Title)</label>
                        <input value={seoSettings.seo_title} onChange={e => setSeoSettings({...seoSettings, seo_title: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors" placeholder="למשל: LingoLive - לימוד אנגלית עם AI" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">תיאור האתר (Meta Description)</label>
                        <textarea value={seoSettings.seo_description} onChange={e => setSeoSettings({...seoSettings, seo_description: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors h-24 resize-none" placeholder="תיאור שיופיע בגוגל..." />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">מילות מפתח (Keywords)</label>
                        <input value={seoSettings.seo_keywords} onChange={e => setSeoSettings({...seoSettings, seo_keywords: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors" placeholder="אנגלית, לימוד, AI..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div>
                            <label className="block text-sm font-bold text-slate-400 mb-2 flex items-center gap-2"><Activity size={14}/> Google Analytics ID</label>
                            <input value={seoSettings.google_analytics_id} onChange={e => setSeoSettings({...seoSettings, google_analytics_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white dir-ltr font-mono text-sm" placeholder="G-XXXXXXXXXX" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-400 mb-2 flex items-center gap-2"><Globe size={14}/> Google Console ID</label>
                            <input value={seoSettings.google_console_id} onChange={e => setSeoSettings({...seoSettings, google_console_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white dir-ltr font-mono text-sm" placeholder="Verification Code" />
                        </div>
                    </div>

                    <button onClick={saveAllSEO} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 transition-transform active:scale-95">שמור הגדרות SEO</button>
                </div>
            </div>
            
            {/* פרסומות */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
              {[1, 2, 3, 4].map(id => {
                const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
                return (
                  <div key={id} className="bg-slate-900 p-5 rounded-3xl border border-white/10 flex flex-col gap-3 shadow-lg">
                    <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">פרסומת {id}</span>
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-white" defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="כותרת" />
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="URL תמונה" />
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.target_url} onBlur={e => ad.target_url = e.target.value} placeholder="URL יעד" />
                    <button onClick={() => saveAd(ad)} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black">עדכן</button>
                  </div>
                );
              })}
            </div>

        </div>
      )}
    </div>
  );
};

export default Admin;
