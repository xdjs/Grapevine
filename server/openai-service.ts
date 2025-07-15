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
      const prompt = `If ${artistName} is a real artist with known music industry collaborations, provide a comprehensive list of music industry professionals who have collaborated with them. Include people who work as producers, songwriters, or both.

IMPORTANT: If ${artistName} is not a well-known artist or you have no authentic collaboration data for them, return an empty collaborators array. Do NOT create fake or placeholder collaborators.

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
- Only include real, verified music industry professionals who have actually worked with ${artistName}
- If you don't have authentic data, return: {"collaborators": []}
- For each real person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Include their top 3 real collaborating artists
- Never use generic names like "John Doe", "Producer X", or placeholder data
- Maximum 10 real collaborators if they exist`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music industry database expert. Provide accurate information about real producer and songwriter collaborations. Only include verified, authentic collaborations from the music industry."
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