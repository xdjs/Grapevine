import React from 'react';
import { Lightbulb } from 'lucide-react';

interface FactModeButtonProps {
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function FactModeButton({ isActive, onToggle, disabled = false }: FactModeButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        fixed top-20 left-4 z-30 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
        flex items-center gap-2 shadow-lg
        ${isActive 
          ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/30' 
          : 'bg-gray-800/80 text-white hover:bg-gray-700/80 border border-gray-600/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
      `}
      title={isActive ? 'Fact Mode Active - Click to disable' : 'Enable Fact Mode - Click on collaborators to see fun facts'}
    >
      <Lightbulb className={`w-4 h-4 ${isActive ? 'text-black' : 'text-yellow-400'}`} />
      Fact Mode
      {isActive && (
        <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
      )}
    </button>
  );
}
