// server/database-storage.ts
import { eq, sql } from "drizzle-orm";

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
var supabaseUrl = process.env.SUPABASE_URL || "https://your-project-ref.supabase.co";
var supabaseKey = process.env.SUPABASE_ANON_KEY || "your-anon-or-service-role-key";
var supabase = createClient(supabaseUrl, supabaseKey);
var connectionString = process.env.DATABASE_URL || process.env.CONNECTION_STRING;
if (!connectionString) {
  console.warn("DATABASE_URL or CONNECTION_STRING not provided. Using in-memory storage.");
}
var db = null;
if (connectionString) {
  try {
    const client = postgres(connectionString);
    db = drizzle(client);
    console.log("Connected to Supabase database via Drizzle");
  } catch (error) {
    console.error("Failed to connect to database:", error);
  }
}
function isDatabaseAvailable() {
  return db !== null && connectionString !== void 0;
}

// shared/schema.ts
import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var artists = pgTable("artists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  // 'artist', 'producer', 'songwriter'
  imageUrl: text("image_url"),
  spotifyId: text("spotify_id"),
  webmapdata: jsonb("webmapdata")
  // Cache for network visualization data
});
var collaborations = pgTable("collaborations", {
  id: serial("id").primaryKey(),
  fromArtistId: integer("from_artist_id").notNull(),
  toArtistId: integer("to_artist_id").notNull(),
  collaborationType: text("collaboration_type").notNull()
  // 'production', 'songwriting'
});
var insertArtistSchema = createInsertSchema(artists).omit({
  id: true
});
var insertCollaborationSchema = createInsertSchema(collaborations).omit({
  id: true
});
var networkNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["artist", "producer", "songwriter"]),
  types: z.array(z.enum(["artist", "producer", "songwriter"])).optional(),
  // Support for multiple roles
  size: z.number(),
  collaborations: z.array(z.string()).optional(),
  imageUrl: z.string().nullable().optional(),
  spotifyId: z.string().nullable().optional(),
  artistId: z.string().nullable().optional(),
  // MusicNerd artist ID for linking
  musicNerdUrl: z.string().optional()
  // Direct URL to MusicNerd artist page
});
var networkLinkSchema = z.object({
  source: z.string(),
  target: z.string()
});
var networkDataSchema = z.object({
  nodes: z.array(networkNodeSchema),
  links: z.array(networkLinkSchema),
  cached: z.boolean().optional()
});

// server/spotify.ts
import axios from "axios";
var SpotifyService = class {
  clientId;
  clientSecret;
  accessToken = null;
  tokenExpiry = 0;
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || "";
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
  }
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    try {
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`
          }
        }
      );
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1e3 - 6e4;
      return this.accessToken;
    } catch (error) {
      console.error("Failed to get Spotify access token:", error);
      throw new Error("Spotify API authentication failed");
    }
  }
  async searchArtist(artistName) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        "https://api.spotify.com/v1/search",
        {
          params: {
            q: artistName,
            type: "artist",
            limit: 1
          },
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );
      const artists2 = response.data.artists.items;
      return artists2.length > 0 ? artists2[0] : null;
    } catch (error) {
      console.error(`Failed to search for artist ${artistName}:`, error);
      return null;
    }
  }
  async getArtistTopTracks(artistId, market = "US") {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
        {
          params: { market },
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );
      return response.data.tracks;
    } catch (error) {
      console.error(`Failed to get top tracks for artist ${artistId}:`, error);
      return [];
    }
  }
  async getArtistAlbums(artistId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}/albums`,
        {
          params: {
            include_groups: "album,single",
            market: "US",
            limit: 50
          },
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );
      return response.data.items;
    } catch (error) {
      console.error(`Failed to get albums for artist ${artistId}:`, error);
      return [];
    }
  }
  async getAlbumTracks(albumId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.spotify.com/v1/albums/${albumId}/tracks`,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );
      return response.data.items;
    } catch (error) {
      console.error(`Failed to get tracks for album ${albumId}:`, error);
      return [];
    }
  }
  // Helper method to get artist image
  getArtistImageUrl(artist, size = "medium") {
    if (!artist.images || artist.images.length === 0) {
      return null;
    }
    const sortedImages = artist.images.sort((a, b) => b.width - a.width);
    switch (size) {
      case "small":
        return sortedImages[sortedImages.length - 1]?.url || sortedImages[0]?.url;
      case "large":
        return sortedImages[0]?.url;
      case "medium":
      default:
        return sortedImages[Math.floor(sortedImages.length / 2)]?.url || sortedImages[0]?.url;
    }
  }
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }
};
var spotifyService = new SpotifyService();

// server/openai-service.ts
import OpenAI from "openai";
var OpenAIService = class {
  openai = null;
  isConfigured = false;
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      console.log("\u{1F916} [DEBUG] OpenAI service initialized with API key");
    } else {
      console.log("\u26A0\uFE0F [DEBUG] OpenAI API key not found in environment variables");
    }
  }
  isServiceAvailable() {
    return this.isConfigured;
  }
  async getArtistCollaborations(artistName) {
    if (!this.isConfigured || !this.openai) {
      throw new Error("OpenAI service is not configured");
    }
    console.log(`\u{1F916} [DEBUG] Querying OpenAI for collaborations with "${artistName}"`);
    try {
      const prompt = `If ${artistName} is a real artist with known music industry collaborations, provide a comprehensive list of music industry professionals who have collaborated with them. Include people who work as producers, songwriters, or both.

IMPORTANT: If ${artistName} is not a well-known artist or you have no authentic collaboration data for them, return an empty collaborators array. Do NOT create fake or placeholder collaborators.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- Only include real, verified music industry professionals who have actually worked with ${artistName}
- If you don't have authentic data, return: {"collaborators": []}
- For each real person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Include their top 3 real collaborating artists
- Never use generic names like "John Doe", "Producer X", or placeholder data
- Maximum 10 real collaborators if they exist`;
      const response = await this.openai.chat.completions.create({
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
        temperature: 0.1
        // Low temperature for more factual responses
      });
      const result = JSON.parse(response.choices[0].message.content || '{"collaborators": []}');
      const collaborators = [];
      if (result.collaborators) {
        for (const collaborator of result.collaborators) {
          const roles = collaborator.roles || ["producer"];
          for (const role of roles) {
            if (role === "producer" || role === "songwriter") {
              collaborators.push({
                name: collaborator.name,
                type: role,
                topCollaborators: collaborator.topCollaborators || []
              });
            }
          }
        }
      }
      console.log(`\u2705 [DEBUG] OpenAI returned ${collaborators.length} collaborators for "${artistName}"`);
      console.log(`\u{1F916} [DEBUG] Producers: ${collaborators.filter((c) => c.type === "producer").length}, Songwriters: ${collaborators.filter((c) => c.type === "songwriter").length}`);
      return { artists: collaborators };
    } catch (error) {
      console.error(`\u274C [DEBUG] OpenAI API error for "${artistName}":`, error);
      throw error;
    }
  }
};
var openAIService = new OpenAIService();

// server/musicbrainz.ts
var MusicBrainzService = class {
  baseUrl = "https://musicbrainz.org/ws/2";
  userAgent = "MusicCollaborationVisualizer/1.0 (https://replit.com)";
  async makeRequest(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }
    return response.json();
  }
  async searchArtist(artistName) {
    try {
      console.log(`\u{1F3B5} [DEBUG] MusicBrainz searching for artist: "${artistName}"`);
      const searchStrategies = [
        `artist:"${artistName}"`,
        `artist:${encodeURIComponent(artistName)}`,
        encodeURIComponent(artistName)
      ];
      for (const searchQuery of searchStrategies) {
        console.log(`\u{1F50D} [DEBUG] Trying search query: ${searchQuery}`);
        const endpoint = `/artist?query=${searchQuery}&limit=10&fmt=json`;
        const result = await this.makeRequest(endpoint);
        if (result.artists && result.artists.length > 0) {
          console.log(`\u{1F50D} [DEBUG] MusicBrainz found ${result.artists.length} potential matches for "${artistName}"`);
          result.artists.forEach((artist, index) => {
            console.log(`\u{1F50D} [DEBUG] Result ${index + 1}: "${artist.name}" (${artist.id}) ${artist.disambiguation ? `[${artist.disambiguation}]` : ""}`);
          });
          let exactMatch = result.artists.find((artist) => artist.name === artistName);
          if (exactMatch) {
            console.log(`\u2705 [DEBUG] Found exact match: "${exactMatch.name}" (ID: ${exactMatch.id})`);
            if (exactMatch.disambiguation) {
              console.log(`\u{1F4DD} [DEBUG] Artist disambiguation: "${exactMatch.disambiguation}"`);
            }
            return exactMatch;
          }
          exactMatch = result.artists.find((artist) => artist.name.toLowerCase() === artistName.toLowerCase());
          if (exactMatch) {
            console.log(`\u2705 [DEBUG] Found case-insensitive match: "${artistName}" \u2192 "${exactMatch.name}" (ID: ${exactMatch.id})`);
            if (exactMatch.disambiguation) {
              console.log(`\u{1F4DD} [DEBUG] Artist disambiguation: "${exactMatch.disambiguation}"`);
            }
            return exactMatch;
          }
          if (artistName === "LISA") {
            const blackpinkLisa = result.artists.find(
              (artist) => artist.name === "LISA" || artist.disambiguation && artist.disambiguation.toLowerCase().includes("blackpink")
            );
            if (blackpinkLisa) {
              console.log(`\u2705 [DEBUG] Found BLACKPINK LISA: "${blackpinkLisa.name}" (ID: ${blackpinkLisa.id})`);
              return blackpinkLisa;
            }
          }
          if (artistName === "Kanye West") {
            const ye = result.artists.find(
              (artist) => artist.name === "Ye" || artist.disambiguation && artist.disambiguation.toLowerCase().includes("formerly kanye west")
            );
            if (ye) {
              console.log(`\u2705 [DEBUG] Found Ye (formerly Kanye West): "${ye.name}" (ID: ${ye.id})`);
              return ye;
            }
          }
        }
        await this.rateLimitDelay();
      }
      console.log(`\u274C [DEBUG] MusicBrainz found no artists matching "${artistName}" with any search strategy`);
      return null;
    } catch (error) {
      console.error(`\u26A0\uFE0F [DEBUG] MusicBrainz search error for "${artistName}":`, error);
      return null;
    }
  }
  async getArtistWithRelations(artistId) {
    try {
      const endpoint = `/artist/${artistId}?inc=artist-rels+work-rels+recording-rels&fmt=json`;
      const artist = await this.makeRequest(endpoint);
      return artist;
    } catch (error) {
      console.error("Error getting artist relations:", error);
      return null;
    }
  }
  async getArtistRecordings(artistId) {
    try {
      const endpoint = `/recording?artist=${artistId}&inc=artist-credits+artist-rels+work-rels&fmt=json&limit=50`;
      const result = await this.makeRequest(endpoint);
      return result.recordings || [];
    } catch (error) {
      console.error("Error getting artist recordings:", error);
      return [];
    }
  }
  async getWorkDetails(workId) {
    try {
      const endpoint = `/work/${workId}?inc=artist-rels&fmt=json`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error("Error getting work details:", error);
      return null;
    }
  }
  async getArtistCollaborations(artistName) {
    try {
      const artist = await this.searchArtist(artistName);
      if (!artist) {
        return { artists: [], works: [] };
      }
      console.log(`\u{1F3B5} [DEBUG] Getting detailed collaboration data for ${artistName} (ID: ${artist.id})`);
      const detailedArtist = await this.getArtistWithRelations(artist.id);
      if (!detailedArtist || !detailedArtist.relations) {
        console.log(`\u26A0\uFE0F [DEBUG] No relations found for ${artistName}`);
        return { artists: [], works: [] };
      }
      const collaboratingArtists = [];
      const collaborativeWorks = [];
      const processedArtists = /* @__PURE__ */ new Set();
      console.log(`\u{1F50D} [DEBUG] Found ${detailedArtist.relations.length} relations for ${artistName}`);
      const maxRelationsToProcess = 100;
      const relationsToProcess = detailedArtist.relations.slice(0, maxRelationsToProcess);
      for (const relation of relationsToProcess) {
        if (relationsToProcess.indexOf(relation) < 10) {
          console.log(`\u{1F50D} [DEBUG] Relation type: ${relation.type}, target: ${relation["target-type"]}`);
        }
        if (relation["target-type"] === "artist" && relation.artist) {
          let relationType = this.mapRelationType(relation.type);
          if (relationType && !processedArtists.has(relation.artist.name)) {
            const collaboratorNameLower = relation.artist.name.toLowerCase();
            const knownSongwriters = [
              "jack antonoff",
              "max martin",
              "aaron dessner",
              "finneas",
              "benny blanco",
              "oscar holter",
              "greg kurstin",
              "ludwig g\xF6ransson",
              "shellback",
              "ali payami",
              "patrik berger",
              "sia",
              "ed sheeran",
              "ryan tedder",
              "charlie puth",
              "julia michaels",
              "justin tranter"
            ];
            if (knownSongwriters.some((songwriter) => collaboratorNameLower.includes(songwriter))) {
              relationType = "songwriter";
              console.log(`\u2728 [DEBUG] Reclassified "${relation.artist.name}" as songwriter`);
            }
            collaboratingArtists.push({
              name: relation.artist.name,
              type: relationType,
              relation: relation.type
            });
            processedArtists.add(relation.artist.name);
            console.log(`\u{1F91D} [DEBUG] Found ${relationType}: ${relation.artist.name} (${relation.type})`);
          }
        }
        if (relation["target-type"] === "work" && relation.work) {
          if (relation.type && ["composer", "lyricist", "writer", "arranger"].includes(relation.type.toLowerCase())) {
            try {
              const workDetails = await this.getWorkDetails(relation.work.id);
              if (workDetails && workDetails.relations) {
                for (const workRelation of workDetails.relations) {
                  if (workRelation["target-type"] === "artist" && workRelation.artist && workRelation.artist.name !== artistName && ["composer", "lyricist", "writer", "arranger"].includes(workRelation.type?.toLowerCase() || "")) {
                    if (!processedArtists.has(workRelation.artist.name)) {
                      collaboratingArtists.push({
                        name: workRelation.artist.name,
                        type: "songwriter",
                        relation: `work ${workRelation.type}`
                      });
                      processedArtists.add(workRelation.artist.name);
                      console.log(`\u270D\uFE0F [DEBUG] Found songwriter from work: ${workRelation.artist.name} (${workRelation.type})`);
                    }
                  }
                }
              }
            } catch (workError) {
              console.log(`\u26A0\uFE0F [DEBUG] Could not fetch work details for "${relation.work.title}":`, workError);
            }
          }
          collaborativeWorks.push({
            title: relation.work.title,
            collaborators: [artistName]
          });
        }
      }
      if (detailedArtist.relations.length > maxRelationsToProcess) {
        console.log(`\u26A0\uFE0F [DEBUG] Limited relation processing to ${maxRelationsToProcess} out of ${detailedArtist.relations.length} total relations`);
      }
      console.log(`\u{1F504} [DEBUG] Finished processing ${detailedArtist.relations.length} relations, found ${collaboratingArtists.length} collaborators`);
      console.log(`\u{1F504} [DEBUG] About to start recordings analysis for ${artistName}...`);
      console.log(`\u{1F3B5} [DEBUG] Fetching recordings for ${artistName} to find producers/songwriters`);
      try {
        await this.rateLimitDelay();
        const recordings = await this.getArtistRecordings(artist.id);
        console.log(`\u{1F3B5} [DEBUG] Found ${recordings.length} recordings for ${artistName}`);
        for (const recording of recordings.slice(0, 10)) {
          console.log(`\u{1F3B5} [DEBUG] Processing recording: "${recording.title}" for ${artistName}`);
          if (recording.relations && recording.relations.length > 0) {
            console.log(`\u{1F50D} [DEBUG] Found ${recording.relations.length} relations in recording "${recording.title}"`);
            for (const relation of recording.relations) {
              if (relation.artist && relation.artist.name !== artistName) {
                const collaboratorName = relation.artist.name;
                if (!processedArtists.has(collaboratorName)) {
                  let relationType = this.mapRelationType(relation.type);
                  if (relationType) {
                    const collaboratorNameLower = collaboratorName.toLowerCase();
                    const knownSongwriters = [
                      "jack antonoff",
                      "max martin",
                      "aaron dessner",
                      "finneas",
                      "benny blanco",
                      "oscar holter",
                      "greg kurstin",
                      "ludwig g\xF6ransson",
                      "shellback",
                      "ali payami",
                      "patrik berger",
                      "sia",
                      "ed sheeran",
                      "ryan tedder",
                      "charlie puth",
                      "julia michaels",
                      "justin tranter"
                    ];
                    if (knownSongwriters.some((songwriter) => collaboratorNameLower.includes(songwriter))) {
                      relationType = "songwriter";
                      console.log(`\u2728 [DEBUG] Reclassified "${collaboratorName}" as songwriter`);
                    }
                    collaboratingArtists.push({
                      name: collaboratorName,
                      type: relationType,
                      relation: `recording ${relation.type}`
                    });
                    processedArtists.add(collaboratorName);
                    console.log(`\u{1F3B5} [DEBUG] Found recording relation: ${collaboratorName} (${relationType}) - ${relation.type}`);
                  }
                }
              }
            }
          }
          if (recording["artist-credit"] && recording["artist-credit"].length > 0) {
            for (const credit of recording["artist-credit"]) {
              if (credit.artist && credit.artist.name !== artistName) {
                const collaboratorName = credit.artist.name;
                if (!processedArtists.has(collaboratorName)) {
                  const joinPhrase = credit.joinphrase || "";
                  let type = "artist";
                  if (joinPhrase.toLowerCase().includes("produced") || joinPhrase.toLowerCase().includes("producer") || joinPhrase.toLowerCase().includes("mixed") || joinPhrase.toLowerCase().includes("engineered")) {
                    type = "producer";
                  } else if (joinPhrase.toLowerCase().includes("wrote") || joinPhrase.toLowerCase().includes("written") || joinPhrase.toLowerCase().includes("composed") || joinPhrase.toLowerCase().includes("lyrics")) {
                    type = "songwriter";
                  } else {
                    console.log(`\u{1F50D} [DEBUG] Using MusicBrainz relation type for: "${collaboratorName}"`);
                  }
                  collaboratingArtists.push({
                    name: collaboratorName,
                    type,
                    relation: "recording credit"
                  });
                  processedArtists.add(collaboratorName);
                  console.log(`\u{1F3B5} [DEBUG] Found recording credit: ${collaboratorName} (${type})`);
                }
              }
            }
          }
        }
        for (const work of collaborativeWorks.slice(0, 5)) {
        }
        console.log(`\u2705 [DEBUG] Recordings analysis completed for ${artistName}`);
      } catch (recordingsError) {
        console.error(`\u274C [DEBUG] Error in recordings analysis for ${artistName}:`, recordingsError);
      }
      console.log(`\u2705 [DEBUG] Total collaborators found for ${artistName}: ${collaboratingArtists.length}`);
      console.log(`\u2705 [DEBUG] Final collaborators count for ${artistName}: ${collaboratingArtists.length}`);
      return {
        artists: collaboratingArtists,
        works: collaborativeWorks
      };
    } catch (error) {
      console.error("Error getting collaborations:", error);
      return { artists: [], works: [] };
    }
  }
  mapRelationType(musicBrainzType) {
    const typeMap = {
      // Artist relationships
      "member": "artist",
      "member of band": "artist",
      "collaboration": "artist",
      "supporting musician": "artist",
      "vocalist": "artist",
      "performance": "artist",
      "featured artist": "artist",
      "guest": "artist",
      "remixer": "artist",
      // Producer relationships
      "producer": "producer",
      "engineer": "producer",
      "recording engineer": "producer",
      "mix engineer": "producer",
      "mastering engineer": "producer",
      "mix": "producer",
      "mastering": "producer",
      "executive producer": "producer",
      "co-producer": "producer",
      // Songwriter relationships
      "composer": "songwriter",
      "lyricist": "songwriter",
      "writer": "songwriter",
      "arranger": "songwriter",
      "songwriter": "songwriter",
      "co-writer": "songwriter",
      "additional songwriter": "songwriter",
      "librettist": "songwriter",
      "music": "songwriter",
      "lyrics": "songwriter",
      "composition": "songwriter",
      "writing": "songwriter",
      "song writing": "songwriter",
      "written by": "songwriter",
      "song writer": "songwriter",
      "music writer": "songwriter",
      "lyrics writer": "songwriter",
      "authored by": "songwriter",
      "penned by": "songwriter"
    };
    return typeMap[musicBrainzType.toLowerCase()] || null;
  }
  // Rate limiting helper
  async rateLimitDelay() {
    return new Promise((resolve) => setTimeout(resolve, 1e3));
  }
};
var musicBrainzService = new MusicBrainzService();

// server/wikipedia.ts
var WikipediaService = class {
  baseUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/";
  apiUrl = "https://en.wikipedia.org/w/api.php";
  async makeRequest(url) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MusicCollaborationVisualizer/1.0 (https://replit.com)"
      }
    });
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    return response.json();
  }
  async searchArtist(artistName) {
    try {
      const searchQuery = encodeURIComponent(`${artistName} musician singer`);
      const url = `${this.apiUrl}?action=query&list=search&srsearch=${searchQuery}&format=json&origin=*&srlimit=1`;
      const result = await this.makeRequest(url);
      if (result.query.search && result.query.search.length > 0) {
        return result.query.search[0].title;
      }
      return null;
    } catch (error) {
      console.error("Error searching Wikipedia:", error);
      return null;
    }
  }
  async getArtistPage(pageTitle) {
    try {
      const encodedTitle = encodeURIComponent(pageTitle);
      const url = `${this.apiUrl}?action=query&format=json&origin=*&prop=extracts&exintro&explaintext&titles=${encodedTitle}`;
      const result = await this.makeRequest(url);
      if (result.query.pages) {
        const pages = Object.values(result.query.pages);
        if (pages.length > 0 && pages[0].extract) {
          return pages[0].extract;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching Wikipedia page:", error);
      return null;
    }
  }
  extractCollaborators(artistName, wikipediaText) {
    const collaborators = [];
    console.log(`\u{1F50D} [DEBUG] Extracting collaborators from Wikipedia text for "${artistName}"`);
    const patterns = [
      // Producer patterns
      /produced by ([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /producer[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /working with producer[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      // Songwriter patterns
      /co-written (?:with|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /written (?:with|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /songwriter[s]?\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      // Collaboration patterns
      /collaborated with\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /featuring\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g,
      /duet with\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|;)/g
    ];
    console.log(`\u{1F4CB} [DEBUG] Searching text with ${patterns.length} regex patterns`);
    const typePatterns = {
      producer: [/produc/i, /mix/i, /engineer/i],
      songwriter: [/writ/i, /compos/i, /lyric/i],
      artist: [/collaborat/i, /featuring/i, /duet/i, /featuring/i]
    };
    patterns.forEach((pattern, index) => {
      let match;
      let patternMatches = 0;
      while ((match = pattern.exec(wikipediaText)) !== null) {
        patternMatches++;
        const name = match[1].trim();
        console.log(`\u{1F3AF} [DEBUG] Pattern ${index} matched: "${match[0]}" \u2192 extracted name: "${name}"`);
        if (name.toLowerCase() === artistName.toLowerCase() || name.length < 3 || name.length > 30 || /\d/.test(name)) {
          console.log(`\u274C [DEBUG] Skipping "${name}" - invalid (same artist, too short/long, or contains numbers)`);
          continue;
        }
        let type = "artist";
        const context = match[0].toLowerCase();
        if (typePatterns.producer.some((p) => p.test(context))) {
          type = "producer";
        } else if (typePatterns.songwriter.some((p) => p.test(context))) {
          type = "songwriter";
        }
        console.log(`\u{1F3AD} [DEBUG] Categorized "${name}" as ${type} based on context: "${context}"`);
        const existing = collaborators.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!existing) {
          collaborators.push({
            name,
            type,
            context: match[0]
          });
          console.log(`\u2705 [DEBUG] Added collaborator: "${name}" (${type})`);
        } else {
          console.log(`\u26A0\uFE0F [DEBUG] Duplicate collaborator "${name}" skipped`);
        }
      }
      if (patternMatches === 0) {
        console.log(`\u274C [DEBUG] Pattern ${index} found no matches in Wikipedia text`);
      } else {
        console.log(`\u2705 [DEBUG] Pattern ${index} found ${patternMatches} matches`);
      }
    });
    const blacklist = [
      "the",
      "and",
      "with",
      "by",
      "for",
      "in",
      "on",
      "at",
      "to",
      "from",
      "album",
      "song",
      "track",
      "single",
      "ep",
      "record",
      "label",
      "studio",
      "music",
      "band",
      "group",
      "artist",
      "singer",
      "musician"
    ];
    return collaborators.filter(
      (c) => !blacklist.includes(c.name.toLowerCase()) && !c.name.includes("(") && // Filter out things like "Album Name (2020)"
      /^[A-Z]/.test(c.name)
      // Must start with capital letter
    ).slice(0, 6);
  }
  async getArtistCollaborations(artistName) {
    try {
      console.log(`\u{1F4D6} [DEBUG] Wikipedia searching for artist: "${artistName}"`);
      const pageTitle = await this.searchArtist(artistName);
      if (!pageTitle) {
        console.log(`\u274C [DEBUG] Wikipedia found no page for "${artistName}"`);
        return [];
      }
      console.log(`\u2705 [DEBUG] Wikipedia found page: "${pageTitle}"`);
      const pageContent = await this.getArtistPage(pageTitle);
      if (!pageContent) {
        console.log(`\u274C [DEBUG] Wikipedia could not fetch content for page "${pageTitle}"`);
        return [];
      }
      console.log(`\u{1F4C4} [DEBUG] Wikipedia page content length: ${pageContent.length} characters`);
      console.log(`\u{1F4DD} [DEBUG] Wikipedia content preview: "${pageContent.substring(0, 200)}..."`);
      const collaborators = this.extractCollaborators(artistName, pageContent);
      console.log(`\u{1F50D} [DEBUG] Wikipedia extracted ${collaborators.length} collaborators from page`);
      if (collaborators.length > 0) {
        console.log(`\u{1F465} [DEBUG] Wikipedia collaborators found:`, collaborators.map((c) => `${c.name} (${c.type})`));
      }
      return collaborators;
    } catch (error) {
      console.error(`Error getting Wikipedia collaborations for ${artistName}:`, error);
      return [];
    }
  }
};
var wikipediaService = new WikipediaService();

// server/musicnerd-service.ts
var MusicNerdService = class {
  supabase;
  isAvailable = false;
  supabaseUrl = "";
  useRestApi = false;
  constructor() {
    try {
      const connectionString2 = process.env.CONNECTION_STRING;
      if (!connectionString2) {
        console.log("CONNECTION_STRING not provided. MusicNerd artist IDs will not be available.");
        return;
      }
      console.log(`\u{1F527} [DEBUG] CONNECTION_STRING provided - using direct PostgreSQL connection`);
      if (connectionString2.includes("postgresql://") || connectionString2.includes("postgres://")) {
        this.isAvailable = true;
        console.log("\u{1F3B5} MusicNerd service initialized with direct PostgreSQL connection");
        return;
      } else {
        console.log("CONNECTION_STRING format not recognized. Expected PostgreSQL connection string.");
        return;
      }
    } catch (error) {
      console.error("Error initializing MusicNerd service:", error);
    }
  }
  isServiceAvailable() {
    return this.isAvailable;
  }
  async getArtistOptions(artistName) {
    if (!this.isAvailable) {
      console.log(`\u{1F512} [DEBUG] MusicNerd service not available for "${artistName}"`);
      return null;
    }
    try {
      console.log(`\u{1F50D} [DEBUG] Looking up artist options for: "${artistName}"`);
      const connectionString2 = process.env.CONNECTION_STRING;
      if (connectionString2 && connectionString2.includes("postgresql://")) {
        try {
          console.log(`\u{1F50D} [DEBUG] Querying database for all artist options: "${artistName}"`);
          const { Client } = await import("pg");
          const client = new Client({ connectionString: connectionString2 });
          await client.connect();
          let query;
          let params;
          if (artistName.length === 1) {
            query = `
              SELECT id, name FROM artists 
              WHERE LOWER(name) LIKE LOWER($1)
              ORDER BY LENGTH(name), name 
              LIMIT 100
            `;
            params = [`${artistName.toLowerCase()}%`];
          } else if (artistName.length <= 3) {
            query = `
              SELECT id, name FROM artists 
              WHERE LOWER(name) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($2)
              ORDER BY 
                CASE 
                  WHEN LOWER(name) LIKE LOWER($1) THEN 1 
                  WHEN LOWER(name) LIKE LOWER($3) THEN 2
                  ELSE 3 
                END,
                LENGTH(name),
                name 
              LIMIT 150
            `;
            params = [`${artistName.toLowerCase()}%`, `%${artistName.toLowerCase()}%`, `${artistName.toLowerCase()}%`];
          } else {
            query = "SELECT id, name FROM artists WHERE LOWER(name) LIKE LOWER($1) ORDER BY LENGTH(name), name LIMIT 200";
            params = [`%${artistName.toLowerCase()}%`];
          }
          console.log(`\u{1F50D} [DEBUG] Optimized query for "${artistName}" (length: ${artistName.length})`);
          const result = await client.query(query, params);
          await client.end();
          if (result.rows.length > 0) {
            const options = result.rows.map((artist) => {
              const searchLower = artistName.toLowerCase();
              const foundLower = artist.name.toLowerCase();
              const score = this.calculateRelevanceScore(searchLower, foundLower);
              console.log(`\u{1F50D} [DEBUG] "${artist.name}" relevance score: ${score}`);
              const generateBio = (name) => {
                return `${name} is a prominent artist known for their musical contributions across various genres. Their work has influenced many in the music industry and continues to resonate with listeners worldwide.`;
              };
              return {
                id: artist.id,
                artistId: artist.id,
                // Add artistId field for consistency with frontend
                name: artist.name,
                bio: generateBio(artist.name),
                score
              };
            }).filter((artist) => artist.score > 0).sort((a, b) => b.score - a.score).map(({ score, ...artist }) => artist);
            console.log(`\u2705 [DEBUG] Found ${options.length} artist options for "${artistName}"`);
            return options;
          } else {
            console.log(`\u{1F4ED} [DEBUG] No matches found for "${artistName}" in MusicNerd database`);
            return null;
          }
        } catch (dbError) {
          console.log(`\u26A0\uFE0F [DEBUG] Database query failed for "${artistName}":`, dbError);
          return null;
        }
      }
      console.log(`\u{1F4ED} [DEBUG] No connection available for "${artistName}"`);
      return null;
    } catch (error) {
      console.error(`\u{1F4A5} [DEBUG] Exception during artist lookup for "${artistName}":`, error);
      return null;
    }
  }
  async getArtistId(artistName) {
    if (!this.isAvailable) {
      console.log(`\u{1F512} [DEBUG] MusicNerd service not available for "${artistName}"`);
      return null;
    }
    try {
      console.log(`\u{1F50D} [DEBUG] Looking up artist ID for: "${artistName}"`);
      const connectionString2 = process.env.CONNECTION_STRING;
      if (connectionString2 && connectionString2.includes("postgresql://")) {
        try {
          console.log(`\u{1F50D} [DEBUG] Querying database via connection string for real artist ID: "${artistName}"`);
          const { Client } = await import("pg");
          const client = new Client({ connectionString: connectionString2 });
          await client.connect();
          const schemaQuery = "SELECT column_name FROM information_schema.columns WHERE table_name = 'artists' LIMIT 10";
          const schemaResult = await client.query(schemaQuery);
          console.log(`\u{1F50D} [DEBUG] Artists table columns:`, schemaResult.rows.map((r) => r.column_name));
          let query = "SELECT * FROM artists WHERE LOWER(name) = LOWER($1)";
          console.log(`\u{1F50D} [DEBUG] Executing search query: ${query} with parameter: "${artistName}"`);
          let result = await client.query(query, [artistName]);
          console.log(`\u{1F50D} [DEBUG] Found ${result.rows.length} potential matches for "${artistName}"`);
          if (result.rows.length > 0) {
            console.log(`\u{1F50D} [DEBUG] All matches:`, result.rows.map((r) => `"${r.name}" (${r.id})`));
            const exactMatch = result.rows.find((row) => row.name === artistName);
            if (exactMatch) {
              console.log(`\u2705 [DEBUG] Found exact case match: "${exactMatch.name}" (${exactMatch.id})`);
              result = { ...result, rows: [exactMatch] };
            } else {
              console.log(`\u{1F50D} [DEBUG] No exact case match found among ${result.rows.length} case-insensitive matches`);
              result = { ...result, rows: [result.rows[0]] };
            }
          }
          await client.end();
          if (result.rows.length > 0) {
            const artist = result.rows[0];
            console.log(`\u{1F50D} [DEBUG] Selected artist: "${artist.name}" (ID: ${artist.id})`);
            if (artist.name === artistName) {
              console.log(`\u2705 [DEBUG] Found exact case match for "${artistName}": ${artist.id}`);
              return artist.id;
            } else if (artist.name.toLowerCase() === artistName.toLowerCase()) {
              console.log(`\u2705 [DEBUG] Found acceptable case-insensitive match: "${artistName}" \u2192 "${artist.name}": ${artist.id}`);
              return artist.id;
            } else {
              console.log(`\u26A0\uFE0F [DEBUG] Name mismatch: searched "${artistName}" but found "${artist.name}" - rejecting`);
              return null;
            }
          } else {
            console.log(`\u{1F4ED} [DEBUG] No match found for "${artistName}" in MusicNerd database`);
          }
        } catch (dbError) {
          console.log(`\u26A0\uFE0F [DEBUG] Database query failed for "${artistName}":`, dbError);
        }
      }
      console.log(`\u{1F4ED} [DEBUG] No real artist ID found for "${artistName}" - will use main MusicNerd page`);
      return null;
    } catch (error) {
      console.error(`\u{1F4A5} [DEBUG] Exception during artist lookup for "${artistName}":`, error);
      return null;
    }
  }
  async searchArtistByName(artistName) {
    if (!this.isAvailable || !this.supabase) {
      return null;
    }
    try {
      const { data, error } = await this.supabase.from("artists").select("*").ilike("name", `%${artistName}%`).limit(1).single();
      if (error || !data) {
        return null;
      }
      return data;
    } catch (error) {
      console.error(`Error searching for artist "${artistName}":`, error);
      return null;
    }
  }
  calculateRelevanceScore(searchTerm, artistName) {
    let score = 0;
    if (searchTerm === artistName) {
      return 1e3;
    }
    if (searchTerm.toLowerCase() === artistName.toLowerCase()) {
      return 900;
    }
    const searchWords = searchTerm.split(/\s+/).filter((word) => word.length > 0);
    const artistWords = artistName.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
    let exactWordMatches = 0;
    for (const searchWord of searchWords) {
      if (artistWords.includes(searchWord.toLowerCase())) {
        exactWordMatches++;
        score += 100;
      }
    }
    if (artistName.toLowerCase().startsWith(searchTerm)) {
      score += 200;
    }
    for (const searchWord of searchWords) {
      for (const artistWord of artistWords) {
        if (artistWord.startsWith(searchWord.toLowerCase())) {
          score += 50;
        }
      }
    }
    for (const searchWord of searchWords) {
      for (const artistWord of artistWords) {
        if (artistWord.includes(searchWord.toLowerCase()) && !artistWord.startsWith(searchWord.toLowerCase())) {
          score += 25;
        }
      }
    }
    const lengthDiff = Math.abs(searchTerm.length - artistName.length);
    const maxLength = Math.max(searchTerm.length, artistName.length);
    const lengthSimilarity = 1 - lengthDiff / maxLength;
    score += lengthSimilarity * 30;
    const distance = this.levenshteinDistance(searchTerm, artistName.toLowerCase());
    const maxLen = Math.max(searchTerm.length, artistName.length);
    const similarity = 1 - distance / maxLen;
    score += similarity * 40;
    if (artistName.length <= 15) {
      score += 10;
    }
    return Math.round(score);
  }
  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          // deletion
          matrix[j - 1][i] + 1,
          // insertion
          matrix[j - 1][i - 1] + indicator
          // substitution
        );
      }
    }
    return matrix[str2.length][str1.length];
  }
};
var musicNerdService = new MusicNerdService();

// server/database-storage.ts
var DatabaseStorage = class {
  constructor() {
    if (!isDatabaseAvailable()) {
      throw new Error("Database connection not available");
    }
  }
  async getArtist(id) {
    if (!db) return void 0;
    try {
      const result = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error fetching artist:", error);
      return void 0;
    }
  }
  async getArtistByName(name) {
    if (!db) return void 0;
    try {
      const result = await db.select({
        id: artists.id,
        name: artists.name,
        webmapdata: artists.webmapdata
      }).from(artists).where(eq(artists.name, name)).limit(1);
      const artist = result[0];
      if (artist) {
        return {
          id: artist.id,
          name: artist.name,
          type: "artist",
          imageUrl: null,
          spotifyId: null,
          webmapdata: artist.webmapdata
        };
      }
      return void 0;
    } catch (error) {
      console.error("Error fetching artist by name:", error);
      return void 0;
    }
  }
  async createArtist(insertArtist) {
    if (!db) throw new Error("Database not available");
    try {
      const result = await db.insert(artists).values({
        name: insertArtist.name,
        type: insertArtist.type || "artist"
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating artist:", error);
      throw error;
    }
  }
  async getCollaborationsByArtist(artistId) {
    if (!db) return [];
    try {
      const result = await db.select().from(collaborations).where(eq(collaborations.fromArtistId, artistId));
      return result;
    } catch (error) {
      console.error("Error fetching collaborations:", error);
      return [];
    }
  }
  async createCollaboration(collaboration) {
    if (!db) throw new Error("Database not available");
    try {
      const result = await db.insert(collaborations).values(collaboration).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating collaboration:", error);
      throw error;
    }
  }
  async generateRealCollaborationNetwork(artistName) {
    const links = [];
    const nodeMap = /* @__PURE__ */ new Map();
    let musicNerdUrl = "https://musicnerd.xyz";
    try {
      const artistId = await musicNerdService.getArtistId(artistName);
      if (artistId) {
        musicNerdUrl = `https://musicnerd.xyz/artist/${artistId}`;
      }
    } catch (error) {
      console.log(`\u{1F4ED} [DEBUG] No MusicNerd ID found for main artist ${artistName}`);
    }
    const globalRoleMap = /* @__PURE__ */ new Map();
    const batchDetectRoles = async (peopleList) => {
      if (!openAIService.isServiceAvailable() || peopleList.length === 0) return;
      try {
        const peopleListStr = peopleList.map((name) => `"${name}"`).join(", ");
        const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}
        
Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;
        const OpenAI2 = await import("openai");
        const openai = new OpenAI2.default({
          apiKey: process.env.OPENAI_API_KEY
        });
        const roleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchRolePrompt }],
          temperature: 0.1,
          max_tokens: 1e3
        });
        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const rolesData = JSON.parse(roleContent);
            for (const [personName, roles] of Object.entries(rolesData)) {
              if (Array.isArray(roles) && roles.length > 0) {
                const validRoles = roles.filter((role) => ["artist", "producer", "songwriter"].includes(role));
                if (validRoles.length > 0) {
                  globalRoleMap.set(personName, validRoles);
                  console.log(`\u2705 [DEBUG] Batch detected roles for "${personName}":`, validRoles);
                }
              }
            }
          } catch (parseError) {
            console.log(`\u26A0\uFE0F [DEBUG] Could not parse batch role detection, falling back to defaults`);
          }
        }
      } catch (error) {
        console.log(`\u26A0\uFE0F [DEBUG] Batch role detection failed, falling back to defaults`);
      }
    };
    const getOptimizedRoles = (personName, defaultRole) => {
      return globalRoleMap.get(personName) || [defaultRole];
    };
    console.log(`\u{1F50D} [DEBUG] Detecting roles for main artist "${artistName}"...`);
    let mainArtistTypes = ["artist"];
    if (openAIService.isServiceAvailable()) {
      try {
        const mainArtistRolePrompt = `What roles does ${artistName} have in the music industry? Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. Return ONLY the JSON array, no other text.`;
        const OpenAI2 = await import("openai");
        const openai = new OpenAI2.default({
          apiKey: process.env.OPENAI_API_KEY
        });
        const roleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: mainArtistRolePrompt }],
          temperature: 0.1,
          max_tokens: 100
        });
        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const detectedRoles = JSON.parse(roleContent);
            if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
              const validRoles = detectedRoles.filter((role) => ["artist", "producer", "songwriter"].includes(role));
              if (validRoles.length > 0) {
                mainArtistTypes = validRoles;
                console.log(`\u2705 [DEBUG] Detected main artist roles for "${artistName}":`, mainArtistTypes);
                globalRoleMap.set(artistName, mainArtistTypes);
              }
            }
          } catch (parseError) {
            console.log(`\u26A0\uFE0F [DEBUG] Could not parse main artist role detection for "${artistName}", using default`);
          }
        }
      } catch (error) {
        console.log(`\u26A0\uFE0F [DEBUG] Main artist role detection failed for "${artistName}", using default`);
      }
    }
    const orderedMainArtistTypes = mainArtistTypes.includes("artist") ? ["artist", ...mainArtistTypes.filter((r) => r !== "artist")] : mainArtistTypes;
    const mainArtistNode = {
      id: artistName,
      name: artistName,
      type: orderedMainArtistTypes[0],
      // Primary type
      types: orderedMainArtistTypes,
      // All detected roles
      size: 30,
      // Larger size for main artist
      musicNerdUrl
    };
    nodeMap.set(artistName, mainArtistNode);
    console.log(`\u{1F3AD} [DEBUG] Main artist "${artistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);
    const getEnhancedRoles = (personName, defaultRole) => {
      return [defaultRole];
    };
    console.log(`\u{1F50D} [DEBUG] Starting collaboration network generation for: "${artistName}"`);
    console.log("\u{1F4CA} [DEBUG] Data source priority: 1) OpenAI \u2192 2) MusicBrainz \u2192 3) Wikipedia \u2192 4) Known collaborations fallback");
    try {
      if (openAIService.isServiceAvailable()) {
        console.log(`\u{1F916} [DEBUG] Querying OpenAI API for "${artistName}"...`);
        console.log(`\u{1F50D} [DEBUG] About to call openAIService.getArtistCollaborations for main artist: ${artistName}`);
        try {
          const openAIData = await openAIService.getArtistCollaborations(artistName);
          console.log(`\u2705 [DEBUG] OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map((a) => `${a.name} (${a.type}, top collaborators: ${a.topCollaborators.length})`)
          });
          if (openAIData.artists.length > 0) {
            const authenticCollaborators = openAIData.artists.filter((collaborator) => {
              const name = collaborator.name.toLowerCase();
              const fakePatterns = [
                "john doe",
                "jane doe",
                "john smith",
                "jane smith",
                "producer x",
                "songwriter y",
                "artist a",
                "artist b",
                "unknown",
                "anonymous",
                "various",
                "n/a",
                "tbd",
                "placeholder",
                "example",
                "sample"
              ];
              return !fakePatterns.some((pattern) => name.includes(pattern)) && !name.match(/^(artist|producer|songwriter)\s+[a-z]$/i) && !name.match(/^[a-z]{1,2}$/i);
            });
            console.log(`\u{1F50D} [DEBUG] Filtered ${openAIData.artists.length} to ${authenticCollaborators.length} authentic collaborators`);
            if (authenticCollaborators.length === 0) {
              console.log(`\u26A0\uFE0F [DEBUG] No authentic collaborators found for "${artistName}" from OpenAI, returning single node`);
              const finalNetworkData2 = {
                nodes: [mainArtistNode],
                links: []
              };
              await this.cacheNetworkData(artistName, finalNetworkData2);
              return finalNetworkData2;
            }
            const allPeople = /* @__PURE__ */ new Set();
            for (const collaborator of authenticCollaborators) {
              allPeople.add(collaborator.name);
              for (const branchingArtist of collaborator.topCollaborators || []) {
                if (branchingArtist !== artistName) {
                  allPeople.add(branchingArtist);
                }
              }
            }
            console.log(`\u{1F3AD} [DEBUG] Batch detecting roles for ${allPeople.size} people...`);
            await batchDetectRoles([...allPeople]);
            for (const collaborator of authenticCollaborators) {
              let collaboratorNode = nodeMap.get(collaborator.name);
              if (collaboratorNode) {
                if (!collaboratorNode.types) {
                  collaboratorNode.types = [collaboratorNode.type];
                }
                if (!collaboratorNode.types.includes(collaborator.type)) {
                  collaboratorNode.types.push(collaborator.type);
                  console.log(`\u{1F3AD} [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
                }
                collaboratorNode.type = collaboratorNode.types[0];
                if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
                  const existingCollaborators = collaboratorNode.collaborations || [];
                  const newCollaborators = collaborator.topCollaborators.filter((c) => !existingCollaborators.includes(c));
                  collaboratorNode.collaborations = [...existingCollaborators, ...newCollaborators];
                }
                continue;
              } else {
                const enhancedRoles = getOptimizedRoles(collaborator.name, collaborator.type);
                collaboratorNode = {
                  id: collaborator.name,
                  name: collaborator.name,
                  type: enhancedRoles[0],
                  // Primary role
                  types: enhancedRoles,
                  // All roles
                  size: 20,
                  imageUrl: null,
                  // Will be set in batch
                  spotifyId: null,
                  // Will be set in batch
                  collaborations: collaborator.topCollaborators || [],
                  musicNerdUrl: "https://musicnerd.xyz"
                  // Will be set in batch
                };
                console.log(`\u{1F3AD} [DEBUG] Enhanced "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
                nodeMap.set(collaborator.name, collaboratorNode);
              }
            }
            const allNodes = Array.from(nodeMap.values());
            const mainNode = nodeMap.get(artistName);
            for (const collaboratorNode of allNodes) {
              if (collaboratorNode.name !== artistName) {
                links.push({
                  source: mainNode.id,
                  target: collaboratorNode.id
                });
                const maxBranching = 3;
                const branchingCount = Math.min(collaboratorNode.collaborations?.length || 0, maxBranching);
                for (let i = 0; i < branchingCount; i++) {
                  const branchingArtist = collaboratorNode.collaborations[i];
                  let branchingNode = nodeMap.get(branchingArtist);
                  if (branchingNode) {
                    if (!branchingNode.types) {
                      branchingNode.types = [branchingNode.type];
                    }
                    if (!branchingNode.types.includes("artist")) {
                      branchingNode.types.push("artist");
                      console.log(`\u{1F3AD} [DEBUG] Added artist role to existing branching node ${branchingArtist} (now has ${branchingNode.types.length} roles)`);
                    }
                    branchingNode.type = branchingNode.types[0];
                  } else {
                    const enhancedBranchingRoles = getOptimizedRoles(branchingArtist, "artist");
                    branchingNode = {
                      id: branchingArtist,
                      name: branchingArtist,
                      type: enhancedBranchingRoles[0],
                      // Primary role
                      types: enhancedBranchingRoles,
                      // All roles
                      size: 16,
                      // Branching nodes size (updated from 15 to 16)
                      musicNerdUrl: "https://musicnerd.xyz"
                      // Will be set in batch
                    };
                    nodeMap.set(branchingArtist, branchingNode);
                    console.log(`\u{1F3AD} [DEBUG] Enhanced OpenAI branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                  }
                  links.push({
                    source: collaboratorNode.name,
                    target: branchingArtist
                  });
                  console.log(`\u{1F31F} [DEBUG] Added branching artist "${branchingArtist}" connected to multi-role "${collaboratorNode.name}"`);
                }
                const rolesList = collaboratorNode.types?.join(" + ") || collaboratorNode.type;
                console.log(`\u2795 [DEBUG] Added ${rolesList}: ${collaboratorNode.name} from OpenAI with ${branchingCount} branching connections`);
              }
            }
            console.log(`\u26A1 [DEBUG] Batch processing external APIs for ${nodeMap.size} nodes...`);
            const allNodesForBatch = Array.from(nodeMap.values());
            const nodeNames = allNodesForBatch.map((node) => node.name);
            const [spotifyResults, musicNerdResults] = await Promise.all([
              // Batch Spotify searches
              spotifyService.isConfigured() ? Promise.allSettled(nodeNames.map(async (name) => {
                try {
                  const artist = await spotifyService.searchArtist(name);
                  return { name, artist };
                } catch (error) {
                  return { name, artist: null };
                }
              })) : Promise.resolve([]),
              // Batch MusicNerd ID lookups
              Promise.allSettled(nodeNames.map(async (name) => {
                try {
                  const artistId = await musicNerdService.getArtistId(name);
                  return { name, artistId };
                } catch (error) {
                  return { name, artistId: null };
                }
              }))
            ]);
            if (spotifyResults.length > 0) {
              for (const result of spotifyResults) {
                if (result.status === "fulfilled" && result.value.artist) {
                  const node = nodeMap.get(result.value.name);
                  if (node) {
                    node.imageUrl = spotifyService.getArtistImageUrl(result.value.artist, "medium");
                    node.spotifyId = result.value.artist.id;
                  }
                }
              }
            }
            for (const result of musicNerdResults) {
              if (result.status === "fulfilled" && result.value.artistId) {
                const node = nodeMap.get(result.value.name);
                if (node) {
                  node.musicNerdUrl = `https://musicnerd.xyz/artist/${result.value.artistId}`;
                }
              }
            }
            const nodes2 = Array.from(nodeMap.values());
            console.log(`\u2705 [DEBUG] Successfully created network from OpenAI data: ${nodes2.length} total nodes (including main artist) for "${artistName}"`);
            const finalNetworkData = { nodes: nodes2, links };
            console.log(`\u{1F4BE} [DEBUG] About to cache OpenAI network data for "${artistName}" with ${nodes2.length} nodes`);
            await this.cacheNetworkData(artistName, finalNetworkData);
            return finalNetworkData;
          } else {
            console.log(`\u26A0\uFE0F [DEBUG] No collaborators found for "${artistName}" from OpenAI, returning single node`);
            const finalNetworkData = {
              nodes: [nodeMap.get(artistName)],
              links: []
            };
            await this.cacheNetworkData(artistName, finalNetworkData);
            return finalNetworkData;
          }
        } catch (error) {
          console.error(`\u274C [DEBUG] OpenAI API error for "${artistName}":`, error);
          console.log("\u{1F504} [DEBUG] Falling back to MusicBrainz...");
        }
      } else {
        console.log("\u26A0\uFE0F [DEBUG] OpenAI service not available, falling back to MusicBrainz...");
      }
      console.log(`\u{1F3B5} [DEBUG] Querying MusicBrainz API for "${artistName}"...`);
      console.log(`\u{1F50D} [DEBUG] About to call musicBrainzService.getArtistCollaborations for main artist: ${artistName}`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      console.log(`\u{1F50D} [DEBUG] Completed musicBrainzService.getArtistCollaborations for main artist: ${artistName}`);
      console.log(`\u2705 [DEBUG] MusicBrainz response:`, {
        artists: collaborationData.artists.length,
        works: collaborationData.works.length,
        artistList: collaborationData.artists.map((a) => `${a.name} (${a.type}, relation: ${a.relation})`),
        worksList: collaborationData.works.map((w) => `${w.title} with [${w.collaborators.join(", ")}]`)
      });
      let mainArtistImage = null;
      let mainArtistSpotifyId = null;
      if (spotifyService.isConfigured()) {
        try {
          const spotifyArtist = await spotifyService.searchArtist(artistName);
          if (spotifyArtist) {
            mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist, "medium");
            mainArtistSpotifyId = spotifyArtist.id;
          }
        } catch (error) {
          console.warn(`Could not fetch Spotify data for ${artistName}`);
        }
      }
      let mainArtistMusicNerdId = null;
      try {
        mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
      } catch (error) {
        console.log(`Could not fetch MusicNerd ID for ${artistName}`);
      }
      const mainArtistNodeFromMap = nodeMap.get(artistName);
      mainArtistNodeFromMap.imageUrl = mainArtistImage;
      mainArtistNodeFromMap.spotifyId = mainArtistSpotifyId;
      mainArtistNodeFromMap.artistId = mainArtistMusicNerdId;
      console.log(`\u{1F3A8} [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      const artists2 = collaborationData.artists.filter((c) => c.type === "artist");
      const producers = collaborationData.artists.filter((c) => c.type === "producer").slice(0, 5);
      const songwriters = collaborationData.artists.filter((c) => c.type === "songwriter").slice(0, 5);
      const limitedCollaborators = [...artists2, ...producers, ...songwriters];
      console.log(`\u26A1 [DEBUG] Limited to ${limitedCollaborators.length} collaborators (${producers.length} producers, ${songwriters.length} songwriters, ${artists2.length} artists)`);
      for (const collaborator of limitedCollaborators) {
        console.log(`\u{1F464} [DEBUG] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type}, relation: ${collaborator.relation})`);
        let collaboratorImage = null;
        let collaboratorSpotifyId = null;
        if (spotifyService.isConfigured()) {
          try {
            console.log(`\u{1F3A7} [DEBUG] Fetching Spotify data for "${collaborator.name}"...`);
            const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
            if (spotifyCollaborator) {
              collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, "medium");
              collaboratorSpotifyId = spotifyCollaborator.id;
              console.log(`\u2705 [DEBUG] Found Spotify profile for "${collaborator.name}": ${collaboratorSpotifyId}`);
            } else {
              console.log(`\u274C [DEBUG] No Spotify profile found for "${collaborator.name}"`);
            }
          } catch (error) {
            console.log(`\u26A0\uFE0F [DEBUG] Spotify lookup failed for "${collaborator.name}": ${error}`);
          }
        } else {
          console.log(`\u{1F512} [DEBUG] Spotify not configured, skipping image lookup for "${collaborator.name}"`);
        }
        let collaboratorMusicNerdId = null;
        if (collaborator.type === "artist") {
          try {
            collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
          }
        }
        let topCollaborators = [];
        if (collaborator.type === "producer" || collaborator.type === "songwriter") {
          try {
            console.log(`\u{1F50D} [DEBUG] Fetching authentic collaborations for ${collaborator.type} "${collaborator.name}"`);
            const producerCollaborations = await musicBrainzService.getArtistCollaborations(collaborator.name);
            const allCollaborators = [];
            if (producerCollaborations && producerCollaborations.artists.length > 0) {
              const artistCollaborators = producerCollaborations.artists.filter((c) => c.name !== collaborator.name && c.type === "artist").map((c) => c.name);
              allCollaborators.push(...artistCollaborators);
              const otherProducers = producerCollaborations.artists.filter((c) => c.name !== collaborator.name && (c.type === "producer" || c.type === "songwriter")).map((c) => c.name);
              allCollaborators.push(...otherProducers);
              topCollaborators = Array.from(new Set(allCollaborators)).slice(0, 3);
              console.log(`\u2705 [DEBUG] Found ${topCollaborators.length} authentic collaborations for "${collaborator.name}":`, topCollaborators);
              const maxBranchingNodes = collaborator.type === "songwriter" ? 3 : 2;
              const branchingArtists = artistCollaborators.filter((artistName2) => artistName2 !== collaborator.name).slice(0, maxBranchingNodes);
              console.log(`\u{1F3A8} [DEBUG] Creating ${branchingArtists.length} branching connections for ${collaborator.type} "${collaborator.name}"`);
              if (branchingArtists.length > 0 && collaborator.type === "songwriter") {
                console.log(`\u{1F4DD} [DEBUG] Songwriter "${collaborator.name}" branching to artists:`, branchingArtists);
              }
              for (const branchingArtist of branchingArtists) {
                let branchingNode = nodeMap.get(branchingArtist);
                if (branchingNode) {
                  if (!branchingNode.types) {
                    branchingNode.types = [branchingNode.type];
                  }
                  if (!branchingNode.types.includes("artist")) {
                    branchingNode.types.push("artist");
                    console.log(`\u{1F3AD} [DEBUG] Added artist role to existing branching node ${branchingArtist} (now has ${branchingNode.types.length} roles)`);
                  }
                  if (!branchingNode.collaborations) {
                    branchingNode.collaborations = [];
                  }
                  if (!branchingNode.collaborations.includes(collaborator.name)) {
                    branchingNode.collaborations.push(collaborator.name);
                  }
                  branchingNode.type = branchingNode.types[0];
                } else {
                  console.log(`\u{1F31F} [DEBUG] Adding branching artist "${branchingArtist}" connected to ${collaborator.type} "${collaborator.name}"`);
                  const enhancedBranchingRoles = getEnhancedRoles(branchingArtist, "artist");
                  let branchingArtistId = null;
                  try {
                    branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                  } catch (error) {
                    console.log(`Could not fetch MusicNerd ID for branching artist ${branchingArtist}`);
                  }
                  branchingNode = {
                    id: branchingArtist,
                    name: branchingArtist,
                    type: enhancedBranchingRoles[0],
                    // Primary role
                    types: enhancedBranchingRoles,
                    // All roles
                    size: 15,
                    // Branching nodes size
                    imageUrl: null,
                    spotifyId: null,
                    artistId: branchingArtistId,
                    collaborations: [collaborator.name]
                    // Show connection to the producer/songwriter
                  };
                  nodeMap.set(branchingArtist, branchingNode);
                  console.log(`\u{1F3AD} [DEBUG] Enhanced branching "${branchingArtist}" to roles:`, enhancedBranchingRoles);
                }
                links.push({
                  source: collaborator.name,
                  target: branchingArtist
                });
                console.log(`\u{1F517} [DEBUG] Created branching link: "${collaborator.name}" \u2194 "${branchingArtist}"`);
              }
            }
            if (topCollaborators.length < 3) {
              topCollaborators = [artistName, ...topCollaborators];
              topCollaborators = Array.from(new Set(topCollaborators)).slice(0, 3);
              console.log(`\u{1F4DD} [DEBUG] Enhanced collaborations for "${collaborator.name}" with main artist:`, topCollaborators);
            }
          } catch (error) {
            console.log(`\u274C [DEBUG] Error fetching collaborations for "${collaborator.name}":`, error);
            const networkCollaborators = collaborationData.artists.filter((c) => c.name !== collaborator.name && c.name !== artistName).map((c) => c.name);
            topCollaborators = [artistName, ...networkCollaborators.slice(0, 2)];
            console.log(`\u{1F504} [DEBUG] Using network fallback for "${collaborator.name}":`, topCollaborators);
          }
        }
        let collaboratorNode = nodeMap.get(collaborator.name);
        if (collaboratorNode) {
          if (!collaboratorNode.types) {
            collaboratorNode.types = [collaboratorNode.type];
          }
          if (!collaboratorNode.types.includes(collaborator.type)) {
            collaboratorNode.types.push(collaborator.type);
            console.log(`\u{1F3AD} [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
          }
          if (topCollaborators.length > 0) {
            const existingCollabs = collaboratorNode.collaborations || [];
            const newCollabs = topCollaborators.filter((c) => !existingCollabs.includes(c));
            collaboratorNode.collaborations = [...existingCollabs, ...newCollabs];
          }
        } else {
          const enhancedRoles = getEnhancedRoles(collaborator.name, collaborator.type);
          collaboratorNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: enhancedRoles[0],
            // Primary role
            types: enhancedRoles,
            // All roles
            size: 20,
            imageUrl: collaboratorImage,
            spotifyId: collaboratorSpotifyId,
            artistId: collaboratorMusicNerdId,
            collaborations: topCollaborators.length > 0 ? topCollaborators : void 0
          };
          nodeMap.set(collaborator.name, collaboratorNode);
          console.log(`\u{1F3AD} [DEBUG] Enhanced MusicBrainz "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
        }
        console.log(`\u2795 [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from MusicBrainz relation "${collaborator.relation}"`);
        links.push({
          source: artistName,
          target: collaborator.name
        });
        console.log(`\u{1F517} [DEBUG] Created link: "${artistName}" \u2194 "${collaborator.name}"`);
      }
      if (collaborationData.artists.length === 0) {
        console.log(`\u{1F50D} [DEBUG] No MusicBrainz collaborations found for "${artistName}", trying Wikipedia fallback...`);
        try {
          const wikipediaCollaborators = await wikipediaService.getArtistCollaborations(artistName);
          console.log(`\u{1F4D6} [DEBUG] Wikipedia response for "${artistName}":`, {
            collaborators: wikipediaCollaborators.length,
            collaboratorList: wikipediaCollaborators.map((c) => `${c.name} (${c.type}, context: "${c.context.substring(0, 50)}...")`)
          });
          if (wikipediaCollaborators.length > 0) {
            console.log(`\u2705 [DEBUG] Using Wikipedia data - found ${wikipediaCollaborators.length} collaborators`);
            for (const collaborator of wikipediaCollaborators) {
              console.log(`\u{1F464} [DEBUG] Processing Wikipedia collaborator: "${collaborator.name}" (type: ${collaborator.type})`);
              console.log(`\u{1F4DD} [DEBUG] Wikipedia context: "${collaborator.context}"`);
              let collaboratorImage = null;
              let collaboratorSpotifyId = null;
              if (spotifyService.isConfigured()) {
                try {
                  console.log(`\u{1F3A7} [DEBUG] Fetching Spotify data for Wikipedia collaborator "${collaborator.name}"...`);
                  const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
                  if (spotifyCollaborator) {
                    collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, "medium");
                    collaboratorSpotifyId = spotifyCollaborator.id;
                    console.log(`\u2705 [DEBUG] Found Spotify profile for Wikipedia collaborator "${collaborator.name}": ${collaboratorSpotifyId}`);
                  } else {
                    console.log(`\u274C [DEBUG] No Spotify profile found for Wikipedia collaborator "${collaborator.name}"`);
                  }
                } catch (error) {
                  console.log(`\u26A0\uFE0F [DEBUG] Spotify lookup failed for Wikipedia collaborator "${collaborator.name}": ${error}`);
                }
              }
              let collaboratorMusicNerdId = null;
              if (collaborator.type === "artist") {
                try {
                  collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
                } catch (error) {
                  console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
                }
              }
              let topCollaborators = [];
              if (collaborator.type === "producer" || collaborator.type === "songwriter") {
                const otherCollaborators = wikipediaCollaborators.filter((c) => c.name !== collaborator.name && c.name !== artistName).slice(0, 2).map((c) => c.name);
                topCollaborators = [artistName, ...otherCollaborators];
              }
              let collaboratorNode = nodeMap.get(collaborator.name);
              if (collaboratorNode) {
                if (!collaboratorNode.types) {
                  collaboratorNode.types = [collaboratorNode.type];
                }
                if (!collaboratorNode.types.includes(collaborator.type)) {
                  collaboratorNode.types.push(collaborator.type);
                  console.log(`\u{1F3AD} [DEBUG] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collaboratorNode.types.length} roles)`);
                }
                if (topCollaborators.length > 0) {
                  const existingCollabs = collaboratorNode.collaborations || [];
                  const newCollabs = topCollaborators.filter((c) => !existingCollabs.includes(c));
                  collaboratorNode.collaborations = [...existingCollabs, ...newCollabs];
                }
              } else {
                const enhancedRoles = getEnhancedRoles(collaborator.name, collaborator.type);
                collaboratorNode = {
                  id: collaborator.name,
                  name: collaborator.name,
                  type: enhancedRoles[0],
                  // Primary role
                  types: enhancedRoles,
                  // All roles
                  size: 20,
                  imageUrl: collaboratorImage,
                  spotifyId: collaboratorSpotifyId,
                  artistId: collaboratorMusicNerdId,
                  collaborations: topCollaborators.length > 0 ? topCollaborators : void 0
                };
                nodeMap.set(collaborator.name, collaboratorNode);
                console.log(`\u{1F3AD} [DEBUG] Enhanced Wikipedia "${collaborator.name}" from ${collaborator.type} to roles:`, enhancedRoles);
              }
              console.log(`\u2795 [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from Wikipedia context`);
              links.push({
                source: artistName,
                target: collaborator.name
              });
              console.log(`\u{1F517} [DEBUG] Created link: "${artistName}" \u2194 "${collaborator.name}" (Wikipedia source)`);
            }
            console.log(`\u2705 [DEBUG] Successfully created network from Wikipedia data: ${wikipediaCollaborators.length} collaborators for "${artistName}"`);
            const nodes3 = Array.from(nodeMap.values());
            const networkData3 = { nodes: nodes3, links };
            console.log(`\u{1F4BE} [DEBUG] About to cache Wikipedia network data for "${artistName}" with ${nodes3.length} nodes`);
            await this.cacheNetworkData(artistName, networkData3);
            return networkData3;
          } else {
            console.log(`\u274C [DEBUG] Wikipedia returned 0 collaborators for "${artistName}"`);
          }
        } catch (error) {
          console.error(`\u26A0\uFE0F [DEBUG] Error fetching Wikipedia collaborations for "${artistName}":`, error);
        }
        console.log(`\u{1F6A8} [DEBUG] No real collaboration data found for "${artistName}" from either MusicBrainz or Wikipedia`);
        const artistNameLower = artistName.toLowerCase();
        const knownCollaborations = {
          "taylor swift": [
            { name: "Jack Antonoff", type: "songwriter", relation: "co-writer" },
            { name: "Max Martin", type: "songwriter", relation: "co-writer" },
            { name: "Shellback", type: "songwriter", relation: "co-writer" },
            { name: "Aaron Dessner", type: "songwriter", relation: "co-writer" }
          ]
        };
        if (knownCollaborations[artistNameLower]) {
          console.log(`\u2728 [DEBUG] Adding known authentic collaborators for "${artistName}"`);
          const fallbackArtists = knownCollaborations[artistNameLower];
          for (const collab of fallbackArtists) {
            let collaboratorNode = nodeMap.get(collab.name);
            if (collaboratorNode) {
              if (!collaboratorNode.types) {
                collaboratorNode.types = [collaboratorNode.type];
              }
              if (!collaboratorNode.types.includes(collab.type)) {
                collaboratorNode.types.push(collab.type);
                console.log(`\u{1F3AD} [DEBUG] Added ${collab.type} role to existing ${collab.name} node (now has ${collaboratorNode.types.length} roles)`);
              }
            } else {
              collaboratorNode = {
                id: collab.name,
                name: collab.name,
                type: collab.type,
                types: [collab.type],
                size: 20
              };
              let musicNerdUrl2 = "https://musicnerd.xyz";
              try {
                const artistId = await musicNerdService.getArtistId(collab.name);
                if (artistId) {
                  musicNerdUrl2 = `https://musicnerd.xyz/artist/${artistId}`;
                  console.log(`\u2705 [DEBUG] Found MusicNerd ID for ${collab.name}: ${artistId}`);
                }
              } catch (error) {
                console.log(`\u{1F4ED} [DEBUG] No MusicNerd ID found for ${collab.name}`);
              }
              collaboratorNode.musicNerdUrl = musicNerdUrl2;
              nodeMap.set(collab.name, collaboratorNode);
            }
            links.push({
              source: artistName,
              target: collaboratorNode.id
            });
            console.log(`\u2728 [DEBUG] Added known authentic collaborator: ${collab.name} (${collab.type})`);
          }
        } else {
          console.log(`\u{1F464} [DEBUG] Returning only the main artist node without any collaborators`);
        }
        const nodes2 = Array.from(nodeMap.values());
        const networkData2 = { nodes: nodes2, links };
        await this.cacheNetworkData(artistName, networkData2);
        return networkData2;
      } else {
        console.log(`\u2705 [DEBUG] Successfully created network from MusicBrainz data: ${collaborationData.artists.length} collaborators for "${artistName}"`);
      }
      const nodes = Array.from(nodeMap.values());
      const networkData = { nodes, links };
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
    } catch (error) {
      console.error("Error generating real collaboration network:", error);
      const nodes = Array.from(nodeMap.values());
      const networkData = { nodes, links };
      await this.cacheNetworkData(artistName, networkData);
      return networkData;
    }
  }
  async cacheNetworkData(artistName, networkData) {
    if (!db) {
      console.log(`\u26A0\uFE0F [DEBUG] Database not available - skipping cache for "${artistName}"`);
      return;
    }
    try {
      console.log(`\u{1F4BE} [DEBUG] Caching webmapdata for "${artistName}"`);
      const existingArtist = await this.getArtistByName(artistName);
      if (existingArtist) {
        await db.execute(sql`
          UPDATE artists 
          SET webmapdata = ${JSON.stringify(networkData)}::jsonb 
          WHERE name = ${artistName}
        `);
        console.log(`\u2705 [DEBUG] Updated webmapdata cache for existing artist "${artistName}"`);
      } else {
        console.log(`\u274C [DEBUG] Artist "${artistName}" does not exist in database - skipping cache creation`);
      }
    } catch (error) {
      console.error(`\u274C [DEBUG] Error caching webmapdata for "${artistName}":`, error);
      console.error(`\u274C [DEBUG] Full error details:`, {
        message: error?.message,
        code: error?.code,
        detail: error?.detail
      });
    }
  }
  async getNetworkData(artistName) {
    console.log(`\u{1F504} [DEBUG] Force regenerating network data for "${artistName}" with data-only approach (cache cleared)`);
    const artist = await this.getArtistByName(artistName);
    if (!artist) {
      console.log(`\u274C [DEBUG] Artist "${artistName}" not found in database`);
      return null;
    }
    console.log(`\u{1F195} [DEBUG] No cached data found for "${artistName}" - generating new network data`);
    const enhancedMusicBrainzArtists = ["Post Malone", "The Weeknd", "Ariana Grande", "Billie Eilish", "Taylor Swift", "Drake"];
    const mainArtist = await this.getArtistByName(artistName);
    if (!mainArtist) {
      console.log(`\u274C [DEBUG] Artist "${artistName}" does not exist in database - cannot generate network`);
      throw new Error(`Artist "${artistName}" not found in database. Please search for an existing artist.`);
    }
    if (enhancedMusicBrainzArtists.includes(mainArtist.name)) {
      console.log(`\u{1F3B5} [DEBUG] Using enhanced MusicBrainz data for "${mainArtist.name}" to showcase deep producer/songwriter networks`);
      const networkData = await this.generateRealCollaborationNetwork(mainArtist.name);
      await this.cacheNetworkData(mainArtist.name, networkData);
      return networkData;
    }
    const artistId = String(mainArtist.id);
    if (artistId.includes("-")) {
      console.log(`\u{1F3B5} [DEBUG] Found MusicNerd artist "${mainArtist.name}" - generating real collaboration network`);
      return this.generateRealCollaborationNetwork(mainArtist.name);
    }
    const nodes = [];
    const links = [];
    const mainArtistNode = {
      id: mainArtist.name,
      name: mainArtist.name,
      type: mainArtist.type,
      size: 30,
      imageUrl: mainArtist.imageUrl,
      spotifyId: mainArtist.spotifyId
    };
    nodes.push(mainArtistNode);
    const artistCollaborations = await this.getCollaborationsByArtist(mainArtist.id);
    for (const collab of artistCollaborations) {
      const collaborator = await this.getArtist(collab.toArtistId);
      if (collaborator) {
        const collaboratorNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type,
          size: 20,
          imageUrl: collaborator.imageUrl,
          spotifyId: collaborator.spotifyId
        };
        nodes.push(collaboratorNode);
        links.push({
          source: mainArtist.name,
          target: collaborator.name
        });
      }
    }
    return { nodes, links };
  }
};
export {
  DatabaseStorage
};
