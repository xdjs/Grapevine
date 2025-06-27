export interface WikipediaSearchResult {
  query: {
    search: Array<{
      title: string;
      snippet: string;
      pageid: number;
    }>;
  };
}

export interface WikipediaPageResult {
  query: {
    pages: {
      [key: string]: {
        title: string;
        extract: string;
        pageid: number;
      };
    };
  };
}

export interface WikipediaCollaborator {
  name: string;
  type: 'artist' | 'producer' | 'songwriter';
  context: string;
}

class WikipediaService {
  private baseUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
  private apiUrl = 'https://en.wikipedia.org/w/api.php';

  private async makeRequest(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MusicCollaborationVisualizer/1.0 (https://replit.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    return response.json();
  }

  async searchArtist(artistName: string): Promise<string | null> {
    try {
      const searchQuery = encodeURIComponent(`${artistName} musician singer`);
      const url = `${this.apiUrl}?action=query&list=search&srsearch=${searchQuery}&format=json&origin=*&srlimit=1`;
      
      const result: WikipediaSearchResult = await this.makeRequest(url);
      
      if (result.query.search && result.query.search.length > 0) {
        return result.query.search[0].title;
      }
      return null;
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      return null;
    }
  }

  async getArtistPage(pageTitle: string): Promise<string | null> {
    try {
      const encodedTitle = encodeURIComponent(pageTitle);
      const url = `${this.apiUrl}?action=query&format=json&origin=*&prop=extracts&exintro&explaintext&titles=${encodedTitle}`;
      
      const result: WikipediaPageResult = await this.makeRequest(url);
      
      if (result.query.pages) {
        const pages = Object.values(result.query.pages);
        if (pages.length > 0 && pages[0].extract) {
          return pages[0].extract;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching Wikipedia page:', error);
      return null;
    }
  }

  extractCollaborators(artistName: string, wikipediaText: string): WikipediaCollaborator[] {
    const collaborators: WikipediaCollaborator[] = [];
    
    console.log(`🔍 [DEBUG] Extracting collaborators from Wikipedia text for "${artistName}"`);
    
    // Common patterns for finding collaborators in Wikipedia text
    const patterns = [
      // Producer patterns
      /produced by ([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /producer[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /working with producer[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      
      // Songwriter patterns
      /co-written (?:with|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /written (?:with|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /songwriter[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      
      // Collaboration patterns
      /collaborated with\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /featuring\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /duet with\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
    ];
    
    console.log(`📋 [DEBUG] Searching text with ${patterns.length} regex patterns`);
    

    const typePatterns = {
      producer: [/produc/i, /mix/i, /engineer/i],
      songwriter: [/writ/i, /compos/i, /lyric/i],
      artist: [/collaborat/i, /featuring/i, /duet/i, /featuring/i]
    };

    patterns.forEach((pattern, index) => {
      let match;
      let patternMatches = 0;
      while ((match = pattern.exec(wikipediaText)) !== null) {
        patternMatches++;
        const name = match[1].trim();
        console.log(`🎯 [DEBUG] Pattern ${index} matched: "${match[0]}" → extracted name: "${name}"`);
        
        // Skip if it's the same artist or too short/long
        if (name.toLowerCase() === artistName.toLowerCase() || 
            name.length < 3 || 
            name.length > 30 ||
            /\d/.test(name)) {
          console.log(`❌ [DEBUG] Skipping "${name}" - invalid (same artist, too short/long, or contains numbers)`);
          continue;
        }

        // Determine type based on context
        let type: 'artist' | 'producer' | 'songwriter' = 'artist';
        const context = match[0].toLowerCase();
        
        if (typePatterns.producer.some(p => p.test(context))) {
          type = 'producer';
        } else if (typePatterns.songwriter.some(p => p.test(context))) {
          type = 'songwriter';
        }
        console.log(`🎭 [DEBUG] Categorized "${name}" as ${type} based on context: "${context}"`);

        // Check if already exists
        const existing = collaborators.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (!existing) {
          collaborators.push({
            name,
            type,
            context: match[0]
          });
          console.log(`✅ [DEBUG] Added collaborator: "${name}" (${type})`);
        } else {
          console.log(`⚠️ [DEBUG] Duplicate collaborator "${name}" skipped`);
        }
      }
      if (patternMatches === 0) {
        console.log(`❌ [DEBUG] Pattern ${index} found no matches in Wikipedia text`);
      } else {
        console.log(`✅ [DEBUG] Pattern ${index} found ${patternMatches} matches`);
      }
    });

    // Filter out common false positives
    const blacklist = [
      'the', 'and', 'with', 'by', 'for', 'in', 'on', 'at', 'to', 'from',
      'album', 'song', 'track', 'single', 'ep', 'record', 'label', 'studio',
      'music', 'band', 'group', 'artist', 'singer', 'musician'
    ];

    return collaborators.filter(c => 
      !blacklist.includes(c.name.toLowerCase()) &&
      !c.name.includes('(') && // Filter out things like "Album Name (2020)"
      /^[A-Z]/.test(c.name) // Must start with capital letter
    ).slice(0, 6); // Limit to 6 collaborators max
  }

  async getArtistCollaborations(artistName: string): Promise<WikipediaCollaborator[]> {
    try {
      console.log(`📖 [DEBUG] Wikipedia searching for artist: "${artistName}"`);
      // Search for the artist's Wikipedia page
      const pageTitle = await this.searchArtist(artistName);
      if (!pageTitle) {
        console.log(`❌ [DEBUG] Wikipedia found no page for "${artistName}"`);
        return [];
      }

      console.log(`✅ [DEBUG] Wikipedia found page: "${pageTitle}"`);
      // Get the page content
      const pageContent = await this.getArtistPage(pageTitle);
      if (!pageContent) {
        console.log(`❌ [DEBUG] Wikipedia could not fetch content for page "${pageTitle}"`);
        return [];
      }

      console.log(`📄 [DEBUG] Wikipedia page content length: ${pageContent.length} characters`);
      console.log(`📝 [DEBUG] Wikipedia content preview: "${pageContent.substring(0, 200)}..."`);
      
      // Extract collaborators from the content
      const collaborators = this.extractCollaborators(artistName, pageContent);
      console.log(`🔍 [DEBUG] Wikipedia extracted ${collaborators.length} collaborators from page`);
      if (collaborators.length > 0) {
        console.log(`👥 [DEBUG] Wikipedia collaborators found:`, collaborators.map(c => `${c.name} (${c.type})`));
      }
      
      return collaborators;
    } catch (error) {
      console.error(`Error getting Wikipedia collaborations for ${artistName}:`, error);
      return [];
    }
  }
}

export const wikipediaService = new WikipediaService();