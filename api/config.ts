export default function handler(req, res) {
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
    // Use production URL from environment variable
    const musicNerdBaseUrl = process.env.MUSIC_BASE_URL || process.env.MUSICNERD_BASE_URL;
    
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