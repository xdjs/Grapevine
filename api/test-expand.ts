import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`🧪 [Test] Test expand endpoint called`);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Return a simple test response
  res.json({
    message: 'Expand endpoint is working',
    timestamp: new Date().toISOString(),
    testData: {
      nodes: [
        { id: 'test-artist', name: 'Test Artist', type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: null },
        { id: 'test-collaborator', name: 'Test Collaborator', type: 'producer', types: ['producer'], color: '#8A2BE2', size: 20, artistId: null }
      ],
      links: [
        { source: 'test-artist', target: 'test-collaborator' }
      ]
    }
  });
} 