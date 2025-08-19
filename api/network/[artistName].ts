import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NetworkNode {
  id: string;
  name: string;
  type: string;
  types: string[];
  color: string;
  size: number;
  artistId: string | null;
  collaborations?: string[];
  imageUrl?: string | null;
  spotifyId?: string | null;
  source?: string;
  collaborationType?: string;
  verificationLevel?: string;
}

interface NetworkLink {
  source: string;
  target: string;
}

interface Collaborator {
  name: string;
  type: string;
  topCollaborators: string[];
}

interface CollaborationData {
  collaborators?: Array<{
    name: string;
    roles: string[];
    topCollaborators: string[];
  }>;
  artists?: Collaborator[];
}

// Add artist name normalization function
function normalizeArtistName(name: string): string {
  // Remove parenthetical information like "(French Kiwi Juice)"
  let normalized = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  
  // Remove common suffixes that might cause mismatches
  normalized = normalized.replace(/\s+(aka|also known as|formerly)\s+.*$/i, '').trim();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Add enhanced artist lookup function
async function findArtistInDatabase(client: any, artistName: string): Promise<{id: string, name: string} | null> {
  const variations = [
    artistName, // Original name
    normalizeArtistName(artistName), // Normalized name
  ];
  
  // Remove duplicates
  const uniqueVariations = [...new Set(variations)];
  
  for (const variation of uniqueVariations) {
    if (!variation || variation.length < 2) continue;
    
    console.log(`🔍 [Vercel] Trying artist lookup with variation: "${variation}"`);
    
    const query = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
    const result = await client.query(query, [variation]);
    
    if (result.rows.length > 0) {
      console.log(`✅ [Vercel] Found match for "${artistName}" using variation "${variation}": "${result.rows[0].name}" (${result.rows[0].id})`);
      return {
        id: result.rows[0].id.toString(),
        name: result.rows[0].name
      };
    }
  }
  
  console.log(`📭 [Vercel] No database match found for "${artistName}" with any variation`);
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const { artistName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      res.status(400).json({ message: 'Artist name is required' });
      return;
    }

    console.log(`🎵 [Vercel] Network data request for: ${artistName}`);
    console.log(`🎵 [Vercel] Function started at:`, new Date().toISOString());
    console.log(`🎵 [Vercel] Environment check - CONNECTION_STRING exists:`, !!process.env.CONNECTION_STRING);
    console.log(`🎵 [Vercel] Environment check - OPENAI_API_KEY exists:`, !!process.env.OPENAI_API_KEY);
    console.log(`🎵 [Vercel] Node.js version:`, process.version);
    console.log(`🎵 [Vercel] Request headers:`, JSON.stringify(req.headers, null, 2));
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      console.error('❌ [Vercel] Available env vars:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
      res.status(500).json({ message: 'Database connection not configured' });
      return;
    }

    try {
      // First, check if we have cached data
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // First check if artist exists in database and get the correct capitalization
      const artistMatch = await findArtistInDatabase(client, artistName);
      
      if (!artistMatch) {
        await client.end();
        res.status(404).json({ 
          message: `Artist "${artistName}" not found in database. Please search for an existing artist.`
        });
        return;
      }
      
      // Use the correct artist name from database (with proper capitalization)
      const correctArtistName = artistMatch.name;
      
      // Skip cache and force fresh generation for all artists with data-only approach
      console.log(`🔄 [Vercel] Skipping cache and forcing fresh generation for ${artistName} with data-only approach`);
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        console.error(`❌ [Vercel] OpenAI API key not configured for ${artistName}`);
        await client.end();
        res.status(503).json({ 
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Generate new network data using OpenAI
      console.log(`🤖 [Vercel] Generating network for ${artistName} using OpenAI service`);
      
      // Import and use our OpenAI service instead of calling OpenAI directly
      const { openAIService } = await import('../../server/openai-service.js');
      
      if (!openAIService.isServiceAvailable()) {
        console.error(`❌ [Vercel] OpenAI service not available for ${artistName}`);
        await client.end();
        res.status(503).json({ 
          error: 'OpenAI service not available',
          message: 'OpenAI service is not properly configured.',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get collaborations using our enhanced service
      console.log(`🎵 [Vercel] Fetching collaborations for ${correctArtistName} using enhanced OpenAI service`);
      const collaborationResult = await openAIService.getArtistCollaborations(correctArtistName);
      
      // Also get Spotify "appears on" collaborations to enhance the network
      let spotifyCollaborations: any = { artists: [] };
      try {
        console.log(`🎵 [Vercel] Fetching real Spotify "appears on" data for ${correctArtistName}`);
        
        // Import and use the Spotify service to get real data
        const { spotifyService } = await import('../../server/spotify.js');
        
        if (spotifyService.isConfigured()) {
          const spotifyCollaborators = await spotifyService.getArtistAppearsOn(correctArtistName);
          
          // Transform Spotify API data to our expected format
          spotifyCollaborations = {
            artists: spotifyCollaborators.map(collaborator => ({
              name: collaborator.name,
              type: collaborator.type,
              topCollaborators: collaborator.topCollaborators || [],
              source: 'spotify_api_real',
              collaborationType: collaborator.collaborationType,
              verificationLevel: collaborator.verificationLevel,
              spotifyUrl: collaborator.spotifyUrl
            }))
          };
          
          console.log(`🎵 [Vercel] Real Spotify API returned ${spotifyCollaborations.artists.length} verified collaborators`);
        } else {
          console.log(`⚠️ [Vercel] Spotify service not configured, skipping "appears on" data`);
        }
      } catch (error) {
        console.warn(`⚠️ [Vercel] Could not fetch real Spotify "appears on" data for ${correctArtistName}:`, error);
      }

      // Merge and deduplicate collaboration data
      const allCollaborators = new Map<string, any>();
      
      // Add main OpenAI collaborators first
      for (const collaborator of collaborationResult.artists) {
        allCollaborators.set(collaborator.name, {
          ...collaborator,
          source: 'openai_general'
        });
      }
      
      // Add Spotify "appears on" collaborators, avoiding duplicates
      for (const collaborator of spotifyCollaborations.artists) {
        if (!allCollaborators.has(collaborator.name)) {
          // Map Spotify collaborator to our expected format
          allCollaborators.set(collaborator.name, {
            name: collaborator.name,
            type: collaborator.type,
            topCollaborators: collaborator.topCollaborators || [],
            source: 'spotify_api_real',
            collaborationType: collaborator.collaborationType,
            verificationLevel: collaborator.verificationLevel,
            spotifyUrl: collaborator.spotifyUrl
          });
          console.log(`🎵 [Vercel] Added real Spotify "appears on" collaborator: "${collaborator.name}" (${collaborator.collaborationType}, ${collaborator.verificationLevel})`);
        } else {
          // Enhance existing collaborator with Spotify data
          const existing = allCollaborators.get(collaborator.name);
          existing.source = 'openai_general+spotify_api_real';
          existing.collaborationType = collaborator.collaborationType;
          existing.verificationLevel = collaborator.verificationLevel;
          existing.spotifyUrl = collaborator.spotifyUrl;
          console.log(`🎵 [Vercel] Enhanced existing collaborator "${collaborator.name}" with real Spotify data`);
        }
      }
      
      // Convert back to array
      const enhancedCollaborations = Array.from(allCollaborators.values());
      
      console.log(`🎵 [Vercel] Combined collaboration data: ${enhancedCollaborations.length} total collaborators (${collaborationResult.artists.length} from general OpenAI, ${spotifyCollaborations.artists.length} from real Spotify API)`);

      // Transform to the expected format for the network
      const collaborators = enhancedCollaborations.map(collaborator => ({
        name: collaborator.name,
        roles: [collaborator.type],
        topCollaborators: collaborator.topCollaborators || [],
        source: collaborator.source,
        collaborationType: collaborator.collaborationType,
        verificationLevel: collaborator.verificationLevel
      }));

      // Build network data structure with comprehensive role consistency
      const nodeMap = new Map<string, NetworkNode>();
      const links: NetworkLink[] = [];

      // Create optimized evidence-based batch role detection system for performance
      const globalRoleMap = new Map<string, string[]>();
      const { roleService } = await import('../../server/role-service.js');

      const batchDetectRoles = async (peopleList: string[]): Promise<void> => {
        if (peopleList.length === 0) return;
        const results = await Promise.allSettled(
          peopleList.map(async (name) => ({ name, roles: (await roleService.computeRoles(name, { includeArtistByDefault: false })).roles }))
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const validRoles = (r.value.roles || []).filter((x: string) => ['artist','producer','songwriter'].includes(x));
            if (validRoles.length > 0) {
              globalRoleMap.set(r.value.name, validRoles);
              console.log(`✅ [Vercel] Evidence-based roles for "${r.value.name}":`, validRoles);
            }
          }
        }
      };
      
      // Quick role lookup with fallback to default
      const getOptimizedRoles = (personName: string, defaultRole: string): string[] => {
        return globalRoleMap.get(personName) || [defaultRole];
      };

      // Pre-detect roles for main artist with dedicated evidence-based detection
      console.log(`🔍 [Vercel] Detecting roles for main artist "${correctArtistName}"...`);
      let mainArtistTypes = ['artist']; // Default
      
      try {
        const result = await roleService.computeRoles(correctArtistName, { includeArtistByDefault: true });
        const validRoles = (result.roles || []).filter(r => ['artist','producer','songwriter'].includes(r));
        if (validRoles.length > 0) {
          mainArtistTypes = validRoles;
          console.log(`✅ [Vercel] Evidence-based main artist roles for "${correctArtistName}":`, mainArtistTypes);
          globalRoleMap.set(correctArtistName, mainArtistTypes);
        }
      } catch {
        console.log(`⚠️ [Vercel] Main artist role detection failed for "${correctArtistName}", using default`);
      }
      
      // Ensure 'artist' is first for main artists if they have that role
      const orderedMainArtistTypes = mainArtistTypes.includes('artist') 
        ? ['artist', ...mainArtistTypes.filter(r => r !== 'artist')]
        : mainArtistTypes;

      // Add main artist node using correct capitalization from database and detected roles
      const mainNode = {
        id: correctArtistName,
        name: correctArtistName,
        type: orderedMainArtistTypes[0],
        types: orderedMainArtistTypes, // Always an array of all roles
        color: '#FF69B4',
        size: 30,
        artistId: artistMatch.id
      };
      nodeMap.set(correctArtistName, mainNode);
      
      console.log(`🎭 [Vercel] Main artist "${correctArtistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);

      // Collect all people for batch role detection
      const allPeople = new Set<string>();
      
      // Function to detect fake collaborators
      const isFakeCollaborator = (name: string): boolean => {
        const lowerName = name.toLowerCase();
        const fakePatterns = [
          'john doe', 'jane doe', 'john smith', 'jane smith', 'joe smith', 'mary johnson',
          'bob johnson', 'sarah williams', 'mike brown', 'lisa davis', 'test user', 'test artist',
          'artist a', 'artist b', 'artist c', 'artist d', 'artist e',
          'producer a', 'producer b', 'producer c', 'producer d', 'producer e',
          'songwriter a', 'songwriter b', 'songwriter c', 'songwriter d', 'songwriter e',
          'artist 1', 'artist 2', 'artist 3', 'artist 4', 'artist 5',
          'producer 1', 'producer 2', 'producer 3', 'producer 4', 'producer 5',
          'songwriter 1', 'songwriter 2', 'songwriter 3', 'songwriter 4', 'songwriter 5',
          'unknown', 'anonymous', 'various', 'n/a', 'tbd', 'to be determined',
          'placeholder', 'example', 'sample', 'fictional', 'generic', 'default'
        ];
        return fakePatterns.some(pattern => lowerName.includes(pattern)) ||
               !!lowerName.match(/^(artist|producer|songwriter)\s+[a-z]$/i) ||
               !!lowerName.match(/^[a-z]{1,2}$/i);
      };
      
        // Add main artist to batch role detection
        allPeople.add(correctArtistName);
        
      // Process collaborators and add to batch role detection
      for (const collaborator of collaborators) {
          // Skip fake collaborators
          if (isFakeCollaborator(collaborator.name)) {
            console.log(`🚫 [Vercel] Filtering out fake collaborator: "${collaborator.name}"`);
            continue;
          }
          
          allPeople.add(collaborator.name);
        // Add branching artists to the batch
          for (const branchingArtist of collaborator.topCollaborators || []) {
            if (branchingArtist !== correctArtistName && !isFakeCollaborator(branchingArtist)) {
              allPeople.add(branchingArtist);
          }
        }
      }
      
      // Track whether hallucinations were used
      let hallucinationsUsed = false;

      // If no collaborators found, return single node
      if (collaborators.length === 0) {
        console.log(`⚠️ [Vercel] No collaborators found for "${correctArtistName}", returning single node`);
          const networkData = { nodes: [mainNode], links: [] };
          await client.end();
          res.json(networkData);
          return;
      }
      
      // Batch detect roles for all people at once for performance
      console.log(`🎭 [Vercel] Batch detecting roles for ${allPeople.size} people...`);
      await batchDetectRoles([...allPeople]);

      // Process collaborators and create network nodes
      for (const collaborator of collaborators) {
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - add the new role to their types array
          if (!collabNode.types.includes(collaborator.type)) {
            collabNode.types.push(collaborator.type);
            // Ensure types is always unique and sorted
            collabNode.types = Array.from(new Set(collabNode.types)).sort();
            collabNode.type = collabNode.types[0];
          }
          // Update collaborations list
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter((c: string) => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
          // Update color for multi-role nodes
          if (collabNode.types.includes('artist') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#FF69B4'; // Keep artist color for artist-songwriters
          } else if (collabNode.types.includes('producer') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#8A2BE2'; // Keep producer color for producer-songwriters
          }
        } else {
          // Create new node with optimized role detection
          const enhancedRoles = getOptimizedRoles(collaborator.name, collaborator.type);
          const color = enhancedRoles.includes('producer') ? '#8A2BE2' : '#00CED1';
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: enhancedRoles[0],
            types: enhancedRoles, // Always an array of all roles
            color: color,
            size: 20,
            collaborations: collaborator.topCollaborators || [],
            source: collaborator.source,
            collaborationType: collaborator.collaborationType,
            verificationLevel: collaborator.verificationLevel
          };
          nodeMap.set(collaborator.name, collabNode);

          // Create link from main artist to collaborator
          links.push({
            source: correctArtistName,
            target: collaborator.name,
          });
        }
      }

      // Create branching nodes for top collaborators
      for (const collaborator of collaborators) {
        if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
          const maxBranching = 3;
          const branchingCount = Math.min(collaborator.topCollaborators.length, maxBranching);
          
          for (let i = 0; i < branchingCount; i++) {
            const branchingArtistName = collaborator.topCollaborators[i];
            
            // Skip if it's the main artist or already exists
            if (branchingArtistName === correctArtistName || nodeMap.has(branchingArtistName)) {
              continue;
            }
            
            // Get enhanced roles from batch detection, fallback to default
            const branchingArtistRoles = getOptimizedRoles(branchingArtistName, 'artist');

            // Create branching artist node
            const branchingArtistNode: NetworkNode = {
              id: branchingArtistName,
              name: branchingArtistName,
              type: branchingArtistRoles[0],
              types: branchingArtistRoles,
              size: 20,
              color: branchingArtistRoles.includes('producer') ? '#8A2BE2' : '#00CED1',
            };
            
            nodeMap.set(branchingArtistName, branchingArtistNode);

            // Create link from collaborator to branching artist
            links.push({
              source: collaborator.name,
              target: branchingArtistName,
            });
          }
        }
      }

      // Convert nodeMap to array for final response
      const nodes = Array.from(nodeMap.values());

      console.log(`🎭 [Vercel] Final network: ${nodes.length} nodes, ${links.length} links`);
      console.log(`🎵 [Vercel] Network sources: ${new Set(nodes.map(n => n.source).filter(Boolean)).size} different sources`);
      
      // Return the network data
      const networkData = { nodes, links };
      await client.end();
      res.json(networkData);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database/OpenAI error:', dbError);
      console.error('❌ [Vercel] Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Failed to generate network data', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
  } catch (error) {
    console.error("❌ [Vercel] Error fetching network data:", error);
    console.error('❌ [Vercel] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}