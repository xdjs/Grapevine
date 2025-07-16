import 'dotenv/config';
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
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: "Artist ID is required" });
    }

    console.log(`🎵 [Vercel] Fetching artist with ID: ${id}`);

    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    let artist = null;

    // Try Supabase first if configured
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        console.log(`🔧 [Vercel] Using Supabase client for artist ID: ${id}`);
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data, error } = await supabase
          .from('artists')
          .select('*')
          .eq('id', parseInt(id))
          .single();
        
        if (error) {
          console.error('❌ [Vercel] Supabase error:', error);
          if (error.code === 'PGRST116') {
            // No rows returned
            return res.status(404).json({ message: 'Artist not found' });
          }
          throw error;
        }
        
        artist = data;
        console.log(`✅ [Vercel] Found artist via Supabase: ${artist.name}`);
        
      } catch (supabaseError) {
        console.error('❌ [Vercel] Supabase failed, trying direct PostgreSQL connection:', supabaseError);
      }
    }

    // Fallback to direct PostgreSQL connection if Supabase failed or not configured
    if (!artist && CONNECTION_STRING) {
      try {
        console.log(`🔧 [Vercel] Using direct PostgreSQL connection for artist ID: ${id}`);
        
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: CONNECTION_STRING,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        await client.connect();
        
        const query = 'SELECT * FROM artists WHERE id = $1';
        const result = await client.query(query, [parseInt(id)]);
        
        await client.end();
        
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Artist not found' });
        }
        
        artist = result.rows[0];
        console.log(`✅ [Vercel] Found artist via PostgreSQL: ${artist.name}`);
        
      } catch (dbError) {
        console.error('❌ [Vercel] Database connection failed:', dbError);
        return res.status(500).json({ 
          message: 'Database connection failed', 
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          hasConnectionString: !!CONNECTION_STRING,
          hasSupabaseConfig: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
        });
      }
    }

    if (!artist) {
      if (!CONNECTION_STRING && !(SUPABASE_URL && SUPABASE_ANON_KEY)) {
        return res.status(500).json({ message: 'Database not configured' });
      }
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Return the artist data
    res.json({ artist });
    
  } catch (error) {
    console.error('❌ [Vercel] Artist fetch error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 