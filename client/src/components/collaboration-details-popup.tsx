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
    switch (type) {
      case 'song':
        return <Music className="w-4 h-4" />;
      case 'album':
        return <Disc3 className="w-4 h-4" />;
      case 'ep':
        return <Disc3 className="w-4 h-4" />;
      case 'single':
        return <Mic2 className="w-4 h-4" />;
      default:
        return <Music className="w-4 h-4" />;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden text-white"
        style={{
          boxShadow: '0 0 20px rgba(180, 39, 180, 0.3)',
          borderColor: '#b427b4'
        }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between p-3 sm:p-6 border-b border-gray-700" style={{ minHeight: '60px' }}>
          {/* Left side - Purple icon and text */}
          <div className="absolute left-3 sm:left-6 top-1/2 transform -translate-y-1/2 flex items-center gap-2 sm:gap-3 max-w-[calc(100%-80px)]">
            <div 
              className="flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30"
              style={{ 
                width: '24px !important', 
                height: '24px !important',
                minWidth: '24px !important',
                minHeight: '24px !important',
                maxWidth: '24px !important',
                maxHeight: '24px !important'
              }}
            >
              <Users 
                style={{ 
                  width: '14px !important', 
                  height: '14px !important',
                  minWidth: '14px !important',
                  minHeight: '14px !important',
                  maxWidth: '14px !important',
                  maxHeight: '14px !important'
                }} 
                className="text-purple-400" 
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                Collaboration Details
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 truncate">
                <span className="font-medium text-purple-300">{artistName}</span>
                <span className="text-gray-400"> & </span>
                <span className="font-medium text-purple-300">{collaboratorName}</span>
              </p>
            </div>
          </div>
          
          {/* Right side - Close button */}
          <button
            onClick={onClose}
            className="absolute right-3 sm:right-6 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 sm:p-2 rounded-lg hover:bg-gray-800"
            style={{ zIndex: 10 }}
          >
            <X 
              style={{ 
                width: '20px !important', 
                height: '20px !important',
                minWidth: '20px !important',
                minHeight: '20px !important',
                maxWidth: '20px !important',
                maxHeight: '20px !important'
              }} 
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 
                  style={{ 
                    width: '24px !important', 
                    height: '24px !important',
                    minWidth: '24px !important',
                    minHeight: '24px !important',
                    maxWidth: '24px !important',
                    maxHeight: '24px !important'
                  }}
                  className="animate-spin text-purple-400" 
                />
                <span className="text-gray-300">Loading collaboration details...</span>
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
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Users className="text-purple-400 w-3 h-3 sm:w-4 sm:h-4" />
                  Collaboration
                </h3>
                <p className="text-gray-300 leading-relaxed">{details.description}</p>
              </div>

              {/* Projects */}
              {details.projects && details.projects.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
<Music className="text-purple-400 w-3 h-3 sm:w-4 sm:h-4" />
                    Projects Together
                  </h3>
                  <div className="space-y-3">
                    {details.projects.map((project, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition-colors"
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
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal History */}
              {details.personalHistory && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">Background</h3>
                  <p className="text-gray-300 leading-relaxed">{details.personalHistory}</p>
                </div>
              )}

              {/* No projects found */}
              {(!details.projects || details.projects.length === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <Music className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg">No specific collaboration projects found between these artists.</p>
                  <p className="text-sm text-gray-500 mt-2">This could mean they haven't officially collaborated yet, or the data isn't available.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-900/50">
          <div className="text-sm text-gray-400">
            Powered by OpenAI & Spotify
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 