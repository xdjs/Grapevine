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
          const relationType = this.mapRelationType(relation.type);
          
          if (relationType && !processedArtists.has(relation.artist.name)) {
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
                const relationType = this.mapRelationType(relation.type);
                if (relationType) {
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
                  const knownProducers = [
                    'andrew watt', 'metro boomin', 'timbaland', 'pharrell williams',
                    'dr. dre', 'kanye west', 'rick rubin', 'max martin', 'jack antonoff',
                    'aaron dessner', 'diplo', 'skrillex', 'calvin harris', 'zedd',
                    'the neptunes', 'daft punk', 'disclosure', 'flume', 'benny blanco',
                    'finneas', 'mustard', 'lex luger', 'zaytoven', 'noah shebib',
                    'frank dukes', 'southside', 'wheezy', 'pierre bourne', 'london on da track',
                    'mike will made-it', 'j. cole', 'tay keith', 'cubeatz', 'illangelo',
                    'ronny j', 'cardo', 'pvlace', 'da internz', 'ovy on the drums',
                    'david guetta', 'will.i.am', 'afrojack', 'steve aoki', 'deadmau5',
                    'avicii', 'martin garrix', 'the chainsmokers', 'marshmello', 'tiësto',
                    // Post Malone collaborators specifically
                    'louis bell', 'tank god', 'frank dukes', 'brian lee', 'adam feeney',
                    'matt dragstrem', 'billy walsh', 'kaan gunesberk', 'carter lang',
                    'cashmere cat', 'dre moon', 'charlie handsome', 'joe london',
                    'swae lee', 'ty dolla sign', 'quavo', '21 savage', 'dj mustard',
                    // Additional common producers
                    'hit-boy', 'lex luger', 'southside', 'tm88', 'metro thuggin',
                    'wheezy', 'cubeatz', 'tay keith', 'ronny j', 'pierre bourne',
                    'london on da track', 'mike will made-it', 'zaytoven', 'young thug'
                  ];
                  
                  const knownSongwriters = [
                    'diane warren', 'linda perry', 'ryan tedder', 'sia', 'ed sheeran',
                    'taylor swift', 'john mayer', 'alicia keys', 'john legend',
                    'carole king', 'paul mccartney', 'john lennon', 'charlie puth',
                    'julia michaels', 'justin tranter', 'mattman & robin', 'shellback',
                    'benjamin levin', 'cashmere cat', 'the weeknd', 'frank ocean',
                    'solange', 'lorde', 'halsey', 'billie eilish', 'olivia rodrigo'
                  ];
                  
                  const collaboratorNameLower = collaboratorName.toLowerCase();
                  console.log(`🔍 [DEBUG] Checking producer/songwriter status for: "${collaboratorNameLower}"`);
                  
                  // Pattern-based detection for common producer/songwriter indicators
                  const producerPatterns = [
                    'beats', 'beatz', 'producer', 'made', 'da track', 'on da', 'the beat',
                    'muzik', 'sounds', 'records', 'tha', 'lil ', 'big ', 'young ', 'j. '
                  ];
                  
                  const songwriterPatterns = [
                    'wrote', 'writer', 'songwriter', 'composed', 'lyrics', 'pen',
                    'words', 'music', 'melody'
                  ];
                  
                  if (knownProducers.some(producer => collaboratorNameLower.includes(producer))) {
                    type = 'producer';
                    console.log(`✅ [DEBUG] Matched as producer: "${collaboratorNameLower}"`);
                  } else if (knownSongwriters.some(songwriter => collaboratorNameLower.includes(songwriter))) {
                    type = 'songwriter';
                    console.log(`✅ [DEBUG] Matched as songwriter: "${collaboratorNameLower}"`);
                  } else if (producerPatterns.some(pattern => collaboratorNameLower.includes(pattern))) {
                    type = 'producer';
                    console.log(`✅ [DEBUG] Matched as producer by pattern: "${collaboratorNameLower}"`);
                  } else if (songwriterPatterns.some(pattern => collaboratorNameLower.includes(pattern))) {
                    type = 'songwriter';
                    console.log(`✅ [DEBUG] Matched as songwriter by pattern: "${collaboratorNameLower}"`);
                  } else {
                    console.log(`❌ [DEBUG] No producer/songwriter match for: "${collaboratorNameLower}"`);
                  }
                }

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