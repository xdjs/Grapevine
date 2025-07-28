import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Spotify service for testing
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

  async searchArtist(artistName: string): Promise<any | null> {
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

  getArtistImageUrl(artist: any, size: 'small' | 'medium' | 'large' = 'medium'): string | null {
    if (!artist.images || artist.images.length === 0) {
      return null;
    }

    // Sort images by size (largest first)
    const sortedImages = artist.images.sort((a: any, b: any) => b.width - a.width);

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

const spotifyService = new SpotifyService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 [Spotify Test] Function started');
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🧪 [Spotify Test] CORS preflight request');
    res.status(200).end();
    return;
  }

  try {
    const { artistName = 'Taylor Swift' } = req.query;
    
    console.log(`🧪 [Spotify Test] Testing Spotify integration for artist: ${artistName}`);
    
    // Test Spotify configuration
    const isConfigured = spotifyService.isConfigured();
    console.log(`🧪 [Spotify Test] Spotify configured: ${isConfigured}`);
    
    if (!isConfigured) {
      return res.status(200).json({
        success: false,
        message: 'Spotify not configured',
        artistName,
        spotifyConfigured: false,
        envVars: {
          SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
          SPOTIFY_CLIENT_SECRET: !!process.env.SPOTIFY_CLIENT_SECRET
        }
      });
    }

    // Test artist search
    console.log(`🧪 [Spotify Test] Searching for artist: ${artistName}`);
    const spotifyArtist = await spotifyService.searchArtist(artistName as string);
    
    if (!spotifyArtist) {
      return res.status(200).json({
        success: false,
        message: 'Artist not found on Spotify',
        artistName,
        spotifyConfigured: true,
        spotifyArtist: null
      });
    }

    // Test image URL generation
    const imageUrl = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
    
    const response = {
      success: true,
      message: 'Spotify integration working',
      artistName,
      spotifyConfigured: true,
      spotifyArtist: {
        id: spotifyArtist.id,
        name: spotifyArtist.name,
        images: spotifyArtist.images,
        imageUrl: imageUrl,
        followers: spotifyArtist.followers,
        popularity: spotifyArtist.popularity
      },
      testResults: {
        hasImages: !!spotifyArtist.images,
        imageCount: spotifyArtist.images?.length || 0,
        hasImageUrl: !!imageUrl,
        imageUrl: imageUrl
      }
    };

    console.log(`🧪 [Spotify Test] Success! Found artist with image: ${imageUrl}`);
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('🧪 [Spotify Test] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing Spotify integration',
      error: error instanceof Error ? error.message : 'Unknown error',
      artistName: req.query.artistName || 'Taylor Swift'
    });
  }
} 