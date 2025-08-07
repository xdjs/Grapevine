import React, { useEffect, useCallback } from 'react';
import { NetworkNode } from '@/types/network';

export interface NetworkTooltipProps {
  node: NetworkNode;
  position: { x: number; y: number };
  visible: boolean;
  isMainArtist: boolean;
  isFirstDegreeCollaborator: boolean;
  onNetworkAction: (node: NetworkNode) => void;
  onExpandAction: (node: NetworkNode) => void;
  onProfileAction: (node: NetworkNode) => void;
  onCollaborationAction: (node: NetworkNode) => void;
  onClose: () => void;
}

export const NetworkTooltip: React.FC<NetworkTooltipProps> = ({
  node,
  position,
  visible,
  isMainArtist,
  isFirstDegreeCollaborator,
  onNetworkAction,
  onExpandAction,
  onProfileAction,
  onCollaborationAction,
  onClose,
}) => {
  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, handleKeyDown]);

  if (!visible) {
    return null;
  }

  const roles = node.types || [node.type];
  const roleDisplay = roles.length > 1 ? roles.join(', ') : roles[0];
  
  // Detect mobile and adjust sizes accordingly
  const isMobile = window.innerWidth <= 768;
  const maxWidth = isMobile ? '280px' : '380px';
  const iconSize = isMobile ? 18 : 32;
  // Collaboration icon uses same size as other icons for consistency
  const titleFontSize = isMobile ? '13px' : '16px';
  const roleFontSize = isMobile ? '10px' : '12px';
  const linkFontSize = isMobile ? '10px' : '12px';
  const closeButtonSize = isMobile ? '18px' : '24px';
  const paddingRight = isMobile ? '20px' : '30px';
  const gap = isMobile ? '4px' : '8px';
  const expandIconFontSize = isMobile ? '12px' : '16px';
  const collaborationStrokeWidth = isMobile ? "1.5" : "2";

  // Check if this node is an artist (has artist role)
  const isArtist = roles.includes('artist');

  // Event handlers
  const handleActionClick = useCallback((
    event: React.MouseEvent | React.KeyboardEvent,
    action: () => void
  ) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  }, []);

  const handleKeyPress = useCallback((
    event: React.KeyboardEvent,
    action: () => void
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleActionClick(event, action);
    }
  }, [handleActionClick]);

  // Asset paths
  const networkIconPath = '/grapevine-logo.png';
  const artistIconPath = '/music_nerd_logo.png';

  // Simple text-based collaboration icon - much smaller and more reliable
  const collaborationIconSvg = (
    <span 
      style={{
        fontSize: `${iconSize * 0.8}px`,
        color: '#ff69b4',
        fontWeight: 'bold',
        display: 'inline-block',
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        textAlign: 'center',
        lineHeight: `${iconSize}px`,
      }}
      aria-label="Collaboration icon"
    >
      👥
    </span>
  );

  return (
    <div
      role="tooltip"
      aria-label={`Tooltip for ${node.name}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth,
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        borderRadius: '8px',
        padding: isMobile ? '8px' : '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: isMobile ? '12px' : '14px',
        lineHeight: '1.4',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto',
        paddingRight,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        onKeyDown={(e) => handleKeyPress(e, onClose)}
        aria-label="Close tooltip"
        role="button"
        tabIndex={0}
        style={{
          position: 'absolute',
          top: '4px',
          right: '6px',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: closeButtonSize,
          cursor: 'pointer',
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>

      {/* Title and role */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: titleFontSize,
          lineHeight: '1.2',
          textAlign: 'left',
        }}
      >
        {node.name}
      </div>
      <div
        style={{
          marginTop: isMobile ? '1px' : '2px',
          fontSize: roleFontSize,
          textAlign: 'left',
        }}
      >
        Roles: {roleDisplay}
      </div>

      {/* Actions container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          marginTop: isMobile ? '4px' : gap,
        }}
      >
        {/* Network action - always available */}
        <div
          data-testid="network-action"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            cursor: 'pointer',
          }}
          onClick={(e) => handleActionClick(e, () => onNetworkAction(node))}
          onKeyDown={(e) => handleKeyPress(e, () => onNetworkAction(node))}
          tabIndex={0}
          role="button"
          aria-label={`View ${node.name}'s network`}
        >
          <img
            src={networkIconPath}
            alt="Network"
            style={{
              width: `${iconSize}px`,
              height: `${iconSize}px`,
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontSize: linkFontSize,
              fontStyle: 'italic',
              textDecoration: 'underline',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}&apos;s network
          </span>
        </div>

        {/* Expand action - for all nodes except main artist */}
        {!isMainArtist && (
          <div
            data-testid="expand-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              console.log(`🔗 [DEBUG] Expand button clicked for ${node.name}`);
              handleActionClick(e, () => onExpandAction(node));
            }}
            onKeyDown={(e) => handleKeyPress(e, () => onExpandAction(node))}
            tabIndex={0}
            role="button"
            aria-label={`Expand ${node.name}'s network`}
          >
            <div
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#4CAF50',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: expandIconFontSize,
                  fontWeight: 'bold',
                }}
              >
                +
              </span>
            </div>
            <span
              style={{
                fontSize: linkFontSize,
                fontStyle: 'italic',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Expand {node.name}&apos;s network
            </span>
          </div>
        )}

        {/* Music Nerd profile action - only for artists */}
        {isArtist && (
          <div
            data-testid="profile-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
            }}
            onClick={(e) => handleActionClick(e, () => onProfileAction(node))}
            onKeyDown={(e) => handleKeyPress(e, () => onProfileAction(node))}
            tabIndex={0}
            role="button"
            aria-label={`View ${node.name}'s Music Nerd profile`}
          >
            <img
              src={artistIconPath}
              alt="Artist Page"
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                borderRadius: '50%',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontSize: linkFontSize,
                fontStyle: 'italic',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {node.name}&apos;s Music Nerd profile
            </span>
          </div>
        )}

        {/* Collaboration details action - not for main artist */}
        {!isMainArtist && (
          <div
            data-testid="collaboration-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
            }}
            onClick={(e) => handleActionClick(e, () => onCollaborationAction(node))}
            onKeyDown={(e) => handleKeyPress(e, () => onCollaborationAction(node))}
            tabIndex={0}
            role="button"
            aria-label="View collaboration details"
          >
            {collaborationIconSvg}
            <span
              style={{
                fontSize: linkFontSize,
                fontStyle: 'italic',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Collaboration details
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkTooltip;