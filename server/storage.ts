import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { musicBrainzService } from "./musicbrainz.js";
import { wikipediaService } from "./wikipedia.js";
import { musicNerdService } from "./musicnerd-service.js";

export interface IStorage {
  // Artist methods
  getArtist(id: number): Promise<Artist | undefined>;
  getArtistByName(name: string): Promise<Artist | undefined>;
  createArtist(artist: InsertArtist): Promise<Artist>;
  
  // Collaboration methods  
  getCollaborationsByArtist(artistId: number): Promise<Collaboration[]>;
  createCollaboration(collaboration: InsertCollaboration): Promise<Collaboration>;
  
  // Network data methods
  getNetworkData(artistName: string): Promise<NetworkData | null>;
  getNetworkDataById?(artistId: string): Promise<NetworkData | null>;
}

export class MemStorage implements IStorage {
  private artists: Map<number, Artist>;
  private collaborations: Map<number, Collaboration>;
  private currentArtistId: number;
  private currentCollaborationId: number;

  constructor() {
    this.artists = new Map();
    this.collaborations = new Map();
    this.currentArtistId = 1;
    this.currentCollaborationId = 1;
    
    // Initialize with mock data
    this.initializeMockData();
  }

  private async initializeMockData() {
    // No mock data - all artists will use real collaboration data
  }

  async getArtist(id: number): Promise<Artist | undefined> {
    return this.artists.get(id);
  }

  async getArtistByName(name: string): Promise<Artist | undefined> {
    return Array.from(this.artists.values()).find(
      (artist) => artist.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createArtist(insertArtist: InsertArtist): Promise<Artist> {
    const id = this.currentArtistId++;
    const artist: Artist = { 
      id,
      name: insertArtist.name,
      type: insertArtist.type,
      imageUrl: insertArtist.imageUrl || null,
      spotifyId: insertArtist.spotifyId || null,
      webmapdata: null
    };
    this.artists.set(id, artist);
    return artist;
  }

  async getCollaborationsByArtist(artistId: number): Promise<Collaboration[]> {
    return Array.from(this.collaborations.values()).filter(
      (collaboration) => collaboration.fromArtistId === artistId || collaboration.toArtistId === artistId
    );
  }

  async createCollaboration(insertCollaboration: InsertCollaboration): Promise<Collaboration> {
    const id = this.currentCollaborationId++;
    const collaboration: Collaboration = { ...insertCollaboration, id };
    this.collaborations.set(id, collaboration);
    return collaboration;
  }

  // Generate a dynamic artist network for unknown artists
  private generateDynamicNetwork(artistName: string): NetworkData {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Create main artist node only - no false collaborators
    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      size: 30, // Larger size for main artist
    };
    nodes.push(mainArtistNode);

    // Return only the main artist node with no collaborators
    return { nodes, links };
  }

  private generateCollaboratorNames(artistName: string): Array<{ name: string; type: 'producer' | 'songwriter' }> {
    // Return empty array - no false collaborators
    return [];
  }

  private async generateDynamicNetworkWithImages(artistName: string): Promise<NetworkData> {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Try to get the main artist from Spotify
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
        console.warn(`Could not fetch Spotify data for ${artistName}:`, error);
      }
    }

    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      size: 30, // Larger size for main artist
      imageUrl: mainArtistImage,
      spotifyId: mainArtistSpotifyId,
    };
    nodes.push(mainArtistNode);

    // Return only the main artist node with no collaborators
    return { nodes, links };
  }

  private async generateRealCollaborationNetwork(artistName: string): Promise<NetworkData> {
    console.log(`🚀 [DEBUG] STARTING generateRealCollaborationNetwork for "${artistName}"`);
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    try {
      // Get real collaboration data from MusicBrainz
      console.log(`🎵 [DEBUG] Fetching MusicBrainz collaboration data for "${artistName}"`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      console.log(`🎵 [DEBUG] MusicBrainz returned ${collaborationData.artists.length} artist collaborators and ${collaborationData.works.length} works for "${artistName}"`);
      
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
      console.log(`🔍 [DEBUG] Looking up MusicNerd artist ID for main artist: "${artistName}"`);
      let mainArtistMusicNerdId = null;
      try {
        mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
        console.log(`✅ [DEBUG] MusicNerd artist ID for "${artistName}": ${mainArtistMusicNerdId}`);
      } catch (error) {
        console.log(`❌ [DEBUG] Could not fetch MusicNerd ID for ${artistName}:`, error);
      }

      // Detect roles for main artist using OpenAI
      let mainArtistTypes: ('artist' | 'producer' | 'songwriter')[] = ['artist'];
      if (process.env.OPENAI_API_KEY) {
        try {
          const mainArtistRolePrompt = `What roles does ${artistName} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many artists also produce and write songs. This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${artistName} - check if they are also a producer or songwriter in addition to being an artist, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
          
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
                mainArtistTypes = detectedRoles.filter(role => 
                  ['artist', 'producer', 'songwriter'].includes(role)
                );
                console.log(`✅ [MemStorage] Detected main artist roles for "${artistName}":`, mainArtistTypes);
              }
            } catch (parseError) {
              console.log(`⚠️ [MemStorage] Could not parse main artist role detection for "${artistName}", using default`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [MemStorage] Main artist role detection failed for "${artistName}", using default`);
        }
      }

      // Create main artist node with detected roles
      const mainArtistNode: NetworkNode = {
        id: artistName,
        name: artistName,
        type: mainArtistTypes[0],
        types: mainArtistTypes,
        size: 30, // Larger size for main artist
        imageUrl: mainArtistImage,
        spotifyId: mainArtistSpotifyId,
        artistId: mainArtistMusicNerdId,
      };
      nodes.push(mainArtistNode);

      // Add collaborating artists from MusicBrainz
      console.log(`🎨 [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      
      // Batch detect roles for ALL people in the network (collaborators AND their branching artists)
      const collaboratorRoleMap = new Map<string, ('artist' | 'producer' | 'songwriter')[]>();
      if (process.env.OPENAI_API_KEY && collaborationData.artists.length > 0) {
        try {
          // Collect ALL people who will be in the network
          const allPeopleInNetwork = new Set<string>();
          for (const collaborator of collaborationData.artists) {
            allPeopleInNetwork.add(collaborator.name);
          }
          
          // Also collect branching artists from topCollaborators
          for (const collaborator of collaborationData.artists) {
            if (collaborator.type === 'producer' || collaborator.type === 'songwriter') {
              try {
                const producerCollaborations = await musicBrainzService.getArtistCollaborations(collaborator.name);
                if (producerCollaborations && producerCollaborations.artists.length > 0) {
                  const branchingArtists = producerCollaborations.artists
                    .filter(c => c.name !== collaborator.name && c.name !== artistName)
                    .slice(0, 3)
                    .map(c => c.name);
                  branchingArtists.forEach(name => allPeopleInNetwork.add(name));
                }
              } catch (error) {
                // Continue without branching artists for this collaborator
              }
            }
          }
          
          const allPeopleArray = Array.from(allPeopleInNetwork);
          const peopleListStr = allPeopleArray.map(name => `"${name}"`).join(', ');
          console.log(`🎭 [MemStorage] Batch detecting roles for ${allPeopleArray.length} people in network:`, allPeopleArray);
          
          const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}
        
CRITICAL: Search extensively for MULTIPLE ROLES for every single person, regardless of their popularity or fame level. Many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has - investigate thoroughly for multiple roles on every person queried, whether they are famous or lesser-known. Return ONLY the JSON object, no other text.`;

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
                if (Array.isArray(roles)) {
                  const validRoles = roles.filter(role => 
                    ['artist', 'producer', 'songwriter'].includes(role)
                  ) as ('artist' | 'producer' | 'songwriter')[];
                  if (validRoles.length > 0) {
                    collaboratorRoleMap.set(personName, validRoles);
                    console.log(`✅ [MemStorage] Batch detected roles for "${personName}":`, validRoles);
                  }
                }
              }
            } catch (parseError) {
              console.log(`⚠️ [MemStorage] Could not parse batch role detection, falling back to defaults`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [MemStorage] Batch role detection failed, falling back to defaults`);
        }
      }
      
      // Use only the role data from external sources - no hardcoded role classifications
      const enhancedCollaborators = collaborationData.artists;
      
      for (const collaborator of enhancedCollaborators) {
        console.log(`👤 [DEBUG] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type})`);
        // Get Spotify image for collaborator
        let collaboratorImage = null;
        let collaboratorSpotifyId = null;
        
        if (spotifyService.isConfigured()) {
          try {
            const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
            if (spotifyCollaborator) {
              collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
              collaboratorSpotifyId = spotifyCollaborator.id;
            }
          } catch (error) {
            // Continue without image
          }
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
            if (producerCollaborations && producerCollaborations.artists.length > 0) {
              const authenticCollaborators = producerCollaborations.artists
                .filter(c => c.name !== collaborator.name)
                .slice(0, 3)
                .map(c => c.name);
              topCollaborators = authenticCollaborators;
              console.log(`✅ [DEBUG] Found ${authenticCollaborators.length} authentic collaborations for "${collaborator.name}":`, topCollaborators);
            } else {
              // Fallback to current network collaborators only if no authentic data exists
              const networkCollaborators = collaborationData.artists
                .filter(c => c.name !== collaborator.name && c.name !== artistName)
                .map(c => c.name);
              topCollaborators = [artistName, ...networkCollaborators.slice(0, 2)];
              console.log(`⚠️ [DEBUG] No authentic collaborations found for "${collaborator.name}", using network fallback:`, topCollaborators);
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

        // Get enhanced roles from batch detection, fallback to original type
        const enhancedRoles = collaboratorRoleMap.get(collaborator.name) || [collaborator.type as 'artist' | 'producer' | 'songwriter'];
        
        // Only include collaborators who are primarily producers/songwriters, not artists
        // If someone has 'artist' as their primary role, exclude them from initial generation
        const primaryRole = enhancedRoles[0];
        if (primaryRole !== 'producer' && primaryRole !== 'songwriter') {
          console.log(`🚫 [MemStorage] Skipping "${collaborator.name}" - primary role is "${primaryRole}", not producer/songwriter`);
          continue;
        }
        
        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: primaryRole,
          types: enhancedRoles,
          size: 20,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
          artistId: collaboratorMusicNerdId,
          collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
        };
        console.log(`🎭 [MemStorage] Enhanced "${collaborator.name}" to roles:`, enhancedRoles);
        console.log(`🎯 [DEBUG] Created node for "${collaborator.name}" with collaborations:`, collaboratorNode.collaborations);
        nodes.push(collaboratorNode);

        links.push({
          source: artistName,
          target: collaborator.name,
        });

        // REMOVED: Branching nodes creation during initial generation
        // Only first-degree collaborators should be shown initially
        // Second-degree connections will be added when users expand specific nodes
      }

      // If no real collaborations found, try Wikipedia
      if (collaborationData.artists.length === 0) {
        console.log(`No MusicBrainz collaborations found for ${artistName}, trying Wikipedia`);
        
        try {
          const wikipediaCollaborators = await wikipediaService.getArtistCollaborations(artistName);
          
          if (wikipediaCollaborators.length > 0) {
            // Add Wikipedia collaborators to the network
            for (const collaborator of wikipediaCollaborators) {
              // Get Spotify image for collaborator
              let collaboratorImage = null;
              let collaboratorSpotifyId = null;
              
              if (spotifyService.isConfigured()) {
                try {
                  const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
                  if (spotifyCollaborator) {
                    collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
                    collaboratorSpotifyId = spotifyCollaborator.id;
                  }
                } catch (error) {
                  // Continue without image
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

              // Detect roles for Wikipedia collaborators too
              let wikipediaCollaboratorRoles: ('artist' | 'producer' | 'songwriter')[] = [collaborator.type];
              if (process.env.OPENAI_API_KEY) {
                try {
                  const singleRolePrompt = `What roles does ${collaborator.name} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${collaborator.name}, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
                  
                  const OpenAI = await import('openai');
                  const openai = new OpenAI.default({
                    apiKey: process.env.OPENAI_API_KEY,
                  });

                  const roleCompletion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: singleRolePrompt }],
                    temperature: 0.1,
                    max_tokens: 100,
                  });

                  const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
                  if (roleContent) {
                    try {
                      const detectedRoles = JSON.parse(roleContent);
                      if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
                        wikipediaCollaboratorRoles = detectedRoles.filter(role => 
                          ['artist', 'producer', 'songwriter'].includes(role)
                        );
                        console.log(`✅ [MemStorage] Detected Wikipedia collaborator roles for "${collaborator.name}":`, wikipediaCollaboratorRoles);
                      }
                    } catch (parseError) {
                      console.log(`⚠️ [MemStorage] Could not parse Wikipedia collaborator role detection for "${collaborator.name}", using default`);
                    }
                  }
                } catch (error) {
                  console.log(`⚠️ [MemStorage] Wikipedia collaborator role detection failed for "${collaborator.name}", using default`);
                }
              }

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: wikipediaCollaboratorRoles[0],
                types: wikipediaCollaboratorRoles,
                size: 20,
                imageUrl: collaboratorImage,
                spotifyId: collaboratorSpotifyId,
                artistId: collaboratorMusicNerdId,
              };
              console.log(`🎭 [MemStorage] Enhanced Wikipedia "${collaborator.name}" to roles:`, wikipediaCollaboratorRoles);
              nodes.push(collaboratorNode);

              links.push({
                source: artistName,
                target: collaborator.name,
              });
            }
            
            console.log(`Found ${wikipediaCollaborators.length} collaborators from Wikipedia for ${artistName}`);
            return { nodes, links };
          }
        } catch (error) {
          console.error('Error fetching Wikipedia collaborations:', error);
        }
        
        // If both MusicBrainz and Wikipedia fail, return only the main artist
        console.log(`No real collaboration data found for ${artistName}, returning only main artist`);
        return { nodes, links };
      }

      return { nodes, links };
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return just the main artist if everything fails
      return { nodes, links };
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    // Use real collaboration data from MusicBrainz for all artists
    console.log(`🎵 [DEBUG] Using real collaboration data path for "${artistName}"`);
    return this.generateRealCollaborationNetwork(artistName);
  }






}

import { DatabaseStorage } from './database-storage.js';
import { isDatabaseAvailable } from './supabase.js';

// Initialize storage based on database availability
let storage: IStorage;

try {
  if (isDatabaseAvailable()) {
    storage = new DatabaseStorage();
    console.log('Using database storage (Supabase)');
  } else {
    storage = new MemStorage();
    console.log('Using in-memory storage (fallback)');
  }
} catch (error) {
  console.warn('Database storage initialization failed, falling back to in-memory storage:', error);
  storage = new MemStorage();
}

export { storage };
