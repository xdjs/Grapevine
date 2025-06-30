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

      console.log(`🔧 [DEBUG] CONNECTION_STRING provided - using direct PostgreSQL connection`);

      // For any PostgreSQL connection string, we'll use direct pg connection
      if (connectionString.includes('postgresql://') || connectionString.includes('postgres://')) {
        this.isAvailable = true;
        console.log('🎵 MusicNerd service initialized with direct PostgreSQL connection');
        return;
      } else {
        console.log('CONNECTION_STRING format not recognized. Expected PostgreSQL connection string.');
        return;
      }
    } catch (error) {
      console.error('Error initializing MusicNerd service:', error);
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  async getArtistOptions(artistName: string): Promise<Array<{id: string, name: string, bio?: string}> | null> {
    if (!this.isAvailable) {
      console.log(`🔒 [DEBUG] MusicNerd service not available for "${artistName}"`);
      return null;
    }

    try {
      console.log(`🔍 [DEBUG] Looking up artist options for: "${artistName}"`);
      
      // Try to query the actual database for real artist IDs using direct PostgreSQL connection
      const connectionString = process.env.CONNECTION_STRING;
      if (connectionString && connectionString.includes('postgresql://')) {
        try {
          console.log(`🔍 [DEBUG] Querying database for all artist options: "${artistName}"`);
          
          // Use the pg package for direct database connection
          const { Client } = await import('pg');
          const client = new Client({ connectionString });
          
          await client.connect();
          
          // Query for multiple matches - exact first, then fuzzy
          let query = 'SELECT id, name, bio FROM artists WHERE LOWER(name) = LOWER($1) ORDER BY name LIMIT 10';
          let result = await client.query(query, [artistName]);
          
          // If no exact matches, try fuzzy search
          if (result.rows.length === 0) {
            query = 'SELECT id, name, bio FROM artists WHERE LOWER(name) LIKE LOWER($1) ORDER BY CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END, name LIMIT 10';
            result = await client.query(query, [`%${artistName}%`, `${artistName}%`]);
          }
          
          await client.end();
          
          if (result.rows.length > 0) {
            const options = result.rows
              .filter(artist => {
                const searchLower = artistName.toLowerCase();
                const foundLower = artist.name.toLowerCase();
                return foundLower.includes(searchLower) || searchLower.includes(foundLower) || foundLower === searchLower;
              })
              .map(artist => ({
                id: artist.id,
                name: artist.name,
                bio: artist.bio || undefined
              }));
            
            console.log(`✅ [DEBUG] Found ${options.length} artist options for "${artistName}"`);
            return options;
          } else {
            console.log(`📭 [DEBUG] No matches found for "${artistName}" in MusicNerd database`);
            return null;
          }
        } catch (dbError) {
          console.log(`⚠️ [DEBUG] Database query failed for "${artistName}":`, dbError);
          return null;
        }
      }
      
      console.log(`📭 [DEBUG] No connection available for "${artistName}"`);
      return null;
    } catch (error) {
      console.error(`💥 [DEBUG] Exception during artist lookup for "${artistName}":`, error);
      return null;
    }
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
          
          // First get all potential matches case-insensitively to see what's available
          let query = 'SELECT * FROM artists WHERE LOWER(name) = LOWER($1)';
          console.log(`🔍 [DEBUG] Executing search query: ${query} with parameter: "${artistName}"`);
          let result = await client.query(query, [artistName]);
          console.log(`🔍 [DEBUG] Found ${result.rows.length} potential matches for "${artistName}"`);
          
          if (result.rows.length > 0) {
            // Log all matches to see what we have
            console.log(`🔍 [DEBUG] All matches:`, result.rows.map(r => `"${r.name}" (${r.id})`));
            
            // Look for exact case match first
            const exactMatch = result.rows.find(row => row.name === artistName);
            if (exactMatch) {
              console.log(`✅ [DEBUG] Found exact case match: "${exactMatch.name}" (${exactMatch.id})`);
              // Use only the exact match
              result = { ...result, rows: [exactMatch] };
            } else {
              console.log(`🔍 [DEBUG] No exact case match found among ${result.rows.length} case-insensitive matches`);
              // Keep the first case-insensitive match for further processing
              result = { ...result, rows: [result.rows[0]] };
            }
          }
          
          await client.end();
          
          if (result.rows.length > 0) {
            const artist = result.rows[0];
            console.log(`🔍 [DEBUG] Selected artist: "${artist.name}" (ID: ${artist.id})`);
            
            // Check if this is an exact match
            if (artist.name === artistName) {
              console.log(`✅ [DEBUG] Found exact case match for "${artistName}": ${artist.id}`);
              return artist.id;
            } else {
              console.log(`⚠️ [DEBUG] Case differs: searched "${artistName}" but found "${artist.name}" - rejecting to avoid confusion`);
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