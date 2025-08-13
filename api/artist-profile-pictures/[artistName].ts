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
    res.status(405).json({ error: 'Method not allowed', reason: 'invalid_method' });
    return;
  }

  const artistNameParam = req.query.artistName;
  const artistName = Array.isArray(artistNameParam) ? artistNameParam[0] : artistNameParam;
  if (!artistName || typeof artistName !== 'string') {
    res.status(400).json({ error: 'Artist name is required', reason: 'missing_param' });
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
      res.status(500).json({ error: 'Database connection not configured', available: false, artist: decodedArtistName, reason: 'db_not_configured' });
      return;
    }
    const spotifyConfigured = Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
    if (!spotifyConfigured) console.warn('⚠️ [ProfilePics:single] Spotify credentials not configured; will only serve cache');

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
      let notFoundReason: string = 'unknown';
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
          notFoundReason = 'cache_miss';
        } catch (cacheErr) {
          console.warn('⚠️ [ProfilePics:single] Cache query failed; falling back to Spotify', cacheErr);
          notFoundReason = 'cache_query_failed';
        }
      }

      // Helper: Spotify fetch with retries, exponential backoff, and Retry-After support
      const fetchFromSpotifyWithRetry = async (
        name: string,
        preferredSize: 'small' | 'medium' | 'large',
        maxRetries: number = 3
      ): Promise<{
        imageUrl: string;
        spotifyId: string;
      } | null> => {
        const { spotifyService } = await import('../../server/spotify');
        let lastErr: any = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const resultMap = await spotifyService.batchGetArtistProfileImages([name], preferredSize);
            const data = resultMap.get(name);
            if (data && data.imageUrl) {
              return { imageUrl: data.imageUrl, spotifyId: data.spotifyId };
            }
            // No match is not an error; break early
            return null;
          } catch (err: any) {
            lastErr = err;
            const status = err?.response?.status || err?.code;
            const retryAfterHeader = err?.response?.headers?.['retry-after'] || err?.response?.headers?.['Retry-After'];
            // Determine delay
            let delayMs = 0;
            if (retryAfterHeader) {
              const sec = Number(retryAfterHeader);
              if (!Number.isNaN(sec) && sec > 0) delayMs = sec * 1000;
            }
            // Exponential backoff if not given or to extend wait
            const backoffMs = 500 * Math.pow(2, attempt);
            delayMs = Math.max(delayMs, backoffMs);

            // Retry only on rate limit or transient errors; stop on final attempt
            const isRateLimited = status === 429;
            const isTransient = status === 500 || status === 502 || status === 503 || status === 504 || status === 'ECONNRESET' || status === 'ETIMEDOUT';
            if ((isRateLimited || isTransient) && attempt < maxRetries) {
              if (delayMs > 0) {
                await new Promise(r => setTimeout(r, delayMs));
              }
              continue;
            }
            // Non-retryable or exhausted
            throw err;
          }
        }
        throw lastErr; // should not reach here
      };

      // Miss or refresh: fetch from Spotify if configured
      let spotifyErrorStatus: number | string | undefined;
      let spotifyErrorMessage: string | undefined;
      if (spotifyConfigured) {
        try {
          const data = await fetchFromSpotifyWithRetry(decodedArtistName, size || 'medium', 3);
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
          notFoundReason = 'spotify_no_match_or_no_image';
        } catch (spErr) {
          console.warn(`⚠️ [ProfilePics:single] Spotify fetch error for ${decodedArtistName}:`, spErr);
          notFoundReason = 'spotify_fetch_error';
          try {
            // Extract status/message if axios-style error
            // @ts-ignore
            spotifyErrorStatus = spErr?.response?.status || spErr?.code || 'unknown';
            // @ts-ignore
            spotifyErrorMessage = spErr?.response?.data?.error_description || spErr?.message || 'unknown';
          } catch {}
        }
      }
      else {
        // Spotify not configured and cache miss
        if (!client || forceRefresh) {
          notFoundReason = 'spotify_not_configured';
        } else if (notFoundReason === 'unknown') {
          notFoundReason = 'spotify_not_configured_cache_miss';
        }
      }

      // If we reach here, no image
      const payload: any = { artist: decodedArtistName, available: false, error: 'Profile picture not found', reason: notFoundReason };
      if (notFoundReason === 'spotify_fetch_error') {
        if (spotifyErrorStatus !== undefined) payload.spotifyStatus = spotifyErrorStatus;
        if (spotifyErrorMessage) payload.spotifyMessage = spotifyErrorMessage;
      }
      res.status(404).json(payload);
    } finally {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
  } catch (error) {
    console.error(`❌ [ProfilePics:single] Error for "${decodedArtistName}":`, error);
    res.status(500).json({ artist: decodedArtistName, available: false, error: 'Internal server error', reason: 'unhandled_exception' });
  }
}
