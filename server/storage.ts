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
    // Create artists
    const taylorSwift = await this.createArtist({ name: "Taylor Swift", type: "artist" });
    const jackAntonoff = await this.createArtist({ name: "Jack Antonoff", type: "producer" });
    const aaronDessner = await this.createArtist({ name: "Aaron Dessner", type: "producer" });
    const maxMartin = await this.createArtist({ name: "Max Martin", type: "producer" });
    const williamBowery = await this.createArtist({ name: "William Bowery", type: "songwriter" });
    const lorde = await this.createArtist({ name: "Lorde", type: "artist" });
    const lanaDelRey = await this.createArtist({ name: "Lana Del Rey", type: "artist" });
    const bonIver = await this.createArtist({ name: "Bon Iver", type: "artist" });
    const arianaGrande = await this.createArtist({ name: "Ariana Grande", type: "artist" });
    const theWeeknd = await this.createArtist({ name: "The Weeknd", type: "artist" });
    
    const drake = await this.createArtist({ name: "Drake", type: "artist" });
    const forty = await this.createArtist({ name: "40", type: "producer" });
    const boi1da = await this.createArtist({ name: "Boi-1da", type: "producer" });
    const hitBoy = await this.createArtist({ name: "Hit-Boy", type: "producer" });
    const partyNextDoor = await this.createArtist({ name: "PartyNextDoor", type: "songwriter" });
    const future = await this.createArtist({ name: "Future", type: "artist" });
    const lilWayne = await this.createArtist({ name: "Lil Wayne", type: "artist" });
    const rihanna = await this.createArtist({ name: "Rihanna", type: "artist" });
    
    const billieEilish = await this.createArtist({ name: "Billie Eilish", type: "artist" });
    const finneas = await this.createArtist({ name: "FINNEAS", type: "producer" });
    const robKinelski = await this.createArtist({ name: "Rob Kinelski", type: "producer" });
    const ashe = await this.createArtist({ name: "Ashe", type: "artist" });
    const selenaGomez = await this.createArtist({ name: "Selena Gomez", type: "artist" });
    
    // Additional artists for testing
    const edSheeran = await this.createArtist({ name: "Ed Sheeran", type: "artist" });
    const johnnyMcDaid = await this.createArtist({ name: "Johnny McDaid", type: "songwriter" });
    const benny = await this.createArtist({ name: "Benny Blanco", type: "producer" });
    const justinBieber = await this.createArtist({ name: "Justin Bieber", type: "artist" });
    const skrillex = await this.createArtist({ name: "Skrillex", type: "producer" });
    
    // Independent artists with no common collaborators
    const laufey = await this.createArtist({ name: "Laufey", type: "artist" });
    const spencerStewart = await this.createArtist({ name: "Spencer Stewart", type: "producer" });
    const adamYassin = await this.createArtist({ name: "Adam Yaasin", type: "songwriter" });
    
    const tylerTheCreator = await this.createArtist({ name: "Tyler, The Creator", type: "artist" });
    const lomatPowers = await this.createArtist({ name: "Loma Powers", type: "producer" });
    const kaliUchis = await this.createArtist({ name: "Kali Uchis", type: "artist" });
    
    const clairo = await this.createArtist({ name: "Clairo", type: "artist" });
    const rostam = await this.createArtist({ name: "Rostam", type: "producer" });
    const jacksonFoote = await this.createArtist({ name: "Jackson Foote", type: "songwriter" });
    
    // Create collaborations for Taylor Swift
    await this.createCollaboration({ fromArtistId: taylorSwift.id, toArtistId: jackAntonoff.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: taylorSwift.id, toArtistId: aaronDessner.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: taylorSwift.id, toArtistId: maxMartin.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: taylorSwift.id, toArtistId: williamBowery.id, collaborationType: "songwriting" });
    
    await this.createCollaboration({ fromArtistId: jackAntonoff.id, toArtistId: lorde.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: jackAntonoff.id, toArtistId: lanaDelRey.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: aaronDessner.id, toArtistId: bonIver.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: maxMartin.id, toArtistId: arianaGrande.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: maxMartin.id, toArtistId: theWeeknd.id, collaborationType: "production" });
    
    // Create collaborations for Drake
    await this.createCollaboration({ fromArtistId: drake.id, toArtistId: forty.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: drake.id, toArtistId: boi1da.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: drake.id, toArtistId: hitBoy.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: drake.id, toArtistId: partyNextDoor.id, collaborationType: "songwriting" });
    
    await this.createCollaboration({ fromArtistId: forty.id, toArtistId: theWeeknd.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: partyNextDoor.id, toArtistId: rihanna.id, collaborationType: "songwriting" });
    
    // Create collaborations for Billie Eilish
    await this.createCollaboration({ fromArtistId: billieEilish.id, toArtistId: finneas.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: billieEilish.id, toArtistId: robKinelski.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: finneas.id, toArtistId: ashe.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: finneas.id, toArtistId: selenaGomez.id, collaborationType: "production" });
    
    // Create collaborations for Ed Sheeran
    await this.createCollaboration({ fromArtistId: edSheeran.id, toArtistId: johnnyMcDaid.id, collaborationType: "songwriting" });
    await this.createCollaboration({ fromArtistId: edSheeran.id, toArtistId: benny.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: benny.id, toArtistId: justinBieber.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: skrillex.id, toArtistId: justinBieber.id, collaborationType: "production" });
    
    // Cross-connections to make network more interesting
    await this.createCollaboration({ fromArtistId: benny.id, toArtistId: selenaGomez.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: johnnyMcDaid.id, toArtistId: taylorSwift.id, collaborationType: "songwriting" });
    
    // Independent artist networks (no cross-connections with main network)
    await this.createCollaboration({ fromArtistId: laufey.id, toArtistId: spencerStewart.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: laufey.id, toArtistId: adamYassin.id, collaborationType: "songwriting" });
    
    await this.createCollaboration({ fromArtistId: tylerTheCreator.id, toArtistId: lomatPowers.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: tylerTheCreator.id, toArtistId: kaliUchis.id, collaborationType: "songwriting" });
    
    await this.createCollaboration({ fromArtistId: clairo.id, toArtistId: rostam.id, collaborationType: "production" });
    await this.createCollaboration({ fromArtistId: clairo.id, toArtistId: jacksonFoote.id, collaborationType: "songwriting" });
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

      // Create main artist node
      const mainArtistNode: NetworkNode = {
        id: artistName,
        name: artistName,
        type: 'artist',
        size: 30, // Larger size for main artist
        imageUrl: mainArtistImage,
        spotifyId: mainArtistSpotifyId,
        artistId: mainArtistMusicNerdId,
      };
      nodes.push(mainArtistNode);

      // Add collaborating artists from MusicBrainz
      console.log(`🎨 [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      
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

        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 20,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
          artistId: collaboratorMusicNerdId,
          collaborations: topCollaborators.length > 0 ? topCollaborators : undefined,
        };
        console.log(`🎯 [DEBUG] Created node for "${collaborator.name}" with collaborations:`, collaboratorNode.collaborations);
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

              // Get MusicNerd artist ID for Wikipedia collaborators who are artists
              let collaboratorMusicNerdId = null;
              if (collaborator.type === 'artist') {
                try {
                  collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
                } catch (error) {
                  console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
                }
              }

              const collaboratorNode: NetworkNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type,
                size: 20,
                imageUrl: collaboratorImage,
                spotifyId: collaboratorSpotifyId,
                artistId: collaboratorMusicNerdId,
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
    // For demo artists with rich mock data, use mock network to show comprehensive producer/songwriter examples
    const demoArtists = ['Taylor Swift', 'Drake', 'Billie Eilish', 'Ed Sheeran'];
    
    if (demoArtists.includes(artistName)) {
      console.log(`🎵 [DEBUG] Using enhanced demo data for "${artistName}" to showcase producer/songwriter networks`);
      const mainArtist = await this.getArtistByName(artistName);
      if (mainArtist) {
        return this.generateEnhancedDemoNetwork(mainArtist);
      }
    }
    
    // For all other artists, use real collaboration data from MusicBrainz
    console.log(`🎵 [DEBUG] Using real collaboration data path for "${artistName}"`);
    return this.generateRealCollaborationNetwork(artistName);
  }



  private async generateEnhancedDemoNetwork(mainArtist: Artist): Promise<NetworkData> {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    const nodeMap = new Map<string, NetworkNode>();

    // Get MusicNerd artist ID for main artist 
    let mainArtistMusicNerdId = null;
    try {
      mainArtistMusicNerdId = await musicNerdService.getArtistId(mainArtist.name);
    } catch (error) {
      console.log(`Could not fetch MusicNerd ID for ${mainArtist.name}`);
    }

    // Add main artist node
    const mainArtistNode: NetworkNode = {
      id: mainArtist.name,
      name: mainArtist.name,
      type: 'artist',
      size: 30, // Larger size for main artist
      artistId: mainArtistMusicNerdId,
    };
    nodes.push(mainArtistNode);
    nodeMap.set(mainArtist.name, mainArtistNode);

    // Get collaborations for the main artist from mock data
    const collaborations = await this.getCollaborationsByArtist(mainArtist.id);
    
    for (const collaboration of collaborations) {
      const collaborator = await this.getArtist(collaboration.toArtistId);
      if (collaborator && !nodeMap.has(collaborator.name)) {
        // Get MusicNerd artist ID for collaborators who are artists
        let collaboratorMusicNerdId = null;
        if (collaborator.type === 'artist') {
          try {
            collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
          }
        }

        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: 20,
          artistId: collaboratorMusicNerdId,
        };
        nodes.push(collaboratorNode);
        nodeMap.set(collaborator.name, collaboratorNode);

        links.push({
          source: mainArtist.name,
          target: collaborator.name,
        });
      }
    }

    // Add secondary connections (collaborator-to-collaborator relationships)
    for (const collaboration of collaborations) {
      const collaborator = await this.getArtist(collaboration.toArtistId);
      if (collaborator) {
        const secondaryCollaborations = await this.getCollaborationsByArtist(collaborator.id);
        
        for (const secondaryCollab of secondaryCollaborations) {
          const other = await this.getArtist(secondaryCollab.toArtistId);
          if (other && other.name !== mainArtist.name && nodeMap.has(other.name)) {
            // Add link between collaborators if both are in the network
            const existingLink = links.find(link => 
              (link.source === collaborator.name && link.target === other.name) ||
              (link.source === other.name && link.target === collaborator.name)
            );
            
            if (!existingLink) {
              links.push({
                source: collaborator.name,
                target: other.name,
              });
            }
          } else if (other && other.name !== mainArtist.name && !nodeMap.has(other.name)) {
            // Add new collaborator node if not already in network
            let otherMusicNerdId = null;
            if (other.type === 'artist') {
              try {
                otherMusicNerdId = await musicNerdService.getArtistId(other.name);
              } catch (error) {
                console.log(`Could not fetch MusicNerd ID for ${other.name}`);
              }
            }

            const otherNode: NetworkNode = {
              id: other.name,
              name: other.name,
              type: other.type as 'artist' | 'producer' | 'songwriter',
              size: 16,
              artistId: otherMusicNerdId,
            };
            nodes.push(otherNode);
            nodeMap.set(other.name, otherNode);

            links.push({
              source: collaborator.name,
              target: other.name,
            });
          }
        }
      }
    }

    return { nodes, links };
  }

  private getOldPath(): NetworkData {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    
    // Simple fallback network for compatibility
    return { nodes, links };
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
