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
          
          // Look for exact name match first (case-sensitive)
          let exactMatch = result.artists.find(artist => artist.name === artistName);
          if (exactMatch) {
            console.log(`✅ [DEBUG] Found exact match: "${exactMatch.name}" (ID: ${exactMatch.id})`);
            if (exactMatch.disambiguation) {
              console.log(`📝 [DEBUG] Artist disambiguation: "${exactMatch.disambiguation}"`);
            }
            return exactMatch;
          }
          
          // If no exact match, try case-insensitive match
          exactMatch = result.artists.find(artist => artist.name.toLowerCase() === artistName.toLowerCase());
          if (exactMatch) {
            console.log(`✅ [DEBUG] Found case-insensitive match: "${artistName}" → "${exactMatch.name}" (ID: ${exactMatch.id})`);
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
      const endpoint = `/recording?artist=${artistId}&inc=artist-credits+artist-rels+work-rels&fmt=json&limit=50`;
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

      // Process artist relations (limit to prevent infinite loops)
      const maxRelationsToProcess = 100; // Limit relations processing to prevent timeout
      const relationsToProcess = detailedArtist.relations.slice(0, maxRelationsToProcess);
      
      for (const relation of relationsToProcess) {
        // Only log first 10 relations to avoid log spam
        if (relationsToProcess.indexOf(relation) < 10) {
          console.log(`🔍 [DEBUG] Relation type: ${relation.type}, target: ${relation["target-type"]}`);
        }
        
        if (relation["target-type"] === "artist" && relation.artist) {
          let relationType = this.mapRelationType(relation.type);
          
          if (relationType && !processedArtists.has(relation.artist.name)) {
            // Use relation type directly from MusicBrainz without hardcoded reclassification
            
            collaboratingArtists.push({
              name: relation.artist.name,
              type: relationType,
              relation: relation.type
            });
            processedArtists.add(relation.artist.name);
            console.log(`🤝 [DEBUG] Found ${relationType}: ${relation.artist.name} (${relation.type})`);
          }
        }

        if (relation["target-type"] === "work" && relation.work) {
          // Check if this is a songwriter relationship (composer, lyricist, etc.)
          if (relation.type && ['composer', 'lyricist', 'writer', 'arranger'].includes(relation.type.toLowerCase())) {
            // This indicates the main artist is a songwriter for this work
            // Look for other songwriters associated with this work
            try {
              const workDetails = await this.getWorkDetails(relation.work.id);
              if (workDetails && workDetails.relations) {
                for (const workRelation of workDetails.relations) {
                  if (workRelation["target-type"] === "artist" && workRelation.artist && 
                      workRelation.artist.name !== artistName &&
                      ['composer', 'lyricist', 'writer', 'arranger'].includes(workRelation.type?.toLowerCase() || '')) {
                    
                    if (!processedArtists.has(workRelation.artist.name)) {
                      collaboratingArtists.push({
                        name: workRelation.artist.name,
                        type: 'songwriter',
                        relation: `work ${workRelation.type}`
                      });
                      processedArtists.add(workRelation.artist.name);
                      console.log(`✍️ [DEBUG] Found songwriter from work: ${workRelation.artist.name} (${workRelation.type})`);
                    }
                  }
                }
              }
            } catch (workError) {
              console.log(`⚠️ [DEBUG] Could not fetch work details for "${relation.work.title}":`, workError);
            }
          }
          
          collaborativeWorks.push({
            title: relation.work.title,
            collaborators: [artistName]
          });
        }
      }
      
      if (detailedArtist.relations.length > maxRelationsToProcess) {
        console.log(`⚠️ [DEBUG] Limited relation processing to ${maxRelationsToProcess} out of ${detailedArtist.relations.length} total relations`);
      }

      console.log(`🔄 [DEBUG] Finished processing ${detailedArtist.relations.length} relations, found ${collaboratingArtists.length} collaborators`);
      console.log(`🔄 [DEBUG] About to start recordings analysis for ${artistName}...`);

      // Get recordings to find producers and songwriters
      console.log(`🎵 [DEBUG] Fetching recordings for ${artistName} to find producers/songwriters`);
      try {
        await this.rateLimitDelay();
        const recordings = await this.getArtistRecordings(artist.id);
        console.log(`🎵 [DEBUG] Found ${recordings.length} recordings for ${artistName}`);

      // Process recordings to extract production credits
      for (const recording of recordings.slice(0, 10)) { // Limit to first 10 recordings to avoid rate limits
        console.log(`🎵 [DEBUG] Processing recording: "${recording.title}" for ${artistName}`);
        
        // Check recording relations for producers/engineers
        if (recording.relations && recording.relations.length > 0) {
          console.log(`🔍 [DEBUG] Found ${recording.relations.length} relations in recording "${recording.title}"`);
          for (const relation of recording.relations) {
            if (relation.artist && relation.artist.name !== artistName) {
              const collaboratorName = relation.artist.name;
              if (!processedArtists.has(collaboratorName)) {
                let relationType = this.mapRelationType(relation.type);
                if (relationType) {
                  // Use relation type directly from MusicBrainz without hardcoded reclassification
                  
                  collaboratingArtists.push({
                    name: collaboratorName,
                    type: relationType,
                    relation: `recording ${relation.type}`
                  });
                  processedArtists.add(collaboratorName);
                  console.log(`🎵 [DEBUG] Found recording relation: ${collaboratorName} (${relationType}) - ${relation.type}`);
                }
              }
            }
          }
        }
        
        // Check artist credits (existing logic)
        if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
          for (const credit of recording['artist-credit']) {
            if (credit.artist && credit.artist.name !== artistName) {
              const collaboratorName = credit.artist.name;
              if (!processedArtists.has(collaboratorName)) {
                // Try to determine role from artist credit and known producer/songwriter names
                const joinPhrase = credit.joinphrase || '';
                let type = 'artist';
                
                // Check for production-related keywords in join phrase
                if (joinPhrase.toLowerCase().includes('produced') || 
                    joinPhrase.toLowerCase().includes('producer') ||
                    joinPhrase.toLowerCase().includes('mixed') ||
                    joinPhrase.toLowerCase().includes('engineered')) {
                  type = 'producer';
                } else if (joinPhrase.toLowerCase().includes('wrote') || 
                           joinPhrase.toLowerCase().includes('written') ||
                           joinPhrase.toLowerCase().includes('composed') ||
                           joinPhrase.toLowerCase().includes('lyrics')) {
                  type = 'songwriter';

                } else {
                  // Use context-based identification for known producer/songwriter names
                  // Use only the role data from MusicBrainz relation types - no hardcoded classifications
                  console.log(`🔍 [DEBUG] Using MusicBrainz relation type for: "${collaboratorName}"`)
                }
                // Use artist type as provided by MusicBrainz without hardcoded arrays

                collaboratingArtists.push({
                  name: collaboratorName,
                  type: type,
                  relation: 'recording credit'
                });
                processedArtists.add(collaboratorName);
                console.log(`🎵 [DEBUG] Found recording credit: ${collaboratorName} (${type})`);
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

        console.log(`✅ [DEBUG] Recordings analysis completed for ${artistName}`);
      } catch (recordingsError) {
        console.error(`❌ [DEBUG] Error in recordings analysis for ${artistName}:`, recordingsError);
      }

      console.log(`✅ [DEBUG] Total collaborators found for ${artistName}: ${collaboratingArtists.length}`);
      

      // Use only data from MusicBrainz API - no hardcoded collaborations

      // Using purely API-driven data - no hardcoded collaborations

      
      console.log(`✅ [DEBUG] Final collaborators count for ${artistName}: ${collaboratingArtists.length}`);
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
      'music': 'songwriter',
      'lyrics': 'songwriter',
      'composition': 'songwriter',
      'writing': 'songwriter',
      'song writing': 'songwriter',
      'written by': 'songwriter',
      'song writer': 'songwriter',
      'music writer': 'songwriter',
      'lyrics writer': 'songwriter',
      'authored by': 'songwriter',
      'penned by': 'songwriter',
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