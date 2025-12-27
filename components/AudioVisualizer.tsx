import React from 'react';

const AudioVisualizer: React.FC<{ isActive: boolean; color: string }> = ({ isActive, color }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className={`w-1 rounded-full transition-all duration-300`}
          style={{ 
            backgroundColor: color,
            height: isActive ? `${Math.random() * 100}%` : '4px',
            opacity: isActive ? 0.8 : 0.2
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;
