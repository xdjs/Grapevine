import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Node runtime handler to match other API functions in this project
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const artistNameParam = req.query.artistName;
  const artistName = Array.isArray(artistNameParam) ? artistNameParam[0] : artistNameParam;
  if (!artistName || typeof artistName !== 'string') {
    res.status(400).json({ error: 'Artist name is required' });
    return;
  }

  const decodedArtistName = decodeURIComponent(artistName);

  try {
    console.log(`🖼️ [ProfilePics:single] Request for "${decodedArtistName}"`);

    // Env checks
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

    if (!CONNECTION_STRING) {
      res.status(500).json({ error: 'Database connection not configured', available: false, artist: decodedArtistName });
      return;
    }
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.warn('⚠️ [ProfilePics:single] Spotify credentials not configured; will only serve cache');
    }

    // Parse query params
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const size = (String(req.query.size || 'medium') as 'small' | 'medium' | 'large');

    // Try to connect to DB, but don't fail hard if unavailable
    let client: any = null;
    try {
      const { Client } = await import('pg');
      client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
    } catch (dbConnErr) {
      console.warn('⚠️ [ProfilePics:single] DB connect failed; continuing without cache', dbConnErr);
    }

    try {
      // Cache-first unless forceRefresh, only if DB connected
      if (client && !forceRefresh) {
        try {
          const cacheQuery = 'SELECT node_pfp, spotify_id FROM artists WHERE LOWER(name) = LOWER($1) AND node_pfp IS NOT NULL';
          const cacheResult = await client.query(cacheQuery, [decodedArtistName]);
          if (cacheResult.rows.length > 0 && cacheResult.rows[0].node_pfp) {
            console.log(`📦 [ProfilePics:single] Cache hit for ${decodedArtistName}`);
            res.json({
              artist: decodedArtistName,
              imageUrl: cacheResult.rows[0].node_pfp,
              spotifyId: cacheResult.rows[0].spotify_id,
              fromCache: true,
              available: true,
              size
            });
            return;
          }
        } catch (cacheErr) {
          console.warn('⚠️ [ProfilePics:single] Cache query failed; falling back to Spotify', cacheErr);
        }
      }

      // Miss or refresh: fetch from Spotify if configured
      if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
        try {
          const { spotifyService } = await import('../../server/spotify');
          const resultMap = await spotifyService.batchGetArtistProfileImages([decodedArtistName], size || 'medium');
          const data = resultMap.get(decodedArtistName);
          if (data && data.imageUrl) {
            // Update cache best-effort
            if (client) {
              try {
                const up = `UPDATE artists SET node_pfp = $1, spotify_id = $2 WHERE LOWER(name) = LOWER($3)`;
                await client.query(up, [data.imageUrl, data.spotifyId, decodedArtistName]);
              } catch (dbErr) {
                console.warn(`⚠️ [ProfilePics:single] Failed to cache DB for ${decodedArtistName}:`, dbErr);
              }
            }
            res.json({
              artist: decodedArtistName,
              imageUrl: data.imageUrl,
              spotifyId: data.spotifyId,
              fromCache: false,
              available: true,
              size
            });
            return;
          }
        } catch (spErr) {
          console.warn(`⚠️ [ProfilePics:single] Spotify fetch error for ${decodedArtistName}:`, spErr);
        }
      }

      // If we reach here, no image
      res.status(404).json({ artist: decodedArtistName, available: false, error: 'Profile picture not found' });
    } finally {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
  } catch (error) {
    console.error(`❌ [ProfilePics:single] Error for "${decodedArtistName}":`, error);
    res.status(500).json({ artist: decodedArtistName, available: false, error: 'Internal server error' });
  }
}
