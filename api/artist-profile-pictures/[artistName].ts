import { NextRequest, NextResponse } from 'next/server';
import { DatabaseStorage } from '../../server/database-storage.js';

export async function GET(request: NextRequest, context: { params: { artistName: string } }) {
  const artistName = context.params.artistName;
  
  if (!artistName) {
    return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
  }

  // Decode the artist name from URL encoding
  const decodedArtistName = decodeURIComponent(artistName);
  
  try {
    console.log(`🖼️ [API] Fetching profile picture for artist: "${decodedArtistName}"`);
    
    const storage = new DatabaseStorage();
    
    // Parse query parameters
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const size = url.searchParams.get('size') as 'small' | 'medium' | 'large' || 'medium';
    
    // Get profile picture with cache-first strategy
    const profilePicturesMap = await storage.getProfilePicturesWithCache([decodedArtistName], forceRefresh);
    const profileData = profilePicturesMap.get(decodedArtistName);
    
    if (!profileData) {
      console.log(`❌ [API] No profile picture found for "${decodedArtistName}"`);
      return NextResponse.json({ 
        error: 'Profile picture not found',
        artist: decodedArtistName,
        available: false
      }, { status: 404 });
    }
    
    console.log(`✅ [API] Profile picture retrieved for "${decodedArtistName}" (from cache: ${profileData.fromCache})`);
    
    return NextResponse.json({
      artist: decodedArtistName,
      imageUrl: profileData.imageUrl,
      spotifyId: profileData.spotifyId,
      fromCache: profileData.fromCache,
      available: true,
      size: size
    });
    
  } catch (error) {
    console.error(`❌ [API] Error fetching profile picture for "${decodedArtistName}":`, error);
    return NextResponse.json({ 
      error: 'Internal server error',
      artist: decodedArtistName,
      available: false
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
