import { eq, and } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "@shared/schema";
import { spotifyService } from "./spotify";
import { musicBrainzService } from "./musicbrainz";
import { wikipediaService } from "./wikipedia";
import { creditsExtractor } from "./credits-extractor";
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
      // Get comprehensive collaboration data (MusicBrainz + Wikipedia + Known Collaborators)
      console.log(`🎯 [DEBUG] Querying comprehensive credits for "${artistName}"...`);
      const comprehensiveCollaborators = await creditsExtractor.getComprehensiveCollaborators(artistName);
      console.log(`✅ [DEBUG] Comprehensive credits response:`, {
        totalCollaborators: comprehensiveCollaborators.length,
        producers: comprehensiveCollaborators.filter(c => c.type === 'producer').length,
        songwriters: comprehensiveCollaborators.filter(c => c.type === 'songwriter').length,
        artists: comprehensiveCollaborators.filter(c => c.type === 'artist').length,
        collaboratorList: comprehensiveCollaborators.map(c => `${c.name} (${c.type}, ${c.source})`)
      });
      
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

      // Create main artist node
      const mainArtistNode: NetworkNode = {
        id: artistName,
        name: artistName,
        type: 'artist',
        size: 20,
        imageUrl: mainArtistImage,
        spotifyId: mainArtistSpotifyId,
      };
      nodes.push(mainArtistNode);

      // Add collaborators from comprehensive credits extraction
      console.log(`🎨 [DEBUG] Processing ${comprehensiveCollaborators.length} comprehensive collaborators...`);
      for (const collaborator of comprehensiveCollaborators) {
        console.log(`👤 [DEBUG] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type}, source: ${collaborator.source})`);
        
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

        // Get second-degree collaborations for producers and songwriters
        let secondDegreeCollaborators: any[] = [];
        let topCollaborators: string[] = [];
        
        if (collaborator.type === 'producer' || collaborator.type === 'songwriter') {
          console.log(`🌿 [DEBUG] Fetching second-degree collaborations for ${collaborator.type}: "${collaborator.name}"`);
          try {
            const secondDegreeCredits = await creditsExtractor.getComprehensiveCollaborators(collaborator.name);
            // Limit to top 3-5 collaborators to avoid overcrowding
            secondDegreeCollaborators = secondDegreeCredits.slice(0, 5);
            topCollaborators = secondDegreeCredits.slice(0, 8).map(c => c.name);
            console.log(`📊 [DEBUG] Found ${secondDegreeCollaborators.length} second-degree collaborators for "${collaborator.name}"`);
          } catch (error) {
            console.log(`⚠️ [DEBUG] Could not fetch second-degree collaborations for "${collaborator.name}": ${error}`);
          }
        }

        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 15,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
          topCollaborators: topCollaborators.length > 0 ? topCollaborators : undefined,
        };
        nodes.push(collaboratorNode);
        console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from ${collaborator.source} source`);

        links.push({
          source: artistName,
          target: collaborator.name,
        });
        console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}"`);

        // Add second-degree nodes and links for producers/songwriters
        for (const secondDegreeCollab of secondDegreeCollaborators) {
          // Skip if already exists to avoid duplicates
          if (nodes.find(n => n.id === secondDegreeCollab.name)) {
            console.log(`⏭️ [DEBUG] Skipping duplicate second-degree node: "${secondDegreeCollab.name}"`);
            continue;
          }

          const secondDegreeNode: NetworkNode = {
            id: secondDegreeCollab.name,
            name: secondDegreeCollab.name,
            type: secondDegreeCollab.type as 'artist' | 'producer' | 'songwriter',
            size: 12, // Smaller size for second-degree connections
            imageUrl: null,
            spotifyId: null,
          };
          nodes.push(secondDegreeNode);
          console.log(`🌿 [DEBUG] Added second-degree node: "${secondDegreeCollab.name}" (${secondDegreeCollab.type}) connected to "${collaborator.name}"`);

          links.push({
            source: collaborator.name,
            target: secondDegreeCollab.name,
          });
          console.log(`🔗 [DEBUG] Created second-degree link: "${collaborator.name}" ↔ "${secondDegreeCollab.name}"`);
        }
      }

      // Comprehensive collaborators already include all sources, so no additional fallback needed
      if (comprehensiveCollaborators.length === 0) {
        console.log(`🔍 [DEBUG] No comprehensive collaborations found for "${artistName}", creating artist-only network...`);
        
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

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type,
                size: 15,
                imageUrl: collaboratorImage,
                spotifyId: collaboratorSpotifyId,
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
        
        // If both MusicBrainz and Wikipedia fail, return only the main artist
        console.log(`🚨 [DEBUG] No real collaboration data found for "${artistName}" from either MusicBrainz or Wikipedia`);
        console.log(`👤 [DEBUG] Returning only the main artist node without any collaborators`);
        return { nodes, links };
      } else {
        console.log(`✅ [DEBUG] Successfully created comprehensive collaboration network: ${comprehensiveCollaborators.length} collaborators for "${artistName}"`);
      }

      return { nodes, links };
    } catch (error) {
      console.error('Error generating real collaboration network:', error);
      // Return just the main artist if everything fails
      return { nodes, links };
    }
  }

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
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