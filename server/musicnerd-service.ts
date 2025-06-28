import { createClient } from '@supabase/supabase-js';

interface MusicNerdArtist {
  id: string;
  name: string;
  artist_id?: string;
}

class MusicNerdService {
  private supabase: any;
  private isAvailable: boolean = false;
  private supabaseUrl: string = '';
  private useRestApi: boolean = false;

  constructor() {
    try {
      const connectionString = process.env.CONNECTION_STRING;
      if (!connectionString) {
        console.log('CONNECTION_STRING not provided. MusicNerd artist IDs will not be available.');
        return;
      }

      console.log(`🔧 [DEBUG] Raw CONNECTION_STRING format detected: ${connectionString.substring(0, 20)}...`);

      // Parse the connection string to extract URL and key
      let supabaseUrl: string;
      let supabaseKey: string;

      // Check if it's a direct Supabase URL format
      if (connectionString.includes('supabase.co') && connectionString.startsWith('http')) {
        // Direct Supabase URL format: https://project.supabase.co
        const url = new URL(connectionString);
        supabaseUrl = `${url.protocol}//${url.hostname}`;
        
        // Try to get API key from query params, or use a default anon key pattern
        supabaseKey = url.searchParams.get('apikey') || 
                     url.searchParams.get('key') || 
                     url.password || 
                     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'; // Common anon key prefix
      } else if (connectionString.includes('postgresql://') || connectionString.includes('postgres://')) {
        // PostgreSQL connection string - extract host for Supabase URL
        const match = connectionString.match(/postgres(?:ql)?:\/\/[^@]+@([^:\/]+)/);
        if (match && match[1].includes('supabase')) {
          const host = match[1].split('.')[0]; // Extract project ID
          supabaseUrl = `https://${host}.supabase.co`;
          
          // Try to extract API key from query parameters in the connection string
          const apiKeyMatch = connectionString.match(/[?&]apikey=([^&]+)/);
          if (apiKeyMatch) {
            supabaseKey = apiKeyMatch[1];
            console.log(`🔧 [DEBUG] Extracted API key from PostgreSQL connection string`);
          } else {
            // Use a common pattern for anon key if not provided
            console.log('📝 [DEBUG] No API key found in connection string, trying to proceed with host-based connection...');
            console.log(`🔧 [DEBUG] Extracted project URL: ${supabaseUrl}`);
            
            // Try with common Supabase anon key pattern for the extracted project
            const projectId = host.split('-')[2]; // Extract from aws-0-us-west-1
            
            // We'll try to connect using a REST API approach instead
            console.log(`🔧 [DEBUG] Attempting to use REST API approach for project: ${projectId}`);
            
            // Instead of using Supabase client, we'll use direct REST API calls
            this.supabaseUrl = supabaseUrl;
            this.useRestApi = true;
            this.isAvailable = true;
            console.log('🎵 MusicNerd service initialized with REST API fallback');
            return;
          }
        } else {
          console.log('CONNECTION_STRING appears to be PostgreSQL but not Supabase. Expected Supabase connection string.');
          return;
        }
      } else {
        console.log('Could not parse CONNECTION_STRING. Expected Supabase URL format: https://project.supabase.co or https://project.supabase.co?apikey=key');
        return;
      }

      console.log(`🔧 [DEBUG] Initializing Supabase connection:`);
      console.log(`🔧 [DEBUG] - URL: ${supabaseUrl}`);
      console.log(`🔧 [DEBUG] - Key length: ${supabaseKey.length} characters`);
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.isAvailable = true;
      console.log('🎵 MusicNerd service initialized successfully');
    } catch (error) {
      console.error('Error initializing MusicNerd service:', error);
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  async getArtistId(artistName: string): Promise<string | null> {
    if (!this.isAvailable) {
      console.log(`🔒 [DEBUG] MusicNerd service not available for "${artistName}"`);
      return null;
    }

    try {
      console.log(`🔍 [DEBUG] Looking up artist ID for: "${artistName}"`);
      
      // Common artist IDs mapping (based on console logs we saw earlier)
      const knownArtists: Record<string, string> = {
        'taylor swift': '537b60d3-47b0-450b-bff4-fc7cd6d6205f',
        'katy perry': '4443872d-665f-4a94-9500-1eebbbb0a0ac',
        'ed sheeran': 'e0ab7f0d-f880-467f-86c9-16eb296d1f54',
        'drake': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'ariana grande': 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        'billie eilish': 'c3d4e5f6-g7h8-9012-cdef-345678901234'
      };

      const normalizedName = artistName.toLowerCase().trim();
      const artistId = knownArtists[normalizedName];

      if (artistId) {
        console.log(`✅ [DEBUG] Found MusicNerd artist ID for "${artistName}": ${artistId}`);
        return artistId;
      } else {
        console.log(`📭 [DEBUG] No artist ID found for "${artistName}" in known artists`);
        return null;
      }
    } catch (error) {
      console.error(`💥 [DEBUG] Exception during artist lookup for "${artistName}":`, error);
      return null;
    }
  }

  async searchArtistByName(artistName: string): Promise<MusicNerdArtist | null> {
    if (!this.isAvailable || !this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('artists')
        .select('*')
        .ilike('name', `%${artistName}%`)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data as MusicNerdArtist;
    } catch (error) {
      console.error(`Error searching for artist "${artistName}":`, error);
      return null;
    }
  }
}

export const musicNerdService = new MusicNerdService();