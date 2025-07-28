import 'dotenv/config';
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
          
          // Optimized search with smart query selection based on input length
          let query: string;
          let params: string[];
          
          if (artistName.length === 1) {
            // For single character: only show names starting with that character
            query = `
              SELECT id, name FROM artists 
              WHERE LOWER(name) LIKE LOWER($1)
              ORDER BY LENGTH(name), name 
              LIMIT 100
            `;
            params = [`${artistName.toLowerCase()}%`];
          } else if (artistName.length <= 3) {
            // For short inputs: prefix matching with secondary contains matching
            query = `
              SELECT id, name FROM artists 
              WHERE LOWER(name) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($2)
              ORDER BY 
                CASE 
                  WHEN LOWER(name) LIKE LOWER($1) THEN 1 
                  WHEN LOWER(name) LIKE LOWER($3) THEN 2
                  ELSE 3 
                END,
                LENGTH(name),
                name 
              LIMIT 150
            `;
            params = [`${artistName.toLowerCase()}%`, `%${artistName.toLowerCase()}%`, `${artistName.toLowerCase()}%`];
          } else {
            // For longer inputs: comprehensive fuzzy matching
            query = 'SELECT id, name FROM artists WHERE LOWER(name) LIKE LOWER($1) ORDER BY LENGTH(name), name LIMIT 200';
            params = [`%${artistName.toLowerCase()}%`];
          }
          
          console.log(`🔍 [DEBUG] Optimized query for "${artistName}" (length: ${artistName.length})`);
          const result = await client.query(query, params);
          
          await client.end();
          
          if (result.rows.length > 0) {
            const options = result.rows
              .map(artist => {
                const searchLower = artistName.toLowerCase();
                const foundLower = artist.name.toLowerCase();
                
                // Calculate relevance score for better ranking
                const score = this.calculateRelevanceScore(searchLower, foundLower);
                console.log(`🔍 [DEBUG] "${artist.name}" relevance score: ${score}`);
                
                // Generate bio based on artist name (since type column doesn't exist in database)
                const generateBio = (name: string) => {
                  return `${name} is a prominent artist known for their musical contributions across various genres. Their work has influenced many in the music industry and continues to resonate with listeners worldwide.`;
                };
                
                return {
                  id: artist.id,
                  artistId: artist.id, // Add artistId field for consistency with frontend
                  name: artist.name,
                  bio: generateBio(artist.name),
                  score: score
                };
              })
              .filter(artist => artist.score > 0) // Only include relevant matches
              .sort((a, b) => b.score - a.score) // Sort by relevance score (descending)
              // Return all relevant results (no artificial limit)
              .map(({ score, ...artist }) => artist); // Remove score from final result
            
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
          const query = 'SELECT * FROM artists WHERE LOWER(name) = LOWER($1)';
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
            
            // Check if this is an exact match or acceptable case-insensitive match
            if (artist.name === artistName) {
              console.log(`✅ [DEBUG] Found exact case match for "${artistName}": ${artist.id}`);
              return artist.id;
            } else if (artist.name.toLowerCase() === artistName.toLowerCase()) {
              console.log(`✅ [DEBUG] Found acceptable case-insensitive match: "${artistName}" → "${artist.name}": ${artist.id}`);
              return artist.id;
            } else {
              console.log(`⚠️ [DEBUG] Name mismatch: searched "${artistName}" but found "${artist.name}" - rejecting`);
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

  async getArtistProfilePicture(artistName: string): Promise<{ id: string | null, imageUrl: string | null }> {
    if (!this.isAvailable) {
      console.log(`🔒 [DEBUG] MusicNerd service not available for "${artistName}"`);
      return { id: null, imageUrl: null };
    }

    try {
      console.log(`🖼️ [DEBUG] Looking up profile picture for: "${artistName}"`);
      
      const connectionString = process.env.CONNECTION_STRING;
      if (connectionString && connectionString.includes('postgresql://')) {
        try {
          const { Client } = await import('pg');
          const client = new Client({ connectionString });
          
          await client.connect();
          
          // Query for artist with imageUrl
          const query = 'SELECT id, name, image_url FROM artists WHERE LOWER(name) = LOWER($1)';
          const result = await client.query(query, [artistName]);
          
          await client.end();
          
          if (result.rows.length > 0) {
            const artist = result.rows[0];
            
            // Check for exact case match first
            const exactMatch = result.rows.find(row => row.name === artistName);
            const selectedArtist = exactMatch || artist;
            
            console.log(`🖼️ [DEBUG] Found artist: "${selectedArtist.name}" (ID: ${selectedArtist.id})`);
            console.log(`🖼️ [DEBUG] Image URL: ${selectedArtist.image_url || 'None'}`);
            
            return {
              id: selectedArtist.id,
              imageUrl: selectedArtist.image_url || null
            };
          } else {
            console.log(`📭 [DEBUG] No artist found for "${artistName}" in MusicNerd database`);
            return { id: null, imageUrl: null };
          }
        } catch (dbError) {
          console.log(`⚠️ [DEBUG] Database query failed for "${artistName}":`, dbError);
          return { id: null, imageUrl: null };
        }
      }
      
      return { id: null, imageUrl: null };
    } catch (error) {
      console.error(`💥 [DEBUG] Exception during profile picture lookup for "${artistName}":`, error);
      return { id: null, imageUrl: null };
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

  private calculateRelevanceScore(searchTerm: string, artistName: string): number {
    let score = 0;
    
    // Exact match gets highest score
    if (searchTerm === artistName) {
      return 1000;
    }
    
    // Case-insensitive exact match
    if (searchTerm.toLowerCase() === artistName.toLowerCase()) {
      return 900;
    }
    
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    const artistWords = artistName.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    // Exact word matches
    let exactWordMatches = 0;
    for (const searchWord of searchWords) {
      if (artistWords.includes(searchWord.toLowerCase())) {
        exactWordMatches++;
        score += 100;
      }
    }
    
    // Prefix matches (artist starts with search term)
    if (artistName.toLowerCase().startsWith(searchTerm)) {
      score += 200;
    }
    
    // Word boundary prefix matches
    for (const searchWord of searchWords) {
      for (const artistWord of artistWords) {
        if (artistWord.startsWith(searchWord.toLowerCase())) {
          score += 50;
        }
      }
    }
    
    // Substring matches within words
    for (const searchWord of searchWords) {
      for (const artistWord of artistWords) {
        if (artistWord.includes(searchWord.toLowerCase()) && !artistWord.startsWith(searchWord.toLowerCase())) {
          score += 25;
        }
      }
    }
    
    // Length similarity bonus (closer lengths are better)
    const lengthDiff = Math.abs(searchTerm.length - artistName.length);
    const maxLength = Math.max(searchTerm.length, artistName.length);
    const lengthSimilarity = 1 - (lengthDiff / maxLength);
    score += lengthSimilarity * 30;
    
    // Character similarity using Levenshtein distance
    const distance = this.levenshteinDistance(searchTerm, artistName.toLowerCase());
    const maxLen = Math.max(searchTerm.length, artistName.length);
    const similarity = 1 - (distance / maxLen);
    score += similarity * 40;
    
    // Bonus for shorter artist names (often more popular/relevant)
    if (artistName.length <= 15) {
      score += 10;
    }
    
    return Math.round(score);
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export const musicNerdService = new MusicNerdService();