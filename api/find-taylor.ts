import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`🔍 [FindTaylor] Looking for Taylor Swift in the database`);

  try {
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [FindTaylor] CONNECTION_STRING not found');
      return res.status(500).json({ 
        message: 'Database configuration missing',
        error: 'CONNECTION_STRING not configured'
      });
    }

    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    
    // Search for Taylor Swift variations
    const searchQuery = `
      SELECT id, name, x, instagram_username, facebook_username 
      FROM artists 
      WHERE LOWER(name) LIKE '%taylor%swift%' 
      OR LOWER(name) LIKE '%taylor swift%'
      ORDER BY name
    `;
    
    console.log(`🔍 [FindTaylor] Searching with query: ${searchQuery}`);
    const result = await client.query(searchQuery);
    
    console.log(`📊 [FindTaylor] Found ${result.rows.length} Taylor Swift matches`);
    result.rows.forEach((artist, index) => {
      console.log(`🎤 [FindTaylor] Match ${index + 1}:`, {
        id: artist.id,
        name: artist.name,
        x: artist.x || 'NULL',
        instagram_username: artist.instagram_username || 'NULL',
        facebook_username: artist.facebook_username || 'NULL'
      });
    });
    
    await client.end();
    
    const response = {
      message: 'Taylor Swift search completed',
      matches: result.rows,
      totalMatches: result.rows.length
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ [FindTaylor] Error:', error);
    res.status(500).json({ 
      message: 'Find Taylor endpoint error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 