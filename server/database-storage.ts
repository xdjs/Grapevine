import { eq, and, sql } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "@shared/schema";
import { spotifyService } from "./spotify";
import { openAIService } from "./openai-service";
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
        .select({
          id: artists.id,
          name: artists.name,
          webMapData: artists.webMapData,
          imageUrl: artists.imageUrl,
          spotifyId: artists.spotifyId
        })
        .from(artists)
        .where(eq(artists.name, name))
        .limit(1);
      
      const artist = result[0];
      if (artist) {
        // Add default type field since MusicNerd database doesn't have it
        return {
          ...artist,
          type: 'artist' as const
        } as Artist;
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
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Create main artist node first
    let musicNerdUrl = 'https://music-nerd-git-staging-musicnerd.vercel.app';
    try {
      const artistId = await musicNerdService.getArtistId(artistName);
      if (artistId) {
        musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
      }
    } catch (error) {
      console.log(`📭 [DEBUG] No MusicNerd ID found for main artist ${artistName}`);
    }

    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      size: 25,
      musicNerdUrl,
    };
    nodes.push(mainArtistNode);

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
            // Process OpenAI data to create network nodes
            for (const collaborator of openAIData.artists) {
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

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type,
                size: 15,
                imageUrl,
                spotifyId,
                collaborations: collaborator.topCollaborators || [], // Add the top collaborators list
              };

              // Get MusicNerd artist ID for the collaborator
              let musicNerdUrl = 'https://music-nerd-git-staging-musicnerd.vercel.app';
              try {
                const artistId = await musicNerdService.getArtistId(collaborator.name);
                if (artistId) {
                  musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
                  console.log(`✅ [DEBUG] Found MusicNerd ID for ${collaborator.name}: ${artistId}`);
                }
              } catch (error) {
                console.log(`📭 [DEBUG] No MusicNerd ID found for ${collaborator.name}`);
              }

              collaboratorNode.musicNerdUrl = musicNerdUrl;
              nodes.push(collaboratorNode);
              links.push({
                source: mainArtistNode.id,
                target: collaboratorNode.id,
              });

              // Add branching connections for the top collaborators
              const maxBranching = 3; // Both producers and songwriters get 3 top collaborator connections
              const branchingCount = Math.min(collaborator.topCollaborators.length, maxBranching);
              
              for (let i = 0; i < branchingCount; i++) {
                const branchingArtist = collaborator.topCollaborators[i];
                
                const branchingNode: NetworkNode = {
                  id: branchingArtist,
                  name: branchingArtist,
                  type: 'artist',
                  size: 15,
                };

                // Get MusicNerd ID for branching artist
                let branchingMusicNerdUrl = 'https://music-nerd-git-staging-musicnerd.vercel.app';
                try {
                  const branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                  if (branchingArtistId) {
                    branchingMusicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${branchingArtistId}`;
                  }
                } catch (error) {
                  console.log(`📭 [DEBUG] No MusicNerd ID found for branching artist ${branchingArtist}`);
                }

                branchingNode.musicNerdUrl = branchingMusicNerdUrl;
                
                // Check if we already have this artist node
                if (!nodes.find(n => n.id === branchingArtist)) {
                  nodes.push(branchingNode);
                }
                
                // Create link between collaborator and their top collaborator
                links.push({
                  source: collaborator.name,
                  target: branchingArtist,
                });

                console.log(`🌟 [DEBUG] Added branching artist "${branchingArtist}" connected to ${collaborator.type} "${collaborator.name}"`);
              }

              console.log(`➕ [DEBUG] Added ${collaborator.type}: ${collaborator.name} from OpenAI with ${branchingCount} branching connections`);
            }

            console.log(`✅ [DEBUG] Successfully created network from OpenAI data: ${openAIData.artists.length} collaborators for "${artistName}"`);
            
            // Cache the generated network data
            const networkData = { nodes, links };
            await this.cacheNetworkData(artistName, networkData);
            
            return networkData;
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
            // Fallback to current network collaborators
            const networkCollaborators = collaborationData.artists
              .filter(c => c.name !== collaborator.name && c.name !== artistName)
              .map(c => c.name);
            topCollaborators = [artistName, ...networkCollaborators.slice(0, 2)];
            console.log(`🔄 [DEBUG] Using network fallback for "${collaborator.name}":`, topCollaborators);
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
            
            // Cache the generated network data
            const networkData = { nodes, links };
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
            const collaboratorNode: NetworkNode = {
              id: collab.name,
              name: collab.name,
              type: collab.type,
              size: 15,
            };
            
            // Get MusicNerd artist ID for the collaborator
            let musicNerdUrl = 'https://music-nerd-git-staging-musicnerd.vercel.app';
            try {
              const artistId = await musicNerdService.getArtistId(collab.name);
              if (artistId) {
                musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
                console.log(`✅ [DEBUG] Found MusicNerd ID for ${collab.name}: ${artistId}`);
              }
            } catch (error) {
              console.log(`📭 [DEBUG] No MusicNerd ID found for ${collab.name}`);
            }
            
            collaboratorNode.musicNerdUrl = musicNerdUrl;
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
        
        // Cache the generated network data
        const networkData = { nodes, links };
        await this.cacheNetworkData(artistName, networkData);
        return networkData;
      } else {
        console.log(`✅ [DEBUG] Successfully created network from MusicBrainz data: ${collaborationData.artists.length} collaborators for "${artistName}"`);
      }

      // Cache the generated network data
      const networkData = { nodes, links };
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return just the main artist if everything fails
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
      console.log(`💾 [DEBUG] Caching webMapData for "${artistName}"`);
      
      // Check if artist already exists in database
      const existingArtist = await this.getArtistByName(artistName);
      
      if (existingArtist) {
        // Update existing artist with webMapData
        await db
          .update(artists)
          .set({ webMapData: networkData })
          .where(eq(artists.name, artistName));
        console.log(`✅ [DEBUG] Updated webMapData cache for existing artist "${artistName}"`);
      } else {
        // Create new artist entry with webMapData using raw SQL since schema doesn't match MusicNerd DB
        await db.execute(sql`
          INSERT INTO artists (name, "webMapData") 
          VALUES (${artistName}, ${JSON.stringify(networkData)}::jsonb)
        `);
        console.log(`✅ [DEBUG] Created new artist "${artistName}" with webMapData cache`);
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error caching webMapData for "${artistName}":`, error);
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    // First, check if we have cached webMapData for this artist (applies to ALL artists)
    console.log(`💾 [DEBUG] Checking for cached webMapData for "${artistName}"`);
    const cachedArtist = await this.getArtistByName(artistName);
    
    if (cachedArtist?.webMapData) {
      console.log(`✅ [DEBUG] Found cached webMapData for "${artistName}" - using cached data`);
      return cachedArtist.webMapData as NetworkData;
    }
    
    console.log(`🆕 [DEBUG] No cached data found for "${artistName}" - generating new network data`);
    
    // For demo artists with rich mock data, use real MusicBrainz to showcase enhanced producer/songwriter extraction
    const enhancedMusicBrainzArtists = ['Post Malone', 'The Weeknd', 'Ariana Grande', 'Billie Eilish', 'Taylor Swift', 'Drake'];
    
    if (enhancedMusicBrainzArtists.includes(artistName)) {
      console.log(`🎵 [DEBUG] Using enhanced MusicBrainz data for "${artistName}" to showcase deep producer/songwriter networks`);
      const networkData = await this.generateRealCollaborationNetwork(artistName);
      // Cache the result
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
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