// src/components/Admin.tsx
import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ads, setAds] = useState<any[]>([]);
  const [newAd, setNewAd] = useState({ title: '', target_url: '', image_url: '', is_active: true });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings').then(res => res.json()).then(data => {
      if (data.ads) setAds(data.ads);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setNewAd({ ...newAd, image_url: base64String });
        setPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveAds = async (updatedAds: any[]) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ads: updatedAds })
    });
    setAds(updatedAds);
  };

  const addAd = () => {
    if (!newAd.image_url) return alert("Please upload an image");
    const updated = [...ads, { ...newAd, slot_id: Date.now().toString() }];
    saveAds(updated);
    setNewAd({ title: '', target_url: '', image_url: '', is_active: true });
    setPreview(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-['Inter']" dir="ltr">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8"><ArrowLeft size={20}/> Back to App</button>
        <h1 className="text-3xl font-black mb-8 italic uppercase tracking-tighter">Ad Management</h1>

        {/* טופס הוספה עם העלאת תמונה */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 mb-8 shadow-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus size={20}/> Create New Ad</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input type="text" placeholder="Ad Title" value={newAd.title} onChange={e => setNewAd({...newAd, title: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3"/>
              <input type="text" placeholder="Target URL (https://...)" value={newAd.target_url} onChange={e => setNewAd({...newAd, target_url: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3"/>
              
              <div className="relative group">
                <input type="file" id="ad-image" accept="image/*" onChange={handleFileChange} className="hidden"/>
                <label htmlFor="ad-image" className="flex items-center justify-center gap-2 w-full bg-indigo-600/20 border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 py-6 rounded-xl cursor-pointer transition-all">
                  <Upload size={20} className="text-indigo-400"/>
                  <span className="font-bold text-indigo-400">Click to Upload Image</span>
                </label>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-slate-800/50 rounded-2xl border border-white/5 p-4 min-h-[200px]">
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 rounded-lg shadow-xl"/>
              ) : (
                <span className="text-slate-500 text-sm">Image Preview</span>
              )}
            </div>
          </div>
          <button onClick={addAd} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-500/20">Add Advertisement</button>
        </div>

        {/* רשימת פרסומות קיימות */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ads.map((ad, index) => (
            <div key={ad.slot_id} className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <img src={ad.image_url} className="w-16 h-16 object-cover rounded-lg"/>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{ad.title}</h3>
                <p className="text-xs text-slate-500 truncate">{ad.target_url}</p>
              </div>
              <button onClick={() => saveAds(ads.filter((_, i) => i !== index))} className="text-red-500 p-2 hover:bg-red-500/10 rounded-full"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
