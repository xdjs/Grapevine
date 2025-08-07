import 'dotenv/config';
import axios from 'axios';

export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  followers: {
    total: number;
  };
  genres: string[];
  popularity: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer

      if (!this.accessToken) {
        throw new Error('Access token is null after successful API response');
      }
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Spotify access token:', error);
      throw new Error('Spotify API authentication failed');
    }
  }

  async searchArtist(artistName: string): Promise<SpotifyArtist | null> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        'https://api.spotify.com/v1/search',
        {
          params: {
            q: artistName,
            type: 'artist',
            limit: 1
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const artists = response.data.artists.items;
      return artists.length > 0 ? artists[0] : null;
    } catch (error) {
      console.error(`Failed to search for artist ${artistName}:`, error);
      return null;
    }
  }

  async searchTrackWithValidation(
    trackName: string, 
    primaryArtist: string, 
    collaborator?: string,
    options: {
      limit?: number;
      market?: string;
      minScore?: number;
    } = {}
  ): Promise<{ track: SpotifyTrack | null; score: number; searchStrategies: string[] }> {
    try {
      const token = await this.getAccessToken();
      const { limit = 5, market = 'US', minScore = 50 } = options;
      
      // Multiple search strategies in order of preference
      const searchStrategies = [
        `"${trackName}" artist:"${primaryArtist}"`,
        ...(collaborator ? [`"${trackName}" "${primaryArtist}" "${collaborator}"`] : []),
        `${trackName} artist:${primaryArtist}`,
        `${trackName} ${primaryArtist}`,
        trackName,
      ];

      let bestMatch = null;
      let bestScore = 0;
      const strategiesUsed: string[] = [];

      for (let i = 0; i < searchStrategies.length; i++) {
        const searchQuery = searchStrategies[i];
        strategiesUsed.push(searchQuery);
        
        try {
          const response = await axios.get(
            'https://api.spotify.com/v1/search',
            {
              params: {
                q: searchQuery,
                type: 'track',
                limit,
                market
              },
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          const tracks = response.data.tracks?.items || [];
          
          // Validate and score each result
          for (const track of tracks) {
            const score = this.validateTrackMatch(track, trackName, primaryArtist, collaborator);
            
            if (score > bestScore && score >= minScore) {
              bestMatch = track;
              bestScore = score;
            }
          }

          // If we found a high-confidence match, stop searching
          if (bestScore >= 80) {
            break;
          }
          
        } catch (strategyError) {
          console.warn(`Spotify search strategy ${i + 1} failed:`, strategyError);
          continue;
        }
      }

      return {
        track: bestMatch,
        score: bestScore,
        searchStrategies: strategiesUsed
      };
      
    } catch (error) {
      console.error(`Failed to search for track ${trackName}:`, error);
      return { track: null, score: 0, searchStrategies: [] };
    }
  }

  private validateTrackMatch(
    spotifyTrack: SpotifyTrack, 
    targetTrackName: string, 
    primaryArtist: string, 
    collaborator?: string
  ): number {
    let score = 0;
    const trackName = spotifyTrack.name.toLowerCase();
    const targetName = targetTrackName.toLowerCase();
    
    // Get artist names from the Spotify track
    const spotifyArtists = spotifyTrack.artists.map(artist => artist.name.toLowerCase()).join(' ');
    const primaryArtistLower = primaryArtist.toLowerCase();
    const collaboratorLower = collaborator?.toLowerCase();
    
    // Title matching (most important factor)
    if (trackName === targetName) {
      score += 40; // Exact title match
    } else if (trackName.includes(targetName) || targetName.includes(trackName)) {
      score += 25; // Partial title match
    } else {
      // Check for common variations (remove parentheses, feat., etc.)
      const cleanTrackName = trackName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
      const cleanTargetName = targetName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
      
      if (cleanTrackName === cleanTargetName) {
        score += 35; // Clean title match
      } else if (cleanTrackName.includes(cleanTargetName) || cleanTargetName.includes(cleanTrackName)) {
        score += 20; // Clean partial match
      }
    }
    
    // Artist matching
    if (spotifyArtists.includes(primaryArtistLower)) {
      score += 25;
    }
    if (collaboratorLower && spotifyArtists.includes(collaboratorLower)) {
      score += 25;
    }
    
    // Check for partial artist name matches
    const primaryWords = primaryArtistLower.split(/\s+/);
    const collaboratorWords = collaboratorLower?.split(/\s+/) || [];
    
    for (const word of primaryWords) {
      if (word.length > 2 && spotifyArtists.includes(word)) {
        score += 5;
      }
    }
    
    for (const word of collaboratorWords) {
      if (word.length > 2 && spotifyArtists.includes(word)) {
        score += 5;
      }
    }
    
    // Bonus for featuring/collaboration indicators
    if (spotifyArtists.includes('feat') || spotifyArtists.includes('featuring') || spotifyArtists.includes('ft')) {
      score += 10;
    }
    
    // Penalty for too many artists (likely compilation)
    if (spotifyTrack.artists.length > 4) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  async getArtistTopTracks(artistId: string, market: string = 'US'): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
        {
          params: { market },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.tracks;
    } catch (error) {
      console.error(`Failed to get top tracks for artist ${artistId}:`, error);
      return [];
    }
  }

  async getArtistAlbums(artistId: string): Promise<any[]> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}/albums`,
        {
          params: {
            include_groups: 'album,single',
            market: 'US',
            limit: 50
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.items;
    } catch (error) {
      console.error(`Failed to get albums for artist ${artistId}:`, error);
      return [];
    }
  }

  async getAlbumTracks(albumId: string): Promise<any[]> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.spotify.com/v1/albums/${albumId}/tracks`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.items;
    } catch (error) {
      console.error(`Failed to get tracks for album ${albumId}:`, error);
      return [];
    }
  }

  // Helper method to get artist image
  getArtistImageUrl(artist: SpotifyArtist, size: 'small' | 'medium' | 'large' = 'medium'): string | null {
    if (!artist.images || artist.images.length === 0) {
      return null;
    }

    // Sort images by size (largest first)
    const sortedImages = artist.images.sort((a, b) => b.width - a.width);

    switch (size) {
      case 'small':
        return sortedImages[sortedImages.length - 1]?.url || sortedImages[0]?.url;
      case 'large':
        return sortedImages[0]?.url;
      case 'medium':
      default:
        return sortedImages[Math.floor(sortedImages.length / 2)]?.url || sortedImages[0]?.url;
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export const spotifyService = new SpotifyService();