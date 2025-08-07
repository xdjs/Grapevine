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
  const maxWidth = isMobile ? '320px' : '380px';
  const iconSize = isMobile ? 20 : 32;
  const titleFontSize = isMobile ? '14px' : '16px';
  const roleFontSize = isMobile ? '11px' : '12px';
  const linkFontSize = isMobile ? '11px' : '12px';
  const closeButtonSize = isMobile ? '20px' : '24px';
  const paddingRight = isMobile ? '25px' : '30px';
  const gap = isMobile ? '6px' : '8px';

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

  // Pink Users icon SVG for collaboration details
  const collaborationIconSvg = (
    <svg 
      width={iconSize} 
      height={iconSize} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Collaboration icon"
      style={{
        minWidth: `${iconSize}px`,
        minHeight: `${iconSize}px`,
        maxWidth: `${iconSize}px`,
        maxHeight: `${iconSize}px`,
        flexShrink: 0,
      }}
    >
      <path 
        d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" 
        stroke="#ff69b4" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="#ff69b4" strokeWidth="2"/>
      <path 
        d="M22 21V19C21.9993 18.1137 21.7044 17.2528 21.1614 16.5523C20.6184 15.8519 19.8581 15.3516 19 15.13" 
        stroke="#ff69b4" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" 
        stroke="#ff69b4" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
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
        padding: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        lineHeight: '1.4',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto',
        paddingRight,
        minWidth: isMobile ? '280px' : '300px',
        width: 'auto',
        overflow: 'hidden',
        wordWrap: 'break-word',
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
          marginTop: '2px',
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
          marginTop: gap,
          width: '100%',
          overflow: 'hidden',
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
            width: '100%',
            overflow: 'hidden',
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
              minWidth: `${iconSize}px`,
              minHeight: `${iconSize}px`,
              maxWidth: `${iconSize}px`,
              maxHeight: `${iconSize}px`,
              borderRadius: '50%',
              cursor: 'pointer',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: linkFontSize,
              fontStyle: 'italic',
              textDecoration: 'underline',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.name}&apos;s network
          </span>
        </div>

        {/* Expand action - only for first-degree collaborators that aren't main artist */}
        {isFirstDegreeCollaborator && !isMainArtist && (
          <div
            data-testid="expand-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
              width: '100%',
              overflow: 'hidden',
            }}
            onClick={(e) => handleActionClick(e, () => onExpandAction(node))}
            onKeyDown={(e) => handleKeyPress(e, () => onExpandAction(node))}
            tabIndex={0}
            role="button"
            aria-label={`Expand ${node.name}'s network`}
          >
            <div
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                minWidth: `${iconSize}px`,
                minHeight: `${iconSize}px`,
                maxWidth: `${iconSize}px`,
                maxHeight: `${iconSize}px`,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#4CAF50',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: '16px',
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
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
              width: '100%',
              overflow: 'hidden',
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
                minWidth: `${iconSize}px`,
                minHeight: `${iconSize}px`,
                maxWidth: `${iconSize}px`,
                maxHeight: `${iconSize}px`,
                borderRadius: '50%',
                cursor: 'pointer',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: linkFontSize,
                fontStyle: 'italic',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
              width: '100%',
              overflow: 'hidden',
            }}
            onClick={(e) => handleActionClick(e, () => onCollaborationAction(node))}
            onKeyDown={(e) => handleKeyPress(e, () => onCollaborationAction(node))}
            tabIndex={0}
            role="button"
            aria-label="View collaboration details"
          >
            <div
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                minWidth: `${iconSize}px`,
                minHeight: `${iconSize}px`,
                maxWidth: `${iconSize}px`,
                maxHeight: `${iconSize}px`,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {collaborationIconSvg}
            </div>
            <span
              style={{
                fontSize: linkFontSize,
                fontStyle: 'italic',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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