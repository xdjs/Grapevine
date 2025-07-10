import { eq, sql } from "drizzle-orm";
import { db, isDatabaseAvailable } from "./supabase.js";
import { artists, collaborations } from "../shared/schema.js";
import { spotifyService } from "./spotify.js";
import { openAIService } from "./openai-service.js";
import { musicBrainzService } from "./musicbrainz.js";
import { wikipediaService } from "./wikipedia.js";
import { musicNerdService } from "./musicnerd-service.js";
class DatabaseStorage {
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
        const OpenAI = await import("openai");
        const openai = new OpenAI.default({
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
        const OpenAI = await import("openai");
        const openai = new OpenAI.default({
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
        console.log(`\u{1F50D} [DEBUG] About to call openAIService.getArtistCollaborations for main artist:`, artistName);
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
}
export {
  DatabaseStorage
};
