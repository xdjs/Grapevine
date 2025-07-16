import 'dotenv/config';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { musicBrainzService } from "./musicbrainz.js";
import { openAIService } from "./openai-service.js";
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

  // Get collaboration details between two artists
  app.get("/api/collaboration/:artist1/:artist2", async (req, res) => {
    const startTime = Date.now();
    try {
      const artist1Name = decodeURIComponent(req.params.artist1);
      const artist2Name = decodeURIComponent(req.params.artist2);
      
      console.log(`🤝 [Server] ==========================================`);
      console.log(`🤝 [Server] NEW COLLABORATION REQUEST`);
      console.log(`🤝 [Server] Artist 1: "${artist1Name}"`);
      console.log(`🤝 [Server] Artist 2: "${artist2Name}"`);
      console.log(`🤝 [Server] Request URL: ${req.url}`);
      console.log(`🤝 [Server] ==========================================`);
      
      let collaborationDetails = null;
      let dataSource = 'none';
      
      // Strategy 1: Try MusicBrainz first (most reliable for documented collaborations)
      try {
        console.log(`🎵 [Server] STRATEGY 1: Trying MusicBrainz for "${artist1Name}" and "${artist2Name}"`);
        const musicBrainzStart = Date.now();
        collaborationDetails = await musicBrainzService.getCollaborationDetails(artist1Name, artist2Name);
        const musicBrainzTime = Date.now() - musicBrainzStart;
        console.log(`🎵 [Server] MusicBrainz completed in ${musicBrainzTime}ms`);
        
        if (collaborationDetails.songs.length > 0 || collaborationDetails.albums.length > 0 || 
            collaborationDetails.details.length > 0) {
          dataSource = 'musicbrainz';
          console.log(`✅ [Server] MusicBrainz SUCCESS: ${collaborationDetails.songs.length} songs, ${collaborationDetails.albums.length} albums, ${collaborationDetails.details.length} details`);
        } else {
          console.log(`⚠️ [Server] MusicBrainz returned empty results`);
        }
      } catch (musicbrainzError) {
        console.log(`❌ [Server] MusicBrainz ERROR:`, musicbrainzError);
        collaborationDetails = { songs: [], albums: [], collaborationType: 'unknown', details: [] };
      }
      
      // Strategy 2: If MusicBrainz found limited/no data, try OpenAI fallback
      if ((collaborationDetails.songs.length === 0 && collaborationDetails.albums.length === 0 && 
           collaborationDetails.details.length === 0) && openAIService.isServiceAvailable()) {
        
        console.log(`🔄 [Server] STRATEGY 2: MusicBrainz found no data, trying OpenAI fallback...`);
        
        try {
          const openAIStart = Date.now();
          const openAIDetails = await openAIService.getCollaborationDetails(artist1Name, artist2Name);
          const openAITime = Date.now() - openAIStart;
          console.log(`🤖 [Server] OpenAI completed in ${openAITime}ms`);
          
          if (openAIDetails.songs.length > 0 || openAIDetails.albums.length > 0 || 
              openAIDetails.details.length > 0) {
            collaborationDetails = openAIDetails;
            dataSource = 'openai';
            console.log(`✅ [Server] OpenAI SUCCESS: ${openAIDetails.songs.length} songs, ${openAIDetails.albums.length} albums, ${openAIDetails.details.length} details`);
          } else {
            console.log(`⚠️ [Server] OpenAI returned empty results`);
          }
        } catch (openaiError) {
          console.log(`❌ [Server] OpenAI ERROR:`, openaiError);
        }
      } else if (!openAIService.isServiceAvailable()) {
        console.log(`⚠️ [Server] OpenAI service not available, skipping strategy 2`);
      } else {
        console.log(`✅ [Server] MusicBrainz found data, skipping OpenAI`);
      }
      
      // Strategy 3: Try name variations for smaller artists if still no data
      if ((collaborationDetails.songs.length === 0 && collaborationDetails.albums.length === 0 && 
           collaborationDetails.details.length === 0)) {
        
        console.log(`🔍 [Server] STRATEGY 3: Trying name variations for smaller artists...`);
        
        // Generate name variations for both artists
        const generateVariations = (name: string): string[] => {
          const variations = [name];
          const lower = name.toLowerCase();
          
          // Remove common prefixes
          if (lower.startsWith('the ')) variations.push(name.substring(4));
          if (lower.startsWith('dj ')) variations.push(name.substring(3));
          if (lower.startsWith('lil ')) variations.push(name.substring(4));
          
          // Handle ampersand variations
          if (name.includes('&')) {
            variations.push(name.replace('&', 'and'));
          }
          if (name.includes(' and ')) {
            variations.push(name.replace(' and ', ' & '));
          }
          
          return variations;
        };
        
        const artist1Variations = generateVariations(artist1Name);
        const artist2Variations = generateVariations(artist2Name);
        
        console.log(`🔍 [Server] Artist 1 variations:`, artist1Variations);
        console.log(`🔍 [Server] Artist 2 variations:`, artist2Variations);
        
        // Try combinations of variations
        let foundWithVariations = false;
        for (const var1 of artist1Variations.slice(0, 2)) {
          for (const var2 of artist2Variations.slice(0, 2)) {
            if (var1 === artist1Name && var2 === artist2Name) continue; // Skip original combination
            
            try {
              console.log(`🔍 [Server] Trying variation: "${var1}" and "${var2}"`);
              
              // Try MusicBrainz with variations
              const variationDetails = await musicBrainzService.getCollaborationDetails(var1, var2);
              if (variationDetails.songs.length > 0 || variationDetails.albums.length > 0 || 
                  variationDetails.details.length > 0) {
                collaborationDetails = variationDetails;
                dataSource = 'musicbrainz-variation';
                console.log(`✅ [Server] Found data with MusicBrainz variations: ${variationDetails.songs.length} songs, ${variationDetails.albums.length} albums`);
                foundWithVariations = true;
                break;
              }
              
              // Try OpenAI with variations if available
              if (openAIService.isServiceAvailable()) {
                const openAIVariationDetails = await openAIService.getCollaborationDetails(var1, var2);
                if (openAIVariationDetails.songs.length > 0 || openAIVariationDetails.albums.length > 0 || 
                    openAIVariationDetails.details.length > 0) {
                  collaborationDetails = openAIVariationDetails;
                  dataSource = 'openai-variation';
                  console.log(`✅ [Server] Found data with OpenAI variations: ${openAIVariationDetails.songs.length} songs, ${openAIVariationDetails.albums.length} albums`);
                  foundWithVariations = true;
                  break;
                }
              }
            } catch (variationError) {
              console.log(`⚠️ [Server] Variation "${var1}" and "${var2}" failed:`, variationError);
            }
          }
          if (foundWithVariations) break;
        }
        
        if (!foundWithVariations) {
          console.log(`⚠️ [Server] No data found with any variations`);
        }
      }
      
      // Final result processing
      const hasData = collaborationDetails.songs.length > 0 || collaborationDetails.albums.length > 0 || 
                      collaborationDetails.details.length > 0;
      
      const totalTime = Date.now() - startTime;
      
      if (!hasData) {
        console.log(`❌ [Server] FINAL RESULT: No collaboration data found between "${artist1Name}" and "${artist2Name}" with any strategy (${totalTime}ms)`);
        const response = {
          songs: [],
          albums: [],
          collaborationType: 'unknown',
          details: [],
          hasData: false,
          dataSource: 'none'
        };
        console.log(`📤 [Server] Sending response:`, response);
        return res.json(response);
      }
      
      console.log(`✅ [Server] FINAL RESULT: Found collaboration data via ${dataSource} (${totalTime}ms)`);
      console.log(`📊 [Server] Final data: ${collaborationDetails.songs.length} songs, ${collaborationDetails.albums.length} albums, ${collaborationDetails.details.length} details`);
      
      const response = {
        ...collaborationDetails,
        hasData: true,
        dataSource
      };
      console.log(`📤 [Server] Sending response:`, response);
      res.json(response);
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [Server] CRITICAL ERROR in collaboration endpoint (${totalTime}ms):`, error);
      console.error(`❌ [Server] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        error: 'Internal server error', 
        songs: [], 
        albums: [], 
        collaborationType: 'unknown', 
        details: [], 
        hasData: false,
        dataSource: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
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
