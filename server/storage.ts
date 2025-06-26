import { artists, collaborations, type Artist, type InsertArtist, type Collaboration, type InsertCollaboration, type NetworkData, type NetworkNode, type NetworkLink } from "@shared/schema";

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
    const artist: Artist = { ...insertArtist, id };
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

  async getNetworkData(artistName: string): Promise<NetworkData | null> {
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) return null;

    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    const nodeMap = new Map<string, NetworkNode>();

    // Add main artist node
    const mainArtistNode: NetworkNode = {
      id: mainArtist.name,
      name: mainArtist.name,
      type: 'artist',
      size: 20,
    };
    nodes.push(mainArtistNode);
    nodeMap.set(mainArtist.name, mainArtistNode);

    // Get collaborations for the main artist
    const collaborations = await this.getCollaborationsByArtist(mainArtist.id);
    
    for (const collaboration of collaborations) {
      const collaboratorId = collaboration.fromArtistId === mainArtist.id 
        ? collaboration.toArtistId 
        : collaboration.fromArtistId;
      
      const collaborator = await this.getArtist(collaboratorId);
      if (!collaborator) continue;

      // Add collaborator node
      if (!nodeMap.has(collaborator.name)) {
        const collaboratorNode: NetworkNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          size: collaborator.type === 'artist' ? 12 : 15,
        };
        nodes.push(collaboratorNode);
        nodeMap.set(collaborator.name, collaboratorNode);
      }

      // Add link between main artist and collaborator
      links.push({
        source: mainArtist.name,
        target: collaborator.name,
      });

      // Get collaborator's other collaborations to show their top 3
      const collaboratorCollaborations = await this.getCollaborationsByArtist(collaborator.id);
      const topCollaborations: string[] = [];
      
      for (const collab of collaboratorCollaborations.slice(0, 3)) {
        const otherId = collab.fromArtistId === collaborator.id ? collab.toArtistId : collab.fromArtistId;
        const other = await this.getArtist(otherId);
        if (other && other.name !== mainArtist.name) {
          topCollaborations.push(other.name);
          
          // Add other artist as node if not already added
          if (!nodeMap.has(other.name)) {
            const otherNode: NetworkNode = {
              id: other.name,
              name: other.name,
              type: other.type as 'artist' | 'producer' | 'songwriter',
              size: 10,
            };
            nodes.push(otherNode);
            nodeMap.set(other.name, otherNode);
          }

          // Add link between collaborator and other artist
          links.push({
            source: collaborator.name,
            target: other.name,
          });
        }
      }

      // Add collaborations list to the collaborator node
      const collaboratorNode = nodeMap.get(collaborator.name);
      if (collaboratorNode) {
        collaboratorNode.collaborations = [mainArtist.name, ...topCollaborations].slice(0, 3);
      }
    }

    return { nodes, links };
  }
}

export const storage = new MemStorage();
