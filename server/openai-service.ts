import OpenAI from "openai";

export interface OpenAICollaborator {
  name: string;
  type: "producer" | "songwriter";
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
      console.log("🤖 [DEBUG] OpenAI service initialized with API key");
    } else {
      console.log(
        "⚠️ [DEBUG] OpenAI API key not found in environment variables",
      );
    }
  }

  isServiceAvailable(): boolean {
    return this.isConfigured;
  }

  async getArtistCollaborations(
    artistName: string,
  ): Promise<OpenAICollaborationResult> {
    if (!this.isConfigured || !this.openai) {
      throw new Error("OpenAI service is not configured");
    }

    console.log(
      `🤖 [DEBUG] Querying OpenAI for collaborations with "${artistName}"`,
    );

    try {
      const prompt = `Generate a list of producers and songwriters who have collaborated with artist ${artistName}. For each producer and songwriter, include their top 3 collaborating artists (biggest artists they have worked with).

Please respond with JSON in this exact format:
{
  "producers": [
    {
      "name": "Producer Name",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ],
  "songwriters": [
    {
      "name": "Songwriter Name", 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Focus on real, verified collaborations from the music industry. Include up to 5 producers and 5 songwriters who have actually worked with ${artistName}. Each producer and songwriter should have exactly 3 top collaborating artists listed. If there are no known collaborations, return empty arrays for producers and songwriters. Do not make up any names or collaborations.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a music industry database expert. Provide accurate information about real producer and songwriter collaborations. Only include verified, authentic collaborations from the music industry. If there are no known collaborations, do not make any information up.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for more factual responses
      });

      const result = JSON.parse(
        response.choices[0].message.content ||
          '{"producers": [], "songwriters": []}',
      );

      // Transform the response to our expected format
      const collaborators: OpenAICollaborator[] = [];

      if (result.producers) {
        for (const producer of result.producers) {
          collaborators.push({
            name: producer.name,
            type: "producer",
            topCollaborators: producer.topCollaborators || [],
          });
        }
      }

      if (result.songwriters) {
        for (const songwriter of result.songwriters) {
          collaborators.push({
            name: songwriter.name,
            type: "songwriter",
            topCollaborators: songwriter.topCollaborators || [],
          });
        }
      }

      console.log(
        `✅ [DEBUG] OpenAI returned ${collaborators.length} collaborators for "${artistName}"`,
      );
      console.log(
        `🤖 [DEBUG] Producers: ${collaborators.filter((c) => c.type === "producer").length}, Songwriters: ${collaborators.filter((c) => c.type === "songwriter").length}`,
      );

      return { artists: collaborators };
    } catch (error) {
      console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();
