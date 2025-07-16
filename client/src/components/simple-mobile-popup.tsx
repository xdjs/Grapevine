import { useEffect } from "react";

interface SimpleMobilePopupProps {
  onExpandNetwork: (artistName: string) => void;
  onOpenMusicNerdProfile: (artistName: string, artistId?: string | null) => void;
}

export default function SimpleMobilePopup({
  onExpandNetwork,
  onOpenMusicNerdProfile,
}: SimpleMobilePopupProps) {
  console.log(`📱 [SIMPLE POPUP] Component rendering`);

  const showPopup = (node: any, x: number, y: number) => {
    console.log(`📱 [SIMPLE POPUP] showPopup called for ${node.name} at ${x}, ${y}`);
    
    // Remove any existing popup first
    const existingOverlay = document.getElementById('mobile-popup-overlay');
    const existingPopup = document.getElementById('mobile-popup');
    if (existingOverlay) existingOverlay.remove();
    if (existingPopup) existingPopup.remove();

    // Create simple popup content
    const roles = node.types || [node.type];
    const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
    const isArtistNode = node.type === 'artist' || (roles && roles.includes('artist'));
    const mainArtistNode = node.size === 30 && node.type === 'artist';

    const content = `
      <div style="position: fixed; z-index: 50; background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(8px); border: 2px solid #b427b4; max-width: calc(100vw - 2rem); left: ${x}px; top: ${y}px; transform: translate(-50%, -100%); margin-top: -10px; border-radius: 8px;">
        <div style="padding: 1rem; color: white;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0;">${node.name}</h3>
              <p style="font-size: 0.875rem; color: #d1d5db; margin: 0;">Role${roles.length > 1 ? 's' : ''}: ${roleDisplay}</p>
            </div>
            <button id="close-popup" style="color: #9ca3af; background: none; border: none; padding: 0.5rem; cursor: pointer;">✕</button>
          </div>
          <div style="margin-top: 0.5rem;">
            ${isArtistNode && !mainArtistNode ? `
              <button id="expand-network" style="width: 100%; background: #2563eb; color: white; border: none; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">Expand ${node.name}'s Network</button>
            ` : ''}
            ${isArtistNode ? `
              <button id="music-nerd-profile" style="width: 100%; background: #374151; color: white; border: 1px solid #4b5563; padding: 0.5rem; border-radius: 4px; cursor: pointer;">View Music Nerd Profile</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Add background overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.5);';
    overlay.id = 'mobile-popup-overlay';
    document.body.appendChild(overlay);
    console.log(`📱 [SIMPLE POPUP] Overlay created and added to body`);

    // Add popup
    const popup = document.createElement('div');
    popup.innerHTML = content;
    popup.id = 'mobile-popup';
    document.body.appendChild(popup);
    console.log(`📱 [SIMPLE POPUP] Popup created and added to body`);

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
    console.log(`📱 [SIMPLE POPUP] Component mounting, setting up global function`);
    (window as any).showMobilePopup = showPopup;
    console.log(`📱 [SIMPLE POPUP] Global function set:`, typeof (window as any).showMobilePopup);
    return () => {
      console.log(`📱 [SIMPLE POPUP] Component unmounting, cleaning up global function`);
      delete (window as any).showMobilePopup;
    };
  }, [onExpandNetwork, onOpenMusicNerdProfile]);

  return <div style={{ display: 'none' }} />; // Hidden div
} 