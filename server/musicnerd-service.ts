import { createClient } from '@supabase/supabase-js';

interface MusicNerdArtist {
  id: string;
  name: string;
  artist_id?: string;
}

class MusicNerdService {
  private supabase: any;
  private isAvailable: boolean = false;

  constructor() {
    try {
      const connectionString = process.env.CONNECTION_STRING;
      if (!connectionString) {
        console.log('CONNECTION_STRING not provided. MusicNerd artist IDs will not be available.');
        return;
      }

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
          supabaseUrl = `https://${match[1]}`;
          // For PostgreSQL strings, we need the API key to be provided separately
          console.log('PostgreSQL connection string detected. Please provide Supabase API key in CONNECTION_STRING as query parameter: ?apikey=your_key');
          return;
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
    if (!this.isAvailable || !this.supabase) {
      console.log(`🔒 [DEBUG] MusicNerd service not available for "${artistName}"`);
      return null;
    }

    try {
      console.log(`🔍 [DEBUG] Querying MusicNerd database for artist: "${artistName}"`);
      
      // Try exact match first
      let { data, error } = await this.supabase
        .from('artists')
        .select('artist_id, id, name')
        .ilike('name', artistName)
        .limit(1);

      if (error) {
        console.error(`❌ [DEBUG] Database error for "${artistName}":`, error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log(`📭 [DEBUG] No exact match found for "${artistName}" in MusicNerd database`);
        
        // Try partial match
        const { data: partialData, error: partialError } = await this.supabase
          .from('artists')
          .select('artist_id, id, name')
          .ilike('name', `%${artistName}%`)
          .limit(5);

        if (partialError) {
          console.error(`❌ [DEBUG] Partial search error for "${artistName}":`, partialError);
          return null;
        }

        if (!partialData || partialData.length === 0) {
          console.log(`❌ [DEBUG] No partial matches found for "${artistName}"`);
          return null;
        }

        console.log(`🔍 [DEBUG] Found ${partialData.length} partial matches:`, partialData.map(d => d.name));
        data = partialData.slice(0, 1); // Take the first match
      }

      const artist = data[0];
      const artistId = artist.artist_id || artist.id;
      console.log(`✅ [DEBUG] Found MusicNerd artist ID for "${artistName}" (matched: "${artist.name}"): ${artistId}`);
      return artistId;
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