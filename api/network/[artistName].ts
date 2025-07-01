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
    const { artistName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    console.log(`🎵 [Vercel] Network data request for: ${artistName}`);
    
    // For now, return a message indicating the full network generation needs to be implemented
    // This is complex due to all the service dependencies
    return res.status(501).json({ 
      message: 'Network generation on Vercel requires additional setup. Please use the main deployment for full functionality.',
      artist: artistName
    });
    
  } catch (error) {
    console.error("❌ [Vercel] Error fetching network data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}