import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkNode } from '@/types/network';

interface ProfilePictureResult {
  artistName: string;
  imageUrl: string | null;
  spotifyId: string | null;
  cached: boolean;
  error?: string;
}

// No longer using batch endpoint; we aggregate per-artist results into stats

interface UseProfilePicturesOptions {
  /** Whether to automatically fetch images for nodes that don't have them */
  autoFetch?: boolean;
  /** Whether to use cached images from database */
  useCache?: boolean;
  /** Maximum number of concurrent requests */
  batchSize?: number;
}

interface UseProfilePicturesReturn {
  /** Whether profile pictures are currently being fetched */
  isLoading: boolean;
  /** Error message if fetching failed */
  error: string | null;
  /** Statistics about the last fetch operation */
  stats: {
    totalRequested: number;
    totalFound: number;
    totalCached: number;
    processingTimeMs: number;
  } | null;
  /** Manually fetch profile pictures for given nodes */
  fetchProfilePictures: (nodes: NetworkNode[]) => Promise<Map<string, string>>;
  /** Update nodes with fetched profile picture URLs */
  updateNodesWithImages: (nodes: NetworkNode[]) => Promise<NetworkNode[]>;
}

/**
 * Hook for managing profile picture fetching separately from network generation
 * Provides optimized batch fetching with caching and error handling
 */
export function useProfilePictures(options: UseProfilePicturesOptions = {}): UseProfilePicturesReturn {
  const {
    autoFetch = true,
    useCache = true,
    batchSize = 25
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UseProfilePicturesReturn['stats']>(null);
  // Track which artist names we've already retried once to avoid infinite retries across calls
  const retriedOnceRef = useRef<Set<string>>(new Set());

  /**
   * Fetch profile pictures for a batch of artists
   */
  const fetchProfilePictures = useCallback(async (nodes: NetworkNode[]): Promise<Map<string, string>> => {
    if (nodes.length === 0) {
      return new Map();
    }

    setIsLoading(true);
    setError(null);

    try {
      // Filter out nodes that already have images (unless we're forcing a refresh)
      const artistNames = nodes
        .filter(node => !node.imageUrl || !useCache)
        .map(node => node.name);

      if (artistNames.length === 0) {
        console.log('🖼️ [ProfilePictures] All nodes already have images, skipping fetch');
        setIsLoading(false);
        return new Map();
      }

      console.log(`🖼️ [ProfilePictures] Fetching images for ${artistNames.length} artists`);

      // Per-artist retrieval (no batch). Sequential with one retry per artist.
      const imageMap = new Map<string, string>();
      const startAll = Date.now();
      const totals = {
        totalRequested: artistNames.length,
        totalFound: 0,
        totalCached: 0,
        processingTimeMs: 0,
      };

      for (const artistName of artistNames) {
        const urlBase = `/api/artist-profile-pictures/${encodeURIComponent(artistName)}`;
        const refreshParam = useCache ? '' : '&refresh=true';
        const url = `${urlBase}?size=medium${refreshParam}`;

        const attemptFetch = async (): Promise<ProfilePictureResult | null> => {
          const resp = await fetch(url, { method: 'GET' });
          // Best-effort parse JSON for richer error context
          if (!resp.ok) {
            let reason = '';
            try {
              const j = await resp.json();
              reason = j?.reason ? ` - ${j.reason}` : '';
            } catch {}
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}${reason}`);
          }
          const data = await resp.json();
          if (!data || data.available === false || !data.imageUrl) {
            if (data?.reason) {
              console.warn(`⚠️ [ProfilePictures] No image for ${artistName}: ${data.reason}`);
            }
            return null;
          }
          return {
            artistName,
            imageUrl: data.imageUrl as string,
            spotifyId: data.spotifyId ?? null,
            cached: Boolean(data.fromCache),
          };
        };

        const perStart = Date.now();
        try {
          // First attempt
          let result = await attemptFetch();
          if (!result && !retriedOnceRef.current.has(artistName)) {
            retriedOnceRef.current.add(artistName);
            console.log(`🔁 [ProfilePictures] Retrying once for ${artistName}`);
            try {
              result = await attemptFetch();
            } catch (retryError) {
              // Swallow retry error, continue to next artist
            }
          }

          if (result && result.imageUrl) {
            imageMap.set(artistName, result.imageUrl);
            totals.totalFound += 1;
            if (result.cached) totals.totalCached += 1;
          }
        } catch (err) {
          // Log and continue; do not set global error for partial failures
          console.warn(`⚠️ [ProfilePictures] Failed to fetch image for ${artistName}:`, err);
        } finally {
          totals.processingTimeMs += (Date.now() - perStart);
        }
      }

      // Use wall clock time as an approximation too
      const totalElapsed = Date.now() - startAll;
      if (totals.processingTimeMs < totalElapsed) {
        totals.processingTimeMs = totalElapsed;
      }

      setStats(totals);
      console.log(`✅ [ProfilePictures] Per-artist fetch complete: ${totals.totalFound}/${totals.totalRequested} images found, ${totals.totalCached} from cache`);
      return imageMap;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ [ProfilePictures] Failed to fetch profile pictures:', errorMessage);
      setError(errorMessage);
      return new Map();
    } finally {
      setIsLoading(false);
    }
  }, [useCache, batchSize]);

  /**
   * Update nodes array with fetched profile picture URLs
   */
  const updateNodesWithImages = useCallback(async (nodes: NetworkNode[]): Promise<NetworkNode[]> => {
    if (!autoFetch) {
      return nodes;
    }

    const imageMap = await fetchProfilePictures(nodes);
    
    if (imageMap.size === 0) {
      return nodes;
    }

    // Create updated nodes array with new image URLs
    const updatedNodes = nodes.map(node => {
      const imageUrl = imageMap.get(node.name);
      if (imageUrl && imageUrl !== node.imageUrl) {
        console.log(`🖼️ [ProfilePictures] Updated ${node.name} with new image: ${imageUrl}`);
        return {
          ...node,
          imageUrl
        };
      }
      return node;
    });

    return updatedNodes;
  }, [autoFetch, fetchProfilePictures]);

  return {
    isLoading,
    error,
    stats,
    fetchProfilePictures,
    updateNodesWithImages
  };
}

/**
 * Utility function to check if a node needs a profile picture
 */
export function nodeNeedsProfilePicture(node: NetworkNode): boolean {
  return !node.imageUrl && (node.type === 'artist' || (node.types?.includes('artist') ?? false));
}

/**
 * Utility function to get all artist names from nodes that need profile pictures
 */
export function getArtistNamesNeedingImages(nodes: NetworkNode[]): string[] {
  return nodes
    .filter(nodeNeedsProfilePicture)
    .map(node => node.name);
}
