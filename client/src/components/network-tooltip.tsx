import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { NetworkNode } from '@/types/network';

export interface NetworkTooltipProps {
  node: NetworkNode;
  position: { x: number; y: number };
  visible: boolean;
  isMainArtist: boolean;
  isFirstDegreeCollaborator: boolean;
  isExpanded?: boolean;
  onNetworkAction: (node: NetworkNode) => void;
  onExpandAction: (node: NetworkNode) => void;
  onShrinkAction: (node: NetworkNode) => void;
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
  isExpanded,
  onNetworkAction,
  onExpandAction,
  onShrinkAction,
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
  
  // Reactive mobile detection that updates on window resize
  const getIsMobile = () =>
    typeof window !== 'undefined' && (
      window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  const [isMobile, setIsMobile] = useState(getIsMobile);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(getIsMobile());
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const maxWidth = isMobile ? '320px' : '380px';
  const iconSize = isMobile ? 14 : 32; // Much smaller icons on mobile
  // Mobile-only bitmap icons (pre-rendered to PNG on the fly for crisp scaling)
  const mobileIconPx = 14;
  const [mobileExpandIconSrc, setMobileExpandIconSrc] = useState<string>('');
  const [mobileShrinkIconSrc, setMobileShrinkIconSrc] = useState<string>('');
  useEffect(() => {
    if (!isMobile) {
      setMobileExpandIconSrc('');
      return;
    }
    if (typeof document === 'undefined') return;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${mobileIconPx}" height="${mobileIconPx}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="#ff69b4" stroke-width="2" fill="none" />
  <line x1="12" y1="7" x2="12" y2="17" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" />
  <line x1="7" y1="12" x2="17" y2="12" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" />
</svg>`;
    const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => {
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      const size = mobileIconPx * dpr;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, mobileIconPx, mobileIconPx);
      ctx.drawImage(img, 0, 0, mobileIconPx, mobileIconPx);
      try { setMobileExpandIconSrc(canvas.toDataURL('image/png')); } catch { setMobileExpandIconSrc(svgUrl); }
    };
    img.src = svgUrl;
  }, [isMobile, mobileIconPx]);
  useEffect(() => {
    if (!isMobile) {
      setMobileShrinkIconSrc('');
      return;
    }
    if (typeof document === 'undefined') return;
    const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width="${mobileIconPx}" height="${mobileIconPx}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="#ff69b4" stroke-width="2" fill="none" />
  <line x1="7" y1="12" x2="17" y2="12" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" />
</svg>`;
    const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => {
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      const size = mobileIconPx * dpr;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, mobileIconPx, mobileIconPx);
      ctx.drawImage(img, 0, 0, mobileIconPx, mobileIconPx);
      try { setMobileShrinkIconSrc(canvas.toDataURL('image/png')); } catch { setMobileShrinkIconSrc(svgUrl); }
    };
    img.src = svgUrl;
  }, [isMobile, mobileIconPx]);
  const [mobileCollabIconSrc, setMobileCollabIconSrc] = useState<string>('');
  useEffect(() => {
    if (!isMobile) {
      setMobileCollabIconSrc('');
      return;
    }
    if (typeof document === 'undefined') return;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${mobileIconPx}" height="${mobileIconPx}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="9" cy="7" r="4" stroke="#ff69b4" stroke-width="2" />
  <path d="M22 21V19C21.9993 18.1137 21.7044 17.2528 21.1614 16.5523C20.6184 15.8519 19.8581 15.3516 19 15.13" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => {
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      const size = mobileIconPx * dpr;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, mobileIconPx, mobileIconPx);
      ctx.drawImage(img, 0, 0, mobileIconPx, mobileIconPx);
      try {
        const png = canvas.toDataURL('image/png');
        setMobileCollabIconSrc(png);
      } catch {
        setMobileCollabIconSrc(svgUrl); // graceful fallback
      }
    };
    img.src = svgUrl;
  }, [isMobile, mobileIconPx]);
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
      className="animate-pop-in"
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
        Roles: {roles.map((role, index) => (
          <span key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ position: 'relative', width: '12px', height: '12px', flexShrink: 0 }}>
              {/* Realistic grape cluster */}
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Main stem */}
                <path d="M6 1 Q6 2 6 3" stroke="#4ade80" strokeWidth="1" fill="none" />
                
                {/* Grape 1 - top center */}
                <ellipse cx="6" cy="3.5" rx="1.8" ry="2.2" fill={role === 'artist' ? '#FF0ACF' : 
                                                               role === 'producer' ? '#AE53FF' : 
                                                               role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Grape 2 - left side */}
                <ellipse cx="4.2" cy="4.8" rx="1.6" ry="2" fill={role === 'artist' ? '#FF0ACF' : 
                                                               role === 'producer' ? '#AE53FF' : 
                                                               role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Grape 3 - right side */}
                <ellipse cx="7.8" cy="4.8" rx="1.6" ry="2" fill={role === 'artist' ? '#FF0ACF' : 
                                                               role === 'producer' ? '#AE53FF' : 
                                                               role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Grape 4 - bottom left */}
                <ellipse cx="4.8" cy="6.5" rx="1.4" ry="1.8" fill={role === 'artist' ? '#FF0ACF' : 
                                                                 role === 'producer' ? '#AE53FF' : 
                                                                 role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Grape 5 - bottom right */}
                <ellipse cx="7.2" cy="6.5" rx="1.4" ry="1.8" fill={role === 'artist' ? '#FF0ACF' : 
                                                                 role === 'producer' ? '#AE53FF' : 
                                                                 role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Grape 6 - bottom center */}
                <ellipse cx="6" cy="7.8" rx="1.2" ry="1.6" fill={role === 'artist' ? '#FF0ACF' : 
                                                               role === 'producer' ? '#AE53FF' : 
                                                               role === 'songwriter' ? '#67D1F8' : '#355367'} />
                
                {/* Small connecting stems */}
                <path d="M6 3 Q6 4 4.2 4.8" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                <path d="M6 3 Q6 4 7.8 4.8" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                <path d="M4.2 4.8 Q5 5.5 4.8 6.5" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                <path d="M7.8 4.8 Q7 5.5 7.2 6.5" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                <path d="M4.8 6.5 Q5.5 7 6 7.8" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                <path d="M7.2 6.5 Q6.5 7 6 7.8" stroke="#4ade80" strokeWidth="0.5" fill="none" />
                
                {/* Leaf */}
                <path d="M6 1 Q8 0.5 9 1.5 Q8.5 2.5 6 2" fill="#4ade80" />
              </svg>
            </div>
            {role}{index < roles.length - 1 ? ', ' : ''}
          </span>
        ))}
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

        {/* Expand action - available for any non-main-artist node */}
        {!isMainArtist && (
          <div
            data-testid="expand-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
              width: '100%',
              overflow: 'hidden',
              opacity: 1,
            }}
            onClick={(e) => {
              handleActionClick(e, () => onExpandAction(node));
            }}
            onKeyDown={(e) => {
              handleKeyPress(e, () => onExpandAction(node));
            }}
            tabIndex={0}
            role="button"
            aria-label={`Expand ${node.name}'s network`}
          >
            {isMobile ? (
              mobileExpandIconSrc ? (
                <img
                  src={mobileExpandIconSrc}
                  alt={'Expand icon'}
                  style={{
                    width: `${mobileIconPx}px`,
                    height: `${mobileIconPx}px`,
                    minWidth: `${mobileIconPx}px`,
                    minHeight: `${mobileIconPx}px`,
                    maxWidth: `${mobileIconPx}px`,
                    maxHeight: `${mobileIconPx}px`,
                    display: 'block',
                    flexShrink: 0,
                    background: 'transparent',
                  }}
                />
              ) : (
                <span style={{
                  width: `${mobileIconPx}px`,
                  height: `${mobileIconPx}px`,
                  minWidth: `${mobileIconPx}px`,
                  minHeight: `${mobileIconPx}px`,
                  maxWidth: `${mobileIconPx}px`,
                  maxHeight: `${mobileIconPx}px`,
                  display: 'block',
                  flexShrink: 0,
                }} />
              )
            ) : (
              <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                 aria-label={'Expand icon'}
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  minWidth: `${iconSize}px`,
                  minHeight: `${iconSize}px`,
                  maxWidth: `${iconSize}px`,
                  maxHeight: `${iconSize}px`,
                  display: 'block',
                  flexShrink: 0,
                }}
              >
                <circle cx="12" cy="12" r="10" stroke="#ff69b4" strokeWidth="2" fill="none" />
                <>
                  <line x1="12" y1="7" x2="12" y2="17" stroke="#ff69b4" strokeWidth="2" strokeLinecap="round" />
                  <line x1="7" y1="12" x2="17" y2="12" stroke="#ff69b4" strokeWidth="2" strokeLinecap="round" />
                </>
              </svg>
            )}
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
              {`Expand ${node.name}'s network`}
            </span>
          </div>
        )}

        {/* Shrink action - show only when node is expanded */}
        {!isMainArtist && isExpanded && (
          <div
            data-testid="shrink-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              cursor: 'pointer',
              width: '100%',
              overflow: 'hidden',
            }}
            onClick={(e) => handleActionClick(e, () => onShrinkAction(node))}
            onKeyDown={(e) => handleKeyPress(e, () => onShrinkAction(node))}
            tabIndex={0}
            role="button"
            aria-label={`Shrink ${node.name}'s network`}
          >
            {isMobile ? (
              mobileShrinkIconSrc ? (
                <img
                  src={mobileShrinkIconSrc}
                  alt={'Shrink icon'}
                  style={{
                    width: `${mobileIconPx}px`,
                    height: `${mobileIconPx}px`,
                    minWidth: `${mobileIconPx}px`,
                    minHeight: `${mobileIconPx}px`,
                    maxWidth: `${mobileIconPx}px`,
                    maxHeight: `${mobileIconPx}px`,
                    display: 'block',
                    flexShrink: 0,
                    background: 'transparent',
                  }}
                />
              ) : (
                <span style={{
                  width: `${mobileIconPx}px`,
                  height: `${mobileIconPx}px`,
                  minWidth: `${mobileIconPx}px`,
                  minHeight: `${mobileIconPx}px`,
                  maxWidth: `${mobileIconPx}px`,
                  maxHeight: `${mobileIconPx}px`,
                  display: 'block',
                  flexShrink: 0,
                }} />
              )
            ) : (
              <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                aria-label={'Shrink icon'}
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  minWidth: `${iconSize}px`,
                  minHeight: `${iconSize}px`,
                  maxWidth: `${iconSize}px`,
                  maxHeight: `${iconSize}px`,
                  display: 'block',
                  flexShrink: 0,
                }}
              >
                <circle cx="12" cy="12" r="10" stroke="#ff69b4" strokeWidth="2" fill="none" />
                <line x1="7" y1="12" x2="17" y2="12" stroke="#ff69b4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
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
              Shrink network
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

        {/* Collaboration details action - not for main artist, hide on mobile */}
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
            {!isMobile && (
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
            )}
            {isMobile && mobileCollabIconSrc && (
              <img
                src={mobileCollabIconSrc}
                alt={'Collaboration icon'}
                style={{
                  width: `${mobileIconPx}px`,
                  height: `${mobileIconPx}px`,
                  minWidth: `${mobileIconPx}px`,
                  minHeight: `${mobileIconPx}px`,
                  maxWidth: `${mobileIconPx}px`,
                  maxHeight: `${mobileIconPx}px`,
                  display: 'block',
                  flexShrink: 0,
                  background: 'transparent',
                }}
              />
            )}
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