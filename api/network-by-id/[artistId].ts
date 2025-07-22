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

interface CollaborationData {
  artists: Array<{
    name: string;
    type?: string;
    roles?: string[];
    topCollaborators: string[];
  }>;
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
    const { artistId } = req.query;
    
    if (!artistId || typeof artistId !== 'string') {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    console.log(`🔍 [Vercel] Network data request for artist ID: ${artistId}`);
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    try {
      // Connect to database
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // Get artist by ID
      const artistQuery = 'SELECT id, name, webmapdata FROM artists WHERE id = $1';
      const artistResult = await client.query(artistQuery, [artistId]);
      
      if (artistResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ 
          message: `Artist with ID "${artistId}" not found in database.`
        });
      }
      
      const artist = artistResult.rows[0];
      console.log(`✅ [Vercel] Found artist: "${artist.name}" (ID: ${artistId})`);
      
      // Check if we have cached network data
      if (artist.webmapdata) {
        console.log(`💾 [Vercel] Found cached webmapdata for artist ID "${artistId}" (${artist.name})`);
        
        // Check if this is a single-node network (no collaborators)
        const cachedData = artist.webmapdata;
        const isSingleNode = cachedData.nodes && cachedData.nodes.length === 1 && 
                            (!cachedData.links || cachedData.links.length === 0);
        
        if (isSingleNode) {
          // Always show popup for single-node networks, don't use cache for this case
          console.log(`🎭 [Vercel] Single-node network found, checking if user wants hallucinations`);
          const allowHallucinations = req.query.allowHallucinations === 'true';
          
          if (!allowHallucinations) {
            // Return special response to trigger popup
            await client.end();
            return res.json({
              noCollaborators: true,
              artistName: artist.name,
              artistId: artist.id,
              singleNodeNetwork: cachedData
            });
          }
          // If hallucinations requested, continue to generation logic below
        } else {
          // Multi-node network, return cached data normally
          await client.end();
          return res.json(cachedData);
        }
      }
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        console.error(`❌ [Vercel] OpenAI API key not configured for artist ID ${artistId}`);
        await client.end();
        return res.status(503).json({ 
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artistId: artistId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate new network data using OpenAI
      console.log(`🤖 [Vercel] Generating network for artist ID ${artistId} (${artist.name}) using OpenAI`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `If ${artist.name} is a real artist with known music industry collaborations, provide a comprehensive list of music industry professionals who have collaborated with them. Include people who work as producers, songwriters, or both.

IMPORTANT: Search for collaborations regardless of ${artist.name}'s popularity level - include mainstream artists, independent artists, underground artists, regional artists, and emerging artists. Many smaller artists still have authentic collaborations that should be included.

If ${artist.name} is not a real artist or you have absolutely no authentic collaboration data for them, return an empty artists array. Do NOT create fake or placeholder collaborators.

Required format:
{
  "artists": [
    {
      "name": "Producer Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Requirements:
- Search thoroughly for ALL artists regardless of fame level: mainstream, independent, underground, regional, emerging
- Only include real, verified music industry professionals who have actually worked with ${artist.name}
- If you don't have authentic data, return: {"artists": []}
- For each real person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Make sure if any of these people have multiple roles (artist, producer, songwriter), it is listed in the data. Search for multiple roles on every person that is queried, regardless of their popularity.
- Include their top 3 real collaborating artists (can include both famous and lesser-known artists)
- Never use generic names like "John Doe", "Producer X", or placeholder data
- Return ONLY the JSON object, no other text
- Ensure all JSON is properly formatted and valid`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music industry database expert. Provide accurate information about real producer and songwriter collaborations from ALL levels of the music industry - mainstream, independent, underground, regional, and emerging artists. Only include verified, authentic collaborations. Do not discriminate based on popularity level."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
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
            artistId: artistId,
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
        console.log(`✅ [Vercel] Parsed collaboration data with ${collaborationData.artists?.length || 0} artists`);
      } catch (parseError) {
        console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
        console.error('❌ [Vercel] Raw OpenAI content:', completion.choices[0]?.message?.content);
        await client.end();
        return res.status(503).json({ 
          error: 'Failed to parse OpenAI response',
          message: 'OpenAI returned invalid JSON format',
          artistId: artistId,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          timestamp: new Date().toISOString()
        });
      }

      // Build network data structure with multi-role consolidation
      const nodeMap = new Map<string, NetworkNode>();
      const links: NetworkLink[] = [];

      // Add main artist node
      const mainNode = {
        id: artist.name,
        name: artist.name,
        type: 'artist',
        types: ['artist'],
        color: '#FF69B4',
        size: 30,
        artistId: artist.id
      };
      nodeMap.set(artist.name, mainNode);

      // Track whether hallucinations were used
      let hallucinationsUsed = false;

      // If no collaborators found, check if user wants hallucinated data
      if (!collaborationData.artists || collaborationData.artists.length === 0) {
        const allowHallucinations = req.query.allowHallucinations === 'true';
        
        if (!allowHallucinations) {
          console.log(`⚠️ [Vercel] No collaborators found for "${artist.name}", returning no-collaborators response`);
          const singleNodeData = { nodes: [mainNode], links: [] };
          
          await client.end();
          
          // Return special response indicating no collaborators found
          res.json({
            noCollaborators: true,
            artistName: artist.name,
            artistId: artist.id,
            singleNodeNetwork: singleNodeData
          });
          return;
        }
        
        // User requested hallucinated data - generate creative network
        console.log(`🎭 [Vercel] No real collaborators found for "${artist.name}", generating hallucinated network as requested`);
        hallucinationsUsed = true;
        
        const hallucinatedPrompt = `Create an imaginative collaboration network for ${artist.name}. Generate plausible but potentially fictional music industry collaborators who could work with this artist. Include both real and creative professionals.

Please respond with JSON in this exact format:
{
  "artists": [
    {
      "name": "Person Name",
      "type": "producer",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "type": "songwriter",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- Mix real industry professionals with plausible fictional ones
- Create 3-8 collaborators total
- Include producers, songwriters, and artists
- Be creative but keep names realistic
- Include varied collaboration styles that would fit ${artist.name}'s music
- Return ONLY the JSON object, no other text`;

        try {
          const hallucinatedCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: hallucinatedPrompt }],
            temperature: 0.7, // Higher temperature for creativity
            max_tokens: 2000,
          });

          const hallucinatedContent = hallucinatedCompletion.choices[0]?.message?.content;
          if (hallucinatedContent) {
            // Parse hallucinated content
            let jsonContent = hallucinatedContent.trim();
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            }
            
            try {
              const hallucinatedData = JSON.parse(jsonContent);
              if (hallucinatedData.artists && hallucinatedData.artists.length > 0) {
                // Use hallucinated data and continue with normal processing
                collaborationData = hallucinatedData;
                console.log(`✨ [Vercel] Generated ${hallucinatedData.artists.length} hallucinated collaborators for "${artist.name}"`);
              }
            } catch (parseError) {
              console.warn('⚠️ [Vercel] Failed to parse hallucinated data, falling back to single node');
            }
          }
        } catch (hallucinationError) {
          console.warn('⚠️ [Vercel] Failed to generate hallucinated data, falling back to single node');
        }
        
        // If still no collaborators after hallucination attempt, return single node
        if (!collaborationData.artists || collaborationData.artists.length === 0) {
          const networkData = { nodes: [mainNode], links: [] };
          await client.end();
          res.json(networkData);
          return;
        }
      }

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
               !!lowerName.match(/^(artist|producer|songwriter)\s+[a-z]$/i) ||
               !!lowerName.match(/^[a-z]{1,2}$/i);
      };

      // Process producers and songwriters with multi-role consolidation
      for (const collaborator of collaborationData.artists || []) {
        // Skip fake collaborators
        if (isFakeCollaborator(collaborator.name)) {
          console.log(`🚫 [Vercel] Filtering out fake collaborator: "${collaborator.name}"`);
          continue;
        }

        // Handle both new format (roles array) and old format (type field)
        const roles = collaborator.roles || [collaborator.type || 'producer'];
        console.log(`🎭 [Vercel] Processing "${collaborator.name}" with roles: [${roles.join(', ')}]`);
        
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - merge all roles into their types array
          for (const role of roles) {
            if (!collabNode.types.includes(role)) {
              collabNode.types.push(role);
              console.log(`🎭 [Vercel] Added ${role} role to existing ${collaborator.name} node (now has ${collabNode.types.length} roles)`);
            }
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
          // Create new node with all roles
          const primaryRole = roles[0];
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: primaryRole,
            types: [...roles], // Include all roles
            color: primaryRole === 'producer' ? '#8A2BE2' : '#00CED1',
            size: 20,
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
          console.log(`✅ [Vercel] Created new node for "${collaborator.name}" with ${roles.length} roles: [${roles.join(', ')}]`);
        }

        // Create link (only once per person, not per role)
        const existingLink = links.find(link => link.source === artist.name && link.target === collaborator.name);
        if (!existingLink) {
          links.push({
            source: artist.name,
            target: collaborator.name
          });
        }

        // Add branching artists with comprehensive multi-role detection
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== artist.name && !nodeMap.has(branchingArtist) && !isFakeCollaborator(branchingArtist)) {
            
            // Use OpenAI to detect all roles for this artist node
            let branchingRoles = ['artist']; // Default fallback
            try {
              console.log(`🎭 [Vercel] Detecting roles for artist node: "${branchingArtist}"`);
              
              const rolePrompt = `What roles does ${branchingArtist} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${branchingArtist}, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
              
              const roleCompletion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: "You are a music industry database expert. Provide accurate information about real producer and songwriter collaborations from ALL levels of the music industry - mainstream, independent, underground, regional, and emerging artists. Only include verified, authentic collaborations. Do not discriminate based on popularity level."
                  },
                  {
                    role: "user",
                    content: rolePrompt
                  }
                ],
                temperature: 0.1,
                max_tokens: 100,
              });

              const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
              if (roleContent) {
                try {
                  const detectedRoles = JSON.parse(roleContent);
                  if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
                    branchingRoles = detectedRoles.filter(role => 
                      ['artist', 'producer', 'songwriter'].includes(role)
                    );
                    console.log(`✅ [Vercel] Detected roles for artist "${branchingArtist}":`, branchingRoles);
                  }
                } catch (parseError) {
                  console.log(`⚠️ [Vercel] Could not parse role detection for "${branchingArtist}", using default`);
                }
              }
            } catch (error) {
              console.log(`⚠️ [Vercel] Role detection failed for "${branchingArtist}", using default`);
            }

            const branchNode = {
              id: branchingArtist,
              name: branchingArtist,
              type: branchingRoles[0],
              types: branchingRoles,
              color: '#FF69B4',
              size: 15,
              artistId: null
            };

            // Look up MusicNerd ID for branching artist
            const branchQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
            const branchResult = await client.query(branchQuery, [branchingArtist]);
            if (branchResult.rows.length > 0) {
              branchNode.artistId = branchResult.rows[0].id;
            }

            nodeMap.set(branchingArtist, branchNode);
            console.log(`🎭 [Vercel] Created artist node "${branchingArtist}" with ${branchingRoles.length} roles: [${branchingRoles.join(', ')}]`);
            
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

      // Only cache the generated data if hallucinations were NOT used
      if (!hallucinationsUsed) {
        try {
          const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE id = $2';
          await client.query(updateQuery, [JSON.stringify(networkData), artistId]);
          console.log(`💾 [Vercel] Cached network data for artist ID ${artistId} (${artist.name})`);
        } catch (cacheError) {
          console.warn('⚠️ [Vercel] Failed to cache data:', cacheError);
        }
      } else {
        console.log(`🎭 [Vercel] Skipping cache for artist ID ${artistId} (${artist.name}) due to hallucinated data`);
      }

      await client.end();
      console.log(`✅ [Vercel] Generated network with ${nodes.length} nodes for artist ID ${artistId}`);
      
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
    console.error("❌ [Vercel] Error fetching network data by ID:", error);
    console.error('❌ [Vercel] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}