import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Music, Disc3, Mic2, Users, Loader2 } from 'lucide-react';
import { CollaborationDetails } from '@/types/network';

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
        className={`bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden text-white ${
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
            <div className={`flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0 ${
              isMobile ? 'w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4' : 'w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8'
            }`}>
              <Users className={`text-purple-400 flex-shrink-0 ${
                isMobile ? 'h-2 w-2 min-h-2 min-w-2 max-h-2 max-w-2' : 'h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4'
              }`} />
            </div>
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
          >
            <X className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
          </button>
        </div>

        {/* Content */}
        <div className={`overflow-y-auto max-h-[calc(90vh-120px)] ${
          isMobile ? 'p-4' : 'p-6'
        }`}>
          {loading && (
            <div className={`flex items-center justify-center ${isMobile ? 'py-8' : 'py-12'}`}>
              <div className="flex items-center gap-3">
                <Loader2 className={`animate-spin text-purple-400 ${
                  isMobile ? 'w-5 h-5' : 'w-8 h-8'
                }`} />
                <span className={`text-gray-300 ${
                  isMobile ? 'text-sm' : 'text-base'
                }`}>Loading collaboration details...</span>
              </div>
            </div>
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
                  <Users className={`text-purple-400 flex-shrink-0 ${
                    isMobile ? 'w-2 h-2 min-w-2 min-h-2 max-w-2 max-h-2' : 'w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4'
                  }`} />
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
                    <Music className={`text-purple-400 flex-shrink-0 ${
                      isMobile ? 'w-2 h-2 min-w-2 min-h-2 max-w-2 max-h-2' : 'w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4'
                    }`} />
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
                          <div className="text-purple-400">
                            {getProjectIcon(project.type)}
                          </div>
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
                          <a
                            href={project.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 transition-colors p-2 rounded-lg hover:bg-green-500/10"
                            title="Open in Spotify"
                          >
                            <ExternalLink className={`flex-shrink-0 ${
                              isMobile ? "w-2.5 h-2.5 min-w-2.5 min-h-2.5 max-w-2.5 max-h-2.5" : "w-5 h-5 min-w-5 min-h-5 max-w-5 max-h-5"
                            }`} />
                          </a>
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
                  <Music className={`mx-auto mb-4 text-gray-600 ${
                    isMobile ? 'w-5 h-5' : 'w-8 h-8'
                  }`} />
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