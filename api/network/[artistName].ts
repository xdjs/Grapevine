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
      
      // First check if artist exists in database
      const artistExistsQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
      const artistExistsResult = await client.query(artistExistsQuery, [artistName]);
      
      if (artistExistsResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ 
          message: `Artist "${artistName}" not found in database. Please search for an existing artist.`
        });
      }
      
      // Check for cached webmapdata
      const cacheQuery = 'SELECT webmapdata FROM artists WHERE LOWER(name) = LOWER($1) AND webmapdata IS NOT NULL';
      const cacheResult = await client.query(cacheQuery, [artistName]);
      
      if (cacheResult.rows.length > 0 && cacheResult.rows[0].webmapdata) {
        console.log(`✅ [Vercel] Found cached data for ${artistName}`);
        await client.end();
        return res.json(cacheResult.rows[0].webmapdata);
      }
      
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

      const prompt = `Generate a list of producers and songwriters who have collaborated with ${artistName}. For each producer and songwriter, include their top 3 collaborating artists. Return the data in this exact JSON format:

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

Provide 5 producers and 5 songwriters who have actually worked with ${artistName}. Use only real music industry collaborations.`;

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
        
        collaborationData = JSON.parse(openaiContent);
        console.log(`✅ [Vercel] Parsed collaboration data with ${collaborationData.artists?.length || 0} artists`);
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

      // Build network data structure
      const nodes = [];
      const links = [];

      // Add main artist node
      const mainArtistQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
      const mainArtistResult = await client.query(mainArtistQuery, [artistName]);
      
      const mainNode = {
        id: artistName,
        type: 'artist',
        types: ['artist'],
        color: '#FF69B4',
        size: 30,
        musicNerdId: mainArtistResult.rows.length > 0 ? mainArtistResult.rows[0].id : null
      };
      nodes.push(mainNode);

      // Process producers and songwriters
      for (const collaborator of collaborationData.artists || []) {
        const collabNode = {
          id: collaborator.name,
          type: collaborator.type,
          types: [collaborator.type],
          color: collaborator.type === 'producer' ? '#8A2BE2' : '#00CED1',
          size: 20,
          musicNerdId: null,
          topCollaborators: collaborator.topCollaborators || []
        };

        // Look up MusicNerd ID for collaborator
        const collabQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
        const collabResult = await client.query(collabQuery, [collaborator.name]);
        if (collabResult.rows.length > 0) {
          collabNode.musicNerdId = collabResult.rows[0].id;
        }

        nodes.push(collabNode);
        links.push({
          source: artistName,
          target: collaborator.name,
          type: collaborator.type === 'producer' ? 'production' : 'songwriting'
        });

        // Add branching artists
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== artistName && !nodes.find(n => n.id === branchingArtist)) {
            const branchNode = {
              id: branchingArtist,
              type: 'artist',
              types: ['artist'],
              color: '#FF69B4',
              size: 15,
              musicNerdId: null
            };

            // Look up MusicNerd ID for branching artist
            const branchQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
            const branchResult = await client.query(branchQuery, [branchingArtist]);
            if (branchResult.rows.length > 0) {
              branchNode.musicNerdId = branchResult.rows[0].id;
            }

            nodes.push(branchNode);
            links.push({
              source: collaborator.name,
              target: branchingArtist,
              type: collaborator.type === 'producer' ? 'production' : 'songwriting'
            });
          }
        }
      }

      const networkData = { nodes, links };

      // Cache the generated data
      try {
        const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
        await client.query(updateQuery, [JSON.stringify(networkData), artistName]);
        console.log(`💾 [Vercel] Cached network data for ${artistName}`);
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