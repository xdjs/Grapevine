import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🏥 [Health Check] Function started');
  console.log('🏥 [Health Check] Method:', req.method);
  console.log('🏥 [Health Check] URL:', req.url);
  console.log('🏥 [Health Check] Environment vars available:', Object.keys(process.env).length);
  console.log('🏥 [Health Check] CONNECTION_STRING exists:', !!process.env.CONNECTION_STRING);
  console.log('🏥 [Health Check] OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🏥 [Health Check] CORS preflight request');
    res.status(200).end();
    return;
  }

  try {
    // Test database connection
    let dbStatus = 'not configured';
    if (process.env.CONNECTION_STRING) {
      try {
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: process.env.CONNECTION_STRING,
          ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        const result = await client.query('SELECT 1 as test');
        await client.end();
        dbStatus = result.rows[0].test === 1 ? 'connected' : 'error';
      } catch (dbError) {
        console.error('🏥 [Health Check] Database error:', dbError);
        dbStatus = 'error: ' + (dbError instanceof Error ? dbError.message : 'unknown');
      }
    }

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        hasConnectionString: !!process.env.CONNECTION_STRING,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        envVarsCount: Object.keys(process.env).length
      },
      database: {
        status: dbStatus
      },
      api: {
        method: req.method,
        url: req.url,
        headers: Object.keys(req.headers)
      }
    };

    console.log('🏥 [Health Check] Response:', JSON.stringify(healthData, null, 2));
    res.status(200).json(healthData);
  } catch (error) {
    console.error('🏥 [Health Check] Error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'unknown error',
      timestamp: new Date().toISOString()
    });
  }
}