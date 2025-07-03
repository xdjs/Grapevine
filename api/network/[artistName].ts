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
      
      // Check for cached webmapdata using the correct artist name
      const cacheQuery = 'SELECT webmapdata FROM artists WHERE LOWER(name) = LOWER($1) AND webmapdata IS NOT NULL';
      const cacheResult = await client.query(cacheQuery, [correctArtistName]);
      
      if (cacheResult.rows.length > 0 && cacheResult.rows[0].webmapdata) {
        console.log(`✅ [Vercel] Found cached data for ${artistName}`);
        await client.end();
        return res.json(cacheResult.rows[0].webmapdata);
      }
      
      // OpenAI collaboration generation disabled for data integrity
      console.error(`🚫 [Vercel] OpenAI collaboration generation disabled for data integrity - only authentic data sources allowed`);
      await client.end();
      return res.status(503).json({ 
        error: 'OpenAI collaboration generation disabled',
        message: 'Data integrity policy: Only authentic collaboration data from verified sources (MusicBrainz, Wikipedia) is allowed. No AI-generated or synthetic collaborations.',
        artist: artistName,
        timestamp: new Date().toISOString()
      });
      
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