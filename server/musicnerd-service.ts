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

      if (connectionString.includes('supabase.co')) {
        // Direct Supabase format
        const url = new URL(connectionString);
        supabaseUrl = `https://${url.hostname}`;
        supabaseKey = url.searchParams.get('apikey') || url.password || '';
      } else {
        // Try to extract from PostgreSQL connection string with API key
        const match = connectionString.match(/https:\/\/([^\/]+).*apikey=([^&]+)/);
        if (match) {
          supabaseUrl = `https://${match[1]}`;
          supabaseKey = match[2];
        } else {
          console.log('Could not parse CONNECTION_STRING for Supabase. Expected format with API key.');
          return;
        }
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.isAvailable = true;
      console.log('MusicNerd service initialized successfully');
    } catch (error) {
      console.error('Error initializing MusicNerd service:', error);
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  async getArtistId(artistName: string): Promise<string | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('artists')
        .select('artist_id, id')
        .ilike('name', artistName)
        .single();

      if (error || !data) {
        console.log(`🎵 Artist "${artistName}" not found in MusicNerd database`);
        return null;
      }

      const artistId = data.artist_id || data.id;
      console.log(`🎵 Found MusicNerd artist ID for "${artistName}": ${artistId}`);
      return artistId;
    } catch (error) {
      console.error(`Error looking up artist "${artistName}":`, error);
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