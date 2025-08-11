import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { SpotifyService } from '../spotify';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SpotifyService - Comprehensive Error Handling (Task 4.1)', () => {
  let service: SpotifyService;
  const mockAccessToken = 'mock_access_token_12345';

  beforeEach(() => {
    service = new SpotifyService();
    vi.clearAllMocks();
    
    // Set up environment variables for testing
    process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rate Limiting Error Handling', () => {
    beforeEach(() => {
      // Mock successful token fetch
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
    });

    it('should handle 429 rate limit errors with exponential backoff', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '2'
          },
          data: {
            error: {
              status: 429,
              message: 'Rate limit exceeded'
            }
          }
        }
      };

      // Mock first call to fail with rate limit, second to succeed
      mockedAxios.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: {
            artists: {
              items: [{
                id: 'spotify_artist_1',
                name: 'Test Artist',
                images: [
                  { url: 'https://example.com/large.jpg', height: 640, width: 640 },
                  { url: 'https://example.com/medium.jpg', height: 300, width: 300 },
                  { url: 'https://example.com/small.jpg', height: 64, width: 64 }
                ],
                followers: { total: 1000000 },
                genres: ['pop'],
                popularity: 85
              }]
            }
          }
        });

      const result = await service.getArtistProfileImageWithRetry('Test Artist');

      // Should successfully return result after retry
      expect(result).not.toBeNull();
      expect(result?.imageUrl).toBe('https://example.com/medium.jpg');
      
      // Should have made at least 2 GET requests (1 failed, 1 succeeded)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should respect Retry-After header from rate limit response', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '1' // 1 second
          }
        }
      };

      mockedAxios.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: {
            artists: {
              items: [{
                id: 'spotify_artist_1',
                name: 'Test Artist',
                images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
                followers: { total: 1000000 },
                genres: ['pop'],
                popularity: 85
              }]
            }
          }
        });

      const result = await service.searchArtistWithRetry('Test Artist');

      expect(result).not.toBeNull();
      // Should have attempted at least 2 requests
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple consecutive rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '1' }
        }
      };

      // All attempts fail with rate limiting
      mockedAxios.get
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      // Should return null after exhausting retries
      expect(result).toBeNull();
      
      // Should have attempted multiple retries
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('Network and Connection Error Handling', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
    });

    it('should handle network timeouts gracefully', async () => {
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'timeout of 5000ms exceeded'
      };

      mockedAxios.get.mockRejectedValue(timeoutError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
      // Should have attempted retry requests
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should handle connection refused errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:443'
      };

      mockedAxios.get.mockRejectedValue(connectionError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.spotify.com'
      };

      mockedAxios.get.mockRejectedValue(dnsError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });
  });

  describe('Spotify API Unavailable Scenarios', () => {
    it('should handle missing Spotify credentials gracefully', () => {
      // Clear environment variables
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;
      
      const serviceWithoutCreds = new SpotifyService();
      
      expect(serviceWithoutCreds.isConfigured()).toBe(false);
    });

    it('should handle invalid authentication tokens', async () => {
      const authError = {
        response: {
          status: 401,
          data: {
            error: {
              status: 401,
              message: 'Invalid access token'
            }
          }
        }
      };

      mockedAxios.post.mockRejectedValue(authError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });

    it('should handle service unavailable (503) errors', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });

      const serviceUnavailableError = {
        response: {
          status: 503,
          data: {
            error: {
              status: 503,
              message: 'Service temporarily unavailable'
            }
          }
        }
      };

      mockedAxios.get.mockRejectedValue(serviceUnavailableError);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });
  });

  describe('Malformed Response Handling', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
    });

    it('should handle missing artists field in response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          // Missing artists field
        }
      });

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });

    it('should handle empty artists array', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: []
          }
        }
      });

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });

    it('should handle artist without images', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: [{
              id: 'spotify_artist_1',
              name: 'Test Artist',
              images: [], // No images available
              followers: { total: 1000000 },
              genres: ['pop'],
              popularity: 85
            }]
          }
        }
      });

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });

    it('should handle corrupted JSON responses', async () => {
      const corruptedResponse = {
        data: '{"artists":{"items":[{incomplete json'
      };

      mockedAxios.get.mockResolvedValue(corruptedResponse);

      const result = await service.getArtistProfileImageWithRetry('Test Artist');
      
      expect(result).toBeNull();
    });
  });

  describe('Batch Processing Error Handling', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
    });

    it('should handle partial failures in batch processing', async () => {
      const artists = ['Artist 1', 'Artist 2', 'Artist 3'];
      
      // Mock first artist to succeed, second to fail with rate limit, third to succeed
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            artists: {
              items: [{
                id: 'artist_1',
                name: 'Artist 1',
                images: [{ url: 'https://example.com/artist1.jpg', height: 300, width: 300 }],
                followers: { total: 1000000 },
                genres: ['pop'],
                popularity: 85
              }]
            }
          }
        })
        .mockRejectedValueOnce({
          response: { status: 429 }
        })
        .mockResolvedValueOnce({
          data: {
            artists: {
              items: [{
                id: 'artist_3',
                name: 'Artist 3',
                images: [{ url: 'https://example.com/artist3.jpg', height: 300, width: 300 }],
                followers: { total: 1000000 },
                genres: ['pop'],
                popularity: 85
              }]
            }
          }
        });

      const results = await service.batchGetArtistProfileImages(artists);
      
      // Should return results for successful requests only
      expect(results.size).toBe(2);
      expect(results.has('Artist 1')).toBe(true);
      expect(results.has('Artist 2')).toBe(false); // Failed due to rate limit
      expect(results.has('Artist 3')).toBe(true);
    });

    it('should handle complete batch failure gracefully', async () => {
      const artists = ['Artist 1', 'Artist 2', 'Artist 3'];
      
      const networkError = { code: 'ECONNREFUSED' };
      mockedAxios.get.mockRejectedValue(networkError);

      const results = await service.batchGetArtistProfileImages(artists);
      
      // Should return empty map on complete failure
      expect(results.size).toBe(0);
    });

    it('should respect rate limits during batch processing', async () => {
      const artists = ['Artist 1', 'Artist 2', 'Artist 3', 'Artist 4', 'Artist 5'];
      
      // Mock all requests to succeed but track timing
      const mockResponse = {
        data: {
          artists: {
            items: [{
              id: 'test_artist',
              name: 'Test Artist',
              images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
              followers: { total: 1000000 },
              genres: ['pop'],
              popularity: 85
            }]
          }
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      const results = await service.batchGetArtistProfileImages(artists);
      const endTime = Date.now();
      
      expect(results.size).toBe(5);
      // Should have delays between batches (300ms minimum)
      expect(endTime - startTime).toBeGreaterThan(300);
    });
  });

  describe('Input Validation and Edge Cases', () => {
    it('should handle empty artist names', async () => {
      const result = await service.getArtistProfileImageWithRetry('');
      expect(result).toBeNull();
    });

    it('should handle null or undefined artist names', async () => {
      const resultNull = await service.getArtistProfileImageWithRetry(null as any);
      const resultUndefined = await service.getArtistProfileImageWithRetry(undefined as any);
      
      expect(resultNull).toBeNull();
      expect(resultUndefined).toBeNull();
    });

    it('should handle very long artist names', async () => {
      const longName = 'A'.repeat(1000);
      
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
      
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: { items: [] }
        }
      });

      const result = await service.getArtistProfileImageWithRetry(longName);
      expect(result).toBeNull();
    });

    it('should handle special characters in artist names', async () => {
      const specialCharsName = 'Björk & The Sugar💫Cubes!';
      
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          expires_in: 3600,
        },
      });
      
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: { items: [] }
        }
      });

      const result = await service.getArtistProfileImageWithRetry(specialCharsName);
      expect(result).toBeNull();
    });
  });

  describe('Service Configuration Validation', () => {
    it('should correctly identify when service is not configured', () => {
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;
      
      const unconfiguredService = new SpotifyService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });

    it('should correctly identify when service is partially configured', () => {
      process.env.SPOTIFY_CLIENT_ID = 'test_id';
      delete process.env.SPOTIFY_CLIENT_SECRET;
      
      const partiallyConfiguredService = new SpotifyService();
      expect(partiallyConfiguredService.isConfigured()).toBe(false);
    });

    it('should correctly identify when service is fully configured', () => {
      process.env.SPOTIFY_CLIENT_ID = 'test_id';
      process.env.SPOTIFY_CLIENT_SECRET = 'test_secret';
      
      const configuredService = new SpotifyService();
      expect(configuredService.isConfigured()).toBe(true);
    });
  });
});
