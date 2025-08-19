import React from 'react';
import { X } from 'lucide-react';

interface GrapePopupProps {
  isOpen: boolean;
  onClose: () => void;
  grapeData?: {
    linkIndex: number;
    clusterIndex: number;
    grapeIndex: number;
    sourceArtist: string;
    targetArtist: string;
  };
}

export default function GrapePopup({
  isOpen,
  onClose,
  grapeData,
}: GrapePopupProps) {
  // Handle keyboard events (especially ESC key)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle overlay click to close
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Handle content click to prevent closing
  const handleContentClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed left-0 right-0 top-0 bottom-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      data-testid="overlay"
    >
      <div 
        className="relative bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden text-white"
        style={{
          boxShadow: '0 0 20px rgba(180, 39, 180, 0.3)',
          borderColor: '#b427b4'
        }}
        onClick={handleContentClick}
        data-testid="popup-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white">
            Grape Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200 text-gray-400 hover:text-white"
            aria-label="Close popup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center text-gray-300">
            <p>Grape popup content will go here.</p>
            {grapeData && (
              <div className="mt-4 text-sm text-gray-400">
                <p>Link: {grapeData.sourceArtist} → {grapeData.targetArtist}</p>
                <p>Cluster: {grapeData.clusterIndex}, Grape: {grapeData.grapeIndex}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
