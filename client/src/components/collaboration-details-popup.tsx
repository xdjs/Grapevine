import React, { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink, Music, Disc3, Mic2, Users, Loader2 } from 'lucide-react';
import { CollaborationDetails } from '@/types/network';

// Utility to rasterize an SVG into a PNG data URL for crisp mobile icons
const useSvgPng = (svg: string, px: number) => {
  return useMemo(() => {
    if (typeof document === 'undefined') return '';
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const size = px * dpr;
    const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = new Image();
    return new Promise<string>((resolve) => {
      img.onload = () => {
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, px, px);
        ctx.drawImage(img, 0, 0, px, px);
        try { resolve(canvas.toDataURL('image/png')); } catch { resolve(svgUrl); }
      };
      img.src = svgUrl;
    }) as unknown as string;
  }, [svg, px]);
};

// Prebuilt SVG strings matching desktop lucide icons, stroked purple for mobile
const PURPLE = '#a855f7';
const usersSvg12 = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
  <circle cx="9" cy="7" r="4" stroke="${PURPLE}" stroke-width="2" />
  <path d="M22 21V19C21.9993 18.1137 21.7044 17.2528 21.1614 16.5523C20.6184 15.8519 19.8581 15.3516 19 15.13" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
</svg>`;
const musicSvg12 = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 18V5l10-2v13" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="7" cy="18" r="3" stroke="${PURPLE}" stroke-width="2" />
  <circle cx="17" cy="16" r="3" stroke="${PURPLE}" stroke-width="2" />
</svg>`;
const discSvg12 = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="${PURPLE}" stroke-width="2" />
  <circle cx="12" cy="12" r="2" stroke="${PURPLE}" stroke-width="2" />
</svg>`;
const micSvg12 = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="9" y="2" width="6" height="11" rx="3" stroke="${PURPLE}" stroke-width="2" />
  <path d="M12 19v3" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
  <path d="M19 11a7 7 0 0 1-14 0" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
</svg>`;
const externalSvg14 = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 3h7v7" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M10 14L21 3" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" />
  <path d="M21 14v7H3V3h7" stroke="${PURPLE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

// Rasterize SVG into PNG data URL for crisp mobile icons
function rasterizeSvgToPng(svg: string, px: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      const size = px * dpr;
      const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(svgUrl); return; }
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, px, px);
        ctx.drawImage(img, 0, 0, px, px);
        try { resolve(canvas.toDataURL('image/png')); }
        catch { resolve(svgUrl); }
      };
      img.src = svgUrl;
    } catch {
      resolve('');
    }
  });
}

// Pre-generate mobile PNGs matching desktop icons (sizes tuned for UI)
const useMobilePngIcons = (isMobile: boolean) => {
  const [icons, setIcons] = React.useState<{ users: string; music: string; disc: string; mic: string; external: string }>({ users: '', music: '', disc: '', mic: '', external: '' });
  React.useEffect(() => {
    let cancelled = false;
    async function generate() {
      if (!isMobile || typeof document === 'undefined') { if (!cancelled) setIcons({ users: '', music: '', disc: '', mic: '', external: '' }); return; }
      const [users, music, disc, mic, external] = await Promise.all([
        rasterizeSvgToPng(usersSvg12, 16),
        rasterizeSvgToPng(musicSvg12, 16),
        rasterizeSvgToPng(discSvg12, 18),
        rasterizeSvgToPng(micSvg12, 18),
        rasterizeSvgToPng(externalSvg14, 18),
      ]);
      if (!cancelled) setIcons({ users, music, disc, mic, external });
    }
    generate();
    return () => { cancelled = true; };
  }, [isMobile]);
  return icons;
};

interface CollaborationDetailsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  collaboratorName: string;
  mainArtistName: string;
}

export default function CollaborationDetailsPopup({
  isOpen,
  onClose,
  artistName,
  collaboratorName,
  mainArtistName,
}: CollaborationDetailsPopupProps) {
  const [details, setDetails] = useState<CollaborationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reactive mobile detection that updates on window resize  
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const mobile = typeof window !== 'undefined' && (
        window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen && artistName && collaboratorName) {
      // Don't fetch if it's the same artist (main artist clicked on themselves)
      if (artistName === collaboratorName) {
        setDetails({
          description: "This would show collaboration details between this artist and their collaborators. Click on a collaborator node to see specific collaboration details.",
          projects: [],
          personalHistory: "Select a collaborator to view detailed collaboration information."
        });
        setLoading(false);
      } else {
        fetchCollaborationDetails();
      }
    }
  }, [isOpen, artistName, collaboratorName]);

  // Handle keyboard events (especially ESC key)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only close on deliberate ESC key press, not on window focus events
      if (event.key === 'Escape' && event.target === document.body) {
        onClose();
      }
    };

    // Prevent modal from closing on window blur/focus events
    const handleWindowBlur = (event: FocusEvent) => {
      // Prevent any automatic closing when window loses focus
      event.preventDefault();
    };

    const handleWindowFocus = (event: FocusEvent) => {
      // Prevent any automatic closing when window regains focus
      event.preventDefault();
    };

    // Prevent modal from closing when switching tabs
    const handleVisibilityChange = (event: Event) => {
      // Prevent automatic closing when tab becomes hidden/visible
      console.log('Collaboration details popup: preventing close on visibility change');
      event.preventDefault();
      event.stopPropagation();
    };

    // Prevent modal from closing on page hide/show (tab switching)
    const handlePageHide = (event: PageTransitionEvent) => {
      console.log('Collaboration details popup: preventing close on page hide');
      event.preventDefault();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      console.log('Collaboration details popup: preventing close on page show');
      event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isOpen, onClose]);

  const fetchCollaborationDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/collaboration-details/${encodeURIComponent(artistName)}/${encodeURIComponent(collaboratorName)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch collaboration details: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDetails(data);
    } catch (err) {
      console.error('Error fetching collaboration details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collaboration details');
    } finally {
      setLoading(false);
    }
  };

  const getProjectIcon = (type: string) => {
    const iconClass = isMobile ? "w-2 h-2 min-w-2 min-h-2 max-w-2 max-h-2 flex-shrink-0" : "w-7 h-7 min-w-7 min-h-7 max-w-7 max-h-7 flex-shrink-0"; // Slightly larger desktop icons
    switch (type) {
      case 'song':
        return <Music className={iconClass} />;
      case 'album':
        return <Disc3 className={iconClass} />;
      case 'ep':
        return <Disc3 className={iconClass} />;
      case 'single':
        return <Mic2 className={iconClass} />;
      default:
        return <Music className={iconClass} />;
    }
  };

  const getProjectTypeLabel = (type: string) => {
    switch (type) {
      case 'song':
        return 'Song';
      case 'album':
        return 'Album';
      case 'ep':
        return 'EP';
      case 'single':
        return 'Single';
      default:
        return type;
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the overlay, not on child elements
    if (e.target === e.currentTarget) {
      // Prevent default behavior - don't close the modal on background click
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent event bubbling from content to overlay
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed left-0 right-0 ${isMobile ? '' : 'top-0'} bottom-0 bg-black/80 backdrop-blur-sm flex ${isMobile ? 'items-start justify-center' : 'items-center justify-center'} z-50 p-4`}
      onClick={handleOverlayClick}
      style={isMobile ? { top: 'calc(env(safe-area-inset-top, 0px) + 56px)' } : undefined}
    >
      <div 
        className={`relative bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl shadow-2xl w-full max-h-[90vh] ${
          isMobile ? 'overflow-y-auto' : 'overflow-hidden'
        } text-white ${
          isMobile ? 'max-w-sm mx-2' : 'max-w-2xl'
        } animate-pop-in`}
        style={{
          boxShadow: '0 0 20px rgba(180, 39, 180, 0.3)',
          borderColor: '#b427b4'
        }}
        onClick={handleContentClick}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-700 ${
          isMobile ? 'p-4' : 'p-6'
        }`}>
          <div className="flex items-center gap-3">
            {/* Desktop header icon; hidden on mobile to avoid layout/overlay issues */}
            {!isMobile && (
              <div className="flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0 w-10 h-10 min-w-10 min-h-10 max-w-10 max-h-10">
                <Users className="text-purple-400 flex-shrink-0 h-6 w-6 min-h-6 min-w-6 max-h-6 max-w-6" />
              </div>
            )}
            <div>
              <h2 className={`font-semibold text-white ${
                isMobile ? 'text-lg' : 'text-xl'
              }`}>
                Collaboration Details
              </h2>
              <p className={`text-gray-300 mt-1 ${
                isMobile ? 'text-xs' : 'text-sm'
              }`}>
                <span className="font-medium text-purple-300">{artistName}</span>
                <span className="text-gray-400"> & </span>
                <span className="font-medium text-purple-300">{collaboratorName}</span>
              </p>
            </div>
          </div>
          {/* Desktop close button (hidden on mobile) */}
          <button
            onClick={onClose}
            className={`text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800 ${isMobile ? 'hidden' : ''}`}
          >
            <X className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
          </button>
        </div>

        {/* Mobile close button - absolute top-right inside the popup */}
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Content */}
        <div className={`${
          isMobile ? '' : 'overflow-y-auto max-h-[calc(90vh-120px)]'
        } ${isMobile ? 'p-4' : 'p-6'}`}>
          {loading && (
            <>
              {isMobile ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-4">
                    {/* Ring spinner styled like the mock */}
                    <div
                      aria-label="Loading"
                      className="rounded-full border-4 border-purple-400/30 border-t-purple-400 animate-spin"
                      style={{ width: 64, height: 64 }}
                    />
                    <div className="text-left">
                      <div className="text-gray-300 text-base font-medium">Loading</div>
                      <div className="text-gray-300 text-base">collaboration</div>
                      <div className="text-gray-300 text-base">details...</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-center py-12`}>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <span className="text-gray-300 text-base">Loading collaboration details...</span>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4 text-lg font-medium">Error loading collaboration details</div>
              <div className="text-sm text-gray-400 mb-6">{error}</div>
              <button
                onClick={fetchCollaborationDetails}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                style={{
                  boxShadow: '0 4px 12px rgba(180, 39, 180, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#8f1c8f';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(180, 39, 180, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#b427b4';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 39, 180, 0.3)';
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {details && !loading && (
            <div className="space-y-6">
              {/* Description */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h3 className={`font-medium text-white mb-3 flex items-center gap-2 ${
                  isMobile ? 'text-base' : 'text-lg'
                }`}>
                  {isMobile ? (
                    <img src={(('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(usersSvg12)))} alt="" width={16} height={16} style={{ minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16 }} />
                  ) : (
                    <Users className="text-purple-400 flex-shrink-0 w-6 h-6 min-w-6 min-h-6 max-w-6 max-h-6" />
                  )}
                  Collaboration
                </h3>
                <p className="text-gray-300 leading-relaxed">{details.description}</p>
              </div>

              {/* Projects */}
              {details.projects && details.projects.length > 0 && (
                <div>
                  <h3 className={`font-medium text-white mb-4 flex items-center gap-2 ${
                    isMobile ? 'text-base' : 'text-lg'
                  }`}>
                    {isMobile ? (
                      <img src={(('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(musicSvg12)))} alt="" width={16} height={16} style={{ minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16 }} />
                    ) : (
                      <Music className="text-purple-400 flex-shrink-0 w-6 h-6 min-w-6 min-h-6 max-w-6 max-h-6" />
                    )}
                    Projects Together
                  </h3>
                  <div className="space-y-3">
                    {details.projects.map((project, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition-colors ${
                          isMobile ? 'p-3' : 'p-4'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {isMobile ? (
                            <img src={(('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent((project.type === 'album' || project.type === 'ep') ? discSvg12 : project.type === 'single' ? micSvg12 : musicSvg12)))} alt="" width={18} height={18} style={{ minWidth: 18, minHeight: 18, maxWidth: 18, maxHeight: 18 }} />
                          ) : (
                            <div className="text-purple-400">{getProjectIcon(project.type)}</div>
                          )}
                          <div>
                            <div className="font-medium text-white">{project.name}</div>
                            <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                              <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs border border-purple-500/30">
                                {getProjectTypeLabel(project.type)}
                              </span>
                              {project.year && (
                                <span className="text-gray-500">{project.year}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {project.spotifyUrl && (
                          <div className="ml-auto">
                            {isMobile ? (
                              <a
                                href={project.spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2 py-1 rounded-md text-green-400 hover:text-green-300 underline text-xs"
                                title="Open on Spotify"
                              >
                                <img src={(('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(externalSvg14)))} alt="Open on Spotify" width={18} height={18} style={{ minWidth: 18, minHeight: 18, maxWidth: 18, maxHeight: 18 }} />
                              </a>
                            ) : (
                              <a
                                href={project.spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center p-2 rounded-md text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                                title="Open on Spotify"
                              >
                                <ExternalLink className="w-7 h-7" style={{ minWidth: 28, minHeight: 28, maxWidth: 28, maxHeight: 28 }} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal History */}
              {details.personalHistory && (
                <div className={`bg-gray-900/50 border border-gray-700 rounded-lg ${
                  isMobile ? 'p-3' : 'p-4'
                }`}>
                  <h3 className={`font-medium text-white mb-3 ${
                    isMobile ? 'text-base' : 'text-lg'
                  }`}>Background</h3>
                  <p className="text-gray-300 leading-relaxed">{details.personalHistory}</p>
                </div>
              )}

              {/* No projects found */}
              {(!details.projects || details.projects.length === 0) && (
                <div className={`text-center text-gray-400 ${isMobile ? 'py-8' : 'py-12'}`}>
{!isMobile && (
                    <Music className="mx-auto mb-4 text-gray-600 w-12 h-12" />
                  )}
                  <p className={isMobile ? 'text-base' : 'text-lg'}>No specific collaboration projects found between these artists.</p>
                  <p className={`text-gray-500 mt-2 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>This could mean they haven't officially collaborated yet, or the data isn't available.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between border-t border-gray-700 bg-gray-900/50 ${
          isMobile ? 'p-4' : 'p-6'
        }`}>
          <div className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Powered by OpenAI & Spotify
          </div>
          <button
            onClick={onClose}
            className={`bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium ${
              isMobile ? 'px-4 py-1.5 text-sm' : 'px-6 py-2'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 