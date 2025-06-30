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
      
      // Try to query the actual database for real artist IDs using direct PostgreSQL connection
      const connectionString = process.env.CONNECTION_STRING;
      if (connectionString && connectionString.includes('postgresql://')) {
        try {
          console.log(`🔍 [DEBUG] Querying database via connection string for real artist ID: "${artistName}"`);
          
          // Use the pg package for direct database connection
          const { Client } = await import('pg');
          const client = new Client({ connectionString });
          
          await client.connect();
          
          // First, check the table schema to see what columns exist
          const schemaQuery = 'SELECT column_name FROM information_schema.columns WHERE table_name = \'artists\' LIMIT 10';
          const schemaResult = await client.query(schemaQuery);
          console.log(`🔍 [DEBUG] Artists table columns:`, schemaResult.rows.map(r => r.column_name));
          
          // Query the artists table directly - adjust column names based on actual schema
          const query = 'SELECT * FROM artists WHERE LOWER(name) LIKE LOWER($1) LIMIT 1';
          const result = await client.query(query, [`%${artistName}%`]);
          
          await client.end();
          
          if (result.rows.length > 0) {
            const artist = result.rows[0];
            console.log(`🔍 [DEBUG] Found artist record for "${artistName}":`, artist);
            
            // Try different possible column names for the artist ID
            const artistId = artist.artist_id || artist.id || artist.uuid || artist.guid || artist.artistId;
            
            if (artistId) {
              console.log(`✅ [DEBUG] Found real MusicNerd artist ID for "${artistName}": ${artistId}`);
              return artistId;
            } else {
              console.log(`⚠️ [DEBUG] Artist found but no ID column detected for "${artistName}"`);
              return null;
            }
          } else {
            console.log(`📭 [DEBUG] No match found for "${artistName}" in MusicNerd database`);
          }
        } catch (dbError) {
          console.log(`⚠️ [DEBUG] Database query failed for "${artistName}":`, dbError);
        }
      }
      
      // If no real artist ID found, return null so it falls back to main MusicNerd page
      console.log(`📭 [DEBUG] No real artist ID found for "${artistName}" - will use main MusicNerd page`);
      return null;
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