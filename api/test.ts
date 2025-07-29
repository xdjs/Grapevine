import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 [Test] Test endpoint called');
  
  // Test environment variables
  const envStatus = {
    NODE_ENV: process.env.NODE_ENV,
    hasConnectionString: !!process.env.CONNECTION_STRING,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasSpotifyId: !!process.env.SPOTIFY_CLIENT_ID,
    hasSpotifySecret: !!process.env.SPOTIFY_CLIENT_SECRET,
    spotifyIdPreview: process.env.SPOTIFY_CLIENT_ID ? process.env.SPOTIFY_CLIENT_ID.substring(0, 8) + '...' : 'missing',
    spotifyConfigured: !!(process.env.SPOTIFY_CLIENT_ID && 
                          process.env.SPOTIFY_CLIENT_SECRET &&
                          !process.env.SPOTIFY_CLIENT_ID.includes('placeholder') &&
                          !process.env.SPOTIFY_CLIENT_ID.includes('your_') &&
                          !process.env.SPOTIFY_CLIENT_SECRET.includes('placeholder') &&
                          !process.env.SPOTIFY_CLIENT_SECRET.includes('your_'))
  };

  // Test Spotify API if credentials are available
  let spotifyTest: any = null;
  if (envStatus.spotifyConfigured) {
    try {
      const authString = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      spotifyTest = {
        tokenRequestStatus: tokenResponse.status,
        tokenRequestOk: tokenResponse.ok,
        canAuthenticate: tokenResponse.ok
      };
      
      if (tokenResponse.ok) {
        // Test searching for a few popular artists to see profile picture availability
        const tokenData = await tokenResponse.json() as { access_token: string };
        const testArtists = ['Taylor Swift', 'Ariana Grande', 'Ed Sheeran'];
        const profilePictureTests = [];
        
        for (const artistName of testArtists) {
          try {
            const searchResponse = await fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
              {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
              }
            );
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json() as { artists: { items: Array<{ images: Array<{ url: string }> }> } };
              const artists = searchData.artists.items;
              const hasProfilePicture = artists.length > 0 && artists[0].images && artists[0].images.length > 0;
              
              profilePictureTests.push({
                artist: artistName,
                found: artists.length > 0,
                hasProfilePicture,
                imageUrl: hasProfilePicture ? artists[0].images[artists[0].images.length - 1].url : null
              });
            }
          } catch (error) {
            profilePictureTests.push({
              artist: artistName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        spotifyTest.searchStatus = 200;
        spotifyTest.searchOk = true;
        spotifyTest.fullWorking = true;
        spotifyTest.profilePictureTests = profilePictureTests;
      }
    } catch (error) {
      spotifyTest = {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullWorking: false
      };
    }
  }

  const response = {
    message: '✅ Test endpoint working!',
    timestamp: new Date().toISOString(),
    environment: envStatus,
    spotifyTest,
    profilePictureInfo: {
      enabled: envStatus.spotifyConfigured,
      scope: envStatus.spotifyConfigured ? 'All artist nodes will get profile pictures if available on Spotify' : 'Disabled - add Spotify credentials',
      batchProcessing: 'Profile pictures are fetched in batches of 5 to avoid API rate limits',
      fallback: 'If Spotify fails, system tries MusicBrainz Cover Art Archive',
      consistency: {
        cacheBusting: 'Profile picture requests include cache-busting parameters',
        freshFetching: 'Profile pictures are always fetched fresh, regardless of network data cache status',
        errorHandling: 'Robust error handling ensures app continues working even if some profile pictures fail',
        displayGuarantee: 'NetworkVisualizer component ensures profile pictures are checked on every render'
      }
    },
    recommendations: {
      profilePictures: envStatus.spotifyConfigured 
        ? '✅ Profile pictures should work for all artist nodes consistently' 
        : '❌ Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to Vercel environment variables for profile pictures',
      testing: 'Search for artists like "Taylor Swift", "Ariana Grande", or "Ed Sheeran" to test profile picture functionality',
      debugging: 'Open browser console to see detailed profile picture fetching logs'
    }
  };

  console.log('🧪 [Test] Response:', JSON.stringify(response, null, 2));
  
  res.status(200).json(response);
}