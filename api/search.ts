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
        // Single character: find artists starting with that character, prioritize exact case
        searchQuery = `
          SELECT id, name, bio 
          FROM artists 
          WHERE name LIKE $1 OR LOWER(name) LIKE LOWER($2)
          ORDER BY 
            CASE WHEN name = $3 THEN 1
                 WHEN name LIKE $4 THEN 2
                 WHEN LOWER(name) = LOWER($5) THEN 3
                 WHEN LOWER(name) LIKE LOWER($6) THEN 4
                 ELSE 5 END,
            name 
          LIMIT 100
        `;
        queryParams = [`${query}%`, `${query.toLowerCase()}%`, query, `${query}%`, query, `${query.toLowerCase()}%`];
      } else {
        // Multiple characters: prioritize exact case matches over case-insensitive
        searchQuery = `
          SELECT id, name, bio 
          FROM artists 
          WHERE name = $1
             OR name LIKE $2 
             OR name LIKE $3
             OR name LIKE $4
             OR LOWER(name) = LOWER($5)
             OR LOWER(name) LIKE LOWER($6) 
             OR LOWER(name) LIKE LOWER($7)
             OR LOWER(name) LIKE LOWER($8)
          ORDER BY 
            CASE WHEN name = $9 THEN 1                    -- Exact case match (highest priority)
                 WHEN name LIKE $10 THEN 2               -- Starts with exact case
                 WHEN name LIKE $11 THEN 3               -- Contains exact case  
                 WHEN name LIKE $12 THEN 4               -- Ends with exact case
                 WHEN LOWER(name) = LOWER($13) THEN 5    -- Exact case-insensitive match
                 WHEN LOWER(name) LIKE LOWER($14) THEN 6 -- Starts with case-insensitive
                 WHEN LOWER(name) LIKE LOWER($15) THEN 7 -- Contains case-insensitive
                 ELSE 8 END,
            name 
          LIMIT 100
        `;
        queryParams = [
          query,            // Exact case match
          `${query}%`,      // Starts with exact case
          `%${query}%`,     // Contains exact case
          `%${query}`,      // Ends with exact case
          query,            // Exact case-insensitive match
          `${query}%`,      // Starts with case-insensitive
          `%${query}%`,     // Contains case-insensitive
          `%${query}`,      // Ends with case-insensitive
          query,            // ORDER BY exact case match
          `${query}%`,      // ORDER BY starts with exact case
          `%${query}%`,     // ORDER BY contains exact case  
          `%${query}`,      // ORDER BY ends with exact case
          query,            // ORDER BY exact case-insensitive match
          `${query}%`,      // ORDER BY starts with case-insensitive
          `%${query}%`      // ORDER BY contains case-insensitive
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