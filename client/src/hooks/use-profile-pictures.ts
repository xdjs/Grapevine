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
        .filter(node => (!node.imageUrl || !useCache) && node.name)
        .map(node => node.name);

      if (artistNames.length === 0) {
        console.log('🖼️ [ProfilePictures] All nodes already have images, skipping fetch');
        setIsLoading(false);
        return new Map();
      }

      console.log(`🖼️ [ProfilePictures] Fetching images for ${artistNames.length} artists`);

      // Process in batches to avoid overwhelming the API
      const imageMap = new Map<string, string>();
      let totalStats = {
        totalRequested: 0,
        totalFound: 0,
        totalCached: 0,
        processingTimeMs: 0
      };

      for (let i = 0; i < artistNames.length; i += batchSize) {
        const batch = artistNames.slice(i, i + batchSize);
        
        console.log(`🖼️ [ProfilePictures] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(artistNames.length/batchSize)}`);

        const response = await fetch('/api/artist-profile-pictures-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artistNames: batch,
            useCache
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ProfilePictureBatchResponse = await response.json();
        
        // Update running totals
        totalStats.totalRequested += data.totalRequested;
        totalStats.totalFound += data.totalFound;
        totalStats.totalCached += data.totalCached;
        totalStats.processingTimeMs += data.processingTimeMs;

        // Process results
        data.results.forEach(result => {
          if (result.imageUrl) {
            imageMap.set(result.artistName, result.imageUrl);
          }
        });

        // Add delay between batches to be respectful to the API
        if (i + batchSize < artistNames.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setStats(totalStats);
      
      console.log(`✅ [ProfilePictures] Batch fetch complete: ${totalStats.totalFound}/${totalStats.totalRequested} images found, ${totalStats.totalCached} from cache`);
      
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
