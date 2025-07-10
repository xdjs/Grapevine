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
      const prompt = `Generate a list of music industry professionals who have collaborated with ${artistName}. For each person, specify their PRIMARY role in relation to ${artistName} specifically.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "role": "producer",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "role": "songwriter",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Important guidelines:
- Include up to 10 music industry professionals who have actually worked with ${artistName}
- For each person, specify their MAIN role when working with ${artistName}: "producer", "songwriter", or "artist"
- If Jack Antonoff primarily produced for ${artistName}, list him as "producer" only (not both producer and songwriter)
- Include their top 3 collaborating artists for each person
- Focus on real, verified collaborations from the music industry`;

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
          // Each person now has a single primary role
          const role = collaborator.role || 'producer'; // Default to producer if no role specified
          
          if (role === 'producer' || role === 'songwriter') {
            collaborators.push({
              name: collaborator.name,
              type: role as 'producer' | 'songwriter',
              topCollaborators: collaborator.topCollaborators || []
            });
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