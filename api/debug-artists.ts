import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`🔍 [Debug] Debug artists endpoint called`);

  try {
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Debug] CONNECTION_STRING not found in environment variables');
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
    
    // First, check the table structure
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'artists' 
      ORDER BY ordinal_position
    `;
    
    console.log(`🔍 [Debug] Checking table structure with query: ${tableStructureQuery}`);
    const structureResult = await client.query(tableStructureQuery);
    console.log(`📋 [Debug] Artists table structure:`, structureResult.rows);
    
    // Get a sample of artists with their social media data
    const sampleQuery = `
      SELECT id, name, x, instagram_username, facebook_username 
      FROM artists 
      LIMIT 10
    `;
    
    console.log(`🔍 [Debug] Getting sample artists with query: ${sampleQuery}`);
    const sampleResult = await client.query(sampleQuery);
    
    console.log(`📊 [Debug] Found ${sampleResult.rows.length} sample artists`);
    sampleResult.rows.forEach((artist, index) => {
      console.log(`🎤 [Debug] Artist ${index + 1}:`, {
        id: artist.id,
        name: artist.name,
        x: artist.x || 'NULL',
        instagram_username: artist.instagram_username || 'NULL',
        facebook_username: artist.facebook_username || 'NULL'
      });
    });
    
    // Check if there are any artists with social media usernames
    const withUsernamesQuery = `
      SELECT id, name, x, instagram_username, facebook_username 
      FROM artists 
      WHERE x IS NOT NULL OR instagram_username IS NOT NULL OR facebook_username IS NOT NULL
      LIMIT 10
    `;
    
    console.log(`🔍 [Debug] Checking for artists with usernames: ${withUsernamesQuery}`);
    const usernamesResult = await client.query(withUsernamesQuery);
    
    console.log(`📊 [Debug] Found ${usernamesResult.rows.length} artists with social media usernames`);
    usernamesResult.rows.forEach((artist, index) => {
      console.log(`🎤 [Debug] Artist with usernames ${index + 1}:`, {
        id: artist.id,
        name: artist.name,
        x: artist.x || 'NULL',
        instagram_username: artist.instagram_username || 'NULL',
        facebook_username: artist.facebook_username || 'NULL'
      });
    });
    
    await client.end();
    
    const response = {
      message: 'Debug completed',
      tableStructure: structureResult.rows,
      sampleArtists: sampleResult.rows,
      artistsWithUsernames: usernamesResult.rows,
      totalSample: sampleResult.rows.length,
      totalWithUsernames: usernamesResult.rows.length
    };
    
    console.log(`✅ [Debug] Debug response:`, response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ [Debug] Debug endpoint error:', error);
    res.status(500).json({ 
      message: 'Debug endpoint error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 