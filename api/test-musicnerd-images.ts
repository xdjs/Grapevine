import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import MusicNerd service
const { musicNerdService } = await import('../../server/musicnerd-service');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 [MusicNerd Images Test] Function started');
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🧪 [MusicNerd Images Test] CORS preflight request');
    res.status(200).end();
    return;
  }

  try {
    const { artistName = 'Taylor Swift' } = req.query;
    
    console.log(`🧪 [MusicNerd Images Test] Testing MusicNerd profile picture for artist: ${artistName}`);
    
    // Test MusicNerd service availability
    const isAvailable = musicNerdService.isServiceAvailable();
    console.log(`🧪 [MusicNerd Images Test] MusicNerd service available: ${isAvailable}`);
    
    if (!isAvailable) {
      return res.status(200).json({
        success: false,
        message: 'MusicNerd service not available',
        artistName,
        musicNerdAvailable: false,
        envVars: {
          CONNECTION_STRING: !!process.env.CONNECTION_STRING
        }
      });
    }

    // Test profile picture fetching
    console.log(`🧪 [MusicNerd Images Test] Fetching profile picture for: ${artistName}`);
    const musicNerdData = await musicNerdService.getArtistProfilePicture(artistName as string);
    
    const response = {
      success: true,
      message: 'MusicNerd profile picture test completed',
      artistName,
      musicNerdAvailable: true,
      musicNerdData: {
        id: musicNerdData.id,
        imageUrl: musicNerdData.imageUrl,
        hasImage: !!musicNerdData.imageUrl
      },
      testResults: {
        hasImageUrl: !!musicNerdData.imageUrl,
        imageUrl: musicNerdData.imageUrl,
        artistId: musicNerdData.id
      }
    };

    if (musicNerdData.imageUrl) {
      console.log(`🧪 [MusicNerd Images Test] Success! Found image: ${musicNerdData.imageUrl}`);
    } else {
      console.log(`🧪 [MusicNerd Images Test] No image found for "${artistName}"`);
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('🧪 [MusicNerd Images Test] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing MusicNerd profile pictures',
      error: error instanceof Error ? error.message : 'Unknown error',
      artistName: req.query.artistName || 'Taylor Swift'
    });
  }
} 