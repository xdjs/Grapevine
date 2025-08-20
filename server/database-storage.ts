import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase.js';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { openAIService } from "./openai-service.js";
import { roleService } from './role-service.js';
import { musicBrainzService } from "./musicbrainz.js";
import { wikipediaService } from "./wikipedia.js";
import { musicNerdService } from "./musicnerd-service.js";
import { IStorage } from './storage.js';

// Type definitions for better type safety
type RoleType = 'artist' | 'producer' | 'songwriter';

interface SafeNetworkNode {
  id: string;
  name: string;
  type: RoleType;
  types?: RoleType[];
  size: number;
  imageUrl?: string | null;
  spotifyId?: string | null;
  artistId?: string | null;
  collaborations?: string[];
  musicNerdUrl?: string;
}

interface SafeNetworkData {
  nodes: SafeNetworkNode[];
  links: NetworkLink[];
}

// Type guard functions
function isValidRole(role: string): role is RoleType {
  return ['artist', 'producer', 'songwriter'].includes(role);
}

function validateRoles(roles: string[]): RoleType[] {
  return roles.filter(isValidRole);
}

function ensureRoleType(role: string): RoleType {
  return isValidRole(role) ? role : 'artist';
}

// Safe conversion functions
function safeParseRoles(data: unknown): RoleType[] {
  if (Array.isArray(data)) {
    return validateRoles(data.filter(item => typeof item === 'string'));
  }
  return [];
}

function createSafeNetworkNode(params: {
  name: string;
  type: string;
  types?: string[];
  size: number;
  imageUrl?: string | null;
  spotifyId?: string | null;
  artistId?: string | null;
  collaborations?: string[];
  musicNerdUrl?: string;
}): SafeNetworkNode {
  const safeType = ensureRoleType(params.type);
  const safeTypes = params.types ? validateRoles(params.types) : [safeType];
  
  return {
    id: params.name,
    name: params.name,
    type: safeType,
    types: safeTypes,
    size: params.size,
    imageUrl: params.imageUrl,
    spotifyId: params.spotifyId,
    artistId: params.artistId,
    collaborations: params.collaborations,
    musicNerdUrl: params.musicNerdUrl || 'https://musicnerd.xyz',
  };
}

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
      // Use raw SQL since our schema doesn't match the actual database columns
      const result = await db.execute(sql`
        SELECT id, name, spotify as spotify_id, node_pfp, webmapdata, x, instagram, facebook
        FROM artists 
        WHERE name = ${name}
        LIMIT 1
      `);
      
      const artist = result[0] as any;
      if (artist) {
        return {
          id: artist.id,
          name: artist.name,
          type: 'artist', // Default type since it doesn't exist in this schema
          imageUrl: null, // Will be populated from node_pfp if needed
          spotifyId: artist.spotify_id,
          nodePfp: artist.node_pfp,
          webmapdata: artist.webmapdata,
          x: artist.x,
          instagramUsername: artist.instagram,
          facebookUsername: artist.facebook
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

  private async batchDetectRoles(peopleList: string[]): Promise<Map<string, RoleType[]>> {
    const globalRoleMap = new Map<string, RoleType[]>();
    if (peopleList.length === 0) return globalRoleMap;
    // Evidence-based detection per person, parallelized
    const results = await Promise.allSettled(
      peopleList.map(async (name) => {
        const result = await roleService.computeRoles(name, { includeArtistByDefault: false });
        return { name, roles: result.roles };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { name, roles } = r.value;
        const valid = validateRoles(roles);
        if (valid.length > 0) {
          globalRoleMap.set(name, valid);
          console.log(`✅ [DEBUG] Evidence-based batch roles for "${name}":`, valid);
        }
      }
    }
    return globalRoleMap;
  }

  private async detectMainArtistRoles(artistName: string): Promise<RoleType[]> {
    const computed = await roleService.computeRoles(artistName, { includeArtistByDefault: true });
    const valid = validateRoles(computed.roles);
    return valid.length > 0 ? valid : ['artist'];
  }

  private async generateRealCollaborationNetwork(artistName: string): Promise<SafeNetworkData> {
    const links: NetworkLink[] = [];
    const nodeMap = new Map<string, SafeNetworkNode>();
    
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

    // Detect roles for main artist
    const mainArtistTypes = await this.detectMainArtistRoles(artistName);
    const orderedMainArtistTypes = mainArtistTypes.includes('artist') 
      ? ['artist' as const, ...mainArtistTypes.filter(r => r !== 'artist')]
      : mainArtistTypes;

    // Create main artist node
    const mainArtistNode = createSafeNetworkNode({
      name: artistName,
      type: orderedMainArtistTypes[0],
      types: orderedMainArtistTypes,
      size: 30,
      musicNerdUrl,
    });
    nodeMap.set(artistName, mainArtistNode);
    
    console.log(`🎭 [DEBUG] Main artist "${artistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);

    try {
      // REMOVED: OpenAI hallucination call that was adding fake collaborators
      // Now we only use real data sources: MusicBrainz, Wikipedia, and real Spotify API
      console.log(`🎵 [DEBUG] Skipping OpenAI to prevent hallucinations - using only real data sources for "${artistName}"`);
      
      // Return just the main artist node with no fake collaborators
      return { nodes: [mainArtistNode], links: [] };
      
    } catch (error) {
      console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
      console.log('🔄 [DEBUG] Falling back to MusicBrainz...');
    }

      // Fallback to MusicBrainz with OpenAI multi-role enhancement
      console.log(`🎵 [DEBUG] Querying MusicBrainz API for "${artistName}"...`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      
      // Process MusicBrainz data with OpenAI role enhancement
      const limitedCollaborators = collaborationData.artists.slice(0, 10);
      
      // Collect all people for OpenAI role detection
      const allPeopleFromMusicBrainz = new Set<string>();
      for (const collaborator of limitedCollaborators) {
        allPeopleFromMusicBrainz.add(collaborator.name);
      }
      
      // Use OpenAI to detect multi-roles for MusicBrainz collaborators
      const musicBrainzRoleMap = await this.batchDetectRoles(Array.from(allPeopleFromMusicBrainz));
      console.log(`🎭 [DEBUG] Enhanced ${allPeopleFromMusicBrainz.size} MusicBrainz collaborators with OpenAI role detection`);

      // Collect all collaborator names for batch role detection
      const collaboratorNames = limitedCollaborators.map(c => c.name);
      console.log(`🎭 [DEBUG] Performing comprehensive role detection for ${collaboratorNames.length} MusicBrainz collaborators`);
      
      // Batch detect roles for ALL collaborators
      const globalRoleMap = await this.batchDetectRoles(collaboratorNames);
      
      for (const collaborator of limitedCollaborators) {
        const safeCollaboratorType = ensureRoleType(collaborator.type);
        

        // Get enhanced roles from OpenAI, fallback to MusicBrainz type
        const enhancedRoles = musicBrainzRoleMap.get(collaborator.name) || [safeCollaboratorType];
        
        const collaboratorNode = createSafeNetworkNode({
            name: collaborator.name,
          type: enhancedRoles[0],
          types: enhancedRoles,
            size: 20,
        });
        
        nodeMap.set(collaborator.name, collaboratorNode);

        console.log(`🎭 [DEBUG] Created MusicBrainz node "${collaborator.name}" with ${enhancedRoles.length} roles: [${enhancedRoles.join(', ')}]`);


              links.push({
                source: artistName,
                target: collaborator.name,
              });
            }
            
            const nodes = Array.from(nodeMap.values());
      return { nodes, links };
      
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return minimal network with just the main artist if it exists
      const fallbackNode = createSafeNetworkNode({
        name: artistName,
        type: 'artist',
        size: 30,
        musicNerdUrl: musicNerdUrl || 'https://musicnerd.xyz',
      });
      return { nodes: [fallbackNode], links: [] };
    }
  }

  private async cacheNetworkData(artistName: string, networkData: SafeNetworkData): Promise<void> {
    if (!db) {
      console.log(`⚠️ [DEBUG] Database not available - skipping cache for "${artistName}"`);
      return;
    }

    try {
      console.log(`💾 [DEBUG] Caching webmapdata for "${artistName}"`);
      
      const existingArtist = await this.getArtistByName(artistName);
      
      if (existingArtist) {
        await db.execute(sql`
          UPDATE artists 
          SET webmapdata = ${JSON.stringify(networkData)}::jsonb 
          WHERE name = ${artistName}
        `);
        console.log(`✅ [DEBUG] Updated webmapdata cache for existing artist "${artistName}"`);
      } else {
        console.log(`❌ [DEBUG] Artist "${artistName}" does not exist in database - skipping cache creation`);
      }
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error caching webmapdata for "${artistName}":`, error);
    }
  }

  private async cacheNetworkDataById(artistId: string, networkData: SafeNetworkData): Promise<void> {
    if (!db) {
      console.log(`⚠️ [DEBUG] Database not available - skipping cache for artist ID "${artistId}"`);
      return;
    }

    try {
      console.log(`💾 [DEBUG] Caching webmapdata for artist ID "${artistId}"`);
      
      await db.execute(sql`
        UPDATE artists 
        SET webmapdata = ${JSON.stringify(networkData)}::jsonb 
        WHERE id = ${artistId}
      `);
      console.log(`✅ [DEBUG] Updated webmapdata cache for artist ID "${artistId}"`);
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error caching webmapdata for artist ID "${artistId}":`, error);
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    console.log(`🔄 [DEBUG] Generating network data for "${artistName}"`);
    
    const artist = await this.getArtistByName(artistName);
    if (!artist) {
      console.log(`❌ [DEBUG] Artist "${artistName}" not found in database`);
      return null;
    }
    
    const networkData = await this.generateRealCollaborationNetwork(artistName);
    await this.cacheNetworkData(artistName, networkData);
    
    // Convert SafeNetworkData to NetworkData
    const convertedData: NetworkData = {
      nodes: networkData.nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        types: node.types,
        size: node.size,
        imageUrl: node.imageUrl,
        spotifyId: node.spotifyId,
        artistId: node.artistId,
        collaborations: node.collaborations,
        musicNerdUrl: node.musicNerdUrl,
      })),
      links: networkData.links
    };
    
    return convertedData;
  }

  async getNetworkDataById(artistId: string): Promise<NetworkData | null> {
    if (!db) return null;
    
    try {
      console.log(`🔍 [DEBUG] Fetching network data for artist ID: "${artistId}"`);
      
      const result = await db
        .select({
          id: artists.id,
          name: artists.name,
          webmapdata: artists.webmapdata
        })
        .from(artists)
        .where(sql`${artists.id} = ${artistId}`)
        .limit(1);
      
      const artist = result[0];
      if (!artist) {
        console.log(`❌ [DEBUG] Artist not found with ID: "${artistId}"`);
        return null;
      }
      
      console.log(`✅ [DEBUG] Found artist: "${artist.name}" (ID: ${artistId})`);
      
      if (artist.webmapdata && typeof artist.webmapdata === 'object' && 'nodes' in artist.webmapdata && 'links' in artist.webmapdata) {
        console.log(`💾 [DEBUG] Found cached webmapdata for artist ID "${artistId}" (${artist.name})`);
        return artist.webmapdata as NetworkData;
      }
      
      console.log(`🔄 [DEBUG] No cached data found for artist ID "${artistId}" (${artist.name}), generating new network...`);
      const networkData = await this.generateRealCollaborationNetwork(artist.name);
      await this.cacheNetworkDataById(artistId, networkData);
      
      // Convert SafeNetworkData to NetworkData
      const convertedData: NetworkData = {
        nodes: networkData.nodes.map(node => ({
          id: node.id,
          name: node.name,
          type: node.type,
          types: node.types,
          size: node.size,
          imageUrl: node.imageUrl,
          spotifyId: node.spotifyId,
          artistId: node.artistId,
          collaborations: node.collaborations,
          musicNerdUrl: node.musicNerdUrl,
        })),
        links: networkData.links
      };
      
      return convertedData;
      
    } catch (error) {
      console.error(`❌ [DEBUG] Error fetching network data for artist ID "${artistId}":`, error);
      return null;
    }
  }

  /**
   * Store profile picture URL and Spotify ID for an artist in the node_pfp column
   * This is separate from network generation and specifically for caching profile pictures
   */
  async storeArtistProfilePicture(artistName: string, profileData: {
    imageUrl: string;
    spotifyId: string;
  }): Promise<boolean> {
    if (!db) {
      console.log(`⚠️ [DEBUG] Database not available - cannot store profile picture for "${artistName}"`);
      return false;
    }

    try {
      console.log(`💾 [DEBUG] Storing profile picture for "${artistName}": ${profileData.imageUrl}`);
      
      // Create profile data object for node_pfp column
      const nodeProfileData = {
        imageUrl: profileData.imageUrl,
        spotifyId: profileData.spotifyId,
        cachedAt: new Date().toISOString()
      };

      // First try to update existing artist
      const existingArtist = await this.getArtistByName(artistName);
      
      if (existingArtist) {
        // Update existing artist with profile picture data
        await db.execute(sql`
          UPDATE artists 
          SET 
            node_pfp = ${JSON.stringify(nodeProfileData)}::jsonb,
            spotify = ${profileData.spotifyId},
            updated_at = NOW()
          WHERE name = ${artistName}
        `);
        console.log(`✅ [DEBUG] Updated profile picture cache for existing artist "${artistName}"`);
        return true;
      } else {
        // Create new artist entry if it doesn't exist
        await db.execute(sql`
          INSERT INTO artists (name, spotify, node_pfp, created_at, updated_at)
          VALUES (${artistName}, ${profileData.spotifyId}, ${JSON.stringify(nodeProfileData)}::jsonb, NOW(), NOW())
        `);
        console.log(`✅ [DEBUG] Created new artist entry with profile picture cache for "${artistName}"`);
        return true;
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error storing profile picture for "${artistName}":`, error);
      return false;
    }
  }

  /**
   * Retrieve cached profile picture data for an artist from node_pfp column
   */
  async getCachedProfilePicture(artistName: string): Promise<{
    imageUrl: string;
    spotifyId: string;
    cachedAt: string;
  } | null> {
    if (!db) return null;

    try {
      // Use raw SQL to match actual database schema
      const result = await db.execute(sql`
        SELECT node_pfp, spotify as spotify_id
        FROM artists 
        WHERE name = ${artistName}
        LIMIT 1
      `);
      
      const artist = result[0] as any;
      if (!artist) {
        return null;
      }

      // First try to get from node_pfp column (new caching system)
      if (artist.node_pfp) {
        let profileData = artist.node_pfp;
        
        // Handle case where it's a string that needs parsing
        if (typeof profileData === 'string') {
          try {
            profileData = JSON.parse(profileData);
          } catch (parseError) {
            console.warn(`⚠️ [DEBUG] Could not parse node_pfp data for "${artistName}":`, parseError);
            profileData = null;
          }
        }
        
        // Now check if we have valid profile data
        if (profileData && profileData.imageUrl && profileData.spotifyId) {
          console.log(`🎯 [DEBUG] Found cached profile picture for "${artistName}" from node_pfp`);
          return {
            imageUrl: profileData.imageUrl,
            spotifyId: profileData.spotifyId,
            cachedAt: profileData.cachedAt || 'unknown'
          };
        }
      }

      // Fallback to legacy spotify column (no image URL in this schema)
      if (artist.spotify_id) {
        console.log(`🎯 [DEBUG] Found Spotify ID for "${artistName}" from legacy column, but no image URL`);
        // We can't provide an image URL from legacy data alone
        return null;
      }

      return null;
    } catch (error) {
      console.error(`❌ [DEBUG] Error retrieving cached profile picture for "${artistName}":`, error);
      return null;
    }
  }

  /**
   * Batch store profile pictures for multiple artists
   */
  async batchStoreProfilePictures(profileDataMap: Map<string, {
    imageUrl: string;
    spotifyId: string;
  }>): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const successful: string[] = [];
    const failed: string[] = [];

    console.log(`💾 [DEBUG] Batch storing profile pictures for ${profileDataMap.size} artists`);

    for (const [artistName, profileData] of profileDataMap) {
      const result = await this.storeArtistProfilePicture(artistName, profileData);
      if (result) {
        successful.push(artistName);
      } else {
        failed.push(artistName);
      }
    }

    console.log(`✅ [DEBUG] Batch store complete: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  /**
   * Check if profile picture cache is fresh (within specified hours)
   */
  async isProfilePictureCacheFresh(artistName: string, maxAgeHours: number = 24): Promise<boolean> {
    const cachedData = await this.getCachedProfilePicture(artistName);
    if (!cachedData || cachedData.cachedAt === 'legacy') {
      return false;
    }

    try {
      const cachedTime = new Date(cachedData.cachedAt);
      const now = new Date();
      const ageHours = (now.getTime() - cachedTime.getTime()) / (1000 * 60 * 60);
      return ageHours < maxAgeHours;
    } catch (error) {
      console.warn(`⚠️ [DEBUG] Could not determine cache age for "${artistName}":`, error);
      return false;
    }
  }

  /**
   * Get profile pictures with cache-first strategy
   */
  async getProfilePicturesWithCache(artistNames: string[], forceRefresh: boolean = false): Promise<Map<string, {
    imageUrl: string;
    spotifyId: string;
    fromCache: boolean;
  }>> {
    const results = new Map();
    const needsFetch: string[] = [];

    console.log(`🎯 [DEBUG] Getting profile pictures for ${artistNames.length} artists (forceRefresh: ${forceRefresh})`);

    // Check cache first
    if (!forceRefresh) {
      for (const artistName of artistNames) {
        const cached = await this.getCachedProfilePicture(artistName);
        const isFresh = await this.isProfilePictureCacheFresh(artistName);
        
        if (cached && isFresh) {
          results.set(artistName, {
            imageUrl: cached.imageUrl,
            spotifyId: cached.spotifyId,
            fromCache: true
          });
          console.log(`💾 [DEBUG] Using cached profile picture for "${artistName}"`);
        } else {
          needsFetch.push(artistName);
        }
      }
    } else {
      needsFetch.push(...artistNames);
    }

    // Fetch missing images from Spotify
    if (needsFetch.length > 0 && spotifyService.isConfigured()) {
      console.log(`🎵 [DEBUG] Fetching ${needsFetch.length} profile pictures from Spotify API`);
      
      const spotifyResults = await spotifyService.batchGetArtistProfileImages(needsFetch);
      
      // Store new results and add to return map
      const storageMap = new Map();
      for (const [artistName, spotifyData] of spotifyResults) {
        storageMap.set(artistName, {
          imageUrl: spotifyData.imageUrl,
          spotifyId: spotifyData.spotifyId
        });
        
        results.set(artistName, {
          imageUrl: spotifyData.imageUrl,
          spotifyId: spotifyData.spotifyId,
          fromCache: false
        });
      }
      
      // Batch store to database
      if (storageMap.size > 0) {
        await this.batchStoreProfilePictures(storageMap);
      }
    }

    console.log(`✅ [DEBUG] Profile picture retrieval complete: ${results.size} found, ${results.size - needsFetch.length} from cache`);
    return results;
  }
}