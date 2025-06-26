import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get network data for an artist
  app.get("/api/network/:artistName", async (req, res) => {
    try {
      const artistName = req.params.artistName;
      const networkData = await storage.getNetworkData(artistName);
      
      // Since we generate dynamic networks for unknown artists, this should never be null
      res.json(networkData);
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

  const httpServer = createServer(app);
  return httpServer;
}
