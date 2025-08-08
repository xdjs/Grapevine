import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Music, Disc3, Mic2, Users, Loader2 } from 'lucide-react';
import { CollaborationDetails } from '@/types/network';

// Tiny inline SVGs for mobile only (fixed size, cannot scale)
const MobileUsersIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" className="inline-block" style={{ minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 3.13A4 4 0 1 1 16 10.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MobileMusicIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" className="inline-block" style={{ minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}>
    <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const MobileExternalIcon = () => (
  <svg aria-label="Open on Spotify" width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }}>
    <path d="M14 3h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 14v7H3V3h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
    const iconClass = isMobile ? "w-2 h-2 min-w-2 min-h-2 max-w-2 max-h-2 flex-shrink-0" : "w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4 flex-shrink-0"; // Ultra small mobile icons
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className={`relative bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden text-white ${
          isMobile ? 'max-w-sm mx-2' : 'max-w-2xl'
        }`}
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
            {/* Small circled users icon on mobile; normal icon on desktop */}
            {isMobile ? (
              <div className="flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 w-5 h-5 flex-shrink-0">
                <MobileUsersIcon />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0 w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8">
                <Users className="text-purple-400 flex-shrink-0 h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4" />
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
        <div className={`overflow-y-auto max-h-[calc(90vh-120px)] ${
          isMobile ? 'p-4' : 'p-6'
        }`}>
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
                    <span className="text-purple-400"><MobileUsersIcon /></span>
                  ) : (
                    <Users className="text-purple-400 flex-shrink-0 w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4" />
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
                      <span className="text-purple-400"><MobileMusicIcon /></span>
                    ) : (
                      <Music className="text-purple-400 flex-shrink-0 w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4" />
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
                            <span className="text-purple-400"><MobileMusicIcon /></span>
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-green-400 hover:text-green-300 transition-colors"
                                title="Open on Spotify"
                              >
                                <span className="text-xs font-medium">Spotify</span>
                                <span className="inline-flex"><MobileExternalIcon /></span>
                              </a>
                            ) : (
                              <a
                                href={project.spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center p-2 rounded-md text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                                title="Open on Spotify"
                              >
                                <ExternalLink className="w-5 h-5" style={{ minWidth: 20, minHeight: 20, maxWidth: 20, maxHeight: 20 }} />
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
                    <Music className="mx-auto mb-4 text-gray-600 w-8 h-8" />
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