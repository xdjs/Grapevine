import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: "Query parameter 'q' is required" });
    }

    const { storage } = await import('../server/storage.js');
    const artist = await storage.getArtistByName(query);
    
    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    res.json(artist);
  } catch (error) {
    console.error("Error searching artist:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}