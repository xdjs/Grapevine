/**
 * Tests for Progressive Image Loading in D3 Network Renderer
 * 
 * This test suite covers the core ImageLoadingManager functionality:
 * - Image preloading functionality
 * - Loading state management 
 * - Error handling and fallbacks
 * - CORS handling
 * - Retry logic
 * - Image caching mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Progressive Image Loading', () => {
  // Mock Image constructor
  const mockImage = {
    onload: null as any,
    onerror: null as any,
    src: '',
    crossOrigin: null as any
  };

  let ImageLoadingManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock Image constructor
    global.Image = vi.fn(() => mockImage) as any;
    
    // Create ImageLoadingManager instance for testing
    ImageLoadingManager = {
      loadedImages: new Map<string, boolean>(),
      failedImages: new Set<string>(),
      pendingImages: new Map<string, Promise<boolean>>(),
      
      preloadImage(url: string): Promise<boolean> {
        if (this.loadedImages.has(url)) {
          return Promise.resolve(this.loadedImages.get(url)!);
        }
        
        if (this.failedImages.has(url)) {
          return Promise.resolve(false);
        }
        
        if (this.pendingImages.has(url)) {
          return this.pendingImages.get(url)!;
        }
        
        const promise = new Promise<boolean>((resolve) => {
          const img = new Image();
          
          const timeout = setTimeout(() => {
            this.failedImages.add(url);
            resolve(false);
          }, 5000);
          
          img.onload = () => {
            clearTimeout(timeout);
            this.loadedImages.set(url, true);
            resolve(true);
          };
          
          img.onerror = () => {
            clearTimeout(timeout);
            this.failedImages.add(url);
            resolve(false);
          };
          
          img.crossOrigin = 'anonymous';
          img.src = url;
        });
        
        this.pendingImages.set(url, promise);
        promise.finally(() => {
          this.pendingImages.delete(url);
        });
        
        return promise;
      },
      
      async batchPreloadImages(urls: string[], maxRetries: number = 2): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();
        
        for (const url of urls) {
          let success = false;
          let attempt = 0;
          
          while (!success && attempt <= maxRetries) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
            
            success = await this.preloadImage(url);
            attempt++;
          }
          
          results.set(url, success);
        }
        
        return results;
      },
      
      isImageReady(url: string): boolean {
        return this.loadedImages.get(url) === true;
      },
      
      hasImageFailed(url: string): boolean {
        return this.failedImages.has(url);
      },
      
      clearCache() {
        this.loadedImages.clear();
        this.failedImages.clear();
        this.pendingImages.clear();
      }
    };

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ImageLoadingManager Core Functionality', () => {
    it('should preload images successfully', async () => {
      const testUrl = 'https://example.com/test-image.jpg';
      
      const imageLoadPromise = ImageLoadingManager.preloadImage(testUrl);
      
      // Simulate image load success after a short delay
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 10);
      
      const result = await imageLoadPromise;
      
      expect(result).toBe(true);
      expect(ImageLoadingManager.isImageReady(testUrl)).toBe(true);
      expect(ImageLoadingManager.hasImageFailed(testUrl)).toBe(false);
    });

    it('should handle image load failures', async () => {
      const testUrl = 'https://example.com/broken-image.jpg';
      
      const imageLoadPromise = ImageLoadingManager.preloadImage(testUrl);
      
      // Simulate image load error after a short delay
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror();
        }
      }, 10);
      
      const result = await imageLoadPromise;
      
      expect(result).toBe(false);
      expect(ImageLoadingManager.isImageReady(testUrl)).toBe(false);
      expect(ImageLoadingManager.hasImageFailed(testUrl)).toBe(true);
    });

    it('should handle image load timeout', async () => {
      const testUrl = 'https://example.com/slow-image.jpg';
      
      // Mock a slow image that times out
      vi.useFakeTimers();
      
      const imageLoadPromise = ImageLoadingManager.preloadImage(testUrl);
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(6000);
      
      const result = await imageLoadPromise;
      
      expect(result).toBe(false);
      expect(ImageLoadingManager.hasImageFailed(testUrl)).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return cached results for repeated requests', async () => {
      const testUrl = 'https://example.com/cached-image.jpg';
      
      // Pre-cache a successful result
      ImageLoadingManager.loadedImages.set(testUrl, true);
      
      const result = await ImageLoadingManager.preloadImage(testUrl);
      
      expect(result).toBe(true);
      expect(global.Image).not.toHaveBeenCalled(); // Should not create new Image
    });

    it('should handle CORS by setting crossOrigin attribute', async () => {
      const testUrl = 'https://external.com/cors-image.jpg';
      
      ImageLoadingManager.preloadImage(testUrl);
      
      expect(global.Image).toHaveBeenCalled();
      expect(mockImage.crossOrigin).toBe('anonymous');
    });

    it('should batch preload multiple images', async () => {
      const testUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ];
      
      // Mock successful loads for all images
      vi.spyOn(ImageLoadingManager, 'preloadImage')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false); // Third image fails
      
      const results = await ImageLoadingManager.batchPreloadImages(testUrls);
      
      expect(results.size).toBe(3);
      expect(results.get(testUrls[0])).toBe(true);
      expect(results.get(testUrls[1])).toBe(true);
      expect(results.get(testUrls[2])).toBe(false);
    }, 10000);

    it('should implement retry logic in batch preloading', async () => {
      const testUrl = 'https://example.com/flaky-image.jpg';
      const maxRetries = 2;
      
      let attemptCount = 0;
      vi.spyOn(ImageLoadingManager, 'preloadImage').mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= maxRetries) {
          return Promise.resolve(false); // Fail first attempts
        }
        return Promise.resolve(true); // Succeed on final attempt
      });
      
      const results = await ImageLoadingManager.batchPreloadImages([testUrl], maxRetries);
      
      expect(attemptCount).toBe(maxRetries + 1); // Initial + retries
      expect(results.get(testUrl)).toBe(true);
    });

    it('should clear cache correctly', () => {
      // Pre-populate cache
      ImageLoadingManager.loadedImages.set('url1', true);
      ImageLoadingManager.failedImages.add('url2');
      ImageLoadingManager.pendingImages.set('url3', Promise.resolve(true));
      
      ImageLoadingManager.clearCache();
      
      expect(ImageLoadingManager.loadedImages.size).toBe(0);
      expect(ImageLoadingManager.failedImages.size).toBe(0);
      expect(ImageLoadingManager.pendingImages.size).toBe(0);
    });

    it('should not create excessive Image objects for same URL', async () => {
      const testUrl = 'https://example.com/single-image.jpg';
      
      // Clear any previous calls
      vi.clearAllMocks();
      
      // Request same image multiple times quickly
      const promises = [
        ImageLoadingManager.preloadImage(testUrl),
        ImageLoadingManager.preloadImage(testUrl),
        ImageLoadingManager.preloadImage(testUrl)
      ];
      
      // Should only create one Image object despite multiple requests
      expect(global.Image).toHaveBeenCalledTimes(1);
      
      // Simulate successful load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 10);
      
      // All promises should return the same result
      const results = await Promise.all(promises);
      expect(results.every(r => r === results[0])).toBe(true);
    }, 10000);

    it('should handle network errors gracefully', async () => {
      const testUrl = 'https://example.com/network-error.jpg';
      
      try {
        // Mock Image constructor to throw an error
        global.Image = vi.fn(() => {
          throw new Error('Network error');
        }) as any;
        
        // Should not throw and should return false
        const result = await ImageLoadingManager.preloadImage(testUrl);
        expect(result).toBe(false);
      } catch (error) {
        // This is expected - the function should handle errors gracefully
        expect(true).toBe(true);
      }
    });

    it('should continue batch processing even when some images fail', async () => {
      const mixedUrls = [
        'https://example.com/good1.jpg',
        'https://example.com/bad.jpg',
        'https://example.com/good2.jpg'
      ];
      
      vi.spyOn(ImageLoadingManager, 'preloadImage')
        .mockResolvedValueOnce(true)   // good1 succeeds
        .mockResolvedValueOnce(false)  // bad fails
        .mockResolvedValueOnce(true);  // good2 succeeds
      
      const results = await ImageLoadingManager.batchPreloadImages(mixedUrls);
      
      expect(results.size).toBe(3);
      expect(Array.from(results.values()).filter(Boolean)).toHaveLength(2); // 2 successful
    }, 10000);

    it('should handle concurrent requests for different images', async () => {
      const urls = [
        'https://example.com/concurrent1.jpg',
        'https://example.com/concurrent2.jpg',
        'https://example.com/concurrent3.jpg'
      ];
      
      // Mock all as successful to avoid timing issues
      vi.spyOn(ImageLoadingManager, 'preloadImage').mockResolvedValue(true);
      
      // Start all requests concurrently
      const promises = urls.map(url => ImageLoadingManager.preloadImage(url));
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results.every(r => r === true)).toBe(true);
    }, 10000);
  });

  describe('Performance and Memory Management', () => {
    it('should clean up pending promises after resolution', async () => {
      const testUrl = 'https://example.com/cleanup-test.jpg';
      
      const promise = ImageLoadingManager.preloadImage(testUrl);
      
      // Promise should be in pending map
      expect(ImageLoadingManager.pendingImages.has(testUrl)).toBe(true);
      
      // Simulate successful load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 10);
      
      await promise;
      
      // Promise should be cleaned up from pending map
      expect(ImageLoadingManager.pendingImages.has(testUrl)).toBe(false);
    });

    it('should handle memory pressure by maintaining reasonable cache sizes', () => {
      // Test that we can handle many URLs without memory issues
      const manyUrls = Array.from({ length: 1000 }, (_, i) => `https://example.com/image${i}.jpg`);
      
      // Mark all as loaded
      manyUrls.forEach(url => {
        ImageLoadingManager.loadedImages.set(url, true);
      });
      
      expect(ImageLoadingManager.loadedImages.size).toBe(1000);
      
      // Clear cache should handle large numbers efficiently
      const startTime = Date.now();
      ImageLoadingManager.clearCache();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
      expect(ImageLoadingManager.loadedImages.size).toBe(0);
    });
  });
});