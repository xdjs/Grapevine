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
    console.log(`🎵 [DEBUG] Generating collaboration network for "${artistName}" using Spotify → MusicBrainz flow`);
    
    // Step 1: Use Spotify API to find collaborators
    console.log(`🎧 [DEBUG] Step 1: Searching Spotify for "${artistName}" collaborators`);
    const spotifyCollaborators = await this.getSpotifyCollaborators(artistName);
    
    if (spotifyCollaborators.length === 0) {
      console.log(`❌ [DEBUG] No Spotify collaborators found for "${artistName}"`);
      return await this.createSingleArtistNetwork(artistName);
    }

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
        console.log(`🔍 [DEBUG] About to call openAIService.getArtistCollaborations for main artist: ${artistName}`);
        
        try {
          const openAIData = await openAIService.getArtistCollaborations(artistName);
          console.log(`✅ [DEBUG] OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map(a => `${a.name} (${a.type}, top collaborators: ${a.topCollaborators.length})`)
          });

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

    const nodeMap = new Map<string, NetworkNode>();
    nodeMap.set(artistName, mainArtistNode);
    const links: NetworkLink[] = [];

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
            branchingMusicNerdId = await musicNerdService.getArtistId(branchingCollaborator);
          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for branching collaborator ${branchingCollaborator}`);
          }

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