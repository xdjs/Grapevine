import type { VercelRequest, VercelResponse } from '@vercel/node';

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

      const prompt = `Generate a list of music industry professionals who have collaborated with ${correctArtistName}. For each person, specify their PRIMARY role in relation to ${correctArtistName} specifically.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "role": "producer",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "role": "songwriter",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Important guidelines:
- Include up to 10 music industry professionals who have actually worked with ${correctArtistName}
- For each person, specify their MAIN role when working with ${correctArtistName}: "producer", "songwriter", or "artist"
- If Jack Antonoff primarily produced for ${correctArtistName}, list him as "producer" only (not both producer and songwriter)
- Include their top 3 collaborating artists for each person
- Focus on real, verified collaborations from the music industry
- Return ONLY the JSON object, no other text`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      let collaborationData;
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
      const nodeMap = new Map();
      const links = [];

      // Create comprehensive role lookup system for consistency across maps
      const globalRoleMap = new Map<string, string[]>();
      
      // Helper function to detect and cache roles for any person
      const getComprehensiveRoles = async (personName: string, defaultRole: 'artist' | 'producer' | 'songwriter'): Promise<string[]> => {
        // Check if we already have roles for this person
        if (globalRoleMap.has(personName)) {
          const cachedRoles = globalRoleMap.get(personName)!;
          console.log(`🎭 [Vercel] Using cached roles for "${personName}":`, cachedRoles);
          return cachedRoles;
        }
        
        // Query OpenAI to determine this person's roles
        let detectedRoles = [defaultRole];
        try {
          const roleDetectionPrompt = `What roles does ${personName} have in the music industry? Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. Return ONLY the JSON array, no other text.`;
          
          const openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
          });

          const roleCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: roleDetectionPrompt }],
            temperature: 0.1,
            max_tokens: 100,
          });

          const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
          if (roleContent) {
            try {
              const parsedRoles = JSON.parse(roleContent);
              if (Array.isArray(parsedRoles) && parsedRoles.length > 0) {
                const validRoles = parsedRoles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
                if (validRoles.length > 0) {
                  detectedRoles = validRoles;
                  console.log(`✅ [Vercel] Detected roles for "${personName}":`, detectedRoles);
                }
              }
            } catch (parseError) {
              console.log(`⚠️ [Vercel] Could not parse role detection for "${personName}", using default`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [Vercel] Role detection failed for "${personName}", using default`);
        }
        
        // Cache the detected roles for consistency
        globalRoleMap.set(personName, detectedRoles);
        return detectedRoles;
      };

      // Detect main artist's roles with comprehensive detection
      console.log(`🔍 [Vercel] Detecting roles for main artist "${correctArtistName}"...`);
      const mainArtistTypes = await getComprehensiveRoles(correctArtistName, 'artist');
      
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

      // Transform new format to expected format and process collaborators
      const collaborators = [];
      if (collaborationData.collaborators) {
        for (const person of collaborationData.collaborators) {
          const role = person.role || 'producer'; // Single primary role
          if (role === 'producer' || role === 'songwriter') {
            collaborators.push({
              name: person.name,
              type: role,
              topCollaborators: person.topCollaborators || []
            });
          }
        }
      } else if (collaborationData.artists) {
        // Fallback for old format
        collaborators.push(...collaborationData.artists);
      }

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
            const newCollabs = collaborator.topCollaborators.filter(c => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
          // Update color for multi-role nodes (artist + songwriter = multi-color, producer + songwriter = purple)
          if (collabNode.types.includes('artist') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#FF69B4'; // Keep artist color for artist-songwriters
          } else if (collabNode.types.includes('producer') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#8A2BE2'; // Keep producer color for producer-songwriters
          }
        } else {
          // Create new node with comprehensive role detection
          const enhancedRoles = await getComprehensiveRoles(collaborator.name, collaborator.type);
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
            const branchingRoles = await getComprehensiveRoles(branchingArtist, 'artist');
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

      // No caching - always return fresh data

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