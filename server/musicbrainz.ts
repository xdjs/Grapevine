export interface MusicBrainzArtist {
  id: string;
  name: string;
  disambiguation?: string;
  "life-span"?: {
    begin?: string;
    end?: string;
  };
  relations?: MusicBrainzRelation[];
}

export interface MusicBrainzRelation {
  type: string;
  direction: string;
  artist?: MusicBrainzArtist;
  work?: {
    id: string;
    title: string;
    type?: string;
  };
  "target-type": string;
  "target-credit"?: string;
  attributes?: string[];
}

export interface MusicBrainzSearchResult {
  artists: MusicBrainzArtist[];
  count: number;
  offset: number;
}

class MusicBrainzService {
  private baseUrl = 'https://musicbrainz.org/ws/2';
  private userAgent = 'MusicCollaborationVisualizer/1.0 (https://replit.com)';

  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    return response.json();
  }

  async searchArtist(artistName: string): Promise<MusicBrainzArtist | null> {
    try {
      console.log(`🎵 [DEBUG] MusicBrainz searching for artist: "${artistName}"`);
      
      // Try different search strategies for better results
      const searchStrategies = [
        `artist:"${artistName}"`,
        `artist:${encodeURIComponent(artistName)}`,
        encodeURIComponent(artistName)
      ];
      
      for (const searchQuery of searchStrategies) {
        console.log(`🔍 [DEBUG] Trying search query: ${searchQuery}`);
        const endpoint = `/artist?query=${searchQuery}&limit=10&fmt=json`;
        const result: MusicBrainzSearchResult = await this.makeRequest(endpoint);
        
        if (result.artists && result.artists.length > 0) {
          console.log(`🔍 [DEBUG] MusicBrainz found ${result.artists.length} potential matches for "${artistName}"`);
          
          // Log all results for debugging
          result.artists.forEach((artist, index) => {
            console.log(`🔍 [DEBUG] Result ${index + 1}: "${artist.name}" (${artist.id}) ${artist.disambiguation ? `[${artist.disambiguation}]` : ''}`);
          });
          
          // Look for exact name match first
          const exactMatch = result.artists.find(artist => artist.name === artistName);
          if (exactMatch) {
            console.log(`✅ [DEBUG] Found exact match: "${exactMatch.name}" (ID: ${exactMatch.id})`);
            if (exactMatch.disambiguation) {
              console.log(`📝 [DEBUG] Artist disambiguation: "${exactMatch.disambiguation}"`);
            }
            return exactMatch;
          }
          
          // Check for the BLACKPINK member LISA specifically
          if (artistName === "LISA") {
            const blackpinkLisa = result.artists.find(artist => 
              artist.name === "LISA" || 
              (artist.disambiguation && artist.disambiguation.toLowerCase().includes('blackpink'))
            );
            if (blackpinkLisa) {
              console.log(`✅ [DEBUG] Found BLACKPINK LISA: "${blackpinkLisa.name}" (ID: ${blackpinkLisa.id})`);
              return blackpinkLisa;
            }
          }
          
          // Check for Kanye West / Ye specifically
          if (artistName === "Kanye West") {
            const ye = result.artists.find(artist => 
              artist.name === "Ye" || 
              (artist.disambiguation && artist.disambiguation.toLowerCase().includes('formerly kanye west'))
            );
            if (ye) {
              console.log(`✅ [DEBUG] Found Ye (formerly Kanye West): "${ye.name}" (ID: ${ye.id})`);
              return ye;
            }
          }
        }
        
        await this.rateLimitDelay();
      }
      
      console.log(`❌ [DEBUG] MusicBrainz found no artists matching "${artistName}" with any search strategy`);
      return null;
    } catch (error) {
      console.error(`⚠️ [DEBUG] MusicBrainz search error for "${artistName}":`, error);
      return null;
    }
  }

  async getArtistWithRelations(artistId: string): Promise<MusicBrainzArtist | null> {
    try {
      const endpoint = `/artist/${artistId}?inc=artist-rels+work-rels+recording-rels&fmt=json`;
      const artist: MusicBrainzArtist = await this.makeRequest(endpoint);
      return artist;
    } catch (error) {
      console.error('Error getting artist relations:', error);
      return null;
    }
  }

  async getArtistRecordings(artistId: string): Promise<any[]> {
    try {
      const endpoint = `/recording?artist=${artistId}&inc=artist-credits+work-rels&fmt=json&limit=50`;
      const result = await this.makeRequest(endpoint);
      return result.recordings || [];
    } catch (error) {
      console.error('Error getting artist recordings:', error);
      return [];
    }
  }

  async getWorkDetails(workId: string): Promise<any> {
    try {
      const endpoint = `/work/${workId}?inc=artist-rels&fmt=json`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error getting work details:', error);
      return null;
    }
  }

  async getArtistCollaborations(artistName: string): Promise<{
    artists: Array<{ name: string; type: string; relation: string }>;
    works: Array<{ title: string; collaborators: string[] }>;
  }> {
    try {
      // First, search for the artist
      const artist = await this.searchArtist(artistName);
      if (!artist) {
        return { artists: [], works: [] };
      }

      console.log(`🎵 [DEBUG] Getting detailed collaboration data for ${artistName} (ID: ${artist.id})`);

      // Get detailed artist info with relations
      const detailedArtist = await this.getArtistWithRelations(artist.id);
      if (!detailedArtist || !detailedArtist.relations) {
        console.log(`⚠️ [DEBUG] No relations found for ${artistName}`);
        return { artists: [], works: [] };
      }

      const collaboratingArtists: Array<{ name: string; type: string; relation: string }> = [];
      const collaborativeWorks: Array<{ title: string; collaborators: string[] }> = [];
      const processedArtists = new Set<string>();

      console.log(`🔍 [DEBUG] Found ${detailedArtist.relations.length} relations for ${artistName}`);

      // Process artist relations
      for (const relation of detailedArtist.relations) {
        console.log(`🔍 [DEBUG] Relation type: ${relation.type}, target: ${relation["target-type"]}`);
        
        if (relation["target-type"] === "artist" && relation.artist) {
          const relationType = this.mapRelationType(relation.type);
          console.log(`🔍 [DEBUG] Mapping "${relation.type}" to "${relationType}"`);
          
          if (relationType && !processedArtists.has(relation.artist.name)) {
            collaboratingArtists.push({
              name: relation.artist.name,
              type: relationType,
              relation: relation.type
            });
            processedArtists.add(relation.artist.name);
            console.log(`🤝 [DEBUG] Found ${relationType}: ${relation.artist.name} (${relation.type})`);
          } else if (!relationType) {
            console.log(`❌ [DEBUG] Unmapped relation type: ${relation.type}`);
          }
        }

        if (relation["target-type"] === "work" && relation.work) {
          collaborativeWorks.push({
            title: relation.work.title,
            collaborators: [artistName]
          });
        }
      }

      // Get recordings to find producers and songwriters
      console.log(`🎵 [DEBUG] Fetching recordings for ${artistName} to find producers/songwriters`);
      await this.rateLimitDelay();
      const recordings = await this.getArtistRecordings(artist.id);
      console.log(`🎵 [DEBUG] Found ${recordings.length} recordings for ${artistName}`);

      // Process recordings to extract production credits
      for (const recording of recordings.slice(0, 10)) { // Limit to first 10 recordings to avoid rate limits
        if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
          for (const credit of recording['artist-credit']) {
            if (credit.artist && credit.artist.name !== artistName) {
              const artistName = credit.artist.name;
              if (!processedArtists.has(artistName)) {
                // Try to determine role from artist credit
                const joinPhrase = credit.joinphrase || '';
                let type = 'artist';
                
                if (joinPhrase.toLowerCase().includes('produced') || 
                    joinPhrase.toLowerCase().includes('producer')) {
                  type = 'producer';
                } else if (joinPhrase.toLowerCase().includes('wrote') || 
                           joinPhrase.toLowerCase().includes('written')) {
                  type = 'songwriter';
                }

                collaboratingArtists.push({
                  name: artistName,
                  type: type,
                  relation: 'recording credit'
                });
                processedArtists.add(artistName);
                console.log(`🎵 [DEBUG] Found recording credit: ${artistName} (${type})`);
              }
            }
          }
        }
      }

      // Process work relations for detailed songwriter/producer credits
      for (const work of collaborativeWorks.slice(0, 5)) { // Limit to avoid rate limits
        // This would require additional API calls to get work details
        // For now, we'll rely on the artist relations and recording credits
      }

      console.log(`✅ [DEBUG] Total collaborators found for ${artistName}: ${collaboratingArtists.length}`);
      return {
        artists: collaboratingArtists,
        works: collaborativeWorks
      };
    } catch (error) {
      console.error('Error getting collaborations:', error);
      return { artists: [], works: [] };
    }
  }

  private mapRelationType(musicBrainzType: string): string | null {
    const typeMap: { [key: string]: string } = {
      // Artist relationships
      'member': 'artist',
      'member of band': 'artist',
      'collaboration': 'artist',
      'supporting musician': 'artist',
      'vocalist': 'artist',
      'performance': 'artist',
      'featured artist': 'artist',
      'guest': 'artist',
      'remixer': 'artist',
      
      // Producer relationships
      'producer': 'producer',
      'engineer': 'producer',
      'recording engineer': 'producer',
      'mix engineer': 'producer',
      'mastering engineer': 'producer',
      'mix': 'producer',
      'mastering': 'producer',
      'executive producer': 'producer',
      'co-producer': 'producer',
      
      // Songwriter relationships
      'composer': 'songwriter',
      'lyricist': 'songwriter',
      'writer': 'songwriter',
      'arranger': 'songwriter',
      'songwriter': 'songwriter',
      'co-writer': 'songwriter',
      'additional songwriter': 'songwriter',
      'librettist': 'songwriter',
    };

    return typeMap[musicBrainzType.toLowerCase()] || null;
  }

  // Rate limiting helper
  private async rateLimitDelay(): Promise<void> {
    // MusicBrainz allows 1 request per second
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export const musicBrainzService = new MusicBrainzService();