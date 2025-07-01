import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for frontend requests
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
    
    console.log(`🔍 [Vercel] Looking up artist options for: "${artistName}"`);
    console.log(`🔍 [Vercel] Environment check - CONNECTION_STRING exists:`, !!process.env.CONNECTION_STRING);
    console.log(`🔍 [Vercel] Node.js version:`, process.version);
    console.log(`🔍 [Vercel] Platform:`, process.platform);
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      console.error('❌ [Vercel] Available env vars:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
      return res.status(500).json({ message: 'Database connection not configured' });
    }
    
    let options = [];
    
    try {
      // Use direct PostgreSQL connection via pg
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      const query = 'SELECT id, name FROM artists WHERE LOWER(name) LIKE LOWER($1) LIMIT 10';
      const result = await client.query(query, [`%${artistName}%`]);
      
      options = result.rows.map(row => {
        // Generate bio based on artist name (since type column doesn't exist in database)
        const generateBio = (name: string) => {
          return `${name} is a prominent artist known for their musical contributions across various genres. Their work has influenced many in the music industry and continues to resonate with listeners worldwide.`;
        };
        
        return {
          id: row.id,
          name: row.name,
          bio: generateBio(row.name)
        };
      });
      
      await client.end();
      
      console.log(`✅ [Vercel] Found ${options.length} artist options for "${artistName}"`);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database connection failed:', dbError);
      console.error('❌ [Vercel] CONNECTION_STRING available:', !!CONNECTION_STRING);
      console.error('❌ [Vercel] Error details:', JSON.stringify(dbError, null, 2));
      return res.status(500).json({ 
        message: 'Database connection failed', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        hasConnectionString: !!CONNECTION_STRING
      });
    }
    
    res.json({ options });
  } catch (error) {
    console.error('❌ [Vercel] Artist options error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}