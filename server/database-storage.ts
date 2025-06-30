import { eq, and } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "@shared/schema";
import { spotifyService } from "./spotify";
import { musicBrainzService } from "./musicbrainz";
import { wikipediaService } from "./wikipedia";
import { musicNerdService } from "./musicnerd-service";
import { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  constructor() {
    if (!isDatabaseAvailable()) {
      throw new Error('Database connection not available');
    }
  }

  async getArtist(id: number): Promise<Artist | undefined> {
    if (!db) return undefined;
    
    try {
      const result = await db
        .select()
        .from(artists)
        .where(eq(artists.id, id))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error('Error fetching artist:', error);
      return undefined;
    }
  }

  async getArtistByName(name: string): Promise<Artist | undefined> {
    if (!db) return undefined;
    
    try {
      const result = await db
        .select()
        .from(artists)
        .where(eq(artists.name, name))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error('Error fetching artist by name:', error);
      return undefined;
    }
  }

  async createArtist(insertArtist: InsertArtist): Promise<Artist> {
    if (!db) throw new Error('Database not available');
    
    try {
      const result = await db
        .insert(artists)
        .values({
          name: insertArtist.name,
          type: insertArtist.type,
          imageUrl: insertArtist.imageUrl || null,
          spotifyId: insertArtist.spotifyId || null
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating artist:', error);
      throw error;
    }
  }

  async getCollaborationsByArtist(artistId: number): Promise<Collaboration[]> {
    if (!db) return [];
    
    try {
      const result = await db
        .select()
        .from(collaborations)
        .where(eq(collaborations.fromArtistId, artistId));
      
      return result;
    } catch (error) {
      console.error('Error fetching collaborations:', error);
      return [];
    }
  }

  async createCollaboration(collaboration: InsertCollaboration): Promise<Collaboration> {
    if (!db) throw new Error('Database not available');
    
    try {
      const result = await db
        .insert(collaborations)
        .values(collaboration)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating collaboration:', error);
      throw error;
    }
  }

  private async generateRealCollaborationNetwork(artistName: string): Promise<NetworkData> {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    console.log(`🔍 [DEBUG] Starting collaboration network generation for: "${artistName}"`);
    console.log('📊 [DEBUG] Data source priority: 1) MusicBrainz → 2) Wikipedia → 3) Generated fallback');

    try {
      // Get real collaboration data from MusicBrainz
      console.log(`🎵 [DEBUG] Querying MusicBrainz API for "${artistName}"...`);
      console.log(`🔍 [DEBUG] About to call musicBrainzService.getArtistCollaborations for main artist: ${artistName}`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      console.log(`🔍 [DEBUG] Completed musicBrainzService.getArtistCollaborations for main artist: ${artistName}`);
      console.log(`✅ [DEBUG] MusicBrainz response:`, {
        artists: collaborationData.artists.length,
        works: collaborationData.works.length,
        artistList: collaborationData.artists.map(a => `${a.name} (${a.type}, relation: ${a.relation})`),
        worksList: collaborationData.works.map(w => `${w.title} with [${w.collaborators.join(', ')}]`)
      });
      
      // Add known authentic songwriter collaborators for major artists if not already found
      const artistNameLower = artistName.toLowerCase();
      const processedNames = new Set(collaborationData.artists.map(a => a.name));
      const knownCollaborations: { [key: string]: Array<{name: string, type: 'songwriter' | 'producer', relation: string}> } = {
        'taylor swift': [
          {name: 'Jack Antonoff', type: 'songwriter', relation: 'co-writer'},
          {name: 'Max Martin', type: 'songwriter', relation: 'co-writer'},
          {name: 'Shellback', type: 'songwriter', relation: 'co-writer'},
          {name: 'Aaron Dessner', type: 'songwriter', relation: 'co-writer'},
        ],
        'ariana grande': [
          {name: 'Victoria Monét', type: 'songwriter', relation: 'co-writer'},
          {name: 'Tayla Parx', type: 'songwriter', relation: 'co-writer'},
        ],
        'billie eilish': [
          {name: 'FINNEAS', type: 'songwriter', relation: 'co-writer'},
        ]
      };
      
      if (knownCollaborations[artistNameLower]) {
        for (const collab of knownCollaborations[artistNameLower]) {
          if (!processedNames.has(collab.name)) {
            collaborationData.artists.push(collab);
            console.log(`✨ [DEBUG] Added known authentic collaborator: ${collab.name} (${collab.type})`);
          }
        }
      }
      
      // Get Spotify image for main artist
      let mainArtistImage = null;
      let mainArtistSpotifyId = null;
      
      if (spotifyService.isConfigured()) {
        try {
          const spotifyArtist = await spotifyService.searchArtist(artistName);
          if (spotifyArtist) {
            mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
            mainArtistSpotifyId = spotifyArtist.id;
          }
        } catch (error) {
          console.warn(`Could not fetch Spotify data for ${artistName}`);
        }
      }

      // Get MusicNerd artist ID for main artist
      let mainArtistMusicNerdId = null;
      try {
        mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
      } catch (error) {
        console.log(`Could not fetch MusicNerd ID for ${artistName}`);
      }

      // Create main artist node
      const mainArtistNode: NetworkNode = {
        id: artistName,
        name: artistName,
        type: 'artist',
        size: 20,
        imageUrl: mainArtistImage,
        spotifyId: mainArtistSpotifyId,
        artistId: mainArtistMusicNerdId,
      };
      nodes.push(mainArtistNode);

      // Add collaborating artists from MusicBrainz - limit to top 5 producers and songwriters for performance
      console.log(`🎨 [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      
      // Filter to only include major producers and songwriters who have worked with big artists
      const majorProducerSongwriters = new Set([
        'max martin', 'jack antonoff', 'benny blanco', 'finneas', 'aaron dessner', 
        'andrew watt', 'metro boomin', 'timbaland', 'pharrell williams', 'ryan tedder',
        'sia', 'julia michaels', 'justin tranter', 'charlie puth', 'diane warren',
        'dr. dre', 'rick rubin', 'shellback', 'ali payami', 'patrik berger',
        'hit-boy', 'mike will made-it', 'mustard', 'london on da track', 'wheezy'
      ]);
      
      // Separate collaborators by type and limit to top 3 major producers/songwriters each
      const artists = collaborationData.artists.filter(c => c.type === 'artist');
      const producers = collaborationData.artists
        .filter(c => c.type === 'producer')
        .filter(c => majorProducerSongwriters.has(c.name.toLowerCase()))
        .slice(0, 3); // Changed from 2 to 3, only major producers
      const songwriters = collaborationData.artists
        .filter(c => c.type === 'songwriter') 
        .filter(c => majorProducerSongwriters.has(c.name.toLowerCase()))
        .slice(0, 3); // Changed from 2 to 3, only major songwriters
      
      const limitedCollaborators = [...artists, ...producers, ...songwriters];
      console.log(`⚡ [DEBUG] Limited to ${limitedCollaborators.length} collaborators (${producers.length} producers, ${songwriters.length} songwriters, ${artists.length} artists)`);
      
      for (const collaborator of limitedCollaborators) {
        console.log(`👤 [DEBUG] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type}, relation: ${collaborator.relation})`);
        
        // Get Spotify image for collaborator
        let collaboratorImage = null;
        let collaboratorSpotifyId = null;
        
        if (spotifyService.isConfigured()) {
          try {
            console.log(`🎧 [DEBUG] Fetching Spotify data for "${collaborator.name}"...`);
            const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
            if (spotifyCollaborator) {
              collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
              collaboratorSpotifyId = spotifyCollaborator.id;
              console.log(`✅ [DEBUG] Found Spotify profile for "${collaborator.name}": ${collaboratorSpotifyId}`);
            } else {
              console.log(`❌ [DEBUG] No Spotify profile found for "${collaborator.name}"`);
            }
          } catch (error) {
            console.log(`⚠️ [DEBUG] Spotify lookup failed for "${collaborator.name}": ${error}`);
          }
        } else {
          console.log(`🔒 [DEBUG] Spotify not configured, skipping image lookup for "${collaborator.name}"`);
        }

        // Get MusicNerd artist ID for collaborators who are artists
        let collaboratorMusicNerdId = null;
        if (collaborator.type === 'artist') {
          try {
            collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
          }
        }

        // For producers and songwriters, fetch their authentic collaboration history from MusicBrainz
        let topCollaborators: string[] = [];
        
        // Define popularity rankings for major artists (higher = more popular)
        const popularityMap = new Map<string, number>([
          // Tier 1: Global superstars (100+)
          ['taylor swift', 150], ['beyoncé', 145], ['rihanna', 140], ['lady gaga', 135], 
          ['ariana grande', 130], ['justin bieber', 125], ['billie eilish', 120], ['drake', 115], 
          ['the weeknd', 110], ['dua lipa', 105], ['olivia rodrigo', 102], ['harry styles', 100],
          
          // Tier 2: Major stars (75-99)
          ['ed sheeran', 95], ['bruno mars', 90], ['justin timberlake', 85], ['selena gomez', 80], 
          ['miley cyrus', 78], ['katy perry', 76], ['sia', 75], ['adele', 90], ['sam smith', 75],
          
          // Tier 3: Well-known artists (50-74)
          ['post malone', 70], ['lorde', 68], ['charli xcx', 65], ['lana del rey', 62], 
          ['the 1975', 60], ['troye sivan', 58], ['halsey', 55], ['shawn mendes', 52], ['camila cabello', 50],
          
          // Tier 4: Rising/established artists (25-49)
          ['doja cat', 45], ['lizzo', 42], ['sza', 40], ['bad bunny', 38], ['rosé', 35], 
          ['lisa', 32], ['jennie', 30], ['jisoo', 28], ['clairo', 25], ['phoebe bridgers', 22],
          
          // Electronic/Dance (specialized popularity)
          ['calvin harris', 65], ['david guetta', 60], ['diplo', 55], ['skrillex', 50], 
          ['marshmello', 45], ['zedd', 40], ['disclosure', 35], ['flume', 30],
          
          // Hip-Hop/R&B established (high popularity)
          ['kendrick lamar', 95], ['j. cole', 85], ['travis scott', 80], ['kanye west', 75], 
          ['childish gambino', 70], ['frank ocean', 68], ['tyler, the creator', 65],
          
          // Rock/Alternative established
          ['imagine dragons', 70], ['coldplay', 85], ['arctic monkeys', 60], ['radiohead', 55],
          
          // K-Pop (specialized but high)
          ['bts', 120], ['blackpink', 90], ['twice', 60], ['stray kids', 45],
          
          // Major Producers (get special priority in cross-connections)
          ['max martin', 80], ['dr. dre', 85], ['timbaland', 82], ['pharrell williams', 88], 
          ['rick rubin', 75], ['jack antonoff', 78], ['benny blanco', 72], ['finneas', 70],
          ['andrew watt', 68], ['metro boomin', 65], ['mike will made-it', 60], ['mustard', 58],
          ['hit-boy', 55], ['london on da track', 52], ['wheezy', 50], ['pierre bourne', 48],
          
          // Major Songwriters (get special priority)
          ['diane warren', 85], ['ryan tedder', 82], ['sia', 78], ['julia michaels', 70],
          ['justin tranter', 68], ['charlie puth', 65], ['ed sheeran', 95] // Ed Sheeran is both artist and songwriter
        ]);
        
        if (collaborator.type === 'producer' || collaborator.type === 'songwriter') {
          try {
            console.log(`🔍 [DEBUG] Fetching authentic collaborations for ${collaborator.type} "${collaborator.name}"`);
            const producerCollaborations = await musicBrainzService.getArtistCollaborations(collaborator.name);
            
            // Collect all types of collaborators: artists, other producers, and songwriters
            const allCollaborators: string[] = [];
            
            if (producerCollaborations && producerCollaborations.artists.length > 0) {
              // Add artist collaborators (the actual musicians they work with)
              const artistCollaborators = producerCollaborations.artists
                .filter(c => c.name !== collaborator.name && c.type === 'artist')
                .map(c => c.name);
              allCollaborators.push(...artistCollaborators);
              
              // Add other producers/songwriters they collaborate with
              const otherProducers = producerCollaborations.artists
                .filter(c => c.name !== collaborator.name && (c.type === 'producer' || c.type === 'songwriter'))
                .map(c => c.name);
              allCollaborators.push(...otherProducers);
              
              // Take top 3 most relevant collaborators for tooltip
              topCollaborators = Array.from(new Set(allCollaborators)).slice(0, 3);
              console.log(`✅ [DEBUG] Found ${topCollaborators.length} authentic collaborations for "${collaborator.name}":`, topCollaborators);
              
              // Add branching artist nodes to the network for style discovery
              // Show 3 branching connections for comprehensive but clean networks
              const maxBranchingNodes = 3; // Increased to 3 for both songwriters and producers
              
              // Sort artists by popularity, prioritizing well-known collaborators
              const branchingArtists = artistCollaborators
                .filter(artistName => artistName !== collaborator.name)
                .sort((a, b) => {
                  const popularityA = popularityMap.get(a.toLowerCase()) || 0;
                  const popularityB = popularityMap.get(b.toLowerCase()) || 0;
                  return popularityB - popularityA; // Sort descending (most popular first)
                })
                .slice(0, maxBranchingNodes);
              
              console.log(`🎨 [DEBUG] Creating ${branchingArtists.length} branching connections for ${collaborator.type} "${collaborator.name}"`);
              if (branchingArtists.length > 0) {
                const popularityInfo = branchingArtists.map(artist => {
                  const popularity = popularityMap.get(artist.toLowerCase()) || 0;
                  return `${artist} (${popularity})`;
                });
                console.log(`📝 [DEBUG] ${collaborator.type} "${collaborator.name}" branching to popular artists:`, popularityInfo);
              }
              
              for (const branchingArtist of branchingArtists) {
                // Check if this artist is already in the network
                const existingNode = nodes.find(node => node.name === branchingArtist);
                if (!existingNode) {
                  console.log(`🌟 [DEBUG] Adding branching artist "${branchingArtist}" connected to ${collaborator.type} "${collaborator.name}"`);
                  
                  // Try to get MusicNerd ID for the branching artist
                  let branchingArtistId: string | null = null;
                  try {
                    branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                  } catch (error) {
                    console.log(`Could not fetch MusicNerd ID for branching artist ${branchingArtist}`);
                  }
                  
                  const branchingNode: NetworkNode = {
                    id: branchingArtist,
                    name: branchingArtist,
                    type: 'artist',
                    size: 12, // Smaller size for branching nodes
                    imageUrl: null,
                    spotifyId: null,
                    artistId: branchingArtistId,
                    collaborations: [collaborator.name], // Show connection to the producer/songwriter
                  };
                  nodes.push(branchingNode);
                  
                  // Create link between producer/songwriter and branching artist
                  links.push({
                    source: collaborator.name,
                    target: branchingArtist,
                  });
                  console.log(`🔗 [DEBUG] Created branching link: "${collaborator.name}" ↔ "${branchingArtist}"`);
                  
                  // For producers/songwriters, try to find other popular producers who also work with this branching artist
                  // This creates cross-connections that make the web more in-depth
                  if ((collaborator.type === 'producer' || collaborator.type === 'songwriter') && branchingArtists.length < maxBranchingNodes) {
                    try {
                      console.log(`🔍 [DEBUG] Looking for other producers who worked with "${branchingArtist}"`);
                      const branchingArtistCollabs = await musicBrainzService.getArtistCollaborations(branchingArtist);
                      
                      if (branchingArtistCollabs && branchingArtistCollabs.artists.length > 0) {
                        // Find other popular producers/songwriters who worked with this artist
                        const otherProducers = branchingArtistCollabs.artists
                          .filter(c => c.type === 'producer' || c.type === 'songwriter')
                          .filter(c => c.name !== collaborator.name) // Not the current producer
                          .filter(c => !nodes.some(node => node.name === c.name)) // Not already in network
                          .sort((a, b) => {
                            const popularityA = popularityMap.get(a.name.toLowerCase()) || 0;
                            const popularityB = popularityMap.get(b.name.toLowerCase()) || 0;
                            return popularityB - popularityA;
                          })
                          .slice(0, 1); // Add just 1 cross-connection producer to avoid overcrowding
                        
                        for (const crossProducer of otherProducers) {
                          console.log(`🌐 [DEBUG] Adding cross-connection producer "${crossProducer.name}" who also worked with "${branchingArtist}"`);
                          
                          // Try to get MusicNerd ID for the cross-connection producer
                          let crossProducerArtistId: string | null = null;
                          try {
                            crossProducerArtistId = await musicNerdService.getArtistId(crossProducer.name);
                          } catch (error) {
                            console.log(`Could not fetch MusicNerd ID for cross-producer ${crossProducer.name}`);
                          }
                          
                          const crossProducerNode: NetworkNode = {
                            id: crossProducer.name,
                            name: crossProducer.name,
                            type: crossProducer.type as 'producer' | 'songwriter',
                            size: 10, // Smaller size for cross-connection nodes
                            imageUrl: null,
                            spotifyId: null,
                            artistId: crossProducerArtistId,
                            collaborations: [branchingArtist], // Show connection to the shared artist
                          };
                          nodes.push(crossProducerNode);
                          
                          // Create link between cross-producer and the shared artist
                          links.push({
                            source: crossProducer.name,
                            target: branchingArtist,
                          });
                          console.log(`🔗 [DEBUG] Created cross-connection: "${crossProducer.name}" ↔ "${branchingArtist}"`);
                        }
                      }
                    } catch (error: any) {
                      console.log(`⚠️ [DEBUG] Could not find cross-connections for "${branchingArtist}"`, error?.message || 'Unknown error');
                    }
                  }
                }
              }
            }
            
            // If still not enough collaborators, add the main artist as a primary collaborator
            if (topCollaborators.length < 3) {
              topCollaborators = [artistName, ...topCollaborators];
              topCollaborators = Array.from(new Set(topCollaborators)).slice(0, 3);
              console.log(`📝 [DEBUG] Enhanced collaborations for "${collaborator.name}" with main artist:`, topCollaborators);
            }
          } catch (error) {
            console.log(`❌ [DEBUG] Error fetching collaborations for "${collaborator.name}":`, error);
            
            // Enhanced fallback: use known major collaborators for popular producers/songwriters
            let fallbackCollaborators: string[] = [];
            const collaboratorNameLower = collaborator.name.toLowerCase();
            
            // Major producer/songwriter known collaborations - only include the most prolific ones
            const knownCollaborations = new Map<string, string[]>([
              ['max martin', ['taylor swift', 'ariana grande', 'the weeknd', 'dua lipa', 'britney spears']],
              ['jack antonoff', ['taylor swift', 'lorde', 'lana del rey', 'clairo', 'bleachers']],
              ['benny blanco', ['ed sheeran', 'justin bieber', 'halsey', 'rihanna', 'katy perry']],
              ['finneas', ['billie eilish', 'selena gomez', 'camila cabello', 'tove lo']],
              ['aaron dessner', ['taylor swift', 'phoebe bridgers', 'bon iver', 'the national']],
              ['andrew watt', ['post malone', 'ozzy osbourne', 'miley cyrus', 'justin bieber']],
              ['metro boomin', ['future', '21 savage', 'travis scott', 'drake', 'the weeknd']],
              ['timbaland', ['justin timberlake', 'missy elliott', 'aaliyah', 'nelly furtado']],
              ['pharrell williams', ['daft punk', 'robin thicke', 'ed sheeran', 'ariana grande']],
              ['ryan tedder', ['adele', 'taylor swift', 'ed sheeran', 'onerepublic', 'beyoncé']],
              ['sia', ['david guetta', 'flo rida', 'beyoncé', 'rihanna', 'britney spears']],
              ['julia michaels', ['justin bieber', 'selena gomez', 'gwen stefani', 'ed sheeran']],
              ['shellback', ['taylor swift', 'pink', 'britney spears', 'ariana grande']],
              ['ali payami', ['taylor swift', 'the weeknd', 'dua lipa', 'ellie goulding']],
              ['charlie puth', ['wiz khalifa', 'meghan trainor', 'jason derulo', 'maroon 5']],
              ['diane warren', ['aerosmith', 'celine dion', 'whitney houston', 'lady gaga']]
            ]);
            
            // Look for known collaborations
            knownCollaborations.forEach((collaborators, producer) => {
              if (collaboratorNameLower.includes(producer)) {
                fallbackCollaborators = collaborators.filter(c => c !== artistName.toLowerCase());
                console.log(`🎯 [DEBUG] Using known collaborations for "${collaborator.name}":`, fallbackCollaborators);
              }
            });
            
            // If no known collaborations found, use network fallback
            if (fallbackCollaborators.length === 0) {
              const networkCollaborators = collaborationData.artists
                .filter(c => c.name !== collaborator.name && c.name !== artistName)
                .map(c => c.name);
              fallbackCollaborators = networkCollaborators.slice(0, 2);
              console.log(`🔄 [DEBUG] Using network fallback for "${collaborator.name}":`, fallbackCollaborators);
            }
            
            topCollaborators = [artistName, ...fallbackCollaborators];
            
            // Create branching nodes for fallback collaborators - show 3 for comprehensive networks
            const maxBranchingNodes = 3;
            const branchingArtists = fallbackCollaborators
              .sort((a, b) => {
                const popularityA = popularityMap.get(a.toLowerCase()) || 0;
                const popularityB = popularityMap.get(b.toLowerCase()) || 0;
                return popularityB - popularityA;
              })
              .slice(0, maxBranchingNodes);
              
            console.log(`🎨 [DEBUG] Creating ${branchingArtists.length} fallback branching connections for ${collaborator.type} "${collaborator.name}"`);
            
            for (const branchingArtist of branchingArtists) {
              const existingNode = nodes.find(node => node.name === branchingArtist);
              if (!existingNode) {
                console.log(`🌟 [DEBUG] Adding fallback branching artist "${branchingArtist}" connected to ${collaborator.type} "${collaborator.name}"`);
                
                let branchingArtistId: string | null = null;
                try {
                  branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                } catch (error) {
                  console.log(`Could not fetch MusicNerd ID for fallback artist ${branchingArtist}`);
                }
                
                const branchingNode: NetworkNode = {
                  id: branchingArtist,
                  name: branchingArtist,
                  type: 'artist',
                  size: 12,
                  imageUrl: null,
                  spotifyId: null,
                  artistId: branchingArtistId,
                  collaborations: [collaborator.name],
                };
                nodes.push(branchingNode);
                
                links.push({
                  source: collaborator.name,
                  target: branchingArtist,
                });
                console.log(`🔗 [DEBUG] Created fallback branching link: "${collaborator.name}" ↔ "${branchingArtist}"`);
              }
            }
          }
        }

        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 15,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
          artistId: collaboratorMusicNerdId,
          collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
        };
        nodes.push(collaboratorNode);
        console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from MusicBrainz relation "${collaborator.relation}"`);

        links.push({
          source: artistName,
          target: collaborator.name,
        });
        console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}"`);
      }

      // If no real collaborations found, try Wikipedia
      if (collaborationData.artists.length === 0) {
        console.log(`🔍 [DEBUG] No MusicBrainz collaborations found for "${artistName}", trying Wikipedia fallback...`);
        
        try {
          const wikipediaCollaborators = await wikipediaService.getArtistCollaborations(artistName);
          console.log(`📖 [DEBUG] Wikipedia response for "${artistName}":`, {
            collaborators: wikipediaCollaborators.length,
            collaboratorList: wikipediaCollaborators.map(c => `${c.name} (${c.type}, context: "${c.context.substring(0, 50)}...")`)
          });
          
          if (wikipediaCollaborators.length > 0) {
            console.log(`✅ [DEBUG] Using Wikipedia data - found ${wikipediaCollaborators.length} collaborators`);
            // Add Wikipedia collaborators to the network
            for (const collaborator of wikipediaCollaborators) {
              console.log(`👤 [DEBUG] Processing Wikipedia collaborator: "${collaborator.name}" (type: ${collaborator.type})`);
              console.log(`📝 [DEBUG] Wikipedia context: "${collaborator.context}"`);
              
              // Get Spotify image for collaborator
              let collaboratorImage = null;
              let collaboratorSpotifyId = null;
              
              if (spotifyService.isConfigured()) {
                try {
                  console.log(`🎧 [DEBUG] Fetching Spotify data for Wikipedia collaborator "${collaborator.name}"...`);
                  const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
                  if (spotifyCollaborator) {
                    collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
                    collaboratorSpotifyId = spotifyCollaborator.id;
                    console.log(`✅ [DEBUG] Found Spotify profile for Wikipedia collaborator "${collaborator.name}": ${collaboratorSpotifyId}`);
                  } else {
                    console.log(`❌ [DEBUG] No Spotify profile found for Wikipedia collaborator "${collaborator.name}"`);
                  }
                } catch (error) {
                  console.log(`⚠️ [DEBUG] Spotify lookup failed for Wikipedia collaborator "${collaborator.name}": ${error}`);
                }
              }

              // Get MusicNerd artist ID for Wikipedia collaborators who are artists
              let collaboratorMusicNerdId = null;
              if (collaborator.type === 'artist') {
                try {
                  collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
                } catch (error) {
                  console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
                }
              }

              // For Wikipedia producers and songwriters, create collaboration list
              let topCollaborators: string[] = [];
              if (collaborator.type === 'producer' || collaborator.type === 'songwriter') {
                const otherCollaborators = wikipediaCollaborators
                  .filter(c => c.name !== collaborator.name && c.name !== artistName)
                  .slice(0, 2)
                  .map(c => c.name);
                topCollaborators = [artistName, ...otherCollaborators];
              }

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type as 'artist' | 'producer' | 'songwriter',
                size: 15,
                imageUrl: collaboratorImage,
                spotifyId: collaboratorSpotifyId,
                artistId: collaboratorMusicNerdId,
                collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
              };
              nodes.push(collaboratorNode);
              console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from Wikipedia context`);

              links.push({
                source: artistName,
                target: collaborator.name,
              });
              console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}" (Wikipedia source)`);
            }
            
            console.log(`✅ [DEBUG] Successfully created network from Wikipedia data: ${wikipediaCollaborators.length} collaborators for "${artistName}"`);
            return { nodes, links };
          } else {
            console.log(`❌ [DEBUG] Wikipedia returned 0 collaborators for "${artistName}"`);
          }
        } catch (error) {
          console.error(`⚠️ [DEBUG] Error fetching Wikipedia collaborations for "${artistName}":`, error);
        }
        
        // If both MusicBrainz and Wikipedia fail, add known authentic collaborators as fallback
        console.log(`🚨 [DEBUG] No real collaboration data found for "${artistName}" from either MusicBrainz or Wikipedia`);
        
        // Add known authentic songwriter collaborators for major artists
        const artistNameLower = artistName.toLowerCase();
        const knownCollaborations: { [key: string]: Array<{name: string, type: 'songwriter' | 'producer', relation: string}> } = {
          'taylor swift': [
            {name: 'Jack Antonoff', type: 'songwriter', relation: 'co-writer'},
            {name: 'Max Martin', type: 'songwriter', relation: 'co-writer'},
            {name: 'Shellback', type: 'songwriter', relation: 'co-writer'},
            {name: 'Aaron Dessner', type: 'songwriter', relation: 'co-writer'},
          ]
        };
        
        if (knownCollaborations[artistNameLower]) {
          console.log(`✨ [DEBUG] Adding known authentic collaborators for "${artistName}"`);
          const fallbackArtists = knownCollaborations[artistNameLower];
          
          for (const collab of fallbackArtists) {
            const collaboratorNode: NetworkNode = {
              id: collab.name,
              name: collab.name,
              type: collab.type,
              size: 15,
            };
            
            // Get MusicNerd artist ID for the collaborator
            try {
              const artistId = await musicNerdService.getArtistId(collab.name);
              if (artistId) {
                collaboratorNode.artistId = artistId;
                console.log(`✅ [DEBUG] Found MusicNerd ID for ${collab.name}: ${artistId}`);
              }
            } catch (error) {
              console.log(`📭 [DEBUG] No MusicNerd ID found for ${collab.name}`);
            }
            nodes.push(collaboratorNode);
            links.push({
              source: mainArtistNode.id,
              target: collaboratorNode.id,
            });
            
            console.log(`✨ [DEBUG] Added known authentic collaborator: ${collab.name} (${collab.type})`);
          }
        } else {
          console.log(`👤 [DEBUG] Returning only the main artist node without any collaborators`);
        }
        
        return { nodes, links };
      } else {
        console.log(`✅ [DEBUG] Successfully created network from MusicBrainz data: ${collaborationData.artists.length} collaborators for "${artistName}"`);
      }

      return { nodes, links };
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return just the main artist if everything fails
      return { nodes, links };
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    // For demo artists with rich mock data, use real MusicBrainz to showcase enhanced producer/songwriter extraction
    const enhancedMusicBrainzArtists = ['Post Malone', 'The Weeknd', 'Ariana Grande', 'Billie Eilish', 'Taylor Swift', 'Drake'];
    
    if (enhancedMusicBrainzArtists.includes(artistName)) {
      console.log(`🎵 [DEBUG] Using enhanced MusicBrainz data for "${artistName}" to showcase deep producer/songwriter networks`);
      return this.generateRealCollaborationNetwork(artistName);
    }
    
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) {
      // Try to get real collaboration data from external APIs
      return this.generateRealCollaborationNetwork(artistName);
    }

    // Artist exists in database, build network from stored data
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    
    const mainArtistNode: NetworkNode = {
      id: mainArtist.name,
      name: mainArtist.name,
      type: mainArtist.type as 'artist' | 'producer' | 'songwriter',
      size: 20,
      imageUrl: mainArtist.imageUrl,
      spotifyId: mainArtist.spotifyId,
    };
    nodes.push(mainArtistNode);

    // Get collaborations from database
    const artistCollaborations = await this.getCollaborationsByArtist(mainArtist.id);
    
    for (const collab of artistCollaborations) {
      const collaborator = await this.getArtist(collab.toArtistId);
      if (collaborator) {
        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 15,
          imageUrl: collaborator.imageUrl,
          spotifyId: collaborator.spotifyId,
        };
        nodes.push(collaboratorNode);

        links.push({
          source: mainArtist.name,
          target: collaborator.name,
        });
      }
    }

    return { nodes, links };
  }
}