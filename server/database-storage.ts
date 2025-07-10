import { eq, and, sql } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase.js';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { openAIService } from "./openai-service.js";
import { musicBrainzService } from "./musicbrainz.js";
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
          type: insertArtist.type || 'artist'
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
    console.log(`🎵 [DEBUG] Generating collaboration network for "${artistName}" using Spotify → MusicBrainz flow`);
    
    // Step 1: Use Spotify API to find collaborators
    console.log(`🎧 [DEBUG] Step 1: Searching Spotify for "${artistName}" collaborators`);
    const spotifyCollaborators = await this.getSpotifyCollaborators(artistName);
    
    if (spotifyCollaborators.length === 0) {
      console.log(`❌ [DEBUG] No Spotify collaborators found for "${artistName}"`);
      return await this.createSingleArtistNetwork(artistName);
    }


    // Create optimized batch role detection system for performance
    const globalRoleMap = new Map<string, string[]>();
    
    // Batch role detection function for better performance
    const batchDetectRoles = async (peopleList: string[]): Promise<void> => {
      if (!openAIService.isServiceAvailable() || peopleList.length === 0) return;
      
      try {
        const peopleListStr = peopleList.map(name => `"${name}"`).join(', ');
        const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}
        
Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;

        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const roleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchRolePrompt }],
          temperature: 0.1,
          max_tokens: 1000,
        });

        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const rolesData = JSON.parse(roleContent);
            for (const [personName, roles] of Object.entries(rolesData)) {
              if (Array.isArray(roles) && roles.length > 0) {
                const validRoles = roles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
                if (validRoles.length > 0) {
                  globalRoleMap.set(personName, validRoles);
                  console.log(`✅ [DEBUG] Batch detected roles for "${personName}":`, validRoles);
                }
              }
            }
          } catch (parseError) {
            console.log(`⚠️ [DEBUG] Could not parse batch role detection, falling back to defaults`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Batch role detection failed, falling back to defaults`);
      }
    };
    
    // Quick role lookup with fallback to default
    const getOptimizedRoles = (personName: string, defaultRole: 'artist' | 'producer' | 'songwriter'): string[] => {
      return globalRoleMap.get(personName) || [defaultRole];
    };

    // Pre-detect roles for main artist with dedicated detection
    console.log(`🔍 [DEBUG] Detecting roles for main artist "${artistName}"...`);
    let mainArtistTypes = ['artist']; // Default
    
    if (openAIService.isServiceAvailable()) {
      try {
        const mainArtistRolePrompt = `What roles does ${artistName} have in the music industry? Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. Return ONLY the JSON array, no other text.`;
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const roleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: mainArtistRolePrompt }],
          temperature: 0.1,
          max_tokens: 100,
        });

        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const detectedRoles = JSON.parse(roleContent);
            if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
              const validRoles = detectedRoles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
              if (validRoles.length > 0) {
                mainArtistTypes = validRoles;
                console.log(`✅ [DEBUG] Detected main artist roles for "${artistName}":`, mainArtistTypes);
                // Cache for consistency
                globalRoleMap.set(artistName, mainArtistTypes);
              }
            }
          } catch (parseError) {
            console.log(`⚠️ [DEBUG] Could not parse main artist role detection for "${artistName}", using default`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Main artist role detection failed for "${artistName}", using default`);
      }
    }
    
    // Ensure 'artist' is first for main artists if they have that role
    const orderedMainArtistTypes = mainArtistTypes.includes('artist') 
      ? ['artist', ...mainArtistTypes.filter(r => r !== 'artist')]
      : mainArtistTypes;

    // Create main artist node with detected roles
    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: orderedMainArtistTypes[0], // Primary type
      types: orderedMainArtistTypes, // All detected roles
      size: 30, // Larger size for main artist
      musicNerdUrl,
    };
    nodeMap.set(artistName, mainArtistNode);
    
    console.log(`🎭 [DEBUG] Main artist "${artistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);

    // Helper function to determine roles - now relying on improved OpenAI prompt for multi-role data
    const getEnhancedRoles = (personName: string, defaultRole: 'artist' | 'producer' | 'songwriter'): ('artist' | 'producer' | 'songwriter')[] => {
      // The new OpenAI prompt should provide comprehensive role information directly
      // For collaborators, we'll rely on the multi-role consolidation logic to merge roles
      return [defaultRole];
    };

    console.log(`✅ [DEBUG] Found ${spotifyCollaborators.length} Spotify collaborators for "${artistName}"`);

    // Step 2: Use MusicBrainz to classify collaborators by type
    console.log(`🎵 [DEBUG] Step 2: Classifying collaborators using MusicBrainz`);
    const classifiedCollaborators = await this.classifyCollaboratorsWithMusicBrainz(spotifyCollaborators);
    
    console.log(`✅ [DEBUG] Classified ${classifiedCollaborators.length} collaborators with MusicBrainz`);

    // Step 3: Build the network with classified collaborators
    return await this.buildNetworkFromCollaborators(artistName, classifiedCollaborators);
  }



    console.log(`🔍 [DEBUG] Starting collaboration network generation for: "${artistName}"`);
    console.log('📊 [DEBUG] Data source priority: 1) MusicBrainz → 2) Wikipedia → 3) Main artist only (no synthetic data)');

    try {
      // Skip OpenAI to ensure only authentic data is used
      // OpenAI generates artificial collaborations, so we'll use only MusicBrainz and Wikipedia
      console.log(`🎯 [DEBUG] Skipping OpenAI for authentic data only - using MusicBrainz and Wikipedia sources`);
      
      // Proceed directly to MusicBrainz for authentic collaboration data
      if (false) { // Disabled OpenAI
        console.log(`🤖 [DEBUG] Querying OpenAI API for "${artistName}"...`);
        console.log('🔍 [DEBUG] About to call openAIService.getArtistCollaborations for main artist:', artistName);
        
        try {
          const openAIData = await openAIService.getArtistCollaborations(artistName);
          console.log(`✅ [DEBUG] OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map(a => `${a.name} (${a.type}, top collaborators: ${a.topCollaborators.length})`)
          });


          if (openAIData.artists.length > 0) {
            // Filter out any generic/fake names that might slip through
            const authenticCollaborators = openAIData.artists.filter(collaborator => {
              const name = collaborator.name.toLowerCase();
              // Filter out obviously fake or generic names
              const fakePatterns = [
                'john doe', 'jane doe', 'john smith', 'jane smith',
                'producer x', 'songwriter y', 'artist a', 'artist b',
                'unknown', 'anonymous', 'various', 'n/a', 'tbd',
                'placeholder', 'example', 'sample'
              ];
              return !fakePatterns.some(pattern => name.includes(pattern)) &&
                     !name.match(/^(artist|producer|songwriter)\s+[a-z]$/i) &&
                     !name.match(/^[a-z]{1,2}$/i); // Single letters or very short generic names
            });
            
            console.log(`🔍 [DEBUG] Filtered ${openAIData.artists.length} to ${authenticCollaborators.length} authentic collaborators`);
            
            if (authenticCollaborators.length === 0) {
              console.log(`⚠️ [DEBUG] No authentic collaborators found for "${artistName}" from OpenAI, returning single node`);
              // Return just the main artist node
              const finalNetworkData = { 
                nodes: [mainArtistNode], 
                links: []
              };
              await this.cacheNetworkData(artistName, finalNetworkData);
              return finalNetworkData;
            }
            
            // Collect all people for batch role detection
            const allPeople = new Set<string>();
            for (const collaborator of authenticCollaborators) {
              allPeople.add(collaborator.name);
              for (const branchingArtist of collaborator.topCollaborators || []) {
                if (branchingArtist !== artistName) {
                  allPeople.add(branchingArtist);
                }
              }
            }
            
            // Batch detect roles for all people at once for performance
            console.log(`🎭 [DEBUG] Batch detecting roles for ${allPeople.size} people...`);
            await batchDetectRoles([...allPeople]);
            
            // Process OpenAI data and merge with main artist node map
            for (const collaborator of authenticCollaborators) {
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
                // Create new node for this person with optimized role detection
                const enhancedRoles = getOptimizedRoles(collaborator.name, collaborator.type);
                
                collaboratorNode = {
                  id: collaborator.name,
                  name: collaborator.name,
                  type: enhancedRoles[0], // Primary role
                  types: enhancedRoles, // All roles
                  size: 20,
                  imageUrl: null, // Will be set in batch
                  spotifyId: null, // Will be set in batch
                  collaborations: collaborator.topCollaborators || [],
                  musicNerdUrl: 'https://musicnerd.xyz', // Will be set in batch
                };
                
                console.log(`🎭 [DEBUG] Enhanced "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
                nodeMap.set(collaborator.name, collaboratorNode);
              }
            }

  private async getSpotifyCollaborators(artistName: string): Promise<string[]> {
    console.log(`🎧 [DEBUG] Getting Spotify collaborators for "${artistName}"`);
    
    if (!spotifyService.isConfigured()) {
      console.log(`❌ [DEBUG] Spotify service not configured`);
      return [];
    }

    try {
      // Search for the artist on Spotify
      const spotifyArtist = await spotifyService.searchArtist(artistName);
      if (!spotifyArtist) {
        console.log(`❌ [DEBUG] Artist "${artistName}" not found on Spotify`);
        return [];
      }


      console.log(`✅ [DEBUG] Found Spotify artist: "${spotifyArtist.name}" (${spotifyArtist.id})`);

      // Get their top 10 tracks to find collaborators
      const topTracks = await spotifyService.getArtistTopTracks(spotifyArtist.id, 'US', 10);
      console.log(`🎵 [DEBUG] Found ${topTracks.length} top tracks for "${artistName}"`);

      // Get their albums to find more collaborators
      const albums = await spotifyService.getArtistAlbums(spotifyArtist.id);
      console.log(`💿 [DEBUG] Found ${albums.length} albums for "${artistName}"`);

      // Extract collaborators from tracks and albums
      const collaborators = new Set<string>();
      
      // From top tracks
      for (const track of topTracks) {
        for (const artist of track.artists) {
          if (artist.name !== artistName && artist.name !== spotifyArtist.name) {
            collaborators.add(artist.name);
            console.log(`🤝 [DEBUG] Found collaborator from track "${track.name}": "${artist.name}"`);
          }
        }
      }


      // From albums (get track details) - expanded search for main artists
      const albumLimit = collaborators.size < 7 ? 8 : 3; // Use more albums if few collaborators found
      for (const album of albums.slice(0, albumLimit)) {
        try {
          const albumTracks = await spotifyService.getAlbumTracks(album.id);
          for (const track of albumTracks) {
            if (track.artists) {
              for (const artist of track.artists) {
                if (artist.name !== artistName && artist.name !== spotifyArtist.name) {
                  collaborators.add(artist.name);
                  console.log(`🤝 [DEBUG] Found collaborator from album "${album.name}": "${artist.name}"`);
                }
              }
            }
          }
          
          // Small delay to prevent rate limiting when checking many albums
          if (albumLimit > 3) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.log(`❌ [DEBUG] Error getting tracks for album "${album.name}":`, error);
        }
      }


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
                    // Create new branching node with optimized role detection
                    const enhancedBranchingRoles = getOptimizedRoles(branchingArtist, 'artist');
                    
                    branchingNode = {
                      id: branchingArtist,
                      name: branchingArtist,
                      type: enhancedBranchingRoles[0], // Primary role
                      types: enhancedBranchingRoles, // All roles
                      size: 16, // Branching nodes size (updated from 15 to 16)
                      musicNerdUrl: 'https://musicnerd.xyz', // Will be set in batch
                    };
                    nodeMap.set(branchingArtist, branchingNode);
                    
                    console.log(`🎭 [DEBUG] Enhanced OpenAI branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                  }
                  
                  // Create link between collaborator and their top collaborator
                  links.push({
                    source: collaboratorNode.name,
                    target: branchingArtist,
                  });

      const collaboratorList = Array.from(collaborators);
      console.log(`✅ [DEBUG] Total unique Spotify collaborators found: ${collaboratorList.length}`);
      return collaboratorList;

    } catch (error) {
      console.log(`❌ [DEBUG] Error getting Spotify collaborators for "${artistName}":`, error);
      return [];
    }
  }

  private async classifyCollaboratorsWithMusicBrainz(collaborators: string[]): Promise<Array<{name: string, type: string, types: string[]}>> {
    console.log(`🎵 [DEBUG] Classifying ${collaborators.length} collaborators with MusicBrainz`);
    
    const classified: Array<{name: string, type: string, types: string[]}> = [];
    
    for (const collaborator of collaborators.slice(0, 10)) { // Top 10 main collaborators
      try {
        console.log(`🔍 [DEBUG] Classifying "${collaborator}" with MusicBrainz`);
        
        // Search for the collaborator in MusicBrainz
        const mbArtist = await musicBrainzService.searchArtist(collaborator);
        if (!mbArtist) {
          console.log(`❌ [DEBUG] "${collaborator}" not found in MusicBrainz, defaulting to 'artist'`);
          classified.push({ name: collaborator, type: 'artist', types: ['artist'] });
          continue;
        }

        // Get detailed artist information with relations
        const detailedArtist = await musicBrainzService.getArtistWithRelations(mbArtist.id);
        if (!detailedArtist || !detailedArtist.relations) {
          console.log(`❌ [DEBUG] No relations found for "${collaborator}" in MusicBrainz, defaulting to 'artist'`);
          classified.push({ name: collaborator, type: 'artist', types: ['artist'] });
          continue;
        }

        // Classify based on MusicBrainz relations
        let type = 'artist'; // Default type
        const relations = detailedArtist.relations;
        
        // Check for producer relations
        const producerRelations = relations.filter(r => 
          r.type === 'producer' || 
          r.type === 'mix' || 
          r.type === 'recording engineer' || 
          r.type === 'mastering engineer'
        );
        
        // Check for songwriter relations  
        const songwriterRelations = relations.filter(r => 
          r.type === 'composer' || 
          r.type === 'lyricist' || 
          r.type === 'writer' ||
          r.type === 'songwriter'
        );

        // Assign multiple roles based on relation counts
        const roles = ['artist']; // Start with artist as base role
        
        if (producerRelations.length > 0) {
          roles.push('producer');
        }
        if (songwriterRelations.length > 0) {
          roles.push('songwriter');
        }
        
        // Determine primary type and keep all roles
        let primaryType = 'artist';
        if (roles.includes('producer') && roles.includes('songwriter')) {
          // If both producer and songwriter, use the one with more relations
          primaryType = producerRelations.length >= songwriterRelations.length ? 'producer' : 'songwriter';
        } else if (roles.includes('producer')) {
          primaryType = 'producer';
        } else if (roles.includes('songwriter')) {
          primaryType = 'songwriter';
        }
        
        const finalRoles = roles; // Keep all roles including 'artist'


        console.log(`✅ [DEBUG] Classified "${collaborator}" with roles [${finalRoles.join(', ')}] (${producerRelations.length} producer relations, ${songwriterRelations.length} songwriter relations)`);
        classified.push({ name: collaborator, type: primaryType, types: finalRoles });

      } catch (error) {
        console.log(`❌ [DEBUG] Error classifying "${collaborator}":`, error);
        classified.push({ name: collaborator, type: 'artist', types: ['artist'] });
      }
    }

    return classified;
  }


            // Batch process all external API calls for performance optimization
            console.log(`⚡ [DEBUG] Batch processing external APIs for ${nodeMap.size} nodes...`);
            const allNodesForBatch = Array.from(nodeMap.values());
            const nodeNames = allNodesForBatch.map(node => node.name);
            
            // Parallel batch operations
            const [spotifyResults, musicNerdResults] = await Promise.all([
              // Batch Spotify searches
              spotifyService.isConfigured() ? 
                Promise.allSettled(nodeNames.map(async name => {
                  try {
                    const artist = await spotifyService.searchArtist(name);
                    return { name, artist };
                  } catch (error) {
                    return { name, artist: null };
                  }
                })) : 
                Promise.resolve([]),
              
              // Batch MusicNerd ID lookups
              Promise.allSettled(nodeNames.map(async name => {
                try {
                  const artistId = await musicNerdService.getArtistId(name);
                  return { name, artistId };
                } catch (error) {
                  return { name, artistId: null };
                }
              }))
            ]);
            
            // Apply Spotify results
            if (spotifyResults.length > 0) {
              for (const result of spotifyResults) {
                if (result.status === 'fulfilled' && result.value.artist) {
                  const node = nodeMap.get(result.value.name);
                  if (node) {
                    node.imageUrl = spotifyService.getArtistImageUrl(result.value.artist, 'medium');
                    node.spotifyId = result.value.artist.id;
                  }
                }
              }
            }
            
            // Apply MusicNerd results
            for (const result of musicNerdResults) {
              if (result.status === 'fulfilled' && result.value.artistId) {
                const node = nodeMap.get(result.value.name);
                if (node) {
                  node.musicNerdUrl = `https://musicnerd.xyz/artist/${result.value.artistId}`;
                }
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
          } else {
            console.log(`⚠️ [DEBUG] No collaborators found for "${artistName}" from OpenAI, returning single node`);
            // Return just the main artist node
            const finalNetworkData = { 
              nodes: [nodeMap.get(artistName)!], 
              links: []
            };
            await this.cacheNetworkData(artistName, finalNetworkData);
            return finalNetworkData;
          }
        } catch (error) {
          console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
          console.log('🔄 [DEBUG] Falling back to MusicBrainz...');
        }
      } else {
        console.log('⚠️ [DEBUG] OpenAI service not available, falling back to MusicBrainz...');

  private async buildNetworkFromCollaborators(artistName: string, collaborators: Array<{name: string, type: string, types: string[]}>): Promise<NetworkData> {
    console.log(`🏗️ [DEBUG] Building network for "${artistName}" with ${collaborators.length} classified collaborators`);
    
    // Get main artist info
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) {
      console.log(`❌ [DEBUG] Main artist "${artistName}" not found in database`);
      throw new Error(`Artist "${artistName}" not found in database`);
    }

    // Get main artist's Spotify image and MusicNerd ID
    let mainArtistImage = null;
    let mainArtistMusicNerdId = null;
    
    try {
      const spotifyArtist = await spotifyService.searchArtist(artistName);
      if (spotifyArtist) {
        mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist);

      }
      mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
    } catch (error) {
      console.log(`Could not fetch metadata for main artist ${artistName}`);
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
      
      // Only use data from external sources - no hardcoded collaborations
      
      // Get Spotify image for main artist
      let mainArtistImage = null;
      let mainArtistSpotifyId = null;
      
      if (spotifyService.isConfigured()) {
        try {
          const spotifyArtist = await spotifyService.searchArtist(artistName);
          if (spotifyArtist) {
            mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
            mainArtistSpotifyId = spotifyArtist.id;

    // Detect multiple roles for main artist using MusicBrainz
    let mainArtistRoles = ['artist'];
    try {
      const mbArtist = await musicBrainzService.searchArtist(artistName);
      if (mbArtist) {
        const detailedArtist = await musicBrainzService.getArtistWithRelations(mbArtist.id);
        if (detailedArtist && detailedArtist.relations) {
          const producerRelations = detailedArtist.relations.filter(r => 
            r.type === 'producer' || r.type === 'mix' || r.type === 'recording engineer'
          );
          const songwriterRelations = detailedArtist.relations.filter(r => 
            r.type === 'composer' || r.type === 'lyricist' || r.type === 'writer' || r.type === 'songwriter'
          );
          
          if (producerRelations.length > 0) {
            mainArtistRoles.push('producer');
          }
          if (songwriterRelations.length > 0) {
            mainArtistRoles.push('songwriter');

          }
          console.log(`🎭 [DEBUG] Main artist "${artistName}" roles: [${mainArtistRoles.join(', ')}]`);
        }
      }
    } catch (error) {
      console.log(`❌ [DEBUG] Could not classify main artist roles for "${artistName}":`, error);
    }

    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      types: mainArtistRoles,
      size: 20,
      artistId: mainArtistMusicNerdId,
    };

      // Update main artist node with additional data
      const mainArtistNodeFromMap = nodeMap.get(artistName)!;
      mainArtistNodeFromMap.imageUrl = mainArtistImage;
      mainArtistNodeFromMap.spotifyId = mainArtistSpotifyId;
      mainArtistNodeFromMap.artistId = mainArtistMusicNerdId;

    // Process collaborators and get their branching collaborators
    for (const collaborator of collaborators) {
      console.log(`🔍 [DEBUG] Processing collaborator "${collaborator.name}" and finding their collaborators`);
      
      // Get collaborator's own collaborators from Spotify
      const branchingCollaborators = await this.getSpotifyCollaborators(collaborator.name);
      const topBranchingCollaborators = branchingCollaborators.slice(0, 3); // Top 3 branching collaborators
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`🌿 [DEBUG] Found ${topBranchingCollaborators.length} branching collaborators for "${collaborator.name}"`);

      // Get collaborator's MusicNerd ID only (no image data)
      let collaboratorMusicNerdId = null;
      
      try {
        if (collaborator.type === 'artist') {
          collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
        }
      } catch (error) {
        console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
      }

      const collaboratorNode: NetworkNode = {
        id: collaborator.name,
        name: collaborator.name,
        type: collaborator.type as 'artist' | 'producer' | 'songwriter',
        types: collaborator.types || [collaborator.type as 'artist' | 'producer' | 'songwriter'], // Multi-role support
        size: 15,
        artistId: collaboratorMusicNerdId,
        topCollaborations: topBranchingCollaborators, // For hover tooltips
      };
      
      nodeMap.set(collaborator.name, collaboratorNode);
      const roleDisplay = collaborator.types ? collaborator.types.join(' + ') : collaborator.type;
      console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${roleDisplay}) from Spotify/MusicBrainz`);

      // Create link from main artist to collaborator
      links.push({
        source: artistName,
        target: collaborator.name,
      });
      console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}"`);

      // Add branching collaborators
      for (const branchingCollaborator of topBranchingCollaborators) {
        if (branchingCollaborator !== artistName && !nodeMap.has(branchingCollaborator)) {
          // Get branching collaborator's MusicNerd ID only (no image data)
          let branchingMusicNerdId = null;
          
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
                    size: 15, // Branching nodes size
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

            branchingMusicNerdId = await musicNerdService.getArtistId(branchingCollaborator);

          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for branching collaborator ${branchingCollaborator}`);
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
            size: 20,
            imageUrl: collaboratorImage,
            spotifyId: collaboratorSpotifyId,
            artistId: collaboratorMusicNerdId,
            collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,

          const branchingNode: NetworkNode = {
            id: branchingCollaborator,
            name: branchingCollaborator,
            type: 'artist', // Default to artist for branching collaborators
            types: ['artist'],
            size: 10,
            artistId: branchingMusicNerdId,

          };
          
          nodeMap.set(branchingCollaborator, branchingNode);
          console.log(`🌿 [DEBUG] Added branching node: "${branchingCollaborator}" (artist) connected to "${collaborator.name}"`);

          // Create link from collaborator to their branching collaborator
          links.push({
            source: collaborator.name,
            target: branchingCollaborator,
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
                  size: 20,
                  imageUrl: collaboratorImage,
                  spotifyId: collaboratorSpotifyId,
                  artistId: collaboratorMusicNerdId,
                  collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
                };
                nodeMap.set(collaborator.name, collaboratorNode);
                
                console.log(`🎭 [DEBUG] Enhanced Wikipedia "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
              }
              console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from Wikipedia context`);

          console.log(`🔗 [DEBUG] Created branching link: "${collaborator.name}" ↔ "${branchingCollaborator}"`);
        }
      }
    }


    // Step 4: Detect cross-collaborations between collaborators
    console.log(`🔍 [DEBUG] Starting cross-collaboration detection between collaborators`);
    await this.addCrossCollaborationLinks(collaborators, nodeMap, links);

    // Final node array from consolidated map
    const finalNodes = Array.from(nodeMap.values());
    
    // Cache the generated network data
    const networkData = { nodes: finalNodes, links };
    console.log(`💾 [DEBUG] About to cache Spotify/MusicBrainz network data for "${artistName}" with ${finalNodes.length} nodes and ${links.length} links`);
    await this.cacheNetworkData(artistName, networkData);
    
    return networkData;
  }

  private async addCrossCollaborationLinks(
    collaborators: Array<{name: string, type: string}>, 
    nodeMap: Map<string, NetworkNode>, 
    links: NetworkLink[]
  ): Promise<void> {
    console.log(`🔗 [DEBUG] Checking for cross-collaborations between ${collaborators.length} collaborators`);
    
    // Check each pair of collaborators to see if they've worked together
    // Only check a subset to balance thoroughness with performance
    const maxChecks = Math.min(collaborators.length, 6); // Limit to top 6 to balance performance
    
    for (let i = 0; i < maxChecks; i++) {
      for (let j = i + 1; j < maxChecks; j++) {
        const collaborator1 = collaborators[i];
        const collaborator2 = collaborators[j];
        

        // If both MusicBrainz and Wikipedia fail, return only the main artist node
        console.log(`🚨 [DEBUG] No real collaboration data found for "${artistName}" from either MusicBrainz or Wikipedia`);
        console.log(`👤 [DEBUG] Returning only the main artist node without any collaborators`);
        
        // No fallback collaborators - authentic data only

        console.log(`🔍 [DEBUG] Checking if "${collaborator1.name}" has worked with "${collaborator2.name}"`);
        
        try {
          // Get collaborator1's top tracks only (faster than full collaborator search)
          const spotifyArtist = await spotifyService.searchArtist(collaborator1.name);
          if (spotifyArtist) {
            const topTracks = await spotifyService.getArtistTopTracks(spotifyArtist.id, 'US', 10);
            

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
                size: 20,
              };

            // Check if collaborator2 appears in any of these tracks
            const hasCollaborated = topTracks.some(track => 
              track.artists.some(artist => 
                artist.name.toLowerCase().includes(collaborator2.name.toLowerCase()) ||
                collaborator2.name.toLowerCase().includes(artist.name.toLowerCase())
              )
            );
            
            if (hasCollaborated) {
              // Check if link already exists
              const linkExists = links.some(link => 
                (link.source === collaborator1.name && link.target === collaborator2.name) ||
                (link.source === collaborator2.name && link.target === collaborator1.name)
              );

              
              if (!linkExists) {
                links.push({
                  source: collaborator1.name,
                  target: collaborator2.name,
                });
                console.log(`🌟 [DEBUG] Added cross-collaboration link: "${collaborator1.name}" ↔ "${collaborator2.name}"`);
              }
            }
            links.push({
              source: artistName,
              target: collaboratorNode.id,
            });
            
            console.log(`✨ [DEBUG] Added known authentic collaborator: ${collab.name} (${collab.type})`);
          }
        } catch (error) {
          console.log(`❌ [DEBUG] Error checking cross-collaboration between "${collaborator1.name}" and "${collaborator2.name}":`, error);
        }

        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }



  private async createSingleArtistNetwork(artistName: string): Promise<NetworkData> {
    console.log(`👤 [DEBUG] Creating single artist network for "${artistName}"`);
    
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) {
      console.log(`❌ [DEBUG] Main artist "${artistName}" not found in database`);
      throw new Error(`Artist "${artistName}" not found in database`);
    }

    // Get main artist's Spotify image and MusicNerd ID
    let mainArtistImage = null;
    let mainArtistMusicNerdId = null;
    
    try {
      const spotifyArtist = await spotifyService.searchArtist(artistName);
      if (spotifyArtist) {
        mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist);
      }
      mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
    } catch (error) {
      console.log(`Could not fetch metadata for main artist ${artistName}`);
    }

    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      types: ['artist'],
      size: 20,
      imageUrl: mainArtistImage,
      spotifyId: null,
      artistId: mainArtistMusicNerdId,
    };

    const networkData = { nodes: [mainArtistNode], links: [] };
    
    // Cache the network data
    console.log(`💾 [DEBUG] About to cache single-artist network data for "${artistName}"`);
    await this.cacheNetworkData(artistName, networkData);
    
    return networkData;
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
        // Update existing artist with webmapdata
        await db
          .update(artists)
          .set({ 
            webmapdata: networkData
          })
          .where(eq(artists.id, existingArtist.id));
        
        console.log(`✅ [DEBUG] Successfully cached webmapdata for existing artist "${artistName}"`);
      } else {
        console.log(`⚠️ [DEBUG] Artist "${artistName}" not found in database - skipping cache`);
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error caching webmapdata for "${artistName}":`, error);
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {

    // Force fresh generation for all artists to use new data-only approach
    console.log(`🔄 [DEBUG] Force regenerating network data for "${artistName}" with data-only approach (cache cleared)`);
    
    // Check if artist exists but skip cached data
    const artist = await this.getArtistByName(artistName);
    if (!artist) {
      console.log(`❌ [DEBUG] Artist "${artistName}" not found in database`);
      return null;
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

    console.log(`🔍 [DEBUG] Getting network data for: "${artistName}"`);
    

    // Check cache for existing network data
    if (cachedArtist?.webmapdata) {
      console.log(`✅ [DEBUG] Found cached webmapdata for "${cachedArtist.name}" - using cached data`);
      return cachedArtist.webmapdata as NetworkData;


    // Check if artist exists in database first
    const existingArtist = await this.getArtistByName(artistName);
    if (!existingArtist) {
      console.log(`❌ [DEBUG] Artist "${artistName}" not found in database`);
      return null;

    }


    // Artist exists in our own database, build network from stored data
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    
    const mainArtistNode: NetworkNode = {
      id: mainArtist.name,
      name: mainArtist.name,
      type: mainArtist.type as 'artist' | 'producer' | 'songwriter',
      size: 30,
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
          size: 20,
          imageUrl: collaborator.imageUrl,
          spotifyId: collaborator.spotifyId,
        };
        nodes.push(collaboratorNode);

        links.push({
          source: mainArtist.name,
          target: collaborator.name,
        });

    // Check for cached data
    if (existingArtist.webmapdata) {
      console.log(`✅ [DEBUG] Found cached webmapdata for "${artistName}"`);
      return existingArtist.webmapdata as NetworkData;

    }

    // Generate new network data
    console.log(`🔄 [DEBUG] No cached data found for "${artistName}" - generating new network...`);
    return await this.generateRealCollaborationNetwork(artistName);
  }
}