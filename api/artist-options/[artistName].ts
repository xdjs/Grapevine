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
    
    const { musicNerdService } = await import('../../server/musicnerd-service.js');
    const options = await musicNerdService.getArtistOptions(artistName);
    
    console.log(`🔍 [DEBUG] Looking up artist options for: "${artistName}"`);
    console.log(`✅ [DEBUG] Found ${options?.length || 0} artist options for "${artistName}"`);
    
    res.json({ options: options || [] });
  } catch (error) {
    console.error('Artist options error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}