import { eq, and } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './supabase';
import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "@shared/schema";
import { spotifyService } from "./spotify";
import { musicBrainzService } from "./musicbrainz";
import { wikipediaService } from "./wikipedia";
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

    try {
      // Get real collaboration data from MusicBrainz
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      
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

      // Add collaborating artists from MusicBrainz
      for (const collaborator of collaborationData.artists) {
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

        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 15,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
        };
        nodes.push(collaboratorNode);

        links.push({
          source: artistName,
          target: collaborator.name,
        });
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

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type,
                size: 15,
                imageUrl: collaboratorImage,
                spotifyId: collaboratorSpotifyId,
              };
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
        
        // If both MusicBrainz and Wikipedia fail, return just the artist
        console.log(`No real collaboration data found for ${artistName}`);
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