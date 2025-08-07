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
    const searchVariations = [
      artistName, // Original name
      artistName.replace(/[^\w\s]/g, ''), // Remove special characters
      artistName.replace(/\s+/g, ' ').trim(), // Normalize whitespace
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
    try {
      console.log(`🎵 [Spotify] Fetching profile image for: ${artistName}`);
      
      const artist = await this.searchArtistWithRetry(artistName);
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
    const batchSize = 3; // Smaller batches for better reliability
    
    console.log(`🎵 [Spotify] Batch fetching profile images for ${artistNames.length} artists`);
    
    for (let i = 0; i < artistNames.length; i += batchSize) {
      const batch = artistNames.slice(i, i + batchSize);
      console.log(`🎵 [Spotify] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(artistNames.length/batchSize)}: [${batch.join(', ')}]`);
      
      // Use Promise.allSettled to handle individual failures gracefully
      const batchPromises = batch.map(async (artistName) => {
        const result = await this.getArtistProfileImageWithRetry(artistName, size);
        return { artistName, result };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          const { artistName, result } = promiseResult.value;
          if (result) {
            results.set(artistName, result);
          } else {
            failures.add(artistName);
          }
        } else {
          console.error(`❌ [Spotify] Promise rejected in batch:`, promiseResult.reason);
        }
      }
      
      // Longer delay between batches for better rate limit compliance
      if (i + batchSize < artistNames.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`✅ [Spotify] Batch processing complete: ${results.size}/${artistNames.length} images found`);
    if (failures.size > 0) {
      console.log(`⚠️ [Spotify] Failed to find images for: [${Array.from(failures).join(', ')}]`);
    }
    
    return results;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export const spotifyService = new SpotifyService();