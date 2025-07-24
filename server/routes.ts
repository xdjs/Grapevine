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

  // Get collaboration information between two artists
  app.get("/api/collaboration-info", async (req, res) => {
    try {
      const { artistName, collaboratorName } = req.query;
      
      if (!artistName || typeof artistName !== 'string') {
        return res.status(400).json({ message: 'Artist name is required' });
      }

      if (!collaboratorName || typeof collaboratorName !== 'string') {
        return res.status(400).json({ message: 'Collaborator name is required' });
      }

      console.log(`🤝 [Server] Collaboration info request for: ${artistName} and ${collaboratorName}`);
      
      // Get environment variables
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
      const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
      
      if (!OPENAI_API_KEY) {
        console.error('❌ [Server] OPENAI_API_KEY not found');
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      // Generate collaboration information using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Given the artist "${artistName}" and their collaborator "${collaboratorName}", write a brief sentence describing how they worked together, and cite the real project (song, album, etc) that they worked on together. All instances of collaborations should be mentioned, as well as their personal history (if the information is available).

Please respond with JSON in this exact format:
{
  "collaborationInfo": "Brief description of their collaboration and relationship",
  "projects": [
    {
      "name": "Project Name (Song/Album)",
      "year": "Year",
      "role": "Role in project",
      "spotifyUrl": "Spotify URL if available"
    }
  ],
  "personalHistory": "Any relevant personal history or background information"
}

Guidelines:
- Focus on real, verified collaborations
- Include specific songs, albums, or projects they worked on together
- If you cannot find real collaborations, return empty projects array
- Keep the collaboration info concise but informative
- Include Spotify URLs when possible for the projects
- Return ONLY the JSON object, no other text`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Lower temperature for faster, more consistent responses
        max_tokens: 500, // Reduced token limit for faster response
      });

      let collaborationData;
      try {
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }
        
        // Try to extract JSON from the response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonContent = jsonMatch ? jsonMatch[0] : content;
        
        collaborationData = JSON.parse(jsonContent);
        
        // Ensure required fields exist
        if (!collaborationData.collaborationInfo) {
          collaborationData.collaborationInfo = "No collaboration information available.";
        }
        if (!collaborationData.projects) {
          collaborationData.projects = [];
        }
        
      } catch (parseError) {
        console.error('❌ [Server] Failed to parse OpenAI response:', parseError);
        console.error('Raw response:', completion.choices[0]?.message?.content);
        
        // Return a fallback response instead of error
        collaborationData = {
          collaborationInfo: "Unable to generate collaboration information at this time.",
          projects: [],
          personalHistory: "Information temporarily unavailable."
        };
      }

      // If Spotify credentials are available, try to enhance with Spotify data
      if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
        try {
          // Get Spotify access token
          const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: 'grant_type=client_credentials'
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Search for collaborative tracks
            const searchQuery = `${artistName} ${collaboratorName}`;
            const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const tracks = searchData.tracks?.items || [];

              // Add Spotify tracks to the response
              collaborationData.spotifyTracks = tracks.map((track: any) => ({
                name: track.name,
                artists: track.artists.map((artist: any) => artist.name),
                album: track.album.name,
                spotifyUrl: track.external_urls.spotify,
                releaseDate: track.album.release_date
              }));
            }
          }
        } catch (spotifyError) {
          console.warn('⚠️ [Server] Spotify API error:', spotifyError);
          // Continue without Spotify data
        }
      }

      console.log(`✅ [Server] Generated collaboration info for ${artistName} and ${collaboratorName}`);
      res.json(collaborationData);

    } catch (error) {
      console.error('❌ [Server] Collaboration info error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
