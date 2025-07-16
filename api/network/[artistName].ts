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
}

interface NetworkLink {
  source: string;
  target: string;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { artistName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
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
      return res.status(500).json({ message: 'Database connection not configured' });
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
      const artistExistsQuery = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
      const artistExistsResult = await client.query(artistExistsQuery, [artistName]);
      
      if (artistExistsResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ 
          message: `Artist "${artistName}" not found in database. Please search for an existing artist.`
        });
      }
      
      // Use the correct artist name from database (with proper capitalization)
      const correctArtistName = artistExistsResult.rows[0].name;
      
      // Skip cache and force fresh generation for all artists with data-only approach
      console.log(`🔄 [Vercel] Skipping cache and forcing fresh generation for ${artistName} with data-only approach`);
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        console.error(`❌ [Vercel] OpenAI API key not configured for ${artistName}`);
        await client.end();
        return res.status(503).json({ 
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate new network data using OpenAI
      console.log(`🤖 [Vercel] Generating network for ${artistName} using OpenAI`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Generate a comprehensive list of music industry professionals who have collaborated with ${correctArtistName}. Include people who work as producers, songwriters, or both. For each person, specify all their roles and their top 3 collaborating artists.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "roles": ["songwriter"],
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Important guidelines:
- Include music industry professionals who have actually worked with ${correctArtistName}
- For each person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Many professionals have multiple roles (e.g., Jack Antonoff is both producer and songwriter)
- Include their top 3 collaborating artists for each person
- Focus on real, verified collaborations from the music industry
- DO NOT generate fake or placeholder names like "Artist A", "Producer 1", "Songwriter X", etc.
- If you cannot find real collaborators, return an empty collaborators array
- Return ONLY the JSON object, no other text`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      let collaborationData: CollaborationData;
      try {
        const openaiContent = completion.choices[0]?.message?.content;
        console.log(`🤖 [Vercel] OpenAI response length: ${openaiContent?.length || 0} characters`);
        
        if (!openaiContent) {
          console.error('❌ [Vercel] OpenAI returned empty response');
          await client.end();
          return res.status(503).json({ 
            error: 'OpenAI API returned empty response',
            message: 'Failed to generate collaboration data from OpenAI',
            artist: artistName,
            timestamp: new Date().toISOString()
          });
        }
        
        // Try to extract JSON from OpenAI response (sometimes includes extra text)
        let jsonContent = openaiContent.trim();
        
        // Remove markdown code blocks if present
        jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        
        // Look for JSON object boundaries
        const jsonStart = jsonContent.indexOf('{');
        const jsonEnd = jsonContent.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
        }
        
        // Try parsing the extracted JSON
        try {
          collaborationData = JSON.parse(jsonContent);
        } catch (firstParseError) {
          // Fallback: try to create a minimal valid structure if parsing fails
          console.warn('❌ [Vercel] Primary JSON parse failed, trying fallback');
          collaborationData = { artists: [] };
        }
        console.log(`✅ [Vercel] Parsed collaboration data with ${collaborationData.collaborators?.length || collaborationData.artists?.length || 0} collaborators`);
      } catch (parseError) {
        console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
        console.error('❌ [Vercel] Raw OpenAI content:', completion.choices[0]?.message?.content);
        await client.end();
        return res.status(503).json({ 
          error: 'Failed to parse OpenAI response',
          message: 'OpenAI returned invalid JSON format',
          artist: artistName,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          timestamp: new Date().toISOString()
        });
      }

      // Build network data structure with comprehensive role consistency
      const nodeMap = new Map<string, NetworkNode>();
      const links: NetworkLink[] = [];

      // Create optimized batch role detection system for performance
      const globalRoleMap = new Map<string, string[]>();
      
      // Batch role detection function for better performance
      const batchDetectRoles = async (peopleList: string[]): Promise<void> => {
        if (peopleList.length === 0) return;
        
        try {
          const peopleListStr = peopleList.map(name => `"${name}"`).join(', ');
          const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}
          
Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;

          const openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
          });

          const roleCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: batchRolePrompt }],
            temperature: 0.1,
            max_tokens: 1000,
          });

          const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
          if (roleContent) {
            try {
              const rolesData = JSON.parse(roleContent);
              for (const [personName, roles] of Object.entries(rolesData)) {
                if (Array.isArray(roles) && roles.length > 0) {
                  const validRoles = roles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
                  if (validRoles.length > 0) {
                    globalRoleMap.set(personName, validRoles);
                    console.log(`✅ [Vercel] Batch detected roles for "${personName}":`, validRoles);
                  }
                }
              }
            } catch (parseError) {
              console.log(`⚠️ [Vercel] Could not parse batch role detection, falling back to defaults`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [Vercel] Batch role detection failed, falling back to defaults`);
        }
      };
      
      // Quick role lookup with fallback to default
      const getOptimizedRoles = (personName: string, defaultRole: string): string[] => {
        return globalRoleMap.get(personName) || [defaultRole];
      };

      // Pre-detect roles for main artist with dedicated detection
      console.log(`🔍 [Vercel] Detecting roles for main artist "${correctArtistName}"...`);
      let mainArtistTypes = ['artist']; // Default
      
      try {
        const mainArtistRolePrompt = `What roles does ${correctArtistName} have in the music industry? Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. Return ONLY the JSON array, no other text.`;
        
        const openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });

        const roleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: mainArtistRolePrompt }],
          temperature: 0.1,
          max_tokens: 100,
        });

        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const detectedRoles = JSON.parse(roleContent);
            if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
              const validRoles = detectedRoles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
              if (validRoles.length > 0) {
                mainArtistTypes = validRoles;
                console.log(`✅ [Vercel] Detected main artist roles for "${correctArtistName}":`, mainArtistTypes);
                // Cache for consistency
                globalRoleMap.set(correctArtistName, mainArtistTypes);
              }
            }
          } catch (parseError) {
            console.log(`⚠️ [Vercel] Could not parse main artist role detection for "${correctArtistName}", using default`);
          }
        }
      } catch (error) {
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
        types: orderedMainArtistTypes,
        color: '#FF69B4',
        size: 30,
        artistId: artistExistsResult.rows[0].id
      };
      nodeMap.set(correctArtistName, mainNode);
      
      console.log(`🎭 [Vercel] Main artist "${correctArtistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);

      // Transform new format to expected format and collect all people for batch role detection
      const collaborators = [];
      const allPeople = new Set<string>();
      
      // Function to detect fake collaborators
      const isFakeCollaborator = (name: string): boolean => {
        const lowerName = name.toLowerCase();
        const fakePatterns = [
          'artist a', 'artist b', 'artist c', 'artist d', 'artist e',
          'producer a', 'producer b', 'producer c', 'producer d', 'producer e',
          'songwriter a', 'songwriter b', 'songwriter c', 'songwriter d', 'songwriter e',
          'artist 1', 'artist 2', 'artist 3', 'artist 4', 'artist 5',
          'producer 1', 'producer 2', 'producer 3', 'producer 4', 'producer 5',
          'songwriter 1', 'songwriter 2', 'songwriter 3', 'songwriter 4', 'songwriter 5',
          'unknown', 'anonymous', 'various', 'n/a', 'tbd',
          'placeholder', 'example', 'sample'
        ];
        return fakePatterns.some(pattern => lowerName.includes(pattern)) ||
               lowerName.match(/^(artist|producer|songwriter)\s+[a-z]$/i) ||
               lowerName.match(/^[a-z]{1,2}$/i);
      };
      
      if (collaborationData.collaborators) {
        for (const person of collaborationData.collaborators) {
          // Skip fake collaborators
          if (isFakeCollaborator(person.name)) {
            console.log(`🚫 [Vercel] Filtering out fake collaborator: "${person.name}"`);
            continue;
          }
          
          allPeople.add(person.name);
          const roles = person.roles || ['producer'];
          for (const role of roles) {
            if (role === 'producer' || role === 'songwriter') {
              collaborators.push({
                name: person.name,
                type: role,
                topCollaborators: person.topCollaborators || []
              });
              // Add branching artists to the batch
              for (const branchingArtist of person.topCollaborators || []) {
                if (branchingArtist !== correctArtistName && !isFakeCollaborator(branchingArtist)) {
                  allPeople.add(branchingArtist);
                }
              }
            }
          }
        }
      } else if (collaborationData.artists) {
        // Fallback for old format
        for (const collaborator of collaborationData.artists) {
          // Skip fake collaborators
          if (isFakeCollaborator(collaborator.name)) {
            console.log(`🚫 [Vercel] Filtering out fake collaborator: "${collaborator.name}"`);
            continue;
          }
          
          collaborators.push(collaborator);
          allPeople.add(collaborator.name);
          for (const branchingArtist of collaborator.topCollaborators || []) {
            if (branchingArtist !== correctArtistName && !isFakeCollaborator(branchingArtist)) {
              allPeople.add(branchingArtist);
            }
          }
        }
      }
      
      // If no collaborators found, return only the main artist
      if (collaborators.length === 0) {
        console.log(`⚠️ [Vercel] No collaborators found for "${correctArtistName}", returning only main artist`);
        const networkData = { nodes: [mainNode], links: [] };
        
        // Cache the generated data
        try {
          const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
          await client.query(updateQuery, [JSON.stringify(networkData), correctArtistName]);
          console.log(`💾 [Vercel] Cached network data for ${correctArtistName}`);
        } catch (cacheError) {
          console.warn('⚠️ [Vercel] Failed to cache data:', cacheError);
        }

        await client.end();
        console.log(`✅ [Vercel] Generated network with 1 node for ${artistName}`);
        
        res.json(networkData);
        return;
      }
      
      // Batch detect roles for all people at once for performance
      console.log(`🎭 [Vercel] Batch detecting roles for ${allPeople.size} people...`);
      await batchDetectRoles([...allPeople]);

      // Process producers and songwriters with multi-role consolidation
      for (const collaborator of collaborators) {
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - add the new role to their types array
          if (!collabNode.types.includes(collaborator.type)) {
            collabNode.types.push(collaborator.type);
            console.log(`🎭 [Vercel] Added ${collaborator.type} role to existing ${collaborator.name} node (now has ${collabNode.types.length} roles)`);
          }
          // Update collaborations list
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter((c: string) => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
          // Update color for multi-role nodes (artist + songwriter = multi-color, producer + songwriter = purple)
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
            types: enhancedRoles,
            color: color,
            size: 20, // Smaller size for collaborators
            artistId: null,
            collaborations: collaborator.topCollaborators || []
          };

          // Look up MusicNerd ID for collaborator
          const collabQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
          const collabResult = await client.query(collabQuery, [collaborator.name]);
          if (collabResult.rows.length > 0) {
            collabNode.artistId = collabResult.rows[0].id;
          }

          nodeMap.set(collaborator.name, collabNode);
        }

        // Create link (only once per person, not per role)
        const existingLink = links.find(link => link.source === correctArtistName && link.target === collaborator.name);
        if (!existingLink) {
          links.push({
            source: correctArtistName,
            target: collaborator.name
          });
        }

        // Add branching artists
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== correctArtistName && !nodeMap.has(branchingArtist)) {
            const branchingRoles = getOptimizedRoles(branchingArtist, 'artist');
            const branchNode = {
              id: branchingArtist,
              name: branchingArtist,
              type: branchingRoles[0],
              types: branchingRoles,
              color: '#FF69B4',
              size: 16,
              artistId: null
            };

            // Look up MusicNerd ID for branching artist
            const branchQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
            const branchResult = await client.query(branchQuery, [branchingArtist]);
            if (branchResult.rows.length > 0) {
              branchNode.artistId = branchResult.rows[0].id;
            }

            nodeMap.set(branchingArtist, branchNode);
            links.push({
              source: collaborator.name,
              target: branchingArtist
            });
          }
        }
      }

      // Convert nodeMap to nodes array
      const nodes = Array.from(nodeMap.values());

      const networkData = { nodes, links };

      // Cache the generated data
      try {
        const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
        await client.query(updateQuery, [JSON.stringify(networkData), correctArtistName]);
        console.log(`💾 [Vercel] Cached network data for ${correctArtistName}`);
      } catch (cacheError) {
        console.warn('⚠️ [Vercel] Failed to cache data:', cacheError);
      }

      await client.end();
      console.log(`✅ [Vercel] Generated network with ${nodes.length} nodes for ${artistName}`);
      
      res.json(networkData);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database/OpenAI error:', dbError);
      console.error('❌ [Vercel] Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
      return res.status(500).json({ 
        message: 'Failed to generate network data', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
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