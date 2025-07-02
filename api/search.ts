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
      
      // Enhanced search with fuzzy matching and multiple results
      let searchQuery;
      let queryParams;
      
      if (query.length === 1) {
        // Single character: find artists starting with that character
        searchQuery = `
          SELECT id, name, bio 
          FROM artists 
          WHERE LOWER(name) LIKE LOWER($1) 
          ORDER BY 
            CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
            name 
          LIMIT 100
        `;
        queryParams = [`${query}%`, `${query}%`];
      } else {
        // Multiple characters: comprehensive fuzzy search
        searchQuery = `
          SELECT id, name, bio 
          FROM artists 
          WHERE LOWER(name) LIKE LOWER($1) 
             OR LOWER(name) LIKE LOWER($2) 
             OR LOWER(name) LIKE LOWER($3)
          ORDER BY 
            CASE WHEN LOWER(name) = LOWER($4) THEN 1
                 WHEN LOWER(name) LIKE LOWER($5) THEN 2
                 WHEN LOWER(name) LIKE LOWER($6) THEN 3
                 ELSE 4 END,
            name 
          LIMIT 100
        `;
        queryParams = [
          `%${query}%`,     // Contains query
          `${query}%`,      // Starts with query  
          `%${query}`,      // Ends with query
          query,            // Exact match (highest priority)
          `${query}%`,      // Starts with (priority 2)
          `%${query}%`      // Contains (priority 3)
        ];
      }
      
      const result = await client.query(searchQuery, queryParams);
      await client.end();
      
      // Convert to expected format for dropdown
      const artists = result.rows.map(row => ({
        id: row.id.toString(),
        artistId: row.id.toString(), 
        name: row.name,
        bio: row.bio || undefined
      }));

      console.log(`✅ [Vercel] Found ${artists.length} artists for query: ${query}`);
      res.json(artists);
      
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