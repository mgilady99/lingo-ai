import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Globe, Users, Lock, ArrowRight, Ticket, AlertTriangle, Settings } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'CODES'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // נתונים עם ערכי ברירת מחדל כדי למנוע קריסה
  const [ads, setAds] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_users: 0 });
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [newPass, setNewPass] = useState('');

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
        setError(null);

        // 1. נסיון לטעון הגדרות
        try {
            const settingsRes = await fetch('/api/admin/settings');
            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setAds(data.ads || []);
                setStats(data.stats || { total_users: 0 });
                
                // טעינת SEO בזהירות
                const newSettings = { ...seoSettings };
                if (data.settings && Array.isArray(data.settings)) {
                    data.settings.forEach((s: any) => {
                        // @ts-ignore
                        if (newSettings[s.key] !== undefined) newSettings[s.key] = s.value;
                    });
                }
                setSeoSettings(newSettings);
            } else {
                console.error("Settings API failed");
            }
        } catch (e) { console.error("Settings fetch error", e); }

        // 2. נסיון לטעון קודים
        try {
            const codesRes = await fetch('/api/admin/codes');
            if (codesRes.ok) {
                const codesData = await codesRes.json();
                setPromoCodes(Array.isArray(codesData) ? codesData : []);
            } else {
                console.warn("Codes API failed - maybe file is missing?");
            }
        } catch (e) { console.error("Codes fetch error", e); }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const saveAd = async (ad: any) => {
    try {
        await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'AD', data: ad }) });
        alert('נשמר!');
    } catch(e) { alert('שגיאה'); }
  };

  const saveAllSEO = async () => {
      try {
        for (const [key, value] of Object.entries(seoSettings)) {
            await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'SETTING', data: { key, value } }) });
        }
        alert('הגדרות נשמרו');
      } catch(e) { alert('שגיאה'); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white"><h1>טוען נתונים...</h1></div>;

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 rtl font-['Inter'] p-8">
      {/* כותרת */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-indigo-400">פאנל ניהול</h1>
        <button onClick={onBack} className="bg-slate-800 px-4 py-2 rounded-xl border border-white/10 hover:bg-slate-700">חזרה לאתר</button>
      </div>

      {/* תפריט */}
      <div className="flex gap-4 mb-8">
        <button onClick={() => setActiveTab('SETTINGS')} className={`px-6 py-3 rounded-xl font-bold ${activeTab === 'SETTINGS' ? 'bg-indigo-600' : 'bg-slate-800'}`}>הגדרות</button>
        <button onClick={() => setActiveTab('CODES')} className={`px-6 py-3 rounded-xl font-bold ${activeTab === 'CODES' ? 'bg-indigo-600' : 'bg-slate-800'}`}>קודים ({promoCodes.length})</button>
      </div>

      {/* אזור שגיאה אם יש */}
      {error && <div className="bg-red-900/50 p-4 rounded-xl mb-4 border border-red-500 text-red-200">שגיאה כללית: {error}</div>}

      {/* לשונית קודים */}
      {activeTab === 'CODES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {promoCodes.length === 0 && <p className="text-slate-500">לא נמצאו קודים (או שהקובץ api/admin/codes חסר)</p>}
            {promoCodes.map((c) => (
                <div key={c.code} className={`p-4 border rounded-xl ${c.is_used ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
                    <span className="font-mono font-bold block">{c.code}</span>
                    <span className="text-xs">{c.is_used ? 'נוצל' : 'פנוי'}</span>
                </div>
            ))}
        </div>
      )}

      {/* לשונית הגדרות */}
      {activeTab === 'SETTINGS' && (
        <div className="space-y-8">
            <div className="bg-slate-900 p-6 rounded-2xl border border-white/10">
                <h2 className="text-xl font-bold mb-4">משתמשים רשומים: {stats.total_users}</h2>
            </div>
            
            {/* פרסומות */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(id => {
                const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
                return (
                  <div key={id} className="bg-slate-900 p-4 rounded-xl border border-white/10 flex flex-col gap-2">
                    <span className="text-emerald-400 font-bold text-xs">מיקום {id}</span>
                    <input className="bg-black/30 p-2 rounded text-white text-xs" defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="כותרת" />
                    <input className="bg-black/30 p-2 rounded text-white text-xs dir-ltr" defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="URL תמונה" />
                    <input className="bg-black/30 p-2 rounded text-white text-xs dir-ltr" defaultValue={ad.target_url} onBlur={e => ad.target_url = e.target.value} placeholder="URL יעד" />
                    <button onClick={() => saveAd(ad)} className="bg-emerald-600 text-white py-1 rounded text-xs font-bold">שמור</button>
                  </div>
                );
              })}
            </div>

            {/* SEO */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-white/10">
                <h3 className="font-bold mb-4">SEO</h3>
                <div className="space-y-3">
                    <input value={seoSettings.seo_title} onChange={e => setSeoSettings({...seoSettings, seo_title: e.target.value})} className="w-full bg-black/30 p-3 rounded-xl border border-white/5" placeholder="כותרת אתר" />
                    <button onClick={saveAllSEO} className="bg-blue-600 px-6 py-2 rounded-xl font-bold">שמור הגדרות</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
