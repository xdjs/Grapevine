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
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: "Query parameter 'q' is required" });
    }

    console.log(`🔍 [Vercel] Searching for artist: ${query}`);

    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    try {
      // Use direct PostgreSQL connection
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      const searchQuery = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1) LIMIT 1';
      const result = await client.query(searchQuery, [query]);
      
      await client.end();
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const artist = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        type: 'artist' // Default type
      };

      console.log(`✅ [Vercel] Found artist: ${artist.name}`);
      res.json(artist);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database error:', dbError);
      return res.status(500).json({ 
        message: 'Database query failed', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
    }
    
  } catch (error) {
    console.error("❌ [Vercel] Error searching artist:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}