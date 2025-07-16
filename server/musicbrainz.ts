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

  async searchArtist(artistName: string): Promise<any> {
    await this.rateLimitDelay();
    
    console.log(`🔍 [DEBUG] Searching MusicBrainz for artist: "${artistName}"`);
    
    try {
      // Try exact match first
      let url = `${this.baseUrl}/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=10`;
      let response = await fetch(url);
      let data = await response.json();
      
      console.log(`🎯 [DEBUG] Exact search for "${artistName}" returned ${data.artists?.length || 0} results`);
      
      // If exact match found with high score, use it
      if (data.artists && data.artists.length > 0) {
        const topMatch = data.artists.find((artist: any) => 
          artist.name.toLowerCase() === artistName.toLowerCase() && artist.score >= 95
        );
        if (topMatch) {
          console.log(`✅ [DEBUG] Found high-confidence exact match for "${artistName}": ${topMatch.name} (score: ${topMatch.score})`);
          return topMatch;
        }
      }
      
      // Try fuzzy search for potentially similar names or aliases
      url = `${this.baseUrl}/artist/?query=${encodeURIComponent(artistName)}&fmt=json&limit=15`;
      response = await fetch(url);
      data = await response.json();
      
      console.log(`🎯 [DEBUG] Fuzzy search for "${artistName}" returned ${data.artists?.length || 0} results`);
      
      if (data.artists && data.artists.length > 0) {
        // Look for exact name match first
        let bestMatch = data.artists.find((artist: any) => 
          artist.name.toLowerCase() === artistName.toLowerCase()
        );
        
        if (bestMatch) {
          console.log(`✅ [DEBUG] Found exact name match for "${artistName}": ${bestMatch.name}`);
          return bestMatch;
        }
        
        // For smaller artists, try alias matching and partial matches
        for (const artist of data.artists) {
          // Check aliases for smaller/independent artists who might have stage names
          if (artist.aliases) {
            const aliasMatch = artist.aliases.find((alias: any) => 
              alias.name.toLowerCase() === artistName.toLowerCase()
            );
            if (aliasMatch) {
              console.log(`✅ [DEBUG] Found alias match for "${artistName}": ${artist.name} (alias: ${aliasMatch.name})`);
              return artist;
            }
          }
          
          // For artists with scores above 85, consider as potential matches
          if (artist.score >= 85) {
            console.log(`✅ [DEBUG] Found high-score match for "${artistName}": ${artist.name} (score: ${artist.score})`);
            return artist;
          }
        }
        
        // If still no match and this might be a smaller artist, try the first reasonable result
        const firstResult = data.artists[0];
        if (firstResult.score >= 70) {
          console.log(`⚠️ [DEBUG] Using best available match for "${artistName}": ${firstResult.name} (score: ${firstResult.score})`);
          return firstResult;
        }
      }
      
      // Try alternative search strategies for smaller artists
      // Search by sortname (handles cases like "Last, First" format)
      url = `${this.baseUrl}/artist/?query=sortname:"${encodeURIComponent(artistName)}"&fmt=json&limit=10`;
      response = await fetch(url);
      data = await response.json();
      
      if (data.artists && data.artists.length > 0) {
        console.log(`✅ [DEBUG] Found sortname match for "${artistName}": ${data.artists[0].name}`);
        return data.artists[0];
      }
      
      console.log(`❌ [DEBUG] No suitable match found for "${artistName}"`);
      return null;
      
    } catch (error) {
      console.error(`❌ [DEBUG] Error searching for artist "${artistName}":`, error);
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

  async getArtistRecordings(artistId: string, limit: number = 50): Promise<any[]> {
    try {
      const endpoint = `/recording?artist=${artistId}&inc=artist-credits+artist-rels+work-rels&fmt=json&limit=${limit}`;
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

  async getArtistReleases(artistId: string, limit: number = 25): Promise<any[]> {
    try {
      const endpoint = `/release?artist=${artistId}&inc=artist-credits&fmt=json&limit=${limit}`;
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
      
      // Search for both artists with enhanced search
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

      // Enhanced recording search - more comprehensive for smaller artists
      console.log(`🎵 [DEBUG] Searching recordings for both artists...`);
      
      // Get recordings for both artists
      const [recordings1, recordings2] = await Promise.all([
        this.getArtistRecordings(artist1.id, 30), // Increased limit for smaller artists
        this.getArtistRecordings(artist2.id, 30)
      ]);
      
      console.log(`🎵 [DEBUG] Found ${recordings1.length} recordings for ${artist1Name}, ${recordings2.length} for ${artist2Name}`);

      // Cross-reference recordings between both artists
      const allRecordings = [...recordings1, ...recordings2];
      
      for (const recording of allRecordings) {
        if (processedRecordings.has(recording.id)) continue;
        processedRecordings.add(recording.id);

        let foundCollaboration = false;
        let collaboratorFound = '';

        // Enhanced artist credit checking
        if (recording['artist-credit']) {
          const creditNames = recording['artist-credit']
            .map((credit: any) => credit.artist?.name.toLowerCase() || '')
            .filter((name: string) => name.length > 0);
          
          const hasArtist1 = creditNames.some((name: string) => 
            name.includes(artist1Name.toLowerCase()) || artist1Name.toLowerCase().includes(name)
          );
          const hasArtist2 = creditNames.some((name: string) => 
            name.includes(artist2Name.toLowerCase()) || artist2Name.toLowerCase().includes(name)
          );
          
          if (hasArtist1 && hasArtist2) {
            songs.push(recording.title);
            foundCollaboration = true;
            collaboratorFound = hasArtist1 ? artist2Name : artist1Name;
            console.log(`🎵 [DEBUG] Found song collaboration: "${recording.title}"`);
            
            // Enhanced collaboration type detection
            for (const credit of recording['artist-credit']) {
              const joinPhrase = (credit.joinphrase || '').toLowerCase();
              if (joinPhrase.includes('produced') || joinPhrase.includes('producer')) {
                collaborationType = 'production';
                details.push(`${collaboratorFound} produced "${recording.title}"`);
              } else if (joinPhrase.includes('wrote') || joinPhrase.includes('composed') || joinPhrase.includes('songwriter')) {
                collaborationType = 'songwriting';
                details.push(`${collaboratorFound} co-wrote "${recording.title}"`);
              } else if (joinPhrase.includes('feat') || joinPhrase.includes('featuring')) {
                collaborationType = 'performance';
                details.push(`${collaboratorFound} featured on "${recording.title}"`);
              } else {
                collaborationType = 'performance';
                details.push(`${collaboratorFound} collaborated on "${recording.title}"`);
              }
            }
          }
        }

        // Enhanced recording relations checking (crucial for smaller artists)
        if (!foundCollaboration && recording.relations) {
          for (const relation of recording.relations) {
            if (relation.artist?.name) {
              const relationArtistName = relation.artist.name.toLowerCase();
              const isArtist1Related = relationArtistName.includes(artist1Name.toLowerCase()) || 
                                      artist1Name.toLowerCase().includes(relationArtistName);
              const isArtist2Related = relationArtistName.includes(artist2Name.toLowerCase()) || 
                                      artist2Name.toLowerCase().includes(relationArtistName);
              
              if ((isArtist1Related || isArtist2Related) && 
                  relationArtistName !== artist1Name.toLowerCase() && 
                  relationArtistName !== artist2Name.toLowerCase()) {
                songs.push(recording.title);
                foundCollaboration = true;
                collaboratorFound = isArtist1Related ? artist2Name : artist1Name;
                console.log(`🎵 [DEBUG] Found recording relation: "${recording.title}" - ${relation.type}`);
                
                const relationType = this.mapRelationType(relation.type);
                if (relationType === 'producer') {
                  collaborationType = 'production';
                  details.push(`${collaboratorFound} ${relation.type} on "${recording.title}"`);
                } else if (relationType === 'songwriter') {
                  collaborationType = 'songwriting';
                  details.push(`${collaboratorFound} ${relation.type} on "${recording.title}"`);
                } else {
                  collaborationType = relation.type || 'collaboration';
                  details.push(`${collaboratorFound} worked as ${relation.type} on "${recording.title}"`);
                }
                break;
              }
            }
          }
        }
      }

      // Enhanced release search for albums - especially important for smaller artists
      console.log(`💿 [DEBUG] Searching releases for album collaborations...`);
      
      try {
        const [releases1, releases2] = await Promise.all([
          this.getArtistReleases(artist1.id, 20), // Increased limit
          this.getArtistReleases(artist2.id, 20)
        ]);
        
        const allReleases = [...(releases1 || []), ...(releases2 || [])];
        
        for (const release of allReleases) {
          if (processedReleases.has(release.id)) continue;
          processedReleases.add(release.id);
          
          // Check if both artists are credited on the same release
          if (release['artist-credit']) {
            const creditNames = release['artist-credit']
              .map((credit: any) => credit.artist?.name.toLowerCase() || '')
              .filter((name: string) => name.length > 0);
            
            const hasArtist1 = creditNames.some((name: string) => 
              name.includes(artist1Name.toLowerCase()) || artist1Name.toLowerCase().includes(name)
            );
            const hasArtist2 = creditNames.some((name: string) => 
              name.includes(artist2Name.toLowerCase()) || artist2Name.toLowerCase().includes(name)
            );
            
            if (hasArtist1 && hasArtist2) {
              albums.push(release.title);
              console.log(`💿 [DEBUG] Found album collaboration: "${release.title}"`);
              details.push(`Collaborated on album "${release.title}"`);
            }
          }
        }
      } catch (releaseError) {
        console.log(`⚠️ [DEBUG] Could not fetch releases for detailed search:`, releaseError);
      }

      // For smaller artists, try alternative search approaches
      if (songs.length === 0 && albums.length === 0 && details.length <= 1) {
        console.log(`🔍 [DEBUG] Limited results found, trying alternative approaches for smaller artists...`);
        
        // Search for works (compositions) that might connect the artists
        if (detailedArtist1?.relations) {
          for (const relation of detailedArtist1.relations) {
            if (relation["target-type"] === "work" && relation.work && 
                ['composer', 'lyricist', 'writer', 'arranger'].includes(relation.type?.toLowerCase() || '')) {
              
              try {
                const workDetails = await this.getWorkDetails(relation.work.id);
                if (workDetails?.relations) {
                  for (const workRelation of workDetails.relations) {
                    if (workRelation.artist?.name.toLowerCase().includes(artist2Name.toLowerCase())) {
                      console.log(`🎼 [DEBUG] Found work collaboration: "${relation.work.title}"`);
                      details.push(`Co-wrote work "${relation.work.title}"`);
                      collaborationType = 'songwriting';
                    }
                  }
                }
              } catch (workError) {
                console.log(`⚠️ [DEBUG] Could not fetch work details:`, workError);
              }
            }
          }
        }
      }

      console.log(`✅ [DEBUG] Collaboration search complete: ${songs.length} songs, ${albums.length} albums, ${details.length} details`);

      return {
        songs: Array.from(new Set(songs)), // Remove duplicates
        albums: Array.from(new Set(albums)),
        collaborationType,
        details: Array.from(new Set(details))
      };

    } catch (error) {
      console.error(`❌ [DEBUG] Error fetching collaboration details:`, error);
      return { songs: [], albums: [], collaborationType: 'unknown', details: [] };
    }
  }
}

export const musicBrainzService = new MusicBrainzService();