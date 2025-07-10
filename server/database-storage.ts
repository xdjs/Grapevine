import { eq, and, sql } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase.js';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { openAIService } from "./openai-service.js";
import { musicBrainzService } from "./musicbrainz.js";
import { wikipediaService } from "./wikipedia.js";
import { musicNerdService } from "./musicnerd-service.js";
import { IStorage } from './storage.js';

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
        .select({
          id: artists.id,
          name: artists.name,
          webmapdata: artists.webmapdata
        })
        .from(artists)
        .where(eq(artists.name, name))
        .limit(1);
      
      const artist = result[0];
      if (artist) {
        // Add default type field since MusicNerd database doesn't have it
        return {
          id: artist.id,
          name: artist.name,
          type: 'artist' as const,
          imageUrl: null,
          spotifyId: null,
          webmapdata: artist.webmapdata
        };
      }
      return undefined;
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
    const links: NetworkLink[] = [];

    // Initialize node map with main artist - we'll merge roles as we find them
    const nodeMap = new Map<string, NetworkNode>();
    
    // Get MusicNerd URL for main artist

    let musicNerdUrl = 'https://musicnerd.xyz';
    try {
      const artistId = await musicNerdService.getArtistId(artistName);
      if (artistId) {
        musicNerdUrl = `https://musicnerd.xyz/artist/${artistId}`;

      }
    } catch (error) {
      console.log(`📭 [DEBUG] No MusicNerd ID found for main artist ${artistName}`);
    }

    // Enhanced role detection system for main artist
    const knownMultiRoleArtists = new Map<string, ('artist' | 'producer' | 'songwriter')[]>([
      // Major Artist-Producer-Songwriters
      ['Taylor Swift', ['artist', 'songwriter', 'producer']],
      ['Kanye West', ['artist', 'producer', 'songwriter']],
      ['Jay-Z', ['artist', 'producer', 'songwriter']],
      ['Drake', ['artist', 'songwriter', 'producer']],
      ['The Weeknd', ['artist', 'songwriter', 'producer']],
      ['Frank Ocean', ['artist', 'songwriter', 'producer']],
      ['Tyler, The Creator', ['artist', 'producer', 'songwriter']],
      ['Mac Miller', ['artist', 'producer', 'songwriter']],
      ['Childish Gambino', ['artist', 'songwriter', 'producer']],
      ['Pharrell Williams', ['artist', 'producer', 'songwriter']],
      ['Timbaland', ['producer', 'artist', 'songwriter']],
      ['Dr. Dre', ['producer', 'artist']],
      ['Eminem', ['artist', 'songwriter', 'producer']],
      ['Lorde', ['artist', 'songwriter', 'producer']],
      ['Grimes', ['artist', 'producer', 'songwriter']],
      ['FKA twigs', ['artist', 'songwriter', 'producer']],
      ['James Blake', ['artist', 'producer', 'songwriter']],
      ['Bon Iver', ['artist', 'producer', 'songwriter']],
      ['Tame Impala', ['artist', 'producer', 'songwriter']],
      ['Billie Eilish', ['artist', 'songwriter']],
      ['Finneas', ['producer', 'songwriter', 'artist']],
      ['Charlie Puth', ['artist', 'songwriter', 'producer']],
      ['John Mayer', ['artist', 'songwriter', 'producer']],
      ['Bruno Mars', ['artist', 'songwriter', 'producer']],
      ['Anderson .Paak', ['artist', 'producer', 'songwriter']],
      ['SZA', ['artist', 'songwriter']],
      ['Daniel Caesar', ['artist', 'songwriter', 'producer']],
      ['Rex Orange County', ['artist', 'songwriter', 'producer']],
      ['Kali Uchis', ['artist', 'songwriter']],
      ['Omar Apollo', ['artist', 'songwriter']],
      ['Clairo', ['artist', 'songwriter', 'producer']],
      ['Still Woozy', ['artist', 'producer', 'songwriter']],
      ['Cuco', ['artist', 'songwriter', 'producer']],
      ['Snoh Aalegra', ['artist', 'songwriter']],
      ['Jorja Smith', ['artist', 'songwriter']],
      ['Kehlani', ['artist', 'songwriter']],
      ['Summer Walker', ['artist', 'songwriter']],
      ['Jhené Aiko', ['artist', 'songwriter']],
      ['Tinashe', ['artist', 'songwriter', 'producer']],
      ['Solange', ['artist', 'songwriter', 'producer']],
      ['SiR', ['artist', 'songwriter']],
      ['Brent Faiyaz', ['artist', 'songwriter', 'producer']],
      
      // Major Songwriters
      ['Ed Sheeran', ['artist', 'songwriter']],
      ['Adele', ['artist', 'songwriter']],
      ['Alicia Keys', ['artist', 'songwriter', 'producer']],
      ['Lady Gaga', ['artist', 'songwriter']],
      ['Olivia Rodrigo', ['artist', 'songwriter']],
      ['Phoebe Bridgers', ['artist', 'songwriter']],
      ['Lana Del Rey', ['artist', 'songwriter']],
      ['H.E.R.', ['artist', 'songwriter', 'producer']],
      
      // Producer-Songwriters
      ['Max Martin', ['producer', 'songwriter']],
      ['Dr. Luke', ['producer', 'songwriter']],
      ['Benny Blanco', ['producer', 'songwriter']],
      ['Jack Antonoff', ['producer', 'songwriter']],
      ['Rick Rubin', ['producer']],
      ['Quincy Jones', ['producer', 'songwriter']],
      ['Mark Ronson', ['producer', 'songwriter']],
      ['Diplo', ['producer', 'artist']],
      ['Skrillex', ['producer', 'artist']],
      ['Calvin Harris', ['producer', 'artist', 'songwriter']],
      ['The Chainsmokers', ['producer', 'artist']],
      ['Zedd', ['producer', 'artist']],
      ['David Guetta', ['producer', 'artist']],
      ['Marshmello', ['producer', 'artist']],
      ['Flume', ['producer', 'artist']],
      ['ODESZA', ['producer', 'artist']],
      ['Porter Robinson', ['producer', 'artist', 'songwriter']],
      ['Madeon', ['producer', 'artist', 'songwriter']],
      ['What So Not', ['producer', 'artist']],
      ['RL Grime', ['producer', 'artist']],
      ['Baauer', ['producer', 'artist']],
      ['Flying Lotus', ['producer', 'artist']],
      ['Kaytranada', ['producer', 'artist']],
      ['TOKiMONSTA', ['producer', 'artist']],
      ['SBTRKT', ['producer', 'artist']],
      ['Burial', ['producer', 'artist']],
      ['Four Tet', ['producer', 'artist']],
      ['Jamie xx', ['producer', 'artist']],
      ['Bonobo', ['producer', 'artist']],
      ['RJD2', ['producer', 'artist']],
      ['Pretty Lights', ['producer', 'artist']],
      ['GRiZ', ['producer', 'artist']],
      ['Gramatik', ['producer', 'artist']],
      ['Big Gigantic', ['producer', 'artist']],
      ['SoDown', ['producer', 'artist']],
      
      // Specific to current searches
      ['Dan Nigro', ['producer', 'songwriter']],
      ['Aaron Dessner', ['producer', 'songwriter', 'artist']],
      ['Alexander 23', ['artist', 'songwriter', 'producer']],
      ['Casey Smith', ['songwriter', 'producer']],
      ['Ludwig Göransson', ['producer', 'songwriter']],
      ['Andrew Watt', ['producer', 'songwriter']],
      ['Ali Payami', ['producer', 'songwriter']],
      ['Shellback', ['producer', 'songwriter']],
      ['Metro Boomin', ['producer', 'songwriter']],
      ['Mike Dean', ['producer', 'songwriter']],
      ['Noah "40" Shebib', ['producer', 'songwriter']],
      ['Hit-Boy', ['producer', 'songwriter']],
      ['Mustard', ['producer', 'songwriter']],
      ['London on da Track', ['producer', 'songwriter']],
      ['TM88', ['producer', 'songwriter']],
      ['Southside', ['producer', 'songwriter']],
      ['Wheezy', ['producer', 'songwriter']],
      ['Pierre Bourne', ['producer', 'songwriter']],
      ['Kenny Beats', ['producer', 'songwriter']],
      ['Alchemist', ['producer', 'songwriter']],
      ['Madlib', ['producer', 'songwriter']],
      ['J Dilla', ['producer', 'songwriter']],
      ['Nujabes', ['producer', 'songwriter']],
    ]);

    // Get enhanced roles for main artist  
    const mainArtistTypes = knownMultiRoleArtists.get(artistName) || ['artist'];

    // Create main artist node with enhanced role detection
    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: mainArtistTypes[0], // Primary type
      types: mainArtistTypes, // All roles
      size: 25,
      musicNerdUrl,
    };
    nodeMap.set(artistName, mainArtistNode);
    
    console.log(`🎭 [DEBUG] Main artist "${artistName}" has ${mainArtistTypes.length} roles:`, mainArtistTypes);

    // Helper function to get enhanced roles for any person
    const getEnhancedRoles = (personName: string, defaultRole: 'artist' | 'producer' | 'songwriter'): ('artist' | 'producer' | 'songwriter')[] => {
      const knownRoles = knownMultiRoleArtists.get(personName);
      if (knownRoles) {
        return knownRoles;
      }
      
      // If not in known list, check for common patterns
      const lowerName = personName.toLowerCase();
      
      // Common producer-songwriter patterns
      if (lowerName.includes('martin') || lowerName.includes('max') || 
          lowerName.includes('antonoff') || lowerName.includes('jack') ||
          lowerName.includes('nigro') || lowerName.includes('dessner') ||
          lowerName.includes('rubin') || lowerName.includes('rick') ||
          lowerName.includes('quincy') || lowerName.includes('jones') ||
          lowerName.includes('ronson') || lowerName.includes('mark') ||
          lowerName.includes('blanco') || lowerName.includes('benny') ||
          lowerName.includes('ludwig') || lowerName.includes('watt') ||
          lowerName.includes('payami') || lowerName.includes('ali') ||
          lowerName.includes('shellback') || lowerName.includes('metro') ||
          lowerName.includes('boomin') || lowerName.includes('dean') ||
          lowerName.includes('mike') || lowerName.includes('40') ||
          lowerName.includes('shebib') || lowerName.includes('noah') ||
          lowerName.includes('hit-boy') || lowerName.includes('mustard') ||
          lowerName.includes('london') || lowerName.includes('track') ||
          lowerName.includes('tm88') || lowerName.includes('southside') ||
          lowerName.includes('wheezy') || lowerName.includes('pierre') ||
          lowerName.includes('bourne') || lowerName.includes('kenny') ||
          lowerName.includes('beats') || lowerName.includes('alchemist') ||
          lowerName.includes('madlib') || lowerName.includes('dilla') ||
          lowerName.includes('nujabes')) {
        if (defaultRole === 'producer') {
          return ['producer', 'songwriter'];
        }
        if (defaultRole === 'songwriter') {
          return ['songwriter', 'producer'];
        }
      }
      
      // Common artist-songwriter patterns
      if (lowerName.includes('swift') || lowerName.includes('taylor') ||
          lowerName.includes('sheeran') || lowerName.includes('ed') ||
          lowerName.includes('adele') || lowerName.includes('keys') ||
          lowerName.includes('alicia') || lowerName.includes('gaga') ||
          lowerName.includes('rodrigo') || lowerName.includes('olivia') ||
          lowerName.includes('bridgers') || lowerName.includes('phoebe') ||
          lowerName.includes('lana') || lowerName.includes('del') ||
          lowerName.includes('rey') || lowerName.includes('h.e.r.')) {
        if (defaultRole === 'artist') {
          return ['artist', 'songwriter'];
        }
        if (defaultRole === 'songwriter') {
          return ['songwriter', 'artist'];
        }
      }
      
      return [defaultRole];
    };

    console.log(`🔍 [DEBUG] Starting collaboration network generation for: "${artistName}"`);
    console.log('📊 [DEBUG] Data source priority: 1) OpenAI → 2) MusicBrainz → 3) Wikipedia → 4) Known collaborations fallback');

    try {
      // First try OpenAI for collaboration data
      if (openAIService.isServiceAvailable()) {
        console.log(`🤖 [DEBUG] Querying OpenAI API for "${artistName}"...`);
        console.log(`🔍 [DEBUG] About to call openAIService.getArtistCollaborations for main artist: ${artistName}`);
        
        try {
          const openAIData = await openAIService.getArtistCollaborations(artistName);
          console.log(`✅ [DEBUG] OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map(a => `${a.name} (${a.type}, top collaborators: ${a.topCollaborators.length})`)
          });

          if (openAIData.artists.length > 0) {
            // Process OpenAI data and merge with main artist node map
            for (const collaborator of openAIData.artists) {
              // Check if we already have a node for this person (including main artist)
              let collaboratorNode = nodeMap.get(collaborator.name);
              
              if (collaboratorNode) {
                // Person already exists - add the new role to their types array
                if (!collaboratorNode.types) {
                  collaboratorNode.types = [collaboratorNode.type];
                }
                if (!collaboratorNode.types.includes(collaborator.type)) {
                  collaboratorNode.types.push(collaborator.type);
                  console.log(`🎭 [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
                }
                // Keep primary type as the first one (for backward compatibility)
                collaboratorNode.type = collaboratorNode.types[0];
                
                // Skip further processing since this person already exists
                // Merge top collaborators from all roles
                if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
                  const existingCollaborators = collaboratorNode.collaborations || [];
                  const newCollaborators = collaborator.topCollaborators.filter(c => !existingCollaborators.includes(c));
                  collaboratorNode.collaborations = [...existingCollaborators, ...newCollaborators];
                }
                continue; // Skip creating new node since we're updating existing one
              } else {
                // Create new node for this person with enhanced role detection
                const enhancedRoles = getEnhancedRoles(collaborator.name, collaborator.type);
                
                // Get image from Spotify if available
                let imageUrl: string | null = null;
                let spotifyId: string | null = null;
                if (spotifyService.isConfigured()) {
                  try {
                    const spotifyArtist = await spotifyService.searchArtist(collaborator.name);
                    if (spotifyArtist) {
                      imageUrl = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
                      spotifyId = spotifyArtist.id;
                    }
                  } catch (error) {
                    console.log(`🔒 [DEBUG] Spotify search failed for "${collaborator.name}"`);
                  }
                }

                collaboratorNode = {
                  id: collaborator.name,
                  name: collaborator.name,
                  type: enhancedRoles[0], // Primary role
                  types: enhancedRoles, // All roles
                  size: 15,
                  imageUrl,
                  spotifyId,
                  collaborations: collaborator.topCollaborators || [],
                };
                
                console.log(`🎭 [DEBUG] Enhanced "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);

                // Get MusicNerd artist ID for the collaborator

                let musicNerdUrl = 'https://musicnerd.xyz';
                try {
                  const artistId = await musicNerdService.getArtistId(collaborator.name);
                  if (artistId) {
                    musicNerdUrl = `https://musicnerd.xyz/artist/${artistId}`;

                    console.log(`✅ [DEBUG] Found MusicNerd ID for ${collaborator.name}: ${artistId}`);
                  }
                } catch (error) {
                  console.log(`📭 [DEBUG] No MusicNerd ID found for ${collaborator.name}`);
                }

                collaboratorNode.musicNerdUrl = musicNerdUrl;
                nodeMap.set(collaborator.name, collaboratorNode);
              }

              }

            // Process all nodes to create links and branching connections
            const allNodes = Array.from(nodeMap.values());
            const mainNode = nodeMap.get(artistName)!;
            
            for (const collaboratorNode of allNodes) {
              // Skip self-processing for the main artist
              if (collaboratorNode.name !== artistName) {
                // Create main connection to collaborator
                links.push({
                  source: mainNode.id,
                  target: collaboratorNode.id,
                });

                // Add branching connections for the top collaborators
                const maxBranching = 3;
                const branchingCount = Math.min(collaboratorNode.collaborations?.length || 0, maxBranching);
                
                for (let i = 0; i < branchingCount; i++) {
                  const branchingArtist = collaboratorNode.collaborations![i];
                  
                  // Check if this branching artist is already in our main node map
                  let branchingNode = nodeMap.get(branchingArtist);
                  
                  if (branchingNode) {
                    // Person already exists - add artist role if not already present
                    if (!branchingNode.types) {
                      branchingNode.types = [branchingNode.type];
                    }
                    if (!branchingNode.types.includes('artist')) {
                      branchingNode.types.push('artist');
                      console.log(`🎭 [DEBUG] Added artist role to existing branching node ${branchingArtist} (now has ${branchingNode.types.length} roles)`);
                    }
                    // Ensure primary type remains as first one for compatibility
                    branchingNode.type = branchingNode.types[0];
                  } else {
                    // Create new branching node with enhanced role detection
                    const enhancedBranchingRoles = getEnhancedRoles(branchingArtist, 'artist');
                    
                    branchingNode = {
                      id: branchingArtist,
                      name: branchingArtist,
                      type: enhancedBranchingRoles[0], // Primary role
                      types: enhancedBranchingRoles, // All roles
                      size: 15,
                    };

                    // Get MusicNerd ID for branching artist

                    let branchingMusicNerdUrl = 'https://musicnerd.xyz';
                    try {
                      const branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                      if (branchingArtistId) {
                        branchingMusicNerdUrl = `https://musicnerd.xyz/artist/${branchingArtistId}`;

                      }
                    } catch (error) {
                      console.log(`📭 [DEBUG] No MusicNerd ID found for branching artist ${branchingArtist}`);
                    }

                    branchingNode.musicNerdUrl = branchingMusicNerdUrl;
                    nodeMap.set(branchingArtist, branchingNode);
                    
                    console.log(`🎭 [DEBUG] Enhanced OpenAI branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                  }
                  
                  // Create link between collaborator and their top collaborator
                  links.push({
                    source: collaboratorNode.name,
                    target: branchingArtist,
                  });

                  console.log(`🌟 [DEBUG] Added branching artist "${branchingArtist}" connected to multi-role "${collaboratorNode.name}"`);
                }

                const rolesList = collaboratorNode.types?.join(' + ') || collaboratorNode.type;
                console.log(`➕ [DEBUG] Added ${rolesList}: ${collaboratorNode.name} from OpenAI with ${branchingCount} branching connections`);
              }
            }


            // Final node array from consolidated map
            const nodes = Array.from(nodeMap.values());
            console.log(`✅ [DEBUG] Successfully created network from OpenAI data: ${nodes.length} total nodes (including main artist) for "${artistName}"`);
            
            // Cache the generated network data
            const finalNetworkData = { nodes, links };
            console.log(`💾 [DEBUG] About to cache OpenAI network data for "${artistName}" with ${nodes.length} nodes`);
            await this.cacheNetworkData(artistName, finalNetworkData);
            
            return finalNetworkData;

          }
        } catch (error) {
          console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
          console.log('🔄 [DEBUG] Falling back to MusicBrainz...');
        }
      } else {
        console.log('⚠️ [DEBUG] OpenAI service not available, falling back to MusicBrainz...');
      }

      // Fallback to MusicBrainz if OpenAI fails or isn't available
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

      // Update main artist node with additional data
      const mainArtistNode = nodeMap.get(artistName)!;
      mainArtistNode.imageUrl = mainArtistImage;
      mainArtistNode.spotifyId = mainArtistSpotifyId;
      mainArtistNode.artistId = mainArtistMusicNerdId;

      // Add collaborating artists from MusicBrainz - limit to top 5 producers and songwriters for performance
      console.log(`🎨 [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      
      // Separate collaborators by type and limit producers/songwriters to top 5 each
      const artists = collaborationData.artists.filter(c => c.type === 'artist');
      const producers = collaborationData.artists.filter(c => c.type === 'producer').slice(0, 5);
      const songwriters = collaborationData.artists.filter(c => c.type === 'songwriter').slice(0, 5);
      
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
              // For songwriters and producers, show their top 3 collaborating artists
              const maxBranchingNodes = collaborator.type === 'songwriter' ? 3 : 2;
              const branchingArtists = artistCollaborators
                .filter(artistName => artistName !== collaborator.name)
                .slice(0, maxBranchingNodes);
              
              console.log(`🎨 [DEBUG] Creating ${branchingArtists.length} branching connections for ${collaborator.type} "${collaborator.name}"`);
              if (branchingArtists.length > 0 && collaborator.type === 'songwriter') {
                console.log(`📝 [DEBUG] Songwriter "${collaborator.name}" branching to artists:`, branchingArtists);
              }
              
              for (const branchingArtist of branchingArtists) {
                // Check if this artist is already in the network (multi-role support)
                let branchingNode = nodeMap.get(branchingArtist);
                
                if (branchingNode) {
                  // Person already exists - add artist role if not already present
                  if (!branchingNode.types) {
                    branchingNode.types = [branchingNode.type];
                  }
                  if (!branchingNode.types.includes('artist')) {
                    branchingNode.types.push('artist');
                    console.log(`🎭 [DEBUG] Added artist role to existing branching node ${branchingArtist} (now has ${branchingNode.types.length} roles)`);
                  }
                  // Update collaborations list
                  if (!branchingNode.collaborations) {
                    branchingNode.collaborations = [];
                  }
                  if (!branchingNode.collaborations.includes(collaborator.name)) {
                    branchingNode.collaborations.push(collaborator.name);
                  }
                  // Ensure primary type remains as first one for compatibility
                  branchingNode.type = branchingNode.types[0];
                } else {
                  // Create new branching node with enhanced role detection
                  console.log(`🌟 [DEBUG] Adding branching artist "${branchingArtist}" connected to ${collaborator.type} "${collaborator.name}"`);
                  
                  const enhancedBranchingRoles = getEnhancedRoles(branchingArtist, 'artist');
                  
                  // Try to get MusicNerd ID for the branching artist
                  let branchingArtistId: string | null = null;
                  try {
                    branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                  } catch (error) {
                    console.log(`Could not fetch MusicNerd ID for branching artist ${branchingArtist}`);
                  }
                  
                  branchingNode = {
                    id: branchingArtist,
                    name: branchingArtist,
                    type: enhancedBranchingRoles[0], // Primary role
                    types: enhancedBranchingRoles, // All roles
                    size: 12, // Smaller size for branching nodes
                    imageUrl: null,
                    spotifyId: null,
                    artistId: branchingArtistId,
                    collaborations: [collaborator.name], // Show connection to the producer/songwriter
                  };
                  nodeMap.set(branchingArtist, branchingNode);
                  
                  console.log(`🎭 [DEBUG] Enhanced branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                }
                
                // Create link between producer/songwriter and branching artist
                links.push({
                  source: collaborator.name,
                  target: branchingArtist,
                });
                console.log(`🔗 [DEBUG] Created branching link: "${collaborator.name}" ↔ "${branchingArtist}"`);
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
            // Fallback to current network collaborators
            const networkCollaborators = collaborationData.artists
              .filter(c => c.name !== collaborator.name && c.name !== artistName)
              .map(c => c.name);
            topCollaborators = [artistName, ...networkCollaborators.slice(0, 2)];
            console.log(`🔄 [DEBUG] Using network fallback for "${collaborator.name}":`, topCollaborators);
          }
        }

        // Check if we already have this person (for multi-role support)
        let collaboratorNode = nodeMap.get(collaborator.name);
        
        if (collaboratorNode) {
          // Person already exists - add the new role to their types array
          if (!collaboratorNode.types) {
            collaboratorNode.types = [collaboratorNode.type];
          }
          if (!collaboratorNode.types.includes(collaborator.type as 'artist' | 'producer' | 'songwriter')) {
            collaboratorNode.types.push(collaborator.type as 'artist' | 'producer' | 'songwriter');
            console.log(`🎭 [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
          }
          // Update collaborations list
          if (topCollaborators.length > 0) {
            const existingCollabs = collaboratorNode.collaborations || [];
            const newCollabs = topCollaborators.filter(c => !existingCollabs.includes(c));
            collaboratorNode.collaborations = [...existingCollabs, ...newCollabs];
          }
        } else {
          // Create new node for this person with enhanced role detection
          const enhancedRoles = getEnhancedRoles(collaborator.name, collaborator.type as 'artist' | 'producer' | 'songwriter');
          
          collaboratorNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: enhancedRoles[0], // Primary role
            types: enhancedRoles, // All roles
            size: 15,
            imageUrl: collaboratorImage,
            spotifyId: collaboratorSpotifyId,
            artistId: collaboratorMusicNerdId,
            collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
          };
          nodeMap.set(collaborator.name, collaboratorNode);
          
          console.log(`🎭 [DEBUG] Enhanced MusicBrainz "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
        }
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

              // Check if we already have this person (for multi-role support)
              let collaboratorNode = nodeMap.get(collaborator.name);
              
              if (collaboratorNode) {
                // Person already exists - add the new role to their types array
                if (!collaboratorNode.types) {
                  collaboratorNode.types = [collaboratorNode.type];
                }
                if (!collaboratorNode.types.includes(collaborator.type as 'artist' | 'producer' | 'songwriter')) {
                  collaboratorNode.types.push(collaborator.type as 'artist' | 'producer' | 'songwriter');
                  console.log(`🎭 [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
                }
                // Update collaborations list
                if (topCollaborators.length > 0) {
                  const existingCollabs = collaboratorNode.collaborations || [];
                  const newCollabs = topCollaborators.filter(c => !existingCollabs.includes(c));
                  collaboratorNode.collaborations = [...existingCollabs, ...newCollabs];
                }
              } else {
                // Create new node for this person with enhanced role detection
                const enhancedRoles = getEnhancedRoles(collaborator.name, collaborator.type as 'artist' | 'producer' | 'songwriter');
                
                collaboratorNode = {
                  id: collaborator.name,
                  name: collaborator.name,
                  type: enhancedRoles[0], // Primary role
                  types: enhancedRoles, // All roles
                  size: 15,
                  imageUrl: collaboratorImage,
                  spotifyId: collaboratorSpotifyId,
                  artistId: collaboratorMusicNerdId,
                  collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
                };
                nodeMap.set(collaborator.name, collaboratorNode);
                
                console.log(`🎭 [DEBUG] Enhanced Wikipedia "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
              }
              console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from Wikipedia context`);

              links.push({
                source: artistName,
                target: collaborator.name,
              });
              console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}" (Wikipedia source)`);
            }
            
            console.log(`✅ [DEBUG] Successfully created network from Wikipedia data: ${wikipediaCollaborators.length} collaborators for "${artistName}"`);

            // Final node array from consolidated map
            const nodes = Array.from(nodeMap.values());
            
            // Cache the generated network data
            const networkData = { nodes, links };
            console.log(`💾 [DEBUG] About to cache Wikipedia network data for "${artistName}" with ${nodes.length} nodes`);
            await this.cacheNetworkData(artistName, networkData);
            
            return networkData;

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
            // Check if we already have this person (for multi-role support)
            let collaboratorNode = nodeMap.get(collab.name);
            
            if (collaboratorNode) {
              // Person already exists - add the new role to their types array
              if (!collaboratorNode.types) {
                collaboratorNode.types = [collaboratorNode.type];
              }
              if (!collaboratorNode.types.includes(collab.type)) {
                collaboratorNode.types.push(collab.type);
                console.log(`🎭 [DEBUG] Added ${collab.type} role to existing ${collab.name} node (now has ${collaboratorNode.types.length} roles)`);
              }
            } else {
              // Create new node for this person
              collaboratorNode = {
                id: collab.name,
                name: collab.name,
                type: collab.type,
                types: [collab.type],
                size: 15,
              };
              
              // Get MusicNerd artist ID for the collaborator

              let musicNerdUrl = 'https://musicnerd.xyz';
              try {
                const artistId = await musicNerdService.getArtistId(collab.name);
                if (artistId) {
                  musicNerdUrl = `https://musicnerd.xyz/artist/${artistId}`;

                  console.log(`✅ [DEBUG] Found MusicNerd ID for ${collab.name}: ${artistId}`);
                }
              } catch (error) {
                console.log(`📭 [DEBUG] No MusicNerd ID found for ${collab.name}`);
              }
              
              collaboratorNode.musicNerdUrl = musicNerdUrl;
              nodeMap.set(collab.name, collaboratorNode);
            }
            links.push({
              source: mainArtistNode.id,
              target: collaboratorNode.id,
            });
            
            console.log(`✨ [DEBUG] Added known authentic collaborator: ${collab.name} (${collab.type})`);
          }
        } else {
          console.log(`👤 [DEBUG] Returning only the main artist node without any collaborators`);
        }
        

        // Final node array from consolidated map
        const nodes = Array.from(nodeMap.values());
        
        // Cache the generated network data
        const networkData = { nodes, links };
        await this.cacheNetworkData(artistName, networkData);
        return networkData;

      } else {
        console.log(`✅ [DEBUG] Successfully created network from MusicBrainz data: ${collaborationData.artists.length} collaborators for "${artistName}"`);
      }

      // Final node array from consolidated map
      const nodes = Array.from(nodeMap.values());
      
      // Cache the generated network data
      const networkData = { nodes, links };
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return just the main artist if everything fails
      const nodes = Array.from(nodeMap.values());
      
      // Cache the generated network data
      const networkData = { nodes, links };
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
    }
  }

  private async cacheNetworkData(artistName: string, networkData: NetworkData): Promise<void> {
    if (!db) {
      console.log(`⚠️ [DEBUG] Database not available - skipping cache for "${artistName}"`);
      return;
    }

    try {
      console.log(`💾 [DEBUG] Caching webmapdata for "${artistName}"`);
      
      // Check if artist already exists in database
      const existingArtist = await this.getArtistByName(artistName);
      
      if (existingArtist) {
        // Update existing artist with webMapData
        // Update existing artist with webmapdata using raw SQL since schema doesn't match MusicNerd DB
        await db.execute(sql`
          UPDATE artists 
          SET webmapdata = ${JSON.stringify(networkData)}::jsonb 
          WHERE name = ${artistName}
        `);
        console.log(`✅ [DEBUG] Updated webmapdata cache for existing artist "${artistName}"`);
      } else {
        // Don't create new artists - only cache data for existing artists
        console.log(`❌ [DEBUG] Artist "${artistName}" does not exist in database - skipping cache creation`);
      }
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error caching webmapdata for "${artistName}":`, error);
      console.error(`❌ [DEBUG] Full error details:`, {
        message: error?.message,
        code: error?.code,
        detail: error?.detail
      });
    }
  }

  private async cacheNetworkDataById(artistId: string, networkData: NetworkData): Promise<void> {
    if (!db) {
      console.log(`⚠️ [DEBUG] Database not available - skipping cache for artist ID "${artistId}"`);
      return;
    }

    try {
      console.log(`💾 [DEBUG] Caching webmapdata for artist ID "${artistId}"`);
      
      // Update artist with webmapdata using ID directly
      await db.execute(sql`
        UPDATE artists 
        SET webmapdata = ${JSON.stringify(networkData)}::jsonb 
        WHERE id = ${artistId}
      `);
      console.log(`✅ [DEBUG] Updated webmapdata cache for artist ID "${artistId}"`);
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error caching webmapdata for artist ID "${artistId}":`, error);
      console.error(`❌ [DEBUG] Full error details:`, {
        message: error?.message,
        code: error?.code,
        detail: error?.detail
      });
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    // First, check if we have cached webmapdata for this artist (applies to ALL artists)
    console.log(`💾 [DEBUG] Checking for cached webmapdata for "${artistName}"`);
    const cachedArtist = await this.getArtistByName(artistName);
    
    if (cachedArtist?.webmapdata) {
      console.log(`✅ [DEBUG] Found cached webmapdata for "${cachedArtist.name}" - using cached data`);
      return cachedArtist.webmapdata as NetworkData;
    }
    
    console.log(`🆕 [DEBUG] No cached data found for "${artistName}" - generating new network data`);
    
    // For demo artists with rich mock data, use real MusicBrainz to showcase enhanced producer/songwriter extraction
    const enhancedMusicBrainzArtists: string[] = ['Post Malone', 'The Weeknd', 'Ariana Grande', 'Billie Eilish', 'Taylor Swift', 'Drake'];
    
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) {
      // Artist doesn't exist in database - return error instead of creating new entry
      console.log(`❌ [DEBUG] Artist "${artistName}" does not exist in database - cannot generate network`);
      throw new Error(`Artist "${artistName}" not found in database. Please search for an existing artist.`);
    }

    // Check if this is an enhanced demo artist using the correct database name
    if (enhancedMusicBrainzArtists.includes(mainArtist.name)) {
      console.log(`🎵 [DEBUG] Using enhanced MusicBrainz data for "${mainArtist.name}" to showcase deep producer/songwriter networks`);
      const networkData = await this.generateRealCollaborationNetwork(mainArtist.name);
      // Cache the result
      await this.cacheNetworkData(mainArtist.name, networkData);
      return networkData;
    }

    // If artist exists in MusicNerd database (UUID ID), skip collaboration lookup 
    // and generate real collaboration data instead since MusicNerd doesn't have our collaborations table
    const artistId = String(mainArtist.id);
    if (artistId.includes('-')) {
      console.log(`🎵 [DEBUG] Found MusicNerd artist "${mainArtist.name}" - generating real collaboration network`);
      return this.generateRealCollaborationNetwork(mainArtist.name);
    }

    // Artist exists in our own database, build network from stored data
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

    // Get collaborations from database (only for integer IDs)
    const artistCollaborations = await this.getCollaborationsByArtist(mainArtist.id as number);
    
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

  async getNetworkDataById(artistId: string): Promise<NetworkData | null> {
    if (!db) return null;
    
    try {
      console.log(`🔍 [DEBUG] Fetching network data for artist ID: "${artistId}"`);
      
      // First, get the artist by ID
      const result = await db
        .select({
          id: artists.id,
          name: artists.name,
          webmapdata: artists.webmapdata
        })
        .from(artists)
        .where(eq(artists.id, artistId))
        .limit(1);
      
      const artist = result[0];
      if (!artist) {
        console.log(`❌ [DEBUG] Artist not found with ID: "${artistId}"`);
        return null;
      }
      
      console.log(`✅ [DEBUG] Found artist: "${artist.name}" (ID: ${artistId})`);
      
      // Check if we have cached network data
      if (artist.webmapdata) {
        console.log(`💾 [DEBUG] Found cached webmapdata for artist ID "${artistId}" (${artist.name})`);
        return artist.webmapdata;
      }
      
      // If no cached data, generate new network data using the artist's name
      console.log(`🔄 [DEBUG] No cached data found for artist ID "${artistId}" (${artist.name}), generating new network...`);
      const networkData = await this.generateRealCollaborationNetwork(artist.name);
      
      // Cache the result with the correct artist ID
      await this.cacheNetworkDataById(artistId, networkData);
      
      return networkData;
      
    } catch (error) {
      console.error(`❌ [DEBUG] Error fetching network data for artist ID "${artistId}":`, error);
      return null;
    }
  }

}