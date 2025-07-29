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

  // Get artist profile picture
  app.get("/api/artist-profile-picture/:artistName", async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      console.log(`🖼️ [Profile] Fetching profile picture for: ${artistName}`);

      let profileImageUrl = null;

      // Method 1: Try Spotify API (if properly configured)
      try {
        const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

        // Check if we have real Spotify credentials (not placeholders)
        if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET &&
            !SPOTIFY_CLIENT_ID.includes('placeholder') &&
            !SPOTIFY_CLIENT_ID.includes('your_') &&
            !SPOTIFY_CLIENT_SECRET.includes('placeholder') &&
            !SPOTIFY_CLIENT_SECRET.includes('your_')) {

          // Get access token
          const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
          const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json() as { access_token: string };
            const accessToken = tokenData.access_token;

            // Search for artist
            const searchResponse = await fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              }
            );

            if (searchResponse.ok) {
              const searchData = await searchResponse.json() as { artists: { items: Array<{ images: Array<{ url: string }> }> } };
              const artists = searchData.artists.items;
              if (artists.length > 0 && artists[0].images && artists[0].images.length > 0) {
                // Use the smallest image for better performance (usually the last one)
                profileImageUrl = artists[0].images[artists[0].images.length - 1].url;
                console.log(`🖼️✅ [Profile] Found Spotify profile image for ${artistName}`);
              }
            }
          }
        } else {
          console.log(`🖼️⚠️ [Profile] Spotify credentials not properly configured`);
        }
      } catch (spotifyError) {
        console.warn(`🖼️❌ [Profile] Spotify API failed for ${artistName}:`, spotifyError instanceof Error ? spotifyError.message : 'Unknown error');
      }

      // Method 2: Fallback to MusicBrainz Cover Art Archive
      if (!profileImageUrl) {
        try {
          console.log(`🖼️🔄 [Profile] Trying MusicBrainz fallback for ${artistName}`);
          const mbResponse = await fetch(
            `https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=1`
          );

          if (mbResponse.ok) {
            const mbData = await mbResponse.json() as { artists: Array<{ id: string }> };
            if (mbData.artists && mbData.artists.length > 0) {
              const artistId = mbData.artists[0].id;

              // Try to get Cover Art Archive image
              const caaResponse = await fetch(
                `https://coverartarchive.org/artist/${artistId}`,
                {
                  headers: { 'User-Agent': 'Grapevine/1.0 (https://grapevine.app)' }
                }
              );

              if (caaResponse.ok) {
                const caaData = await caaResponse.json() as { images: Array<{ image: string, thumbnails: { small: string } }> };
                if (caaData.images && caaData.images.length > 0) {
                  profileImageUrl = caaData.images[0].thumbnails?.small || caaData.images[0].image;
                  console.log(`🖼️✅ [Profile] Found MusicBrainz profile image for ${artistName}`);
                }
              }
            }
          }
        } catch (mbError) {
          console.warn(`🖼️⚠️ [Profile] MusicBrainz fallback failed for ${artistName}:`, mbError instanceof Error ? mbError.message : 'Unknown error');
        }
      }

      // Return result (null if no image found - frontend will use original design)
      if (profileImageUrl) {
        res.json({
          artistName,
          imageUrl: profileImageUrl,
          success: true
        });
      } else {
        console.log(`🖼️⭕ [Profile] No profile image found for ${artistName}`);
        res.json({
          artistName,
          imageUrl: null,
          success: true
        });
      }
    } catch (error) {
      console.error(`🖼️💥 [Profile] Error fetching profile picture for ${req.params.artistName}:`, error);
      res.status(500).json({ 
        message: "Internal server error",
        artistName: req.params.artistName,
        imageUrl: null,
        success: false
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
