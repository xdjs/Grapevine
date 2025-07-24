import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Music, Disc3, Mic2 } from 'lucide-react';
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
      fetchCollaborationDetails();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Collaboration Details
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {artistName} & {collaboratorName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading collaboration details...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">Error loading collaboration details</div>
              <div className="text-sm text-gray-600">{error}</div>
              <button
                onClick={fetchCollaborationDetails}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {details && !loading && (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Collaboration</h3>
                <p className="text-gray-700 leading-relaxed">{details.description}</p>
              </div>

              {/* Projects */}
              {details.projects && details.projects.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Projects Together</h3>
                  <div className="space-y-3">
                    {details.projects.map((project, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="text-blue-600">
                            {getProjectIcon(project.type)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{project.name}</div>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                {getProjectTypeLabel(project.type)}
                              </span>
                              {project.year && (
                                <span>{project.year}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {project.spotifyUrl && (
                          <a
                            href={project.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700 transition-colors"
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
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Background</h3>
                  <p className="text-gray-700 leading-relaxed">{details.personalHistory}</p>
                </div>
              )}

              {/* No projects found */}
              {(!details.projects || details.projects.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <Music className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No specific collaboration projects found between these artists.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Powered by OpenAI & Spotify
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 