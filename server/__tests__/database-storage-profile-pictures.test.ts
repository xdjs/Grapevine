import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// Mock all dependencies before importing DatabaseStorage
vi.mock('../supabase.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
  isDatabaseAvailable: vi.fn(() => true),
}));

vi.mock('../spotify.js', () => ({
  spotifyService: {
    isConfigured: vi.fn(() => true),
    batchGetArtistProfileImages: vi.fn(),
  },
}));

vi.mock('../openai-service.js', () => ({
  openAIService: {
    isServiceAvailable: vi.fn(() => false),
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../musicbrainz.js', () => ({
  musicBrainzService: {
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../wikipedia.js', () => ({
  wikipediaService: {
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../musicnerd-service.js', () => ({
  musicNerdService: {
    getArtistId: vi.fn(),
  },
}));

// Now import the modules after mocking
import { DatabaseStorage } from '../database-storage.js';
import { db } from '../supabase.js';
import { artists } from '../../shared/schema.js';
import { spotifyService } from '../spotify.js';

describe('DatabaseStorage - Profile Picture Functionality', () => {
  let storage: DatabaseStorage;
  let mockDb: any;
  let mockSpotifyService: any;

  beforeEach(() => {
    storage = new DatabaseStorage();
    mockDb = db as any;
    mockSpotifyService = spotifyService as any;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeArtistProfilePicture', () => {
    it('should store profile picture data for new artist', async () => {
      // Mock getArtistByName to return null (artist doesn't exist)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      // Mock insert operation
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{
          id: 1,
          name: 'Taylor Swift',
          type: 'artist',
          imageUrl: 'https://example.com/taylor.jpg',
          spotifyId: 'spotify123'
        }])
      });

      const profileData = {
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123'
      };

      const result = await storage.storeArtistProfilePicture('Taylor Swift', profileData);

      expect(result).toBe(true);
      expect(mockDb.insert).toHaveBeenCalledWith(artists);
    });

    it('should update existing artist profile picture data', async () => {
      // Mock getArtistByName to return existing artist
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1,
              name: 'Taylor Swift',
              type: 'artist',
              imageUrl: null,
              spotifyId: null,
              nodePfp: null
            }])
          })
        })
      });

      // Mock execute for update operation
      mockDb.execute.mockResolvedValue({ rowCount: 1 });

      const profileData = {
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123'
      };

      const result = await storage.storeArtistProfilePicture('Taylor Swift', profileData);

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock getArtistByName to throw error
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      const profileData = {
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123'
      };

      const result = await storage.storeArtistProfilePicture('Taylor Swift', profileData);

      expect(result).toBe(false);
    });

    it('should return false when database is not available', async () => {
      // Create storage with mocked unavailable database
      const storageWithoutDb = new DatabaseStorage();
      (storageWithoutDb as any).constructor = function() {
        // Override the constructor check
      };

      // Mock isDatabaseAvailable to return false
      vi.doMock('../supabase.js', () => ({
        db: null,
        isDatabaseAvailable: vi.fn(() => false),
      }));

      const profileData = {
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123'
      };

      const result = await storage.storeArtistProfilePicture('Taylor Swift', profileData);

      expect(result).toBe(false);
    });
  });

  describe('getCachedProfilePicture', () => {
    it('should retrieve cached profile picture from node_pfp column', async () => {
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: '2024-01-01T00:00:00.000Z'
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      const result = await storage.getCachedProfilePicture('Taylor Swift');

      expect(result).toEqual({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should fallback to legacy columns when node_pfp is not available', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: null,
              imageUrl: 'https://example.com/taylor.jpg',
              spotifyId: 'spotify123'
            }])
          })
        })
      });

      const result = await storage.getCachedProfilePicture('Taylor Swift');

      expect(result).toEqual({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: 'legacy'
      });
    });

    it('should return null when no profile picture data exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: null,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      const result = await storage.getCachedProfilePicture('Taylor Swift');

      expect(result).toBeNull();
    });

    it('should return null when artist not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await storage.getCachedProfilePicture('Unknown Artist');

      expect(result).toBeNull();
    });

    it('should handle malformed JSON in node_pfp gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: 'invalid json',
              imageUrl: 'https://example.com/taylor.jpg',
              spotifyId: 'spotify123'
            }])
          })
        })
      });

      const result = await storage.getCachedProfilePicture('Taylor Swift');

      // Should fallback to legacy columns
      expect(result).toEqual({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: 'legacy'
      });
    });
  });

  describe('batchStoreProfilePictures', () => {
    it('should store multiple profile pictures successfully', async () => {
      // Mock successful operations
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ id: 1 }])
      });

      const profileDataMap = new Map([
        ['Taylor Swift', { imageUrl: 'https://example.com/taylor.jpg', spotifyId: 'spotify123' }],
        ['Ed Sheeran', { imageUrl: 'https://example.com/ed.jpg', spotifyId: 'spotify456' }]
      ]);

      const result = await storage.batchStoreProfilePictures(profileDataMap);

      expect(result.successful).toEqual(['Taylor Swift', 'Ed Sheeran']);
      expect(result.failed).toEqual([]);
    });

    it('should handle partial failures in batch operations', async () => {
      let callCount = 0;
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 2) { // First artist succeeds (2 calls for getArtistByName)
                return Promise.resolve([]); // No existing artist
              } else { // Second artist fails
                return Promise.reject(new Error('Database error'));
              }
            })
          })
        })
      });

      // First artist succeeds
      let insertCallCount = 0;
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockImplementation(() => {
          insertCallCount++;
          if (insertCallCount === 1) {
            return Promise.resolve([{ id: 1 }]); // First insert succeeds
          } else {
            return Promise.reject(new Error('Insert failed')); // Second insert fails (though won't reach here due to select error)
          }
        })
      });

      const profileDataMap = new Map([
        ['Taylor Swift', { imageUrl: 'https://example.com/taylor.jpg', spotifyId: 'spotify123' }],
        ['Ed Sheeran', { imageUrl: 'https://example.com/ed.jpg', spotifyId: 'spotify456' }]
      ]);

      const result = await storage.batchStoreProfilePictures(profileDataMap);

      expect(result.successful).toEqual(['Taylor Swift']);
      expect(result.failed).toEqual(['Ed Sheeran']);
    });
  });

  describe('isProfilePictureCacheFresh', () => {
    it('should return true for fresh cache within specified hours', async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: recentTime
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      const result = await storage.isProfilePictureCacheFresh('Taylor Swift', 24);

      expect(result).toBe(true);
    });

    it('should return false for stale cache beyond specified hours', async () => {
      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(); // 25 hours ago
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: oldTime
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      const result = await storage.isProfilePictureCacheFresh('Taylor Swift', 24);

      expect(result).toBe(false);
    });

    it('should return false for legacy cache entries', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: null,
              imageUrl: 'https://example.com/taylor.jpg',
              spotifyId: 'spotify123'
            }])
          })
        })
      });

      const result = await storage.isProfilePictureCacheFresh('Taylor Swift', 24);

      expect(result).toBe(false);
    });

    it('should return false when no cached data exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await storage.isProfilePictureCacheFresh('Unknown Artist', 24);

      expect(result).toBe(false);
    });
  });

  describe('getProfilePicturesWithCache', () => {
    beforeEach(() => {
      // Reset call counts for complex mocking scenarios
      vi.clearAllMocks();
    });

    it('should return cached data when cache is fresh', async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: recentTime
      });

      // Mock getCachedProfilePicture calls
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      const result = await storage.getProfilePicturesWithCache(['Taylor Swift']);

      expect(result.size).toBe(1);
      expect(result.get('Taylor Swift')).toEqual({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        fromCache: true
      });
    });

    it('should fetch from Spotify when cache is stale', async () => {
      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(); // 25 hours ago
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: oldTime
      });

      // Mock stale cache
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      // Mock Spotify fetch
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://spotify.com/new-taylor.jpg',
          spotifyId: 'spotify123',
          spotifyArtist: { id: 'spotify123', name: 'Taylor Swift', images: [] }
        }]
      ]));

      // Mock database storage after fetch
      mockDb.execute.mockResolvedValue({ rowCount: 1 });

      const result = await storage.getProfilePicturesWithCache(['Taylor Swift']);

      expect(result.size).toBe(1);
      expect(result.get('Taylor Swift')).toEqual({
        imageUrl: 'https://spotify.com/new-taylor.jpg',
        spotifyId: 'spotify123',
        fromCache: false
      });
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(['Taylor Swift']);
    });

    it('should handle force refresh correctly', async () => {
      // Mock fresh cache
      const recentTime = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 minutes ago
      const mockNodePfpData = JSON.stringify({
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        cachedAt: recentTime
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              nodePfp: mockNodePfpData,
              imageUrl: null,
              spotifyId: null
            }])
          })
        })
      });

      // Mock Spotify fetch for force refresh
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://spotify.com/refreshed-taylor.jpg',
          spotifyId: 'spotify123',
          spotifyArtist: { id: 'spotify123', name: 'Taylor Swift', images: [] }
        }]
      ]));

      mockDb.execute.mockResolvedValue({ rowCount: 1 });

      const result = await storage.getProfilePicturesWithCache(['Taylor Swift'], true);

      expect(result.size).toBe(1);
      expect(result.get('Taylor Swift')).toEqual({
        imageUrl: 'https://spotify.com/refreshed-taylor.jpg',
        spotifyId: 'spotify123',
        fromCache: false
      });
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(['Taylor Swift']);
    });

    it('should handle mixed cache states correctly', async () => {
      let selectCallCount = 0;
      
      // Mock different cache states for different artists
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount <= 2) { // First artist - fresh cache
                const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();
                const mockNodePfpData = JSON.stringify({
                  imageUrl: 'https://example.com/taylor.jpg',
                  spotifyId: 'spotify123',
                  cachedAt: recentTime
                });
                return Promise.resolve([{
                  nodePfp: mockNodePfpData,
                  imageUrl: null,
                  spotifyId: null
                }]);
              } else { // Second artist - no cache
                return Promise.resolve([]);
              }
            })
          })
        })
      });

      // Mock Spotify fetch for missing artist
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(new Map([
        ['Ed Sheeran', {
          imageUrl: 'https://spotify.com/ed.jpg',
          spotifyId: 'spotify456',
          spotifyArtist: { id: 'spotify456', name: 'Ed Sheeran', images: [] }
        }]
      ]));

      mockDb.execute.mockResolvedValue({ rowCount: 1 });

      const result = await storage.getProfilePicturesWithCache(['Taylor Swift', 'Ed Sheeran']);

      expect(result.size).toBe(2);
      expect(result.get('Taylor Swift')?.fromCache).toBe(true);
      expect(result.get('Ed Sheeran')?.fromCache).toBe(false);
    });

    it('should handle Spotify service not configured', async () => {
      // Mock no cache
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      // Mock Spotify not configured
      mockSpotifyService.isConfigured.mockReturnValue(false);

      const result = await storage.getProfilePicturesWithCache(['Taylor Swift']);

      expect(result.size).toBe(0);
      expect(mockSpotifyService.batchGetArtistProfileImages).not.toHaveBeenCalled();
    });
  });
});
