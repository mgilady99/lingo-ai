import React from 'react';

interface AvatarProps { state: 'idle' | 'listening' | 'speaking'; }

const Avatar: React.FC<AvatarProps> = ({ state }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full border-4 border-indigo-500/20 ${state !== 'idle' ? 'animate-pulse' : ''}`} />
      <div className={`w-48 h-48 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-500 ${state === 'speaking' ? 'scale-110' : 'scale-100'}`}>
        <img 
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop" 
          alt="AI Assistant" 
          className={`w-full h-full object-cover transition-opacity duration-500 ${state === 'idle' ? 'opacity-80' : 'opacity-100'}`}
        />
      </div>
      {state === 'listening' && <div className="absolute -bottom-2 px-4 py-1 bg-green-500 text-white text-[10px] font-bold rounded-full animate-bounce">Listening...</div>}
    </div>
  );
};

export default Avatar;
