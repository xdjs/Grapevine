import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get network data for an artist
  app.get("/api/network/:artistName", async (req, res) => {
    try {
      const artistName = req.params.artistName;
      
      // Check if data is cached first
      let isCached = false;
      if ('getArtistByName' in storage) {
        const cachedArtist = await storage.getArtistByName(artistName);
        if (cachedArtist && 'webmapdata' in cachedArtist && cachedArtist.webmapdata) {
          isCached = true;
        }
      }
      
      const networkData = await storage.getNetworkData(artistName);
      
      // Include cache status in response
      res.json({
        ...networkData,
        cached: isCached
      });
    } catch (error) {
      console.error("Error fetching network data:", error);
      
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

  // Get configuration including MusicNerd base URL
  app.get("/api/config", async (req, res) => {
    try {
      // Use production URL from environment variable
      const musicNerdBaseUrl = process.env.MUSIC_BASE_URL || process.env.MUSICNERD_BASE_URL;
      
      if (!musicNerdBaseUrl) {
        console.error("🔧 [CRITICAL] MUSIC_BASE_URL environment variable is not set");
        res.status(500).json({ message: "MusicNerd base URL not configured" });
        return;
      }
      
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
