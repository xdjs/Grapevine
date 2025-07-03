import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Network } from 'lucide-react';

interface MobileNodeActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  onGoToMusicNerd: () => void;
  onSeeNetworkMap: () => void;
  showNetworkOption: boolean; // Hide network option for main artist
}

export default function MobileNodeActionModal({
  isOpen,
  onClose,
  artistName,
  onGoToMusicNerd,
  onSeeNetworkMap,
  showNetworkOption,
}: MobileNodeActionModalProps) {
  const handleGoToMusicNerd = () => {
    onGoToMusicNerd();
    onClose();
  };

  const handleSeeNetworkMap = () => {
    onSeeNetworkMap();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            {artistName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleGoToMusicNerd}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-3 flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Go to MusicNerd page
          </Button>
          
          {showNetworkOption && (
            <Button
              onClick={handleSeeNetworkMap}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 flex items-center justify-center gap-2"
            >
              <Network className="w-4 h-4" />
              See their network map
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}