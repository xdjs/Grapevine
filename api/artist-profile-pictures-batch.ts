import { NextRequest, NextResponse } from 'next/server';
import { DatabaseStorage } from '../server/database-storage.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artistNames, forceRefresh = false, size = 'medium' } = body;
    
    if (!artistNames || !Array.isArray(artistNames)) {
      return NextResponse.json({ 
        error: 'artistNames array is required' 
      }, { status: 400 });
    }
    
    if (artistNames.length === 0) {
      return NextResponse.json({ 
        profilePictures: {},
        totalRequested: 0,
        totalFound: 0,
        fromCache: 0
      });
    }
    
    if (artistNames.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 artists allowed per batch request' 
      }, { status: 400 });
    }
    
    console.log(`🖼️ [API] Batch fetching profile pictures for ${artistNames.length} artists (forceRefresh: ${forceRefresh})`);
    
    const storage = new DatabaseStorage();
    
    // Get profile pictures with cache-first strategy
    const profilePicturesMap = await storage.getProfilePicturesWithCache(artistNames, forceRefresh);
    
    // Convert Map to object for JSON response
    const profilePictures: Record<string, {
      imageUrl: string;
      spotifyId: string;
      fromCache: boolean;
      available: boolean;
    }> = {};
    
    let fromCacheCount = 0;
    
    for (const artistName of artistNames) {
      const profileData = profilePicturesMap.get(artistName);
      if (profileData) {
        profilePictures[artistName] = {
          imageUrl: profileData.imageUrl,
          spotifyId: profileData.spotifyId,
          fromCache: profileData.fromCache,
          available: true
        };
        if (profileData.fromCache) {
          fromCacheCount++;
        }
      } else {
        profilePictures[artistName] = {
          imageUrl: '',
          spotifyId: '',
          fromCache: false,
          available: false
        };
      }
    }
    
    const totalFound = Object.values(profilePictures).filter(p => p.available).length;
    
    console.log(`✅ [API] Batch profile picture retrieval complete: ${totalFound}/${artistNames.length} found, ${fromCacheCount} from cache`);
    
    return NextResponse.json({
      profilePictures,
      totalRequested: artistNames.length,
      totalFound,
      fromCache: fromCacheCount,
      size
    });
    
  } catch (error) {
    console.error(`❌ [API] Error in batch profile picture fetch:`, error);
    return NextResponse.json({ 
      error: 'Internal server error',
      profilePictures: {},
      totalRequested: 0,
      totalFound: 0,
      fromCache: 0
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
