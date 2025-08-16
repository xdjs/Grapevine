import React, { useEffect, useState } from 'react';
import { X, Lightbulb } from 'lucide-react';

interface FloatingFactsBoxProps {
  isVisible: boolean;
  facts: string[];
  artistName: string;
  onClose: () => void;
}

export default function FloatingFactsBox({ isVisible, facts, artistName, onClose }: FloatingFactsBoxProps) {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Rotate through facts every 8 seconds
  useEffect(() => {
    if (!isVisible || facts.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % facts.length);
        setIsAnimating(false);
      }, 300);
    }, 8000);

    return () => clearInterval(interval);
  }, [isVisible, facts.length]);

  if (!isVisible || facts.length === 0) return null;

  return (
    <div className="fixed top-32 left-4 z-20 max-w-xs">
      <div className="bg-gray-900/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-medium">Fun Facts</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-700/50"
            title="Close facts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Artist Name */}
        <div className="text-white font-medium text-sm mb-2">
          About {artistName}
        </div>

        {/* Current Fact */}
        <div className="text-gray-100 text-sm leading-relaxed">
          <div 
            className={`transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
          >
            {facts[currentFactIndex]}
          </div>
        </div>

        {/* Fact Counter */}
        {facts.length > 1 && (
          <div className="flex justify-center mt-3">
            <div className="flex gap-1">
              {facts.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentFactIndex 
                      ? 'bg-yellow-400' 
                      : 'bg-gray-500'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
