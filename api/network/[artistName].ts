import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { artistName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    console.log(`Network data request for: ${artistName}`);
    
    const { storage } = await import('../../server/storage.js');
    const networkData = await storage.getNetworkData(artistName);
    
    res.json(networkData);
  } catch (error) {
    console.error("Error fetching network data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}