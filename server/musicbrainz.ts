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
  private userAgent = 'MusicCollaborationVisualizer/1.0 (https://github.com/grapevine-music)';

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

  async getArtistReleases(artistId: string): Promise<any[]> {
    try {
      const endpoint = `/release?artist=${artistId}&inc=artist-credits&fmt=json&limit=25`;
      const result = await this.makeRequest(endpoint);
      return result.releases || [];
    } catch (error) {
      console.error('Error getting artist releases:', error);
      return [];
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
            // Reclassify known songwriter-producers as songwriters
            const collaboratorNameLower = relation.artist.name.toLowerCase();
            const knownSongwriters = [
              'jack antonoff', 'max martin', 'aaron dessner', 'finneas',
              'benny blanco', 'oscar holter', 'greg kurstin', 'ludwig göransson', 
              'shellback', 'ali payami', 'patrik berger', 'sia', 'ed sheeran',
              'ryan tedder', 'charlie puth', 'julia michaels', 'justin tranter'
            ];
            
            if (knownSongwriters.some(songwriter => collaboratorNameLower.includes(songwriter))) {
              relationType = 'songwriter';
              console.log(`✨ [DEBUG] Reclassified "${relation.artist.name}" as songwriter`);
            }
            
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
                  // Reclassify known songwriter-producers as songwriters
                  const collaboratorNameLower = collaboratorName.toLowerCase();
                  const knownSongwriters = [
                    'jack antonoff', 'max martin', 'aaron dessner', 'finneas',
                    'benny blanco', 'oscar holter', 'greg kurstin', 'ludwig göransson', 
                    'shellback', 'ali payami', 'patrik berger', 'sia', 'ed sheeran',
                    'ryan tedder', 'charlie puth', 'julia michaels', 'justin tranter'
                  ];
                  
                  if (knownSongwriters.some(songwriter => collaboratorNameLower.includes(songwriter))) {
                    relationType = 'songwriter';
                    console.log(`✨ [DEBUG] Reclassified "${collaboratorName}" as songwriter`);
                  }
                  
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

  async getCollaborationDetails(artist1Name: string, artist2Name: string): Promise<{
    songs: string[];
    albums: string[];
    collaborationType: string;
    details: string[];
  }> {
    try {
      console.log(`🤝 [DEBUG] Fetching collaboration details between "${artist1Name}" and "${artist2Name}"`);
      
      // Search for both artists
      const [artist1, artist2] = await Promise.all([
        this.searchArtist(artist1Name),
        this.searchArtist(artist2Name)
      ]);

      if (!artist1 || !artist2) {
        console.log(`❌ [DEBUG] Could not find one or both artists: ${artist1Name}, ${artist2Name}`);
        return { songs: [], albums: [], collaborationType: 'unknown', details: [] };
      }

      console.log(`✅ [DEBUG] Found both artists: ${artist1Name} (${artist1.id}), ${artist2Name} (${artist2.id})`);

      const songs: string[] = [];
      const albums: string[] = [];
      let collaborationType = 'unknown';
      const details: string[] = [];
      const processedRecordings = new Set<string>();
      const processedReleases = new Set<string>();

      // Get detailed info for both artists
      const [detailedArtist1, detailedArtist2] = await Promise.all([
        this.getArtistWithRelations(artist1.id),
        this.getArtistWithRelations(artist2.id)
      ]);

      // Check artist-to-artist relations first
      if (detailedArtist1?.relations) {
        for (const relation of detailedArtist1.relations) {
          if (relation["target-type"] === "artist" && 
              relation.artist?.name.toLowerCase() === artist2Name.toLowerCase()) {
            const relationType = this.mapRelationType(relation.type);
            if (relationType) {
              collaborationType = relation.type;
              details.push(`${artist1Name} and ${artist2Name} have a "${relation.type}" relationship`);
              console.log(`🔍 [DEBUG] Found direct relationship: ${relation.type}`);
            }
          }
        }
      }

      // Get recordings for artist1 to find collaborations
      await this.rateLimitDelay();
      const recordings1 = await this.getArtistRecordings(artist1.id);
      console.log(`🎵 [DEBUG] Found ${recordings1.length} recordings for ${artist1Name}`);

      // Process recordings to find collaborations
      for (const recording of recordings1.slice(0, 20)) { // Limit to prevent timeout
        if (processedRecordings.has(recording.id)) continue;
        processedRecordings.add(recording.id);

        let foundCollaboration = false;

        // Check artist credits
        if (recording['artist-credit']) {
          for (const credit of recording['artist-credit']) {
            if (credit.artist?.name.toLowerCase().includes(artist2Name.toLowerCase()) ||
                artist2Name.toLowerCase().includes(credit.artist?.name.toLowerCase() || '')) {
              songs.push(recording.title);
              foundCollaboration = true;
              console.log(`🎵 [DEBUG] Found song collaboration: "${recording.title}"`);
              
              // Determine collaboration type from credits
              const joinPhrase = credit.joinphrase || '';
              if (joinPhrase.toLowerCase().includes('produced')) {
                collaborationType = 'production';
                details.push(`${artist2Name} produced "${recording.title}"`);
              } else if (joinPhrase.toLowerCase().includes('wrote') || joinPhrase.toLowerCase().includes('composed')) {
                collaborationType = 'songwriting';
                details.push(`${artist2Name} co-wrote "${recording.title}"`);
              } else {
                collaborationType = 'performance';
                details.push(`${artist2Name} featured on "${recording.title}"`);
              }
              break;
            }
          }
        }

        // Check recording relations (producer, engineer, etc.)
        if (!foundCollaboration && recording.relations) {
          for (const relation of recording.relations) {
            if (relation.artist?.name.toLowerCase().includes(artist2Name.toLowerCase()) ||
                artist2Name.toLowerCase().includes(relation.artist?.name.toLowerCase() || '')) {
              songs.push(recording.title);
              foundCollaboration = true;
              console.log(`🎵 [DEBUG] Found recording relation: "${recording.title}" - ${relation.type}`);
              
              const relationType = this.mapRelationType(relation.type);
              if (relationType === 'producer') {
                collaborationType = 'production';
                details.push(`${artist2Name} ${relation.type} on "${recording.title}"`);
              } else if (relationType === 'songwriter') {
                collaborationType = 'songwriting';
                details.push(`${artist2Name} ${relation.type} on "${recording.title}"`);
              }
              break;
            }
          }
        }
      }

      // Get releases (albums) for artist1 to find album collaborations
      await this.rateLimitDelay();
      const releases1 = await this.getArtistReleases(artist1.id);
      console.log(`💿 [DEBUG] Found ${releases1.length} releases for ${artist1Name}`);

      for (const release of releases1.slice(0, 10)) { // Limit to prevent timeout
        if (processedReleases.has(release.id)) continue;
        processedReleases.add(release.id);

        // Check release artist credits
        if (release['artist-credit']) {
          for (const credit of release['artist-credit']) {
            if (credit.artist?.name.toLowerCase().includes(artist2Name.toLowerCase()) ||
                artist2Name.toLowerCase().includes(credit.artist?.name.toLowerCase() || '')) {
              albums.push(release.title);
              console.log(`💿 [DEBUG] Found album collaboration: "${release.title}"`);
              details.push(`Collaborated on album "${release.title}"`);
              break;
            }
          }
        }
      }

      console.log(`✅ [DEBUG] Collaboration details found: ${songs.length} songs, ${albums.length} albums`);
      return {
        songs: Array.from(new Set(songs)), // Remove duplicates
        albums: Array.from(new Set(albums)), // Remove duplicates
        collaborationType,
        details: Array.from(new Set(details)) // Remove duplicates
      };

    } catch (error) {
      console.error(`❌ [DEBUG] Error fetching collaboration details between ${artist1Name} and ${artist2Name}:`, error);
      return { songs: [], albums: [], collaborationType: 'unknown', details: [] };
    }
  }
}

export const musicBrainzService = new MusicBrainzService();