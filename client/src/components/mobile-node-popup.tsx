import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ExternalLink, Network } from "lucide-react";
import { NetworkNode } from "@/types/network";

interface MobileNodePopupProps {
  node: NetworkNode | null;
  isOpen: boolean;
  onClose: () => void;
  onExpandNetwork: (artistName: string) => void;
  onOpenMusicNerdProfile: (artistName: string, artistId?: string | null) => void;
  position: { x: number; y: number } | null;
}

export default function MobileNodePopup({
  node,
  isOpen,
  onClose,
  onExpandNetwork,
  onOpenMusicNerdProfile,
  position,
}: MobileNodePopupProps) {
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState("");

  // Fetch configuration on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.musicNerdBaseUrl) {
            setMusicNerdBaseUrl(config.musicNerdBaseUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    };
    
    fetchConfig();
  }, []);

  if (!isOpen || !node || !position) return null;

  const roles = node.types || [node.type];
  const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
  const isArtistNode = node.type === 'artist' || (roles && roles.includes('artist'));
  const mainArtistNode = node.size === 30 && node.type === 'artist';

  const handleExpandNetwork = () => {
    if (isArtistNode && !mainArtistNode) {
      onExpandNetwork(node.name);
    }
    onClose();
  };

  const handleOpenMusicNerdProfile = () => {
    onOpenMusicNerdProfile(node.name, node.artistId);
    onClose();
  };

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      
      {/* Popup */}
      <Card 
        className="fixed z-50 bg-gray-900/95 backdrop-blur border-2 max-w-[calc(100vw-2rem)]"
        style={{ 
          borderColor: '#b427b4',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -100%)',
          marginTop: '-10px'
        }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{node.name}</h3>
              <p className="text-sm text-gray-300">Role{roles.length > 1 ? 's' : ''}: {roleDisplay}</p>
            </div>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Collaboration info */}
          {node.collaborations && node.collaborations.length > 0 && (
            <div className="text-sm text-gray-300">
              <strong>Recent Collaborations:</strong>
              <div className="mt-1 space-y-1">
                {node.collaborations.slice(0, 3).map((collab, index) => (
                  <div key={index} className="text-xs">{collab}</div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {isArtistNode && !mainArtistNode && (
              <Button
                onClick={handleExpandNetwork}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Network className="w-4 h-4 mr-2" />
                Expand {node.name}'s Network
              </Button>
            )}
            
            {isArtistNode && (
              <Button
                onClick={handleOpenMusicNerdProfile}
                size="sm"
                variant="secondary"
                className="w-full bg-gray-800 hover:bg-gray-700 border-gray-600"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Music Nerd Profile
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
} 