
import React from 'react';
import { TranscriptionEntry } from '../types';
import { CheckCircle } from 'lucide-react';

interface TranscriptItemProps {
  entry: TranscriptionEntry;
}

const TranscriptItem: React.FC<TranscriptItemProps> = ({ entry }) => {
  const isUser = entry.role === 'user';
  // Check for Hebrew characters to determine text direction
  const isRtl = /[\u0590-\u05FF]/.test(entry.text);

  return (
    <div className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-500`}>
      <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-md transition-all ${
        isUser 
          ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500' 
          : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
      }`}>
        <p className={`leading-relaxed ${isRtl ? 'text-right' : 'text-left'} text-sm md:text-base`} dir={isRtl ? 'rtl' : 'ltr'}>
          {entry.text}
        </p>
        
        {entry.correction && (
          <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-emerald-100 text-[11px] leading-snug">{entry.correction}</p>
          </div>
        )}

        <div className={`text-[9px] mt-1 opacity-50 ${isUser ? 'text-right' : 'text-left'}`}>
          {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
