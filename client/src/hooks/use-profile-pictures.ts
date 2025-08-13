import { useState, useEffect, useCallback } from 'react';
import { NetworkNode } from '@/types/network';

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

  /**
   * Fetch profile pictures per-artist (no batch endpoint)
   */
  const fetchProfilePictures = useCallback(async (nodes: NetworkNode[]): Promise<Map<string, string>> => {
    if (nodes.length === 0) {
      return new Map();
    }

    setIsLoading(true);
    setError(null);

    const start = Date.now();
    const imageMap = new Map<string, string>();
    const artistNames = nodes
      .filter(node => !node.imageUrl || !useCache)
      .map(node => node.name);

    const totalStats = {
      totalRequested: artistNames.length,
      totalFound: 0,
      totalCached: 0,
      processingTimeMs: 0,
    };

    // Process with limited concurrency using batchSize as concurrency limit
    const concurrency = Math.max(1, batchSize);
    let index = 0;

    const fetchOne = async (artistName: string) => {
      try {
        const params = new URLSearchParams();
        params.set('size', 'medium');
        if (!useCache) params.set('refresh', 'true');
        const url = `/api/artist-profile-pictures/${encodeURIComponent(artistName)}${params.toString() ? `?${params.toString()}` : ''}`;

        const res = await fetch(url);
        if (!res.ok) {
          // Treat 404 as not found; other errors recorded but do not throw
          if (res.status !== 404) {
            const msg = await res.text().catch(() => '');
            console.warn(`⚠️ [ProfilePictures] HTTP ${res.status} for ${artistName}: ${msg}`);
          }
          return;
        }
        const data = await res.json();
        if (data && data.imageUrl) {
          imageMap.set(artistName, data.imageUrl as string);
          totalStats.totalFound += 1;
          if (data.fromCache) totalStats.totalCached += 1;
        }
      } catch (e) {
        console.warn(`⚠️ [ProfilePictures] Error fetching image for ${artistName}:`, e);
      }
    };

    const workers: Promise<void>[] = Array.from({ length: Math.min(concurrency, artistNames.length) }, async () => {
      while (index < artistNames.length) {
        const current = artistNames[index++];
        await fetchOne(current);
        // Small yield to avoid starving event loop
        await Promise.resolve();
      }
    });

    try {
      await Promise.all(workers);
    } finally {
      totalStats.processingTimeMs = Date.now() - start;
      setStats(totalStats);
      setIsLoading(false);
    }

    console.log(`✅ [ProfilePictures] Fetched ${totalStats.totalFound}/${totalStats.totalRequested} images (cached: ${totalStats.totalCached})`);
    return imageMap;
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
