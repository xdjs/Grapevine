import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Network } from 'lucide-react';
import { NetworkNode } from '../../../shared/schema';

interface MobileNodeActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  nodeData: NetworkNode | null;
  onGoToMusicNerd: () => void;
  onSeeNetworkMap: () => void;
  showNetworkOption: boolean; // Hide network option for main artist
}

export default function MobileNodeActionModal({
  isOpen,
  onClose,
  artistName,
  nodeData,
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

  // Generate node information similar to tooltip
  const getNodeInfo = () => {
    if (!nodeData) return null;
    
    const roles = nodeData.types || [nodeData.type];
    const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
    
    return {
      roles,
      roleDisplay,
      hasCollaborations: nodeData.collaborations && nodeData.collaborations.length > 0,
      collaborations: nodeData.collaborations || []
    };
  };

  const nodeInfo = getNodeInfo();

  // Debug log for modal opening
  if (isOpen && nodeData) {
    console.log(`📱 [Mobile Modal] Opening modal for: ${nodeData.name}`);
    console.log(`📱 [Mobile Modal] Node roles: ${nodeData.types || [nodeData.type]}`);
    console.log(`📱 [Mobile Modal] Node collaborations: ${nodeData.collaborations?.length || 0}`);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            {artistName}
          </DialogTitle>
        </DialogHeader>
        
        {/* Node Information */}
        {nodeInfo && (
          <div className="text-white text-sm space-y-2 mt-4">
            <div>
              <span className="text-gray-300">Role{nodeInfo.roles.length > 1 ? 's' : ''}: </span>
              <span className="font-medium">{nodeInfo.roleDisplay}</span>
            </div>
            
            {nodeInfo.hasCollaborations && (
              <div>
                <span className="text-gray-300">
                  {nodeInfo.roles.includes('producer') || nodeInfo.roles.includes('songwriter') 
                    ? 'Top Collaborations:' 
                    : 'Recent Collaborations:'}
                </span>
                <div className="mt-1 text-xs text-gray-400">
                  {nodeInfo.collaborations.slice(0, 3).map((collaboration, index) => (
                    <div key={index}>• {collaboration}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Action buttons only for artist nodes */}
        {nodeInfo && nodeInfo.roles.includes('artist') && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}