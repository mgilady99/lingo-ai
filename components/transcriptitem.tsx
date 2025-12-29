import React from 'react';

interface TranscriptEntry {
  role: string;
  text: string;
  timestamp?: Date;
}

interface TranscriptItemProps {
  entry: TranscriptEntry;
}

const TranscriptItem: React.FC<TranscriptItemProps> = ({ entry }) => {
  // פונקציה בטוחה שלא תקריס את האפליקציה אם התאריך חסר
  const formatTime = (date?: Date) => {
    if (!date) return '';
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const isUser = entry.role === 'user';

  return (
    <div className={`flex flex-col gap-1 p-3 rounded-2xl max-w-[90%] ${isUser ? 'bg-indigo-600/20 self-start mr-auto border border-indigo-500/30' : 'bg-slate-800/60 self-end ml-auto border border-slate-700'}`}>
      <div className="flex items-center justify-between gap-4">
        <span className={`text-[10px] font-black uppercase tracking-wider ${isUser ? 'text-indigo-400' : 'text-slate-400'}`}>
          {isUser ? 'YOU' : 'AI'}
        </span>
        <span className="text-[9px] text-slate-600 font-mono">
          {formatTime(entry.timestamp)}
        </span>
      </div>
      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
        {entry.text}
      </p>
    </div>
  );
};

export default TranscriptItem;
