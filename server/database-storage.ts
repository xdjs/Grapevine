import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase.js';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { openAIService } from "./openai-service.js";
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

  private async batchDetectRoles(peopleList: string[]): Promise<Map<string, RoleType[]>> {
    const globalRoleMap = new Map<string, RoleType[]>();
    
    if (!openAIService.isServiceAvailable() || peopleList.length === 0) {
      return globalRoleMap;
    }
      
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
          const rolesData = JSON.parse(roleContent) as Record<string, unknown>;
            for (const [personName, roles] of Object.entries(rolesData)) {
            const validRoles = safeParseRoles(roles);
                if (validRoles.length > 0) {
                  globalRoleMap.set(personName, validRoles);
                  console.log(`✅ [DEBUG] Batch detected roles for "${personName}":`, validRoles);
              }
            }
          } catch (parseError) {
            console.log(`⚠️ [DEBUG] Could not parse batch role detection, falling back to defaults`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Batch role detection failed, falling back to defaults`);
      }
    
    return globalRoleMap;
  }

  private async detectMainArtistRoles(artistName: string): Promise<RoleType[]> {
    const roles: RoleType[] = [];
    
    // Get enhanced collaboration data from OpenAI with alternative names
    if (openAIService.isServiceAvailable()) {
      try {
        // Try multiple name variations for smaller artists
        const nameVariations = this.generateNameVariations(artistName);
        console.log(`🔍 [DEBUG] Trying ${nameVariations.length} name variations for "${artistName}":`, nameVariations);
        
        let bestResult = null;
        let bestCollaboratorCount = 0;
        
        for (const nameVariation of nameVariations) {
          try {
            const openAIData = await openAIService.getArtistCollaborations(nameVariation);
            if (openAIData.artists.length > bestCollaboratorCount) {
              bestResult = openAIData;
              bestCollaboratorCount = openAIData.artists.length;
              console.log(`✅ [DEBUG] Better result found for "${nameVariation}": ${openAIData.artists.length} collaborators`);
            }
          } catch (variationError) {
            console.log(`⚠️ [DEBUG] No data for variation "${nameVariation}"`);
          }
        }
        
        if (bestResult) {
          console.log(`🎭 [DEBUG] Using best result with ${bestResult.artists.length} collaborators`);
          
          // Check for songwriter roles
          const songwriterCollaborators = bestResult.artists.filter(c => c.type === 'songwriter');
          if (songwriterCollaborators.length > 0) {
            roles.push('songwriter');
            console.log(`✍️ [DEBUG] Detected "${artistName}" as songwriter (${songwriterCollaborators.length} songwriter collaborations)`);
          }
          
          // Check for producer roles
          const producerCollaborators = bestResult.artists.filter(c => c.type === 'producer');
          if (producerCollaborators.length > 0) {
            roles.push('producer');
            console.log(`🎛️ [DEBUG] Detected "${artistName}" as producer (${producerCollaborators.length} producer collaborations)`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Could not detect roles for "${artistName}" via OpenAI:`, error);
      }
    }
    
    // Try MusicBrainz with name variations
    try {
      const nameVariations = this.generateNameVariations(artistName);
      for (const nameVariation of nameVariations) {
        const musicBrainzData = await musicBrainzService.getArtistCollaborations(nameVariation);
        if (musicBrainzData.artists.length > 0) {
          console.log(`🎵 [DEBUG] Found MusicBrainz data for "${nameVariation}": ${musicBrainzData.artists.length} collaborators`);
          
          // Check relationship types to infer roles
          for (const collaborator of musicBrainzData.artists) {
            if (collaborator.relation && collaborator.relation.toLowerCase().includes('produc')) {
              if (!roles.includes('producer')) {
                roles.push('producer');
                console.log(`🎛️ [DEBUG] Detected "${artistName}" as producer from MusicBrainz relations`);
              }
            }
            if (collaborator.relation && (collaborator.relation.toLowerCase().includes('writ') || 
                                        collaborator.relation.toLowerCase().includes('compos'))) {
              if (!roles.includes('songwriter')) {
                roles.push('songwriter');
                console.log(`✍️ [DEBUG] Detected "${artistName}" as songwriter from MusicBrainz relations`);
              }
            }
          }
          break; // Use first successful variation
        }
      }
    } catch (error) {
      console.log(`⚠️ [DEBUG] Could not detect roles for "${artistName}" via MusicBrainz:`, error);
    }
    
    // Default to 'artist' if no specific roles detected
    if (roles.length === 0) {
      roles.push('artist');
      console.log(`🎭 [DEBUG] No specific roles detected for "${artistName}", defaulting to 'artist'`);
    }
    
    return roles;
  }

  private generateNameVariations(artistName: string): string[] {
    const variations = [artistName]; // Start with original name
    const nameLower = artistName.toLowerCase();
    
    // Handle common variations for smaller/independent artists
    
    // Remove common prefixes/suffixes
    const prefixesToRemove = ['the ', 'dj ', 'mc ', 'lil ', 'young ', 'big ', 'old ', '$'];
    const suffixesToRemove = [' band', ' group', ' collective', ' crew', ' productions', ' music'];
    
    for (const prefix of prefixesToRemove) {
      if (nameLower.startsWith(prefix)) {
        variations.push(artistName.substring(prefix.length));
      }
    }
    
    for (const suffix of suffixesToRemove) {
      if (nameLower.endsWith(suffix)) {
        variations.push(artistName.substring(0, artistName.length - suffix.length));
      }
    }
    
    // Handle ampersand variations
    if (artistName.includes('&')) {
      variations.push(artistName.replace('&', 'and'));
      variations.push(artistName.replace('&', '+'));
    }
    if (artistName.includes(' and ')) {
      variations.push(artistName.replace(' and ', ' & '));
      variations.push(artistName.replace(' and ', ' + '));
    }
    
    // Handle number variations (common in hip-hop/electronic)
    const numberWords = {
      '2': ['two', 'to', 'too'],
      '4': ['four', 'for', 'fore'],
      '8': ['eight', 'ate'],
      '1': ['one', 'won']
    };
    
    for (const [num, words] of Object.entries(numberWords)) {
      if (artistName.includes(num)) {
        for (const word of words) {
          variations.push(artistName.replace(num, word));
        }
      }
      for (const word of words) {
        if (nameLower.includes(word)) {
          variations.push(artistName.replace(new RegExp(word, 'gi'), num));
        }
      }
    }
    
    // Handle stylized names (remove special characters for mainstream search)
    const cleanName = artistName.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanName !== artistName) {
      variations.push(cleanName);
    }
    
    // Handle all caps / title case variations
    if (artistName === artistName.toUpperCase()) {
      // Convert from ALL CAPS to Title Case
      variations.push(artistName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()));
    }
    
    // Remove duplicates and empty strings
    return Array.from(new Set(variations.filter(v => v.length > 0)));
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
      // Try OpenAI for collaboration data with name variations
      if (openAIService.isServiceAvailable()) {
        console.log(`🤖 [DEBUG] Querying OpenAI API for "${artistName}"...`);
        
        try {
          // Try name variations for better results with smaller artists
          const nameVariations = this.generateNameVariations(artistName);
          let bestOpenAIData = null;
          let bestCollaboratorCount = 0;
          
          for (const nameVariation of nameVariations.slice(0, 3)) { // Limit to top 3 variations
            try {
              console.log(`🔍 [DEBUG] Trying OpenAI with variation: "${nameVariation}"`);
              const variationData = await openAIService.getArtistCollaborations(nameVariation);
              if (variationData.artists.length > bestCollaboratorCount) {
                bestOpenAIData = variationData;
                bestCollaboratorCount = variationData.artists.length;
                console.log(`✅ [DEBUG] Better OpenAI result for "${nameVariation}": ${variationData.artists.length} collaborators`);
              }
            } catch (variationError) {
              console.log(`⚠️ [DEBUG] OpenAI variation "${nameVariation}" failed:`, variationError);
            }
          }
          
          const openAIData = bestOpenAIData || await openAIService.getArtistCollaborations(artistName);
          console.log(`✅ [DEBUG] Final OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map(a => `${a.name} (${a.type})`)
          });

          if (openAIData.artists.length > 0) {
            // Filter authentic collaborators
            const authenticCollaborators = openAIData.artists.filter(collaborator => {
              const name = collaborator.name.toLowerCase();
              const fakePatterns = [
                'john doe', 'jane doe', 'john smith', 'jane smith',
                'producer x', 'songwriter y', 'artist a', 'artist b', 'artist c', 'artist d', 'artist e',
                'producer a', 'producer b', 'producer c', 'producer d', 'producer e',
                'songwriter a', 'songwriter b', 'songwriter c', 'songwriter d', 'songwriter e',
                'artist 1', 'artist 2', 'artist 3', 'artist 4', 'artist 5',
                'producer 1', 'producer 2', 'producer 3', 'producer 4', 'producer 5',
                'songwriter 1', 'songwriter 2', 'songwriter 3', 'songwriter 4', 'songwriter 5',
                'unknown', 'anonymous', 'various', 'n/a', 'tbd',
                'placeholder', 'example', 'sample'
              ];
              return !fakePatterns.some(pattern => name.includes(pattern)) &&
                     !name.match(/^(artist|producer|songwriter)\s+[a-z]$/i) &&
                     !name.match(/^[a-z]{1,2}$/i);
            });
            
            console.log(`🔍 [DEBUG] Filtered ${openAIData.artists.length} to ${authenticCollaborators.length} authentic collaborators`);
            
            if (authenticCollaborators.length === 0) {
              console.log(`⚠️ [DEBUG] No authentic collaborators found for "${artistName}" from OpenAI`);
              return { nodes: [mainArtistNode], links: [] };
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
            
            // Batch detect roles
            const globalRoleMap = await this.batchDetectRoles(Array.from(allPeople));
            
            // Helper function to get roles with fallback
            const getOptimizedRoles = (personName: string, defaultRole: RoleType): RoleType[] => {
              return globalRoleMap.get(personName) || [defaultRole];
            };
            
            // Process OpenAI data
            for (const collaborator of authenticCollaborators) {
              const safeCollaboratorType = ensureRoleType(collaborator.type);
              let collaboratorNode = nodeMap.get(collaborator.name);
              
              if (collaboratorNode) {
                // Person already exists - merge roles
                const currentTypes = collaboratorNode.types || [collaboratorNode.type];
                if (!currentTypes.includes(safeCollaboratorType)) {
                  collaboratorNode.types = [...currentTypes, safeCollaboratorType];
                  console.log(`🎭 [DEBUG] Added ${safeCollaboratorType} role to existing ${collaborator.name} node`);
                }
                
                // Merge collaborations
                if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
                  const existingCollabs = collaboratorNode.collaborations || [];
                  const newCollabs = collaborator.topCollaborators.filter(c => !existingCollabs.includes(c));
                  collaboratorNode.collaborations = [...existingCollabs, ...newCollabs];
                }
              } else {
                // Create new node
                const enhancedRoles = getOptimizedRoles(collaborator.name, safeCollaboratorType);
                
                collaboratorNode = createSafeNetworkNode({
                  name: collaborator.name,
                  type: enhancedRoles[0],
                  types: enhancedRoles,
                  size: 20,
                  collaborations: collaborator.topCollaborators || [],
                });
                
                nodeMap.set(collaborator.name, collaboratorNode);
                console.log(`🎭 [DEBUG] Enhanced "${collaborator.name}" to roles:`, enhancedRoles);
              }
            }

            // Create links and branching connections
            const allNodes = Array.from(nodeMap.values());
            
            for (const collaboratorNode of allNodes) {
              if (collaboratorNode.name !== artistName) {
                // Create main connection
                links.push({
                  source: mainArtistNode.id,
                  target: collaboratorNode.id,
                });

                // Add branching connections
                const maxBranching = 3;
                const branchingCount = Math.min(collaboratorNode.collaborations?.length || 0, maxBranching);
                
                for (let i = 0; i < branchingCount; i++) {
                  const branchingArtist = collaboratorNode.collaborations![i];
                  
                  let branchingNode = nodeMap.get(branchingArtist);
                  
                  if (branchingNode) {
                    // Add artist role if not present
                    const currentTypes = branchingNode.types || [branchingNode.type];
                    if (!currentTypes.includes('artist')) {
                      branchingNode.types = [...currentTypes, 'artist'];
                      console.log(`🎭 [DEBUG] Added artist role to existing branching node ${branchingArtist}`);
                    }
                  } else {
                    // Create new branching node
                    const enhancedBranchingRoles = getOptimizedRoles(branchingArtist, 'artist');
                    
                    branchingNode = createSafeNetworkNode({
                      name: branchingArtist,
                      type: enhancedBranchingRoles[0],
                      types: enhancedBranchingRoles,
                      size: 16,
                    });
                    
                    nodeMap.set(branchingArtist, branchingNode);
                    console.log(`🎭 [DEBUG] Enhanced branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                  }
                  
                  // Create link
                  links.push({
                    source: collaboratorNode.name,
                    target: branchingArtist,
                  });
                }
              }
            }

            // Batch process external APIs
            const allNodesForBatch = Array.from(nodeMap.values());
            const nodeNames = allNodesForBatch.map(node => node.name);
            
            // Parallel batch operations
            const [spotifyResults, musicNerdResults] = await Promise.all([
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
              
              Promise.allSettled(nodeNames.map(async name => {
                try {
                  const artistId = await musicNerdService.getArtistId(name);
                  return { name, artistId };
                } catch (error) {
                  return { name, artistId: null };
                }
              }))
            ]);
            
            // Apply results
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
            
            for (const result of musicNerdResults) {
              if (result.status === 'fulfilled' && result.value.artistId) {
                const node = nodeMap.get(result.value.name);
                if (node) {
                  node.musicNerdUrl = `https://musicnerd.xyz/artist/${result.value.artistId}`;
                }
              }
            }
            
            const nodes = Array.from(nodeMap.values());
            console.log(`✅ [DEBUG] Successfully created network from OpenAI data: ${nodes.length} nodes for "${artistName}"`);
            
            return { nodes, links };
          }
        } catch (error) {
          console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
          console.log('🔄 [DEBUG] Falling back to MusicBrainz...');
        }
      }

      // Fallback to MusicBrainz
      console.log(`🎵 [DEBUG] Querying MusicBrainz API for "${artistName}"...`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      
      // Process MusicBrainz data with type safety
      const limitedCollaborators = collaborationData.artists.slice(0, 10);
      
      for (const collaborator of limitedCollaborators) {
        const safeCollaboratorType = ensureRoleType(collaborator.type);
        
        const collaboratorNode = createSafeNetworkNode({
            name: collaborator.name,
          type: safeCollaboratorType,
            size: 20,
        });
        
                nodeMap.set(collaborator.name, collaboratorNode);

              links.push({
                source: artistName,
                target: collaborator.name,
              });
            }
            
            const nodes = Array.from(nodeMap.values());
      return { nodes, links };
      
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      return { nodes: [mainArtistNode], links: [] };
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
      
      if (artist.webmapdata) {
        console.log(`💾 [DEBUG] Found cached webmapdata for artist ID "${artistId}" (${artist.name})`);
        return artist.webmapdata;
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
}