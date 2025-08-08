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

export class SpotifyService {
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

      // Safe access to nested response data
      const artists = response?.data?.artists?.items;
      return (artists && Array.isArray(artists) && artists.length > 0) ? artists[0] : null;
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

  /**
   * Get artist profile image by searching for the artist and extracting the best image
   * @param artistName - The name of the artist to search for
   * @param size - The preferred image size (defaults to medium ~300px)
   * @returns Promise with artist profile image data or null if not found
   */
  async getArtistProfileImage(artistName: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<{
    imageUrl: string;
    spotifyId: string;
    spotifyArtist: SpotifyArtist;
  } | null> {
    try {
      console.log(`🎵 [Spotify] Fetching profile image for: ${artistName}`);
      
      const artist = await this.searchArtist(artistName);
      if (!artist) {
        console.log(`❌ [Spotify] No artist found for: ${artistName}`);
        return null;
      }

      const imageUrl = this.getArtistImageUrl(artist, size);
      if (!imageUrl) {
        console.log(`❌ [Spotify] No image available for artist: ${artistName}`);
        return null;
      }

      console.log(`✅ [Spotify] Found profile image for ${artistName}: ${imageUrl}`);
      return {
        imageUrl,
        spotifyId: artist.id,
        spotifyArtist: artist
      };
    } catch (error) {
      console.error(`❌ [Spotify] Failed to get profile image for ${artistName}:`, error);
      return null;
    }
  }

  /**
   * Enhanced artist search with retry logic and better name matching
   * @param artistName - Name of the artist to search for
   * @param retries - Number of retries if search fails (default: 2)
   * @returns Promise with artist data or null if not found
   */
  async searchArtistWithRetry(artistName: string, retries: number = 2): Promise<SpotifyArtist | null> {
    // Input validation
    if (!artistName || typeof artistName !== 'string' || artistName.trim() === '') {
      console.log(`❌ [Spotify] Invalid artist name provided: ${artistName}`);
      return null;
    }

    const cleanName = artistName.trim();
    const searchVariations = [
      cleanName, // Original name
      cleanName.replace(/[^\w\s]/g, ''), // Remove special characters
      cleanName.replace(/\s+/g, ' ').trim(), // Normalize whitespace
    ];

    for (const searchTerm of searchVariations) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await this.searchArtist(searchTerm);
          if (result) {
            if (searchTerm !== artistName) {
              console.log(`🔄 [Spotify] Found "${artistName}" using variation: "${searchTerm}"`);
            }
            return result;
          }
        } catch (error) {
          if (attempt === retries) {
            console.warn(`⚠️ [Spotify] Search failed for "${searchTerm}" after ${retries + 1} attempts:`, error);
          } else {
            console.log(`🔄 [Spotify] Retrying search for "${searchTerm}" (attempt ${attempt + 2}/${retries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1))); // Exponential backoff
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Enhanced get artist profile image with retry logic
   * @param artistName - The name of the artist to search for
   * @param size - The preferred image size (defaults to medium ~300px)
   * @returns Promise with artist profile image data or null if not found
   */
  async getArtistProfileImageWithRetry(artistName: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<{
    imageUrl: string;
    spotifyId: string;
    spotifyArtist: SpotifyArtist;
  } | null> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      console.log(`🎵 [Spotify:${requestId}] Fetching profile image for: ${artistName} (size: ${size})`);
      
      const artist = await this.searchArtistWithRetry(artistName);
      if (!artist) {
        const duration = Date.now() - startTime;
        console.log(`❌ [Spotify:${requestId}] No artist found for: ${artistName} (${duration}ms)`);
        // Enhanced monitoring: Track failure reasons
        console.log(`📊 [Spotify:${requestId}] Search failure - Artist not found in Spotify catalog`);
        return null;
      }

      const imageUrl = this.getArtistImageUrl(artist, size);
      if (!imageUrl) {
        const duration = Date.now() - startTime;
        console.log(`❌ [Spotify:${requestId}] No image available for artist: ${artistName} (${duration}ms)`);
        console.log(`📊 [Spotify:${requestId}] Image failure - Artist found but no images available. Images count: ${artist.images?.length || 0}`);
        return null;
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [Spotify:${requestId}] Found profile image for ${artistName}: ${imageUrl} (${duration}ms)`);
      console.log(`📊 [Spotify:${requestId}] Success metrics - Artist ID: ${artist.id}, Image dimensions: ${artist.images?.[0]?.width}x${artist.images?.[0]?.height}, Popularity: ${artist.popularity}`);
      
      return {
        imageUrl,
        spotifyId: artist.id,
        spotifyArtist: artist
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Spotify:${requestId}] Failed to get profile image for ${artistName} (${duration}ms):`, error);
      
      // Enhanced error monitoring with structured logging
      const errorType = error?.code || error?.response?.status || 'UNKNOWN';
      const errorMessage = error?.message || JSON.stringify(error);
      console.error(`📊 [Spotify:${requestId}] Error details - Type: ${errorType}, Message: ${errorMessage}, Artist: ${artistName}`);
      
      // Track different error patterns for monitoring
      if (error?.response?.status === 429) {
        console.error(`🚨 [Spotify:${requestId}] Rate limit exceeded - consider implementing circuit breaker`);
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
        console.error(`🚨 [Spotify:${requestId}] Network connectivity issue - check Spotify API status`);
      } else if (error?.response?.status === 401) {
        console.error(`🚨 [Spotify:${requestId}] Authentication failure - check API credentials`);
      }
      
      return null;
    }
  }

  /**
   * Batch fetch profile images for multiple artists with enhanced error handling
   * @param artistNames - Array of artist names to fetch images for
   * @param size - The preferred image size (defaults to medium ~300px)
   * @returns Promise with map of artist names to their profile image data
   */
  async batchGetArtistProfileImages(
    artistNames: string[], 
    size: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<Map<string, {
    imageUrl: string;
    spotifyId: string;
    spotifyArtist: SpotifyArtist;
  }>> {
    const results = new Map();
    const failures = new Set<string>();
    const errors = new Map<string, string>(); // Track error types
    const batchSize = 3; // Smaller batches for better reliability
    const startTime = Date.now();
    const batchId = Math.random().toString(36).substring(7);
    
    console.log(`🎵 [Spotify:${batchId}] Batch fetching profile images for ${artistNames.length} artists (size: ${size})`);
    
    for (let i = 0; i < artistNames.length; i += batchSize) {
      const batch = artistNames.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(artistNames.length/batchSize);
      
      console.log(`🎵 [Spotify:${batchId}] Processing batch ${batchNumber}/${totalBatches}: [${batch.join(', ')}]`);
      
      // Use Promise.allSettled to handle individual failures gracefully
      const batchPromises = batch.map(async (artistName) => {
        try {
          const result = await this.getArtistProfileImageWithRetry(artistName, size);
          return { artistName, result, error: null };
        } catch (error) {
          return { artistName, result: null, error };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          const { artistName, result, error } = promiseResult.value;
          if (result) {
            results.set(artistName, result);
          } else {
            failures.add(artistName);
            if (error) {
              const errorType = error?.code || error?.response?.status || 'UNKNOWN';
              errors.set(artistName, errorType);
            }
          }
        } else {
          console.error(`❌ [Spotify:${batchId}] Promise rejected in batch:`, promiseResult.reason);
        }
      }
      
      // Log batch progress
      console.log(`📊 [Spotify:${batchId}] Batch ${batchNumber} complete: ${batch.length - failures.size} successful, ${failures.size} failed`);
      
      // Longer delay between batches for better rate limit compliance
      if (i + batchSize < artistNames.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    const duration = Date.now() - startTime;
    const successRate = ((results.size / artistNames.length) * 100).toFixed(1);
    
    console.log(`✅ [Spotify:${batchId}] Batch processing complete: ${results.size}/${artistNames.length} images found (${successRate}% success rate) in ${duration}ms`);
    
    if (failures.size > 0) {
      console.log(`⚠️ [Spotify:${batchId}] Failed to find images for: [${Array.from(failures).join(', ')}]`);
      
      // Log error distribution for monitoring
      const errorTypes = new Map<string, number>();
      for (const [artist, errorType] of errors) {
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
      }
      
      if (errorTypes.size > 0) {
        console.log(`📊 [Spotify:${batchId}] Error distribution:`, Object.fromEntries(errorTypes));
      }
    }
    
    return results;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export const spotifyService = new SpotifyService();