import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
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
    // Use production URL with fallback to environment variable
    const musicNerdBaseUrl = process.env.MUSICNERD_BASE_URL_OVERRIDE || 'https://www.musicnerd.xyz';
    
    console.log(`🔧 [Vercel Config] Returning musicNerdBaseUrl: ${musicNerdBaseUrl}`);
    
    res.json({ 
      musicNerdBaseUrl 
    });
  } catch (error) {
    console.error("❌ [Vercel Config] Error:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}