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
    
    // Import and initialize services
    const { createClient } = await import('@supabase/supabase-js');
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      return res.status(500).json({ message: 'Database connection not configured' });
    }
    
    // Initialize Supabase client for direct database queries
    const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder_key';
    
    let options = [];
    
    try {
      // Try to use Supabase client directly
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase
        .from('artists')
        .select('id, name, bio')
        .ilike('name', `%${artistName}%`)
        .limit(10);
      
      if (error) {
        console.error('❌ [Vercel] Supabase query error:', error);
        return res.status(500).json({ message: 'Database query failed' });
      }
      
      options = data || [];
      console.log(`✅ [Vercel] Found ${options.length} artist options for "${artistName}"`);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database connection failed:', dbError);
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    res.json({ options });
  } catch (error) {
    console.error('❌ [Vercel] Artist options error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}