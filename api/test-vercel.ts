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
    console.log('🧪 [Vercel Test] Function called');
    console.log('🧪 [Vercel Test] Environment variables check:');
    console.log('🧪 [Vercel Test] NODE_ENV:', process.env.NODE_ENV);
    console.log('🧪 [Vercel Test] CONNECTION_STRING exists:', !!process.env.CONNECTION_STRING);
    console.log('🧪 [Vercel Test] OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('🧪 [Vercel Test] SPOTIFY_CLIENT_ID exists:', !!process.env.SPOTIFY_CLIENT_ID);
    console.log('🧪 [Vercel Test] SPOTIFY_CLIENT_SECRET exists:', !!process.env.SPOTIFY_CLIENT_SECRET);
    
    // Test database connection
    let dbConnectionTest = 'Not attempted';
    if (process.env.CONNECTION_STRING) {
      try {
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: process.env.CONNECTION_STRING,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        await client.connect();
        const result = await client.query('SELECT COUNT(*) as count FROM artists LIMIT 1');
        await client.end();
        dbConnectionTest = `Success - Found ${result.rows[0].count} artists`;
      } catch (error) {
        dbConnectionTest = `Failed - ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        CONNECTION_STRING: !!process.env.CONNECTION_STRING,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
        SPOTIFY_CLIENT_SECRET: !!process.env.SPOTIFY_CLIENT_SECRET,
      },
      database: {
        connectionTest: dbConnectionTest
      },
      request: {
        method: req.method,
        url: req.url,
        headers: Object.keys(req.headers)
      }
    };

    console.log('🧪 [Vercel Test] Response:', JSON.stringify(response, null, 2));
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Vercel Test] Error:', error);
    return res.status(500).json({ 
      error: 'Test failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
} 