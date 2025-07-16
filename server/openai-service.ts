import 'dotenv/config';
import OpenAI from "openai";

export interface OpenAICollaborator {
  name: string;
  type: 'producer' | 'songwriter';
  topCollaborators: string[];
}

export interface OpenAICollaborationResult {
  artists: OpenAICollaborator[];
}

class OpenAIService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      console.log('🤖 [DEBUG] OpenAI service initialized with API key');
    } else {
      console.log('⚠️ [DEBUG] OpenAI API key not found in environment variables');
    }
  }

  isServiceAvailable(): boolean {
    return this.openai !== null;
  }

  async getCollaborationDetails(artist1Name: string, artist2Name: string): Promise<{
    songs: string[];
    albums: string[];
    collaborationType: string;
    details: string[];
  }> {
    if (!this.openai) {
      console.log('🤖 [DEBUG] OpenAI not configured, skipping collaboration details');
      return { songs: [], albums: [], collaborationType: 'unknown', details: [] };
    }

    try {
      console.log(`🤖 [DEBUG] Fetching collaboration details from OpenAI for "${artist1Name}" and "${artist2Name}"`);

      const prompt = `What did ${artist1Name} and ${artist2Name} collaborate on? Cite the exact song or project/album, and how they helped work on it.

Search comprehensively for collaborations including:
- Major label releases and independent/underground projects  
- Singles, albums, EPs, mixtapes, and compilation appearances
- Producer-songwriter relationships across all career phases
- Cross-genre collaborations and experimental projects
- Earlier career work before mainstream success
- Regional/local music scene collaborations
- Remix work, features, and uncredited contributions

Return a JSON object with the following structure:
{
  "songs": ["Song Title 1", "Song Title 2"],
  "albums": ["Album Title 1", "Album Title 2"],
  "collaborationType": "production|songwriting|performance|remix|unknown",
  "details": ["Brief description of collaboration 1", "Brief description of collaboration 2"]
}

Be specific about:
- Exact song titles they worked on together
- Specific albums or projects (include independent releases)
- How each person contributed to the collaboration
- What role each played (producer, songwriter, featured artist, engineer, etc.)

Include ALL authentic collaborations with specific song/album names when available. For smaller, independent, or emerging artists, include any known professional working relationships, studio sessions, or creative partnerships, even if less documented in mainstream sources. If no collaborations exist, return empty arrays and "unknown" for collaborationType.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a comprehensive music industry database expert with knowledge of mainstream, independent, and underground music scenes. Provide accurate, specific information about real musical collaborations between artists of all sizes and career stages. Include collaborations from major labels, independent labels, self-releases, and regional music scenes. Only include verified collaborations with actual song/album titles."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"songs": [], "albums": [], "collaborationType": "unknown", "details": []}');
      
      console.log(`✅ [DEBUG] OpenAI collaboration details:`, {
        songs: result.songs?.length || 0,
        albums: result.albums?.length || 0,
        collaborationType: result.collaborationType || 'unknown'
      });

      return {
        songs: result.songs || [],
        albums: result.albums || [],
        collaborationType: result.collaborationType || 'unknown',
        details: result.details || []
      };

    } catch (error) {
      console.error(`❌ [DEBUG] OpenAI collaboration details error:`, error);
      return { songs: [], albums: [], collaborationType: 'unknown', details: [] };
    }
  }

  async getArtistCollaborations(artistName: string): Promise<OpenAICollaborationResult> {
    if (!this.isConfigured || !this.openai) {
      throw new Error('OpenAI service is not configured');
    }

    console.log(`🤖 [DEBUG] Querying OpenAI for collaborations with "${artistName}"`);

    try {
      const prompt = `Provide a comprehensive list of music industry professionals who have collaborated with ${artistName}. Include people who work as producers, songwriters, or both.

Search across ALL career phases and music contexts:
- Major label and independent releases
- Early career/developmental work before mainstream success
- Regional and local music scene collaborations  
- Cross-genre experiments and side projects
- Producer-songwriter relationships in various capacities
- Studio musicians and session work
- Remix collaborations and alternative versions
- Live performance collaborators
- Self-released or underground projects

IMPORTANT: Include both well-established industry figures AND smaller/independent collaborators who have worked with ${artistName}. Do NOT limit results to only mainstream collaborators.

If ${artistName} has limited mainstream recognition but has authentic music industry work, still provide any verified collaborators from their actual musical output.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- Include real, verified music industry professionals who have actually worked with ${artistName}
- For smaller/independent artists, include collaborators even if documentation is limited
- If truly no authentic data exists, return: {"collaborators": []}
- For each real person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Include their top 3 real collaborating artists (can include both mainstream and independent artists)
- Never use generic names like "John Doe", "Producer X", or placeholder data
- Maximum 15 real collaborators if they exist
- Prioritize quality and authenticity over quantity`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a comprehensive music industry database expert with extensive knowledge of mainstream, independent, underground, and regional music scenes worldwide. Provide accurate information about real producer and songwriter collaborations across all levels of the music industry. Include verified, authentic collaborations from major labels, independent labels, self-releases, and local music scenes. Focus on real working relationships regardless of artist size or mainstream recognition."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for more factual responses
      });

      const result = JSON.parse(response.choices[0].message.content || '{"collaborators": []}');
      
      // Transform the response to our expected format
      const collaborators: OpenAICollaborator[] = [];
      
      if (result.collaborators) {
        for (const collaborator of result.collaborators) {
          // For each person, create entries for each of their roles
          const roles = collaborator.roles || ['producer']; // Default to producer if no roles specified
          
          for (const role of roles) {
            if (role === 'producer' || role === 'songwriter') {
              collaborators.push({
                name: collaborator.name,
                type: role as 'producer' | 'songwriter',
                topCollaborators: collaborator.topCollaborators || []
              });
            }
          }
        }
      }

      console.log(`✅ [DEBUG] OpenAI returned ${collaborators.length} collaborators for "${artistName}"`);
      console.log(`🤖 [DEBUG] Producers: ${collaborators.filter(c => c.type === 'producer').length}, Songwriters: ${collaborators.filter(c => c.type === 'songwriter').length}`);

      return { artists: collaborators };

    } catch (error) {
      console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();