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
    return this.isConfigured;
  }

  async getArtistCollaborations(artistName: string): Promise<OpenAICollaborationResult> {
    if (!this.isConfigured || !this.openai) {
      throw new Error('OpenAI service is not configured');
    }

    console.log(`🤖 [DEBUG] Querying OpenAI for collaborations with "${artistName}"`);

    try {
      const prompt = `Provide a comprehensive list of music industry professionals who have collaborated with ${artistName}. Focus on producers, songwriters, and other artists who have worked with them.

For well-known/mainstream artists (chart-topping, Grammy-nominated, major label artists): Include all documented collaborations you're aware of, as these are likely well-documented and verifiable.

For lesser-known artists (independent, underground, regional): Be more selective and only include collaborations you're confident about.

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
- For mainstream artists with significant commercial success: Include all known producers, songwriters, and collaborators from album credits, interviews, and industry documentation
- For independent/underground artists: Be more selective but still include authentic collaborations from official releases
- If ${artistName} is not a real artist or has absolutely no collaboration data, return: {"collaborators": []}
- For each person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Make sure if any of these people have multiple roles (artist, producer, songwriter), it is listed in the data
- Include their top 3 real collaborating artists (can include both famous and lesser-known artists)
- Never use generic placeholder names like "John Doe", "Producer X", etc.
- Maximum 10 real collaborators if they exist
- Be confident about well-documented collaborations for commercially successful artists
- Focus on collaborations from official album/song credits, not rumors or speculation`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music industry database expert. For mainstream/well-known artists, confidently provide all documented collaborations. For lesser-known artists, be more selective but still inclusive of authentic collaborations. Prioritize accuracy while being comprehensive for well-documented artists."
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