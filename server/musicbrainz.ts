export interface MusicBrainzArtist {
  id: string;
  name: string;
  disambiguation?: string;
  "life-span"?: {
    begin?: string;
    end?: string;
  };
  relations?: MusicBrainzRelation[];
}

export interface MusicBrainzRelation {
  type: string;
  direction: string;
  artist?: MusicBrainzArtist;
  work?: {
    id: string;
    title: string;
    type?: string;
  };
  "target-type": string;
  "target-credit"?: string;
  attributes?: string[];
}

export interface MusicBrainzSearchResult {
  artists: MusicBrainzArtist[];
  count: number;
  offset: number;
}

class MusicBrainzService {
  private baseUrl = 'https://musicbrainz.org/ws/2';
  private userAgent = 'MusicCollaborationVisualizer/1.0 (https://replit.com)';

  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    return response.json();
  }

  async searchArtist(artistName: string): Promise<MusicBrainzArtist | null> {
    try {
      console.log(`🎵 [DEBUG] MusicBrainz searching for artist: "${artistName}"`);
      const searchQuery = encodeURIComponent(artistName);
      const endpoint = `/artist?query=artist:${searchQuery}&limit=1&fmt=json`;
      const result: MusicBrainzSearchResult = await this.makeRequest(endpoint);
      
      if (result.artists && result.artists.length > 0) {
        const artist = result.artists[0];
        console.log(`✅ [DEBUG] MusicBrainz found artist: "${artist.name}" (ID: ${artist.id})`);
        if (artist.disambiguation) {
          console.log(`📝 [DEBUG] Artist disambiguation: "${artist.disambiguation}"`);
        }
        return artist;
      }
      console.log(`❌ [DEBUG] MusicBrainz found no artists matching "${artistName}"`);
      return null;
    } catch (error) {
      console.error(`⚠️ [DEBUG] MusicBrainz search error for "${artistName}":`, error);
      return null;
    }
  }

  async getArtistWithRelations(artistId: string): Promise<MusicBrainzArtist | null> {
    try {
      const endpoint = `/artist/${artistId}?inc=artist-rels+work-rels&fmt=json`;
      const artist: MusicBrainzArtist = await this.makeRequest(endpoint);
      return artist;
    } catch (error) {
      console.error('Error getting artist relations:', error);
      return null;
    }
  }

  async getArtistCollaborations(artistName: string): Promise<{
    artists: Array<{ name: string; type: string; relation: string }>;
    works: Array<{ title: string; collaborators: string[] }>;
  }> {
    try {
      // First, search for the artist
      const artist = await this.searchArtist(artistName);
      if (!artist) {
        return { artists: [], works: [] };
      }

      // Get detailed artist info with relations
      const detailedArtist = await this.getArtistWithRelations(artist.id);
      if (!detailedArtist || !detailedArtist.relations) {
        return { artists: [], works: [] };
      }

      const collaboratingArtists: Array<{ name: string; type: string; relation: string }> = [];
      const collaborativeWorks: Array<{ title: string; collaborators: string[] }> = [];

      // Process artist relations
      for (const relation of detailedArtist.relations) {
        if (relation["target-type"] === "artist" && relation.artist) {
          const relationType = this.mapRelationType(relation.type);
          if (relationType) {
            collaboratingArtists.push({
              name: relation.artist.name,
              type: relationType,
              relation: relation.type
            });
          }
        }

        if (relation["target-type"] === "work" && relation.work) {
          collaborativeWorks.push({
            title: relation.work.title,
            collaborators: [artistName] // Will be expanded with work relations
          });
        }
      }

      return {
        artists: collaboratingArtists,
        works: collaborativeWorks
      };
    } catch (error) {
      console.error('Error getting collaborations:', error);
      return { artists: [], works: [] };
    }
  }

  private mapRelationType(musicBrainzType: string): string | null {
    const typeMap: { [key: string]: string } = {
      'member': 'artist',
      'member of band': 'artist',
      'collaboration': 'artist',
      'supporting musician': 'artist',
      'vocalist': 'artist',
      'performance': 'artist',
      'producer': 'producer',
      'engineer': 'producer',
      'mix': 'producer',
      'mastering': 'producer',
      'composer': 'songwriter',
      'lyricist': 'songwriter',
      'writer': 'songwriter',
      'arranger': 'songwriter',
    };

    return typeMap[musicBrainzType.toLowerCase()] || null;
  }

  // Rate limiting helper
  private async rateLimitDelay(): Promise<void> {
    // MusicBrainz allows 1 request per second
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export const musicBrainzService = new MusicBrainzService();