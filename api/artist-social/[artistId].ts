import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ArtistSocialData {
  artistId: string;
  name: string;
  xUsername?: string | null;
  instagramUsername?: string | null;
  facebookUsername?: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { artistId } = req.query;

  if (typeof artistId !== 'string') {
    return res.status(400).json({ 
      message: 'Artist ID is required',
      error: 'Invalid artist ID parameter'
    });
  }

  try {
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      return res.status(500).json({ 
        message: 'Database configuration missing',
        error: 'CONNECTION_STRING not configured'
      });
    }

    // Use direct PostgreSQL connection via pg
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    
    const query = `
      SELECT id, name, x, instagram_username, facebook_username 
      FROM artists 
      WHERE id = $1
    `;
    
    const result = await client.query(query, [artistId]);
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Artist not found in Supabase',
        error: `No artist found with ID: ${artistId}`
      });
    }
    
    const artist = result.rows[0];
    
    const socialData: ArtistSocialData = {
      artistId: artist.id,
      name: artist.name,
      xUsername: artist.x || null,
      instagramUsername: artist.instagram_username || null,
      facebookUsername: artist.facebook_username || null
    };
    
    res.json(socialData);
    
  } catch (error) {
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 