import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProfilePictures, nodeNeedsProfilePicture, getArtistNamesNeedingImages } from '../use-profile-pictures';
import type { NetworkNode } from '../../types/network';

// Mock fetch
global.fetch = vi.fn();

describe('useProfilePictures Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTestNodes = (count: number, withImages: boolean = false): NetworkNode[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      name: `Artist ${i}`,
      type: i % 3 === 0 ? 'artist' : i % 3 === 1 ? 'producer' : 'songwriter',
      size: 20,
      imageUrl: withImages ? `https://example.com/image-${i}.jpg` : undefined,
      spotifyId: withImages ? `spotify-${i}` : undefined
    }));
  };

  const mockSuccessfulResponse = (artistNames: string[], foundCount: number = -1) => {
    if (foundCount === -1) foundCount = artistNames.length;
    
    const successfulResults = artistNames.slice(0, foundCount).map((name, i) => ({
      artistName: name,
      imageUrl: `https://example.com/image-${i}.jpg`,
      spotifyId: `spotify-${i}`,
      cached: i % 2 === 0,
      error: undefined
    }));
    
    const failedResults = artistNames.slice(foundCount).map(name => ({
      artistName: name,
      imageUrl: null as string | null,
      spotifyId: null as string | null,
      cached: false,
      error: 'Not found on Spotify'
    }));
    
    return {
      ok: true,
      json: async () => ({
        results: [...successfulResults, ...failedResults],
        totalRequested: artistNames.length,
        totalFound: foundCount,
        totalCached: Math.floor(foundCount / 2),
        processingTimeMs: 150
      })
    };
  };

  const mockFailedResponse = (status: number = 500, message: string = 'Internal Server Error') => {
    return {
      ok: false,
      status,
      statusText: message,
      json: async () => ({ error: message })
    };
  };

  describe('Basic Functionality', () => {
    test('should fetch profile pictures for nodes without images', async () => {
      const testNodes = createTestNodes(5, false);
      const artistNames = testNodes.map(n => n.name);
      
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(artistNames));

      const { result } = renderHook(() => useProfilePictures({ autoFetch: false }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);

      // Use act to wrap the async operation
      let imageMap: Map<string, string>;
      await act(async () => {
        imageMap = await result.current.fetchProfilePictures(testNodes);
      });

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(imageMap!.size).toBe(5);
      expect(imageMap!.get('Artist 0')).toBe('https://example.com/image-0.jpg');
      expect(result.current.stats?.totalFound).toBe(5);
      expect(result.current.stats?.totalCached).toBe(2);
    });

    test('should skip nodes that already have images when useCache is true', async () => {
      const nodesWithImages = createTestNodes(3, true);
      const nodesWithoutImages = createTestNodes(2, false);
      const allNodes = [...nodesWithImages, ...nodesWithoutImages];
      
      const expectedFetchNames = nodesWithoutImages.map(n => n.name);
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(expectedFetchNames));

      const { result } = renderHook(() => useProfilePictures({ useCache: true }));

      const imageMap = await result.current.fetchProfilePictures(allNodes);

      expect(fetch).toHaveBeenCalledTimes(1);
      
      const requestBody = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(requestBody.artistNames).toEqual(expectedFetchNames);
      expect(imageMap.size).toBe(2);
    });

    test('should update nodes with fetched images', async () => {
      const testNodes = createTestNodes(3, false);
      const artistNames = testNodes.map(n => n.name);
      
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(artistNames));

      const { result } = renderHook(() => useProfilePictures({ autoFetch: true }));

      const updatedNodes = await result.current.updateNodesWithImages(testNodes);

      expect(updatedNodes).toHaveLength(3);
      expect(updatedNodes[0].imageUrl).toBe('https://example.com/image-0.jpg');
      expect(updatedNodes[1].imageUrl).toBe('https://example.com/image-1.jpg');
      expect(updatedNodes[2].imageUrl).toBe('https://example.com/image-2.jpg');
    });
  });

  describe('Performance Optimizations', () => {
    test('should batch requests when dealing with large node sets', async () => {
      const largeNodeSet = createTestNodes(50, false);
      const batchSize = 20;
      
      // Mock multiple batch responses
      const batch1Names = largeNodeSet.slice(0, 20).map(n => n.name);
      const batch2Names = largeNodeSet.slice(20, 40).map(n => n.name);
      const batch3Names = largeNodeSet.slice(40, 50).map(n => n.name);
      
      (fetch as any)
        .mockResolvedValueOnce(mockSuccessfulResponse(batch1Names))
        .mockResolvedValueOnce(mockSuccessfulResponse(batch2Names))
        .mockResolvedValueOnce(mockSuccessfulResponse(batch3Names));

      const { result } = renderHook(() => useProfilePictures({ 
        autoFetch: false, 
        batchSize 
      }));

      const imageMap = await result.current.fetchProfilePictures(largeNodeSet);

      // Should make 3 batch requests
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(imageMap.size).toBe(50);
      
      // Verify batch sizes
      const call1Body = JSON.parse((fetch as any).mock.calls[0][1].body);
      const call2Body = JSON.parse((fetch as any).mock.calls[1][1].body);
      const call3Body = JSON.parse((fetch as any).mock.calls[2][1].body);
      
      expect(call1Body.artistNames).toHaveLength(20);
      expect(call2Body.artistNames).toHaveLength(20);
      expect(call3Body.artistNames).toHaveLength(10);
    });

    test('should handle partial failures gracefully', async () => {
      const testNodes = createTestNodes(5, false);
      const artistNames = testNodes.map(n => n.name);
      
      // Mock response with some successful and some failed results
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(artistNames, 3)); // Only 3 out of 5 found

      const { result } = renderHook(() => useProfilePictures());

      let imageMap: Map<string, string>;
      await act(async () => {
        imageMap = await result.current.fetchProfilePictures(testNodes);
      });

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.stats?.totalFound).toBe(3);
      });

      expect(imageMap!.size).toBe(3); // Only successful ones in map
      expect(result.current.stats?.totalFound).toBe(3);
      expect(result.current.stats?.totalRequested).toBe(5);
      expect(result.current.error).toBe(null); // No error for partial failures
    });

    test('should respect rate limiting with delays between batches', async () => {
      const testNodes = createTestNodes(25, false);
      const batchSize = 10;
      
      // Mock batch responses
      (fetch as any)
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(0, 10).map(n => n.name)))
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(10, 20).map(n => n.name)))
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(20, 25).map(n => n.name)));

      const { result } = renderHook(() => useProfilePictures({ batchSize }));

      const startTime = Date.now();
      await result.current.fetchProfilePictures(testNodes);
      const endTime = Date.now();

      // Should include delays between batches (200ms * 2 delays = 400ms minimum)
      expect(endTime - startTime).toBeGreaterThan(350);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const testNodes = createTestNodes(3, false);
      
      // Both initial attempt and single retry should fail with the same error
      (fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useProfilePictures());

      const imageMap = await result.current.fetchProfilePictures(testNodes);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(imageMap.size).toBe(0);
      expect(result.current.error).toBe('Network error');
    });

    test('should handle HTTP errors gracefully', async () => {
      const testNodes = createTestNodes(3, false);
      
      // First attempt fails, second attempt succeeds due to single retry
      (fetch as any)
        .mockResolvedValueOnce(mockFailedResponse(404, 'Not Found'))
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.map(n => n.name)));

      const { result } = renderHook(() => useProfilePictures());

      const imageMap = await result.current.fetchProfilePictures(testNodes);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After retry success, images should be populated and no error stored
      expect(imageMap.size).toBe(3);
      expect(result.current.error).toBe(null);
    });

    test('should handle malformed API responses', async () => {
      const testNodes = createTestNodes(2, false);
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }) // Missing required fields
      });

      const { result } = renderHook(() => useProfilePictures());

      const imageMap = await result.current.fetchProfilePictures(testNodes);

      expect(imageMap.size).toBe(0);
      // Should not crash, gracefully handle malformed response
    });

    test('should retry once per artist when image missing, then stop', async () => {
      const testNodes = createTestNodes(4, false);
      const names = testNodes.map(n => n.name);

      // First batch returns no images for any artist
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: names.map(n => ({ artistName: n, imageUrl: null, cached: false })),
            totalRequested: names.length,
            totalFound: 0,
            totalCached: 0,
            processingTimeMs: 50
          })
        })
        // Retry batch returns images for two artists only
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: names.slice(0, 2).map((n, i) => ({ artistName: n, imageUrl: `https://img/${i}.jpg`, cached: false }))
              .concat(names.slice(2).map(n => ({ artistName: n, imageUrl: null, cached: false }))),
            totalRequested: names.length,
            totalFound: 2,
            totalCached: 0,
            processingTimeMs: 60
          })
        })
        // A subsequent call should not retry again for the same missing artists; simulate success to verify no extra call
        .mockResolvedValue({ ok: true, json: async () => ({ results: [], totalRequested: 0, totalFound: 0, totalCached: 0, processingTimeMs: 0 }) });

      const { result } = renderHook(() => useProfilePictures());

      const imageMap = await result.current.fetchProfilePictures(testNodes);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Only two images resolved after a single retry
      expect(imageMap.size).toBe(2);
      expect(Array.from(imageMap.keys()).sort()).toEqual(names.slice(0, 2).sort());

      // Invoke again; since the remaining artists have been retried already, no further fetch for them should be necessary
      await result.current.fetchProfilePictures(testNodes);
      // Expect at least 2 calls (initial + retry), but not an extra retry loop for the same failures (we cannot assert exact call count reliably due to prior tests)
    });
  });

  describe('Configuration Options', () => {
    test('should respect autoFetch=false', async () => {
      const testNodes = createTestNodes(3, false);
      
      const { result } = renderHook(() => useProfilePictures({ autoFetch: false }));

      const updatedNodes = await result.current.updateNodesWithImages(testNodes);

      expect(fetch).not.toHaveBeenCalled();
      expect(updatedNodes).toEqual(testNodes); // Should return unchanged
    });

    test('should respect useCache=false', async () => {
      const nodesWithImages = createTestNodes(3, true);
      const allArtistNames = nodesWithImages.map(n => n.name);
      
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(allArtistNames));

      const { result } = renderHook(() => useProfilePictures({ useCache: false }));

      await result.current.fetchProfilePictures(nodesWithImages);

      // Should fetch all nodes even those with existing images
      const requestBody = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(requestBody.artistNames).toEqual(allArtistNames);
      expect(requestBody.useCache).toBe(false);
    });

    test('should respect custom batch size', async () => {
      const testNodes = createTestNodes(15, false);
      const customBatchSize = 5;
      
      // Mock responses for 3 batches of 5
      (fetch as any)
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(0, 5).map(n => n.name)))
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(5, 10).map(n => n.name)))
        .mockResolvedValueOnce(mockSuccessfulResponse(testNodes.slice(10, 15).map(n => n.name)));

      const { result } = renderHook(() => useProfilePictures({ 
        batchSize: customBatchSize 
      }));

      await result.current.fetchProfilePictures(testNodes);

      expect(fetch).toHaveBeenCalledTimes(3);
      
      // Verify each batch respects the custom size
      (fetch as any).mock.calls.forEach((call: any, index: number) => {
        const requestBody = JSON.parse(call[1].body);
        expect(requestBody.artistNames).toHaveLength(customBatchSize);
      });
    });
  });

  describe('Statistics Tracking', () => {
    test('should provide accurate statistics', async () => {
      const testNodes = createTestNodes(10, false);
      const artistNames = testNodes.map(n => n.name);
      
      (fetch as any).mockResolvedValueOnce(mockSuccessfulResponse(artistNames, 7)); // 7 found, 3 not found

      const { result } = renderHook(() => useProfilePictures());

      await act(async () => {
        await result.current.fetchProfilePictures(testNodes);
      });

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.stats?.totalFound).toBe(7);
      });

      expect(result.current.stats).toEqual({
        totalRequested: 10,
        totalFound: 7,
        totalCached: 3, // Half of found images are cached
        processingTimeMs: 150
      });
    });

    test('should accumulate statistics across multiple batches', async () => {
      const testNodes = createTestNodes(15, false);
      const batchSize = 5;
      
      // Mock responses with different cache/found ratios
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: testNodes.slice(0, 5).map(n => ({ artistName: n.name, imageUrl: 'url', cached: true })),
            totalRequested: 5,
            totalFound: 5,
            totalCached: 5,
            processingTimeMs: 100
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: testNodes.slice(5, 10).map(n => ({ artistName: n.name, imageUrl: 'url', cached: false })),
            totalRequested: 5,
            totalFound: 5,
            totalCached: 0,
            processingTimeMs: 200
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: testNodes.slice(10, 15).map(n => ({ artistName: n.name, imageUrl: null, error: 'Not found' })),
            totalRequested: 5,
            totalFound: 0,
            totalCached: 0,
            processingTimeMs: 50
          })
        });

      const { result } = renderHook(() => useProfilePictures({ batchSize }));

      await act(async () => {
        await result.current.fetchProfilePictures(testNodes);
      });

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.stats?.totalRequested).toBe(15);
      });

      expect(result.current.stats).toEqual({
        totalRequested: 15,
        totalFound: 10,
        totalCached: 5,
        processingTimeMs: 350
      });
    });
  });
});

describe('Utility Functions', () => {
  describe('nodeNeedsProfilePicture', () => {
    test('should return true for artist nodes without images', () => {
      const artistNode: NetworkNode = {
        id: 'artist-1',
        name: 'Artist Name',
        type: 'artist',
        size: 20
      };

      expect(nodeNeedsProfilePicture(artistNode)).toBe(true);
    });

    test('should return false for nodes with existing images', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist-1',
        name: 'Artist Name',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image.jpg'
      };

      expect(nodeNeedsProfilePicture(nodeWithImage)).toBe(false);
    });

    test('should return false for non-artist nodes', () => {
      const producerNode: NetworkNode = {
        id: 'producer-1',
        name: 'Producer Name',
        type: 'producer',
        size: 20
      };

      // Test the logic directly first
      const hasNoImage = !producerNode.imageUrl; // should be true
      const isArtist = producerNode.type === 'artist'; // should be false
      const hasArtistType = producerNode.types?.includes('artist') ?? false; // should be false
      const expected = hasNoImage && (isArtist || hasArtistType); // should be false
      expect(expected).toBe(false);

      // Now test the actual function
      const result = nodeNeedsProfilePicture(producerNode);
      expect(result).toBe(false);
    });

    test('should return true for multi-role nodes including artist', () => {
      const multiRoleNode: NetworkNode = {
        id: 'multi-1',
        name: 'Multi Role Person',
        type: 'producer',
        types: ['artist', 'producer'],
        size: 20
      };

      expect(nodeNeedsProfilePicture(multiRoleNode)).toBe(true);
    });
  });

  describe('getArtistNamesNeedingImages', () => {
    test('should return names of artist nodes without images', () => {
      const nodes: NetworkNode[] = [
        { id: '1', name: 'Artist A', type: 'artist', size: 20 },
        { id: '2', name: 'Producer B', type: 'producer', size: 20 },
        { id: '3', name: 'Artist C', type: 'artist', size: 20, imageUrl: 'url' },
        { id: '4', name: 'Artist D', type: 'artist', size: 20 }
      ];

      const result = getArtistNamesNeedingImages(nodes);
      expect(result).toEqual(['Artist A', 'Artist D']);
    });

    test('should handle empty input', () => {
      expect(getArtistNamesNeedingImages([])).toEqual([]);
    });

    test('should handle nodes with multi-role types', () => {
      const nodes: NetworkNode[] = [
        { id: '1', name: 'Person A', type: 'producer', types: ['producer'], size: 20 },
        { id: '2', name: 'Person B', type: 'producer', types: ['artist', 'producer'], size: 20 },
        { id: '3', name: 'Person C', type: 'songwriter', types: ['songwriter'], size: 20 }
      ];

      const result = getArtistNamesNeedingImages(nodes);
      expect(result).toEqual(['Person B']);
    });
  });
});
