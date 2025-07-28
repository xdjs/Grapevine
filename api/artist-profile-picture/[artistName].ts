import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { artistName } = req.query;

  if (!artistName || typeof artistName !== 'string') {
    return res.status(400).json({ message: 'Artist name is required' });
  }

  console.log(`🖼️ [Profile] Fetching profile picture for: ${artistName}`);

  let profileImageUrl = null;
  
  // Method 1: Try Spotify API (if properly configured)
  try {
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Check if we have real Spotify credentials (not placeholders)
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && 
        !SPOTIFY_CLIENT_ID.includes('placeholder') && 
        !SPOTIFY_CLIENT_ID.includes('your_') &&
        !SPOTIFY_CLIENT_SECRET.includes('placeholder') && 
        !SPOTIFY_CLIENT_SECRET.includes('your_')) {
      
      // Get access token
      const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json() as { access_token: string };
        const accessToken = tokenData.access_token;
        
        // Search for artist
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { artists: { items: Array<{ images: Array<{ url: string }> }> } };
          const artists = searchData.artists.items;
          if (artists.length > 0 && artists[0].images && artists[0].images.length > 0) {
            // Use the smallest image for better performance (usually the last one)
            profileImageUrl = artists[0].images[artists[0].images.length - 1].url;
            console.log(`🖼️✅ [Profile] Found Spotify profile image for ${artistName}`);
          }
        }
      }
    } else {
      console.log(`🖼️⚠️ [Profile] Spotify credentials not properly configured`);
    }
  } catch (spotifyError) {
    console.warn(`🖼️❌ [Profile] Spotify API failed for ${artistName}:`, spotifyError instanceof Error ? spotifyError.message : 'Unknown error');
  }
  
  // Method 2: Fallback to MusicBrainz Cover Art Archive
  if (!profileImageUrl) {
    try {
      console.log(`🖼️🔄 [Profile] Trying MusicBrainz fallback for ${artistName}`);
      const mbResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=1`
      );
      
      if (mbResponse.ok) {
        const mbData = await mbResponse.json() as { artists: Array<{ id: string }> };
        if (mbData.artists && mbData.artists.length > 0) {
          const artistId = mbData.artists[0].id;
          
          // Try to get Cover Art Archive image
          const caaResponse = await fetch(
            `https://coverartarchive.org/artist/${artistId}`,
            { 
              headers: { 'User-Agent': 'Grapevine/1.0 (https://grapevine.app)' }
            }
          );
          
          if (caaResponse.ok) {
            const caaData = await caaResponse.json() as { images: Array<{ image: string, thumbnails: { small: string } }> };
            if (caaData.images && caaData.images.length > 0) {
              profileImageUrl = caaData.images[0].thumbnails?.small || caaData.images[0].image;
              console.log(`🖼️✅ [Profile] Found MusicBrainz profile image for ${artistName}`);
            }
          }
        }
      }
    } catch (mbError) {
      console.warn(`🖼️⚠️ [Profile] MusicBrainz fallback failed for ${artistName}:`, mbError instanceof Error ? mbError.message : 'Unknown error');
    }
  }
  
  // Return result (null if no image found - frontend will use original design)
  if (profileImageUrl) {
    res.json({ 
      artistName,
      imageUrl: profileImageUrl,
      success: true 
    });
  } else {
    console.log(`🖼️⭕ [Profile] No profile image found for ${artistName}`);
    res.json({ 
      artistName,
      imageUrl: null,
      success: true 
    });
  }
} 