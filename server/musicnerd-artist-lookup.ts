import postgres from 'postgres';

export interface MusicNerdArtist {
  id: string;
  name: string;
  bio?: string;
  spotify?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  soundcloud?: string;
}

class MusicNerdArtistLookup {
  private client: any = null;

  constructor() {
    if (process.env.CONNECTION_STRING) {
      this.client = postgres(process.env.CONNECTION_STRING);
    }
  }

  async findArtistByName(artistName: string): Promise<MusicNerdArtist | null> {
    if (!this.client) {
      console.log('No MusicNerd database connection available');
      return null;
    }

    try {
      // Query MusicNerd's artists table for exact or partial name match
      const query = `
        SELECT id, name, bio, spotify, instagram, youtube, x as twitter, soundcloud
        FROM artists 
        WHERE LOWER(name::text) = LOWER($1) 
        OR LOWER(lcname) = LOWER($1)
        LIMIT 1;
      `;

      const result = await this.client.unsafe(query, [artistName]);

      if (result.length > 0) {
        const artist = result[0];
        console.log(`✅ Found MusicNerd artist: ${artist.name} (ID: ${artist.id})`);
        
        return {
          id: artist.id,
          name: artist.name,
          bio: artist.bio,
          spotify: artist.spotify,
          instagram: artist.instagram,
          youtube: artist.youtube,
          twitter: artist.twitter,
          soundcloud: artist.soundcloud
        };
      }

      // If no exact match, try partial search
      const partialQuery = `
        SELECT id, name, bio, spotify, instagram, youtube, x as twitter, soundcloud
        FROM artists 
        WHERE LOWER(name::text) LIKE LOWER($1) 
        OR LOWER(lcname) LIKE LOWER($1)
        ORDER BY 
          CASE 
            WHEN LOWER(name::text) = LOWER($2) THEN 1
            WHEN LOWER(name::text) LIKE LOWER($3) THEN 2
            ELSE 3
          END
        LIMIT 1;
      `;

      const partialResult = await this.client.unsafe(partialQuery, [
        `%${artistName}%`,
        artistName,
        `${artistName}%`
      ]);

      if (partialResult.length > 0) {
        const artist = partialResult[0];
        console.log(`🔍 Found MusicNerd artist (partial match): ${artist.name} (ID: ${artist.id})`);
        
        return {
          id: artist.id,
          name: artist.name,
          bio: artist.bio,
          spotify: artist.spotify,
          instagram: artist.instagram,
          youtube: artist.youtube,
          twitter: artist.twitter,
          soundcloud: artist.soundcloud
        };
      }

      console.log(`❌ No MusicNerd artist found for: ${artistName}`);
      return null;

    } catch (error) {
      console.error('Error searching MusicNerd artists:', error);
      return null;
    }
  }

  async findMultipleArtists(artistNames: string[]): Promise<Map<string, MusicNerdArtist>> {
    const results = new Map<string, MusicNerdArtist>();

    for (const artistName of artistNames) {
      const artist = await this.findArtistByName(artistName);
      if (artist) {
        results.set(artistName, artist);
      }
    }

    return results;
  }

  // Generate MusicNerd profile URL using artist ID
  generateProfileUrl(artistId: string): string {
    return `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
  }

  async close() {
    if (this.client) {
      await this.client.end();
    }
  }
}

export const musicNerdLookup = new MusicNerdArtistLookup();