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
    const { artistId } = req.query;
    
    if (!artistId || typeof artistId !== 'string') {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    console.log(`🔍 [Vercel] Looking up network for artist ID: "${artistId}"`);
    console.log(`🔍 [Vercel] Environment check - CONNECTION_STRING exists:`, !!process.env.CONNECTION_STRING);

    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    try {
      // Use direct PostgreSQL connection to find artist by ID
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // Check if artist exists by ID and get their name
      const artistExistsQuery = 'SELECT id, name, webmapdata FROM artists WHERE id = $1';
      const artistExistsResult = await client.query(artistExistsQuery, [artistId]);
      
      if (artistExistsResult.rows.length === 0) {
        await client.end();
        console.log(`❌ [Vercel] Artist ID "${artistId}" not found in database`);
        return res.status(404).json({ message: `Artist with ID "${artistId}" not found in database. Please search for an existing artist.` });
      }

      const artist = artistExistsResult.rows[0];
      const artistName = artist.name;
      console.log(`✅ [Vercel] Found artist "${artistName}" (ID: ${artistId})`);

      // Check if we have cached webmapdata
      // Clear cache for LISA/LiSA disambiguation - force regeneration to fix confusion
      const shouldClearCache = artistName === 'LISA' || artistName === 'LiSA';
      
      if (artist.webmapdata && !shouldClearCache) {
        await client.end();
        console.log(`🚀 [Vercel] Using cached webmapdata for "${artistName}" (ID: ${artistId})`);
        return res.json({
          ...artist.webmapdata,
          cached: true
        });
      }
      
      if (shouldClearCache) {
        console.log(`🗑️ [Vercel] Clearing cache for LISA/LiSA disambiguation - regenerating for "${artistName}" (ID: ${artistId})`);
      }

      await client.end();

      // No cached data, need to generate network using the artist's exact name
      console.log(`🆕 [Vercel] No cached data for "${artistName}" (ID: ${artistId}) - generating new network`);

      // Check if OpenAI is available for network generation
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
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

      const prompt = `Generate a list of producers and songwriters who have collaborated with ${artistName}. Return ONLY valid JSON with no additional text, markdown, or formatting.

Required format:
{
  "artists": [
    {
      "name": "Producer Name",
      "type": "producer", 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Songwriter Name",
      "type": "songwriter",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Requirements:
- Provide exactly 5 producers and 5 songwriters who have actually worked with ${artistName}
- Use only real music industry collaborations
- Return ONLY the JSON object, no other text
- Ensure all JSON is properly formatted and valid`;

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
          return res.status(500).json({ 
            error: 'OpenAI returned empty response',
            message: 'Failed to generate collaboration data',
            artist: artistName,
            timestamp: new Date().toISOString()
          });
        }

        // Clean the response - remove markdown formatting if present
        const cleanedResponse = openaiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        console.log(`🤖 [Vercel] Cleaned OpenAI response: ${cleanedResponse.substring(0, 200)}...`);
        
        collaborationData = JSON.parse(cleanedResponse);
        console.log(`🤖 [Vercel] OpenAI returned ${collaborationData?.artists?.length || 0} collaborators for "${artistName}"`);
        
        if (!collaborationData?.artists || collaborationData.artists.length === 0) {
          console.error('❌ [Vercel] OpenAI returned no collaborators');
          await client.end();
          return res.status(500).json({ 
            error: 'No collaborators found',
            message: 'OpenAI could not find collaboration data for this artist',
            artist: artistName,
            timestamp: new Date().toISOString()
          });
        }
      } catch (jsonError) {
        console.error('❌ [Vercel] Failed to parse OpenAI response as JSON:', jsonError);
        console.error('❌ [Vercel] Raw OpenAI response:', openaiContent);
        await client.end();
        return res.status(500).json({ 
          error: 'Failed to parse OpenAI response',
          message: 'OpenAI returned invalid JSON format',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }

      // Build network data structure with multi-role consolidation
      const nodeMap = new Map();
      const links = [];

      // Add main artist node using correct capitalization from database
      const mainNode = {
        id: artistName,
        name: artistName,
        type: 'artist',
        types: ['artist'],
        color: '#FF69B4',
        size: 30,
        artistId: artistId
      };
      
      nodeMap.set(artistName, mainNode);
      console.log(`🎨 [Vercel] Created main artist node for "${artistName}" (ID: ${artistId})`);

      // Process collaborators
      const limitedCollaborators = collaborationData.artists.slice(0, 10); // Limit for performance
      
      for (const collaborator of limitedCollaborators) {
        console.log(`👤 [Vercel] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type})`);
        
        // Check if we already have this person (for multi-role support)
        let collaboratorNode = nodeMap.get(collaborator.name);
        
        if (collaboratorNode) {
          // Person already exists - add the new role to their types array
          if (!collaboratorNode.types) {
            collaboratorNode.types = [collaboratorNode.type];
          }
          if (!collaboratorNode.types.includes(collaborator.type)) {
            collaboratorNode.types.push(collaborator.type);
            console.log(`🎭 [Vercel] Added ${collaborator.type} role to existing ${collaborator.name} node`);
          }
        } else {
          // Create new node for this person
          collaboratorNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: collaborator.type,
            types: [collaborator.type],
            size: 15,
            collaborations: collaborator.topCollaborators || []
          };
          
          // Try to get MusicNerd artist ID if they're an artist
          if (collaborator.type === 'artist') {
            try {
              const collaboratorQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
              const collaboratorResult = await client.query(collaboratorQuery, [collaborator.name]);
              if (collaboratorResult.rows.length > 0) {
                collaboratorNode.artistId = collaboratorResult.rows[0].id;
              }
            } catch (error) {
              console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
            }
          }
          
          nodeMap.set(collaborator.name, collaboratorNode);
        }

        links.push({
          source: artistName,
          target: collaborator.name,
        });
        console.log(`🔗 [Vercel] Created link: "${artistName}" ↔ "${collaborator.name}"`);
      }

      // Final node array from consolidated map
      const nodes = Array.from(nodeMap.values());
      const networkData = { nodes, links };
      
      console.log(`✅ [Vercel] Generated network data for "${artistName}" (ID: ${artistId}) with ${nodes.length} nodes and ${links.length} links`);

      // Cache the generated network data
      try {
        const client2 = new Client({
          connectionString: CONNECTION_STRING,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        await client2.connect();
        
        await client2.query(`
          UPDATE artists 
          SET webmapdata = $1::jsonb 
          WHERE id = $2
        `, [JSON.stringify(networkData), artistId]);
        
        await client2.end();
        console.log(`💾 [Vercel] Cached network data for "${artistName}" (ID: ${artistId})`);
      } catch (cacheError) {
        console.error(`❌ [Vercel] Failed to cache network data for "${artistName}":`, cacheError);
      }

      res.json({
        ...networkData,
        cached: false
      });
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database error:', dbError);
      return res.status(500).json({ 
        message: 'Database operation failed', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
    }
    
  } catch (error) {
    console.error("❌ [Vercel] Error generating network by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}