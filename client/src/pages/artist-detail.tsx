import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, Music, User, Mic } from "lucide-react";

// Type definition for artist data
interface Artist {
  id: number;
  name: string;
  type: 'artist' | 'producer' | 'songwriter';
  imageUrl?: string | null;
  spotifyId?: string | null;
  webmapdata?: any;
}

interface ArtistResponse {
  artist: Artist;
}

// Custom hook to fetch artist data
function useArtist(id: string) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async (): Promise<ArtistResponse> => {
      console.log(`🔍 Fetching artist with ID: ${id}`);
      
      const response = await fetch(`/api/artists/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('Artist not found');
        }
        throw new Error(errorData.message || `Failed to fetch artist: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Artist data received:', data);
      return data;
    },
    enabled: !!id && id !== 'undefined',
    retry: (failureCount, error) => {
      // Don't retry for 404 errors
      if (error instanceof Error && error.message === 'Artist not found') {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// Get icon for artist type
function getTypeIcon(type: string) {
  switch (type) {
    case 'artist':
      return <User className="w-4 h-4" />;
    case 'producer':
      return <Mic className="w-4 h-4" />;
    case 'songwriter':
      return <Music className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
}

// Get color for artist type badge
function getTypeColor(type: string) {
  switch (type) {
    case 'artist':
      return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    case 'producer':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'songwriter':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}

export default function ArtistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error } = useArtist(id || '');

  // Navigate back to home
  const handleGoBack = () => {
    setLocation('/');
  };

  // Navigate to network view for this artist
  const handleViewNetwork = () => {
    if (data?.artist) {
      // Navigate to connections page with this artist pre-loaded
      setLocation(`/connections?artist=${encodeURIComponent(data.artist.name)}`);
    }
  };

  // Open Spotify link if available
  const handleSpotifyLink = () => {
    if (data?.artist?.spotifyId) {
      window.open(`https://open.spotify.com/artist/${data.artist.spotifyId}`, '_blank');
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertDescription>
            No artist ID provided in the URL.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              onClick={handleGoBack}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        {/* Loading Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  <Skeleton className="h-8 w-64 bg-gray-800" />
                  <Skeleton className="h-6 w-32 bg-gray-800" />
                </div>
                <Skeleton className="w-24 h-24 rounded-lg bg-gray-800" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-48 bg-gray-800" />
                <Skeleton className="h-10 w-40 bg-gray-800" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              onClick={handleGoBack}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        {/* Error Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Alert className="bg-red-900/20 border-red-800 text-red-300">
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load artist data'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const artist = data?.artist;

  if (!artist) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              onClick={handleGoBack}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        {/* No Artist Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Alert className="bg-yellow-900/20 border-yellow-800 text-yellow-300">
            <AlertDescription>
              Artist not found.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Artist Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-4 flex-1">
                <div>
                  <CardTitle className="text-3xl font-bold text-white mb-2">
                    {artist.name}
                  </CardTitle>
                  <Badge 
                    variant="outline" 
                    className={`${getTypeColor(artist.type)} flex items-center gap-2 w-fit`}
                  >
                    {getTypeIcon(artist.type)}
                    {artist.type.charAt(0).toUpperCase() + artist.type.slice(1)}
                  </Badge>
                </div>
              </div>
              
              {/* Artist Image */}
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="w-24 h-24 rounded-lg object-cover border border-gray-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                  {getTypeIcon(artist.type)}
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleViewNetwork}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <Music className="w-4 h-4 mr-2" />
                  View Collaboration Network
                </Button>
                
                {artist.spotifyId && (
                  <Button
                    variant="outline"
                    onClick={handleSpotifyLink}
                    className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Spotify
                  </Button>
                )}
              </div>

              {/* Artist Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-200">Artist ID</h3>
                  <p className="text-gray-400 font-mono">#{artist.id}</p>
                </div>
                
                {artist.spotifyId && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-200">Spotify ID</h3>
                    <p className="text-gray-400 font-mono">{artist.spotifyId}</p>
                  </div>
                )}
              </div>

              {/* Network Data Preview */}
              {artist.webmapdata && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-lg font-semibold text-gray-200">Collaboration Data</h3>
                  <p className="text-gray-400 text-sm">
                    This artist has cached collaboration network data available.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 