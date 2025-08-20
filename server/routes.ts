import 'dotenv/config';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get network data for an artist by name
  app.get("/api/network/:artistName", async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      console.log(`🔍 [Server] Fetching network data for: "${artistName}"`);
      
      const networkData = await storage.getNetworkData(artistName);
      
      if (!networkData) {
        return res.status(404).json({ message: `No network data found for artist: ${artistName}` });
      }
      
      res.json(networkData);
    } catch (error) {
      console.error("Error fetching network data:", error);
      
      // Check if it's a "not found" error
      if (error instanceof Error && error.message.includes('not found in database')) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get network data for an artist by ID
  app.get("/api/network-by-id/:artistId", async (req, res) => {
    try {
      const artistId = req.params.artistId;
      console.log(`🔍 [Server] Fetching network data for artist ID: "${artistId}"`);
      
      if (storage.getNetworkDataById) {
        const networkData = await storage.getNetworkDataById(artistId);
        
        if (!networkData) {
          return res.status(404).json({ message: `No network data found for artist ID: ${artistId}` });
        }
        
        res.json(networkData);
      } else {
        return res.status(501).json({ 
          error: "Method not implemented",
          message: "Network data by ID is not supported by the current storage implementation"
        });
      }
    } catch (error) {
      console.error("Error fetching network data by ID:", error);
      
      // Check if it's a "not found" error
      if (error instanceof Error && error.message.includes('not found in database')) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search for artists by name - Returns multiple suggestions for dropdown
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      console.log(`🔍 [Server] Searching for artists: ${query}`);
      
      // Import the musicNerdService which has comprehensive search functionality
      const { musicNerdService } = await import("./musicnerd-service");
      const artistOptions = await musicNerdService.getArtistOptions(query);
      
      if (!artistOptions || artistOptions.length === 0) {
        console.log(`📭 [Server] No artists found for: ${query}`);
        return res.json([]); // Return empty array instead of 404 for dropdown
      }

      console.log(`✅ [Server] Found ${artistOptions.length} artists for: ${query}`);
      res.json(artistOptions);
    } catch (error) {
      console.error("Error searching artist:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist options for dropdown selection
  app.get("/api/artist-options/:artistName", async (req, res) => {
    try {
      const artistName = req.params.artistName;
      if (!artistName) {
        return res.status(400).json({ message: "Artist name is required" });
      }
      
      const { musicNerdService } = await import("./musicnerd-service");
      const options = await musicNerdService.getArtistOptions(artistName);
      
      res.json({ options: options || [] });
    } catch (error) {
      console.error("Artist options error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Clear cached data for an artist (temporary debugging endpoint)
  app.delete("/api/clear-cache/:artistName", async (req, res) => {
    try {
      const artistName = req.params.artistName;
      console.log(`🗑️ [DEBUG] Clearing cache for "${artistName}"`);
      
      if ('getArtistByName' in storage && 'cacheNetworkData' in storage) {
        const artist = await storage.getArtistByName(artistName);
        if (artist) {
          // Clear the webmapdata field
          if ('webmapdata' in artist) {
            const { DatabaseStorage } = await import("./database-storage");
            if (storage instanceof DatabaseStorage) {
              // Use direct database update
              const connectionString = process.env.CONNECTION_STRING;
              if (connectionString) {
                const { Client } = await import('pg');
                const client = new Client({ connectionString });
                await client.connect();
                await client.query('UPDATE artists SET webmapdata = NULL WHERE LOWER(name) = LOWER($1)', [artistName]);
                await client.end();
                console.log(`✅ [DEBUG] Cache cleared for "${artistName}"`);
                res.json({ message: `Cache cleared for ${artistName}` });
                return;
              }
            }
          }
        }
      }
      
      res.json({ message: `No cache found for ${artistName}` });
    } catch (error) {
      console.error("Clear cache error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get grape content for popup
  app.get("/api/grape-content/:sourceArtist/:targetArtist", async (req, res) => {
    try {
      const sourceArtist = decodeURIComponent(req.params.sourceArtist);
      const targetArtist = decodeURIComponent(req.params.targetArtist);
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [Server] Grape content request received for collaboration: ${sourceArtist} → ${targetArtist}`);
      
      if (!sourceArtist || !targetArtist) {
        console.log(`🕐 [${new Date().toISOString()}] ❌ [Server] Artist names are empty, returning 400 error`);
        return res.status(400).json({ error: 'Both source and target artist names are required' });
      }

      console.log(`🕐 [${new Date().toISOString()}] 🍇 [Server] Starting content generation for collaboration: ${sourceArtist} → ${targetArtist}`);

      // Create a prompt for OpenAI to generate grape popup content for the specific collaboration
      const prompt = `Tell me a fun fact about the most recent project that ${sourceArtist} and ${targetArtist} worked on together. Keep your answer short but informative. Do not include "Fun Fact:" or mention fun facts in your answer; only show the information. Do not ask for any extra questions or clarification.`;

      console.log(`🕐 [${new Date().toISOString()}] 🍇 [Server] Making OpenAI API call for collaboration: ${sourceArtist} → ${targetArtist}`);
      
      const { openAIService } = await import("./openai-service");
      
      if (!openAIService.isServiceAvailable()) {
        throw new Error('OpenAI service is not configured');
      }
      
      // Create a simple OpenAI instance for this specific use case
      const OpenAI = (await import("openai")).default;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }
      
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a music expert who provides concise, factual information about recent music collaborations. Keep responses under 100 words and focus on specific, interesting details about recent projects."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });
      
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [Server] OpenAI API call completed for collaboration: ${sourceArtist} → ${targetArtist}`);

      const content = completion.choices[0]?.message?.content?.trim();

      if (!content) {
        console.log(`🕐 [${new Date().toISOString()}] ❌ [Server] No content generated from OpenAI for collaboration: ${sourceArtist} → ${targetArtist}`);
        throw new Error('No content generated from OpenAI');
      }

      console.log(`🕐 [${new Date().toISOString()}] ✅ [Server] Generated content for ${sourceArtist} → ${targetArtist}:`, content);

      console.log(`🕐 [${new Date().toISOString()}] 🍇 [Server] Returning successful response for collaboration: ${sourceArtist} → ${targetArtist}`);
      res.json({
        content,
        sourceArtist,
        targetArtist,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`🕐 [${new Date().toISOString()}] ❌ [Server] Error generating content for collaboration ${req.params.sourceArtist} → ${req.params.targetArtist}:`, error);
      
      res.status(500).json({ 
        error: 'Failed to generate grape content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get configuration including MusicNerd base URL
  app.get("/api/config", async (req, res) => {
    try {
      // Use production URL with fallback to environment variable
      const musicNerdBaseUrl = process.env.MUSICNERD_BASE_URL_OVERRIDE || 'https://www.musicnerd.xyz';
      
      console.log(`🔧 [DEBUG] Config endpoint called, returning musicNerdBaseUrl: ${musicNerdBaseUrl}`);
      
      res.json({ 
        musicNerdBaseUrl 
      });
    } catch (error) {
      console.error("Config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
