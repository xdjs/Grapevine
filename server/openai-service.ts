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
    console.log(
      `🚫 [DEBUG] OpenAI collaboration generation disabled for data integrity - skipping "${artistName}"`,
    );
    
    // Return empty result to force fallback to authentic data sources only
    return { artists: [] };
  }
}

export const openAIService = new OpenAIService();
