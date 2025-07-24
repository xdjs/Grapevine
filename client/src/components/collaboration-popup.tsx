import React from 'react';
import { X, ExternalLink, Music, Calendar, User } from 'lucide-react';
import { CollaborationInfo } from '@/types/network';

interface CollaborationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  collaborationInfo: CollaborationInfo | null;
  artistName: string;
  collaboratorName: string;
  isLoading: boolean;
}

export default function CollaborationPopup({
  isOpen,
  onClose,
  collaborationInfo,
  artistName,
  collaboratorName,
  isLoading
}: CollaborationPopupProps) {
  if (!isOpen) return null;

  const handleSpotifyClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-gray-900 rounded-lg shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">
              Collaboration Details
            </h2>
            <p className="text-gray-300 text-sm mt-1">
              {artistName} & {collaboratorName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-6"></div>
              <span className="text-gray-300 text-center text-lg font-medium">
                Loading collaboration info...
              </span>
                                   <span className="text-sm text-gray-500 mt-2 text-center">
                       This may take 5-15 seconds
                       <br />
                       <span className="text-xs text-gray-600">Using AI to analyze collaboration history</span>
                     </span>
              <div className="mt-4 flex space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          ) : collaborationInfo ? (
            <div className="space-y-6">
              {/* Collaboration Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <User className="h-5 w-5 mr-2 text-purple-400" />
                  Collaboration
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {collaborationInfo.collaborationInfo}
                </p>
              </div>

              {/* Projects */}
              {collaborationInfo.projects && collaborationInfo.projects.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Music className="h-5 w-5 mr-2 text-purple-400" />
                    Projects Together
                  </h3>
                  <div className="space-y-3">
                    {collaborationInfo.projects.map((project, index) => (
                      <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{project.name}</h4>
                            <div className="flex items-center text-sm text-gray-400 mt-1">
                              <Calendar className="h-4 w-4 mr-1" />
                              {project.year}
                              <span className="mx-2">•</span>
                              {project.role}
                            </div>
                          </div>
                          {project.spotifyUrl && (
                            <button
                              onClick={() => handleSpotifyClick(project.spotifyUrl!)}
                              className="ml-3 p-2 text-green-400 hover:text-green-300 transition-colors"
                              title="Open in Spotify"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spotify Tracks */}
              {collaborationInfo.spotifyTracks && collaborationInfo.spotifyTracks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Music className="h-5 w-5 mr-2 text-green-400" />
                    Related Tracks on Spotify
                  </h3>
                  <div className="space-y-3">
                    {collaborationInfo.spotifyTracks.map((track, index) => (
                      <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{track.name}</h4>
                            <p className="text-sm text-gray-400 mt-1">
                              {track.artists.join(', ')} • {track.album}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Released: {track.releaseDate}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSpotifyClick(track.spotifyUrl)}
                            className="ml-3 p-2 text-green-400 hover:text-green-300 transition-colors"
                            title="Open in Spotify"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal History */}
              {collaborationInfo.personalHistory && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-400" />
                    Background
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {collaborationInfo.personalHistory}
                  </p>
                </div>
              )}

              {/* No Projects Message */}
              {(!collaborationInfo.projects || collaborationInfo.projects.length === 0) && 
               (!collaborationInfo.spotifyTracks || collaborationInfo.spotifyTracks.length === 0) && (
                <div className="text-center py-8">
                  <Music className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">
                    No specific collaborative projects found between {artistName} and {collaboratorName}.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">
                Unable to load collaboration information.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                The request may have timed out or the API is unavailable.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 