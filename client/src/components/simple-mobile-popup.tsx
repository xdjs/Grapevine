import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ExternalLink, Network } from "lucide-react";
import { NetworkNode } from "@/types/network";

interface SimpleMobilePopupProps {
  onExpandNetwork: (artistName: string) => void;
  onOpenMusicNerdProfile: (artistName: string, artistId?: string | null) => void;
}

export default function SimpleMobilePopup({
  onExpandNetwork,
  onOpenMusicNerdProfile,
}: SimpleMobilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (popupRef.current && !popupRef.current.contains(target)) {
        hidePopup();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const showPopup = (node: NetworkNode, x: number, y: number) => {
    if (!popupRef.current) return;

    const roles = node.types || [node.type];
    const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
    const isArtistNode = node.type === 'artist' || (roles && roles.includes('artist'));
    const mainArtistNode = node.size === 30 && node.type === 'artist';

    // Create popup content
    const content = `
      <div class="fixed z-50 bg-gray-900/95 backdrop-blur border-2 max-w-[calc(100vw-2rem)]" 
           style="border-color: #b427b4; left: ${x}px; top: ${y}px; transform: translate(-50%, -100%); margin-top: -10px;">
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-white">${node.name}</h3>
              <p class="text-sm text-gray-300">Role${roles.length > 1 ? 's' : ''}: ${roleDisplay}</p>
            </div>
            <button id="close-popup" class="text-gray-400 hover:text-white p-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          ${node.collaborations && node.collaborations.length > 0 ? `
            <div class="text-sm text-gray-300">
              <strong>Recent Collaborations:</strong>
              <div class="mt-1 space-y-1">
                ${node.collaborations.slice(0, 3).map(collab => `<div class="text-xs">${collab}</div>`).join('')}
              </div>
            </div>
          ` : ''}
          <div class="space-y-2 pt-2">
            ${isArtistNode && !mainArtistNode ? `
              <button id="expand-network" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded">
                <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Expand ${node.name}'s Network
              </button>
            ` : ''}
            ${isArtistNode ? `
              <button id="music-nerd-profile" class="w-full bg-gray-800 hover:bg-gray-700 border-gray-600 text-white text-sm px-4 py-2 rounded border">
                <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                View Music Nerd Profile
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Add background overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-40 bg-black/50';
    overlay.id = 'mobile-popup-overlay';
    document.body.appendChild(overlay);

    // Add popup
    const popup = document.createElement('div');
    popup.innerHTML = content;
    popup.id = 'mobile-popup';
    document.body.appendChild(popup);

    // Add event listeners
    const closeBtn = document.getElementById('close-popup');
    const expandBtn = document.getElementById('expand-network');
    const musicNerdBtn = document.getElementById('music-nerd-profile');

    if (closeBtn) {
      closeBtn.addEventListener('click', hidePopup);
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        onExpandNetwork(node.name);
        hidePopup();
      });
    }

    if (musicNerdBtn) {
      musicNerdBtn.addEventListener('click', () => {
        onOpenMusicNerdProfile(node.name, node.artistId);
        hidePopup();
      });
    }

    overlay.addEventListener('click', hidePopup);
  };

  const hidePopup = () => {
    const overlay = document.getElementById('mobile-popup-overlay');
    const popup = document.getElementById('mobile-popup');
    
    if (overlay) overlay.remove();
    if (popup) popup.remove();
  };

  // Expose showPopup globally so it can be called from the network visualizer
  useEffect(() => {
    (window as any).showMobilePopup = showPopup;
    return () => {
      delete (window as any).showMobilePopup;
    };
  }, [onExpandNetwork, onOpenMusicNerdProfile]);

  return null; // This component doesn't render anything visible
} 