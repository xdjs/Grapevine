import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { artistId } = req.query;

  if (typeof artistId !== 'string') {
    return res.status(400).json({ 
      message: 'Artist ID is required',
      error: 'Invalid artist ID parameter'
    });
  }

  console.log(`🧪 [Test] Testing social media data for artist ID: "${artistId}"`);

  try {
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Test] CONNECTION_STRING not found in environment variables');
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
    
    // Test 1: Check if artist exists at all
    const existsQuery = `SELECT COUNT(*) as count FROM artists WHERE id = $1`;
    console.log(`🧪 [Test] Step 1 - Checking if artist exists: ${existsQuery} with ID: ${artistId}`);
    const existsResult = await client.query(existsQuery, [artistId]);
    const artistExists = existsResult.rows[0].count > 0;
    console.log(`🧪 [Test] Artist exists: ${artistExists}`);
    
    if (!artistExists) {
      await client.end();
      return res.status(404).json({
        message: 'Artist not found',
        artistId,
        artistExists: false,
        error: `No artist found with ID: ${artistId}`
      });
    }
    
    // Test 2: Get all data for this artist
    const fullQuery = `SELECT * FROM artists WHERE id = $1`;
    console.log(`🧪 [Test] Step 2 - Getting full artist data: ${fullQuery}`);
    const fullResult = await client.query(fullQuery, [artistId]);
    const fullArtist = fullResult.rows[0];
    console.log(`🧪 [Test] Full artist data:`, fullArtist);
    
    // Test 3: Get specific social media columns
    const socialQuery = `SELECT id, name, x, instagram_username, facebook_username FROM artists WHERE id = $1`;
    console.log(`🧪 [Test] Step 3 - Getting social media data: ${socialQuery}`);
    const socialResult = await client.query(socialQuery, [artistId]);
    const socialArtist = socialResult.rows[0];
    console.log(`🧪 [Test] Social media data:`, socialArtist);
    
    // Test 4: Check which columns have values
    const columnChecks = {
      hasX: !!socialArtist.x,
      hasInstagram: !!socialArtist.instagram_username,
      hasFacebook: !!socialArtist.facebook_username,
      xValue: socialArtist.x || null,
      instagramValue: socialArtist.instagram_username || null,
      facebookValue: socialArtist.facebook_username || null
    };
    console.log(`🧪 [Test] Column checks:`, columnChecks);
    
    await client.end();
    
    const response = {
      message: 'Test completed',
      artistId,
      artistExists: true,
      artistName: socialArtist.name,
      fullData: fullArtist,
      socialData: socialArtist,
      columnChecks,
      wouldWork: {
        x: !!socialArtist.x,
        instagram: !!socialArtist.instagram_username,
        facebook: !!socialArtist.facebook_username
      }
    };
    
    console.log(`✅ [Test] Test response:`, response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ [Test] Test endpoint error:', error);
    res.status(500).json({ 
      message: 'Test endpoint error',
      artistId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 