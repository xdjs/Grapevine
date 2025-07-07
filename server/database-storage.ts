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

      // Get their top tracks to find collaborators
      const topTracks = await spotifyService.getArtistTopTracks(spotifyArtist.id);
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

      // From albums (get track details)
      for (const album of albums.slice(0, 5)) { // Limit to avoid rate limits
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

  private async classifyCollaboratorsWithMusicBrainz(collaborators: string[]): Promise<Array<{name: string, type: string}>> {
    console.log(`🎵 [DEBUG] Classifying ${collaborators.length} collaborators with MusicBrainz`);
    
    const classified: Array<{name: string, type: string}> = [];
    
    for (const collaborator of collaborators.slice(0, 15)) { // Limit to avoid rate limits
      try {
        console.log(`🔍 [DEBUG] Classifying "${collaborator}" with MusicBrainz`);
        
        // Search for the collaborator in MusicBrainz
        const mbArtist = await musicBrainzService.searchArtist(collaborator);
        if (!mbArtist) {
          console.log(`❌ [DEBUG] "${collaborator}" not found in MusicBrainz, defaulting to 'artist'`);
          classified.push({ name: collaborator, type: 'artist' });
          continue;
        }

        // Get detailed artist information with relations
        const detailedArtist = await musicBrainzService.getArtistWithRelations(mbArtist.id);
        if (!detailedArtist || !detailedArtist.relations) {
          console.log(`❌ [DEBUG] No relations found for "${collaborator}" in MusicBrainz, defaulting to 'artist'`);
          classified.push({ name: collaborator, type: 'artist' });
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

        // Classify based on relation counts
        if (producerRelations.length > songwriterRelations.length && producerRelations.length > 0) {
          type = 'producer';
        } else if (songwriterRelations.length > 0) {
          type = 'songwriter';
        }

        console.log(`✅ [DEBUG] Classified "${collaborator}" as "${type}" (${producerRelations.length} producer relations, ${songwriterRelations.length} songwriter relations)`);
        classified.push({ name: collaborator, type });

      } catch (error) {
        console.log(`❌ [DEBUG] Error classifying "${collaborator}":`, error);
        classified.push({ name: collaborator, type: 'artist' });
      }
    }

    return classified;
  }

  private async buildNetworkFromCollaborators(artistName: string, collaborators: Array<{name: string, type: string}>): Promise<NetworkData> {
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

    const nodeMap = new Map<string, NetworkNode>();
    nodeMap.set(artistName, mainArtistNode);
    const links: NetworkLink[] = [];

    // Process collaborators and get their branching collaborators
    for (const collaborator of collaborators) {
      console.log(`🔍 [DEBUG] Processing collaborator "${collaborator.name}" and finding their collaborators`);
      
      // Get collaborator's own collaborators from Spotify
      const branchingCollaborators = await this.getSpotifyCollaborators(collaborator.name);
      const topBranchingCollaborators = branchingCollaborators.slice(0, 3); // Top 3
      
      console.log(`🌿 [DEBUG] Found ${topBranchingCollaborators.length} branching collaborators for "${collaborator.name}"`);

      // Get collaborator's Spotify image and MusicNerd ID
      let collaboratorImage = null;
      let collaboratorSpotifyId = null;
      let collaboratorMusicNerdId = null;
      
      try {
        const spotifyArtist = await spotifyService.searchArtist(collaborator.name);
        if (spotifyArtist) {
          collaboratorImage = spotifyService.getArtistImageUrl(spotifyArtist);
          collaboratorSpotifyId = spotifyArtist.id;
        }
        
        if (collaborator.type === 'artist') {
          collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
        }
      } catch (error) {
        console.log(`Could not fetch metadata for ${collaborator.name}`);
      }

      const collaboratorNode: NetworkNode = {
        id: collaborator.name,
        name: collaborator.name,
        type: collaborator.type as 'artist' | 'producer' | 'songwriter',
        types: [collaborator.type as 'artist' | 'producer' | 'songwriter'],
        size: 15,
        imageUrl: collaboratorImage,
        spotifyId: collaboratorSpotifyId,
        artistId: collaboratorMusicNerdId,
        topCollaborations: topBranchingCollaborators, // For hover tooltips
      };
      
      nodeMap.set(collaborator.name, collaboratorNode);
      console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from Spotify/MusicBrainz`);

      // Create link from main artist to collaborator
      links.push({
        source: artistName,
        target: collaborator.name,
      });
      console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}"`);

      // Add branching collaborators
      for (const branchingCollaborator of topBranchingCollaborators) {
        if (branchingCollaborator !== artistName && !nodeMap.has(branchingCollaborator)) {
          // Get branching collaborator's Spotify image and MusicNerd ID
          let branchingImage = null;
          let branchingSpotifyId = null;
          let branchingMusicNerdId = null;
          
          try {
            const spotifyArtist = await spotifyService.searchArtist(branchingCollaborator);
            if (spotifyArtist) {
              branchingImage = spotifyService.getArtistImageUrl(spotifyArtist);
              branchingSpotifyId = spotifyArtist.id;
            }
            branchingMusicNerdId = await musicNerdService.getArtistId(branchingCollaborator);
          } catch (error) {
            console.log(`Could not fetch metadata for branching collaborator ${branchingCollaborator}`);
          }

          const branchingNode: NetworkNode = {
            id: branchingCollaborator,
            name: branchingCollaborator,
            type: 'artist', // Default to artist for branching collaborators
            types: ['artist'],
            size: 12,
            imageUrl: branchingImage,
            spotifyId: branchingSpotifyId,
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

    // Final node array from consolidated map
    const nodes = Array.from(nodeMap.values());
    
    // Cache the generated network data
    const networkData = { nodes, links };
    console.log(`💾 [DEBUG] About to cache Spotify/MusicBrainz network data for "${artistName}" with ${nodes.length} nodes`);
    await this.cacheNetworkData(artistName, networkData);
    
    return networkData;
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