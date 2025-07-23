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

  console.log(`🔍 [Vercel] Fetching social media data for artist ID: "${artistId}"`);

  try {
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found in environment variables');
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
    
    console.log(`🔍 [Vercel] Executing query: ${query} with artistId: ${artistId}`);
    const result = await client.query(query, [artistId]);
    
    await client.end();
    
    if (result.rows.length === 0) {
      console.log(`❌ [Vercel] Artist not found in Supabase with ID: "${artistId}"`);
      return res.status(404).json({ 
        message: 'Artist not found in Supabase',
        error: `No artist found with ID: ${artistId}`
      });
    }
    
    const artist = result.rows[0];
    console.log(`📄 [Vercel] Raw Supabase data for artist ID ${artistId}:`, {
      id: artist.id,
      name: artist.name,
      x: artist.x,
      instagram_username: artist.instagram_username,
      facebook_username: artist.facebook_username
    });
    
    // Verify username data exists in Supabase
    const usernamesFound = {
      x: !!artist.x,
      instagram: !!artist.instagram_username,
      facebook: !!artist.facebook_username
    };
    
    console.log(`🔍 [Vercel] Username verification for "${artist.name}" (ID: ${artistId}):`, usernamesFound);
    
    const socialData: ArtistSocialData = {
      artistId: artist.id,
      name: artist.name,
      xUsername: artist.x || null,
      instagramUsername: artist.instagram_username || null,
      facebookUsername: artist.facebook_username || null
    };
    
    // Log which usernames were successfully retrieved from Supabase
    const foundUsernames = [];
    if (socialData.xUsername) foundUsernames.push(`X: @${socialData.xUsername}`);
    if (socialData.instagramUsername) foundUsernames.push(`Instagram: @${socialData.instagramUsername}`);
    if (socialData.facebookUsername) foundUsernames.push(`Facebook: @${socialData.facebookUsername}`);
    
    if (foundUsernames.length > 0) {
      console.log(`✅ [Vercel] Found usernames in Supabase for "${artist.name}": ${foundUsernames.join(', ')}`);
    } else {
      console.log(`⚠️ [Vercel] No social media usernames found in Supabase for "${artist.name}" (ID: ${artistId})`);
    }
    
    res.json(socialData);
    
  } catch (error) {
    console.error('❌ [Vercel] Artist social data error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 