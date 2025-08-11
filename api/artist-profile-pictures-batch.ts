import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProfilePictureRequest {
  artistNames: string[];
  useCache?: boolean;
}

interface ProfilePictureResult {
  artistName: string;
  imageUrl: string | null;
  spotifyId: string | null;
  cached: boolean;
  error?: string;
}

interface ProfilePictureBatchResponse {
  results: ProfilePictureResult[];
  totalRequested: number;
  totalFound: number;
  totalCached: number;
  processingTimeMs: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use POST.' });
  }

  const startTime = Date.now();

  try {
    const body = req.body as ProfilePictureRequest;
    
    if (!body.artistNames || !Array.isArray(body.artistNames) || body.artistNames.length === 0) {
      return res.status(400).json({ 
        message: 'artistNames array is required and must not be empty',
        example: { artistNames: ["Taylor Swift", "Drake"] }
      });
    }

    // Limit batch size for performance
    if (body.artistNames.length > 50) {
      return res.status(400).json({
        message: 'Maximum 50 artists per batch request',
        received: body.artistNames.length
      });
    }

    console.log(`🖼️ [ProfilePics] Batch request for ${body.artistNames.length} artists: [${body.artistNames.join(', ')}]`);

    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!CONNECTION_STRING) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ message: 'Spotify API credentials not configured' });
    }

    // Initialize database connection
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();

    const results: ProfilePictureResult[] = [];
    const uncachedArtists: string[] = [];
    let cachedCount = 0;

    // First pass: Check cache if requested
    if (body.useCache !== false) {
      console.log(`📦 [ProfilePics] Checking cache for ${body.artistNames.length} artists...`);
      
      for (const artistName of body.artistNames) {
        try {
          // Check database cache using node_pfp column
          const cacheQuery = 'SELECT node_pfp, spotify_id FROM artists WHERE LOWER(name) = LOWER($1) AND node_pfp IS NOT NULL';
          const cacheResult = await client.query(cacheQuery, [artistName]);
          
          if (cacheResult.rows.length > 0 && cacheResult.rows[0].node_pfp) {
            // node_pfp may be stored as a raw URL string or as JSON containing { imageUrl, spotifyId }
            const rawPfp = cacheResult.rows[0].node_pfp as any;
            let resolvedImageUrl: string | null = null;
            let resolvedSpotifyId: string | null = cacheResult.rows[0].spotify_id ?? null;

            if (typeof rawPfp === 'string') {
              try {
                const parsed = JSON.parse(rawPfp);
                if (parsed && typeof parsed === 'object') {
                  resolvedImageUrl = parsed.imageUrl ?? null;
                  resolvedSpotifyId = resolvedSpotifyId ?? parsed.spotifyId ?? null;
                } else {
                  resolvedImageUrl = rawPfp;
                }
              } catch {
                // Not JSON, treat as direct URL
                resolvedImageUrl = rawPfp;
              }
            } else if (rawPfp && typeof rawPfp === 'object') {
              // pg may return jsonb as object already
              resolvedImageUrl = rawPfp.imageUrl ?? null;
              resolvedSpotifyId = resolvedSpotifyId ?? rawPfp.spotifyId ?? null;
            }

            results.push({
              artistName,
              imageUrl: resolvedImageUrl,
              spotifyId: resolvedSpotifyId,
              cached: true
            });
            cachedCount++;
            console.log(`✅ [ProfilePics] Cache hit for ${artistName}: ${results[results.length - 1].imageUrl}`);
          } else {
            uncachedArtists.push(artistName);
          }
        } catch (error) {
          console.warn(`⚠️ [ProfilePics] Cache check failed for ${artistName}:`, error);
          uncachedArtists.push(artistName);
        }
      }
    } else {
      uncachedArtists.push(...body.artistNames);
    }

    // Second pass: Fetch from Spotify API for uncached artists
    if (uncachedArtists.length > 0) {
      console.log(`🎵 [ProfilePics] Fetching from Spotify API for ${uncachedArtists.length} uncached artists...`);
      
      try {
        // Import Spotify service
        const { spotifyService } = await import('../server/spotify');
        
        if (spotifyService.isConfigured()) {
          // Use optimized batch size for better performance
          const batchSize = 5; // Smaller batches to avoid rate limits
          
          for (let i = 0; i < uncachedArtists.length; i += batchSize) {
            const batch = uncachedArtists.slice(i, i + batchSize);
            console.log(`🎵 [ProfilePics] Processing Spotify batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uncachedArtists.length/batchSize)}: [${batch.join(', ')}]`);
            
            const spotifyResults = await spotifyService.batchGetArtistProfileImages(batch, 'medium');
            
            // Process results and update database cache
            for (const artistName of batch) {
              const spotifyData = spotifyResults.get(artistName);
              
              if (spotifyData) {
                // Update database cache
                try {
                  const updateQuery = `
                    UPDATE artists 
                    SET node_pfp = $1, spotify_id = $2 
                    WHERE LOWER(name) = LOWER($3)
                  `;
                  await client.query(updateQuery, [spotifyData.imageUrl, spotifyData.spotifyId, artistName]);
                  console.log(`💾 [ProfilePics] Cached profile picture for ${artistName}`);
                } catch (dbError) {
                  console.warn(`⚠️ [ProfilePics] Failed to cache data for ${artistName}:`, dbError);
                }
                
                results.push({
                  artistName,
                  imageUrl: spotifyData.imageUrl,
                  spotifyId: spotifyData.spotifyId,
                  cached: false
                });
              } else {
                results.push({
                  artistName,
                  imageUrl: null,
                  spotifyId: null,
                  cached: false,
                  error: 'Not found on Spotify'
                });
              }
            }
            
            // Add delay between batches to respect rate limits
            if (i + batchSize < uncachedArtists.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        } else {
          // Spotify not configured - return null results for uncached artists
          for (const artistName of uncachedArtists) {
            results.push({
              artistName,
              imageUrl: null,
              spotifyId: null,
              cached: false,
              error: 'Spotify API not configured'
            });
          }
        }
      } catch (spotifyError) {
        console.error(`❌ [ProfilePics] Spotify batch processing error:`, spotifyError);
        
        // Add error results for failed artists
        for (const artistName of uncachedArtists) {
          if (!results.find(r => r.artistName === artistName)) {
            results.push({
              artistName,
              imageUrl: null,
              spotifyId: null,
              cached: false,
              error: spotifyError instanceof Error ? spotifyError.message : 'Spotify API error'
            });
          }
        }
      }
    }

    await client.end();

    const processingTime = Date.now() - startTime;
    const totalFound = results.filter(r => r.imageUrl !== null).length;
    
    console.log(`✅ [ProfilePics] Batch processing complete: ${totalFound}/${body.artistNames.length} images found, ${cachedCount} from cache, ${processingTime}ms`);

    const response: ProfilePictureBatchResponse = {
      results,
      totalRequested: body.artistNames.length,
      totalFound,
      totalCached: cachedCount,
      processingTimeMs: processingTime
    };

    res.json(response);
    
  } catch (error) {
    console.error("❌ [ProfilePics] Error in batch profile picture request:", error);
    
    const processingTime = Date.now() - startTime;
    
    res.status(500).json({ 
      message: "Failed to fetch profile pictures",
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
  }
}