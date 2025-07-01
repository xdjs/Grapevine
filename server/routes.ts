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
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search for artists by name
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      const artist = await storage.getArtistByName(query);
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      res.json(artist);
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

  const httpServer = createServer(app);
  return httpServer;
}
