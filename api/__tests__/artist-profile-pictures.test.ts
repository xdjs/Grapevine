import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// Mock all database storage dependencies
vi.mock('../../server/supabase.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
  isDatabaseAvailable: vi.fn(() => true),
}));

vi.mock('../../server/spotify.js', () => ({
  spotifyService: {
    isConfigured: vi.fn(() => true),
    batchGetArtistProfileImages: vi.fn(),
  },
}));

vi.mock('../../server/openai-service.js', () => ({
  openAIService: {
    isServiceAvailable: vi.fn(() => false),
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../../server/musicbrainz.js', () => ({
  musicBrainzService: {
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../../server/wikipedia.js', () => ({
  wikipediaService: {
    getArtistCollaborations: vi.fn(),
  },
}));

vi.mock('../../server/musicnerd-service.js', () => ({
  musicNerdService: {
    getArtistId: vi.fn(),
  },
}));

vi.mock('../../server/database-storage.js', () => ({
  DatabaseStorage: vi.fn().mockImplementation(() => ({
    getProfilePicturesWithCache: vi.fn(),
  })),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn().mockImplementation((data, options) => ({
      data,
      status: options?.status || 200,
    })),
  },
}));

// Import after mocking
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../artist-profile-pictures/[artistName].js';
import { POST } from '../artist-profile-pictures-batch.js';
import { DatabaseStorage } from '../../server/database-storage.js';

describe('Artist Profile Pictures API', () => {
  let mockDatabaseStorage: any;
  let mockNextResponse: any;

  beforeEach(() => {
    mockDatabaseStorage = {
      getProfilePicturesWithCache: vi.fn(),
    };
    (DatabaseStorage as Mock).mockImplementation(() => mockDatabaseStorage);
    
    mockNextResponse = NextResponse;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/artist-profile-pictures/[artistName]', () => {
    it('should return profile picture data for existing artist', async () => {
      const mockRequest = new NextRequest('http://localhost/api/artist-profile-pictures/Taylor%20Swift') as any;
      const mockContext = {
        params: { artistName: 'Taylor%20Swift' }
      };

      // Mock successful profile picture retrieval
      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://example.com/taylor.jpg',
          spotifyId: 'spotify123',
          fromCache: true
        }]
      ]));

      const result = await GET(mockRequest, mockContext);

      expect(mockDatabaseStorage.getProfilePicturesWithCache).toHaveBeenCalledWith(['Taylor Swift'], false);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        artist: 'Taylor Swift',
        imageUrl: 'https://example.com/taylor.jpg',
        spotifyId: 'spotify123',
        fromCache: true,
        available: true,
        size: 'medium'
      });
    });

    it('should handle URL-encoded artist names correctly', async () => {
      const mockRequest = new NextRequest('http://localhost/api/artist-profile-pictures/Daft%20Punk') as any;
      const mockContext = {
        params: { artistName: 'Daft%20Punk' }
      };

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Daft Punk', {
          imageUrl: 'https://example.com/daft-punk.jpg',
          spotifyId: 'spotify456',
          fromCache: false
        }]
      ]));

      const result = await GET(mockRequest, mockContext);

      expect(mockDatabaseStorage.getProfilePicturesWithCache).toHaveBeenCalledWith(['Daft Punk'], false);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        artist: 'Daft Punk',
        imageUrl: 'https://example.com/daft-punk.jpg',
        spotifyId: 'spotify456',
        fromCache: false,
        available: true,
        size: 'medium'
      });
    });

    it('should handle query parameters correctly', async () => {
      const mockRequest = {
        url: 'http://localhost/api/artist-profile-pictures/Taylor%20Swift?refresh=true&size=large'
      } as NextRequest;
      const mockContext = {
        params: { artistName: 'Taylor%20Swift' }
      };

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://example.com/taylor-large.jpg',
          spotifyId: 'spotify123',
          fromCache: false
        }]
      ]));

      const result = await GET(mockRequest, mockContext);

      expect(mockDatabaseStorage.getProfilePicturesWithCache).toHaveBeenCalledWith(['Taylor Swift'], true);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        artist: 'Taylor Swift',
        imageUrl: 'https://example.com/taylor-large.jpg',
        spotifyId: 'spotify123',
        fromCache: false,
        available: true,
        size: 'large'
      });
    });

    it('should return 404 when artist profile picture not found', async () => {
      const mockRequest = new NextRequest('http://localhost/api/artist-profile-pictures/Unknown%20Artist') as any;
      const mockContext = {
        params: { artistName: 'Unknown%20Artist' }
      };

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map());

      const result = await GET(mockRequest, mockContext);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Profile picture not found',
        artist: 'Unknown Artist',
        available: false
      }, { status: 404 });
    });

    it('should return 400 when artist name is missing', async () => {
      const mockRequest = new NextRequest('http://localhost/api/artist-profile-pictures/') as any;
      const mockContext = {
        params: { artistName: '' }
      };

      const result = await GET(mockRequest, mockContext);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Artist name is required'
      }, { status: 400 });
    });

    it('should handle database errors gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost/api/artist-profile-pictures/Taylor%20Swift') as any;
      const mockContext = {
        params: { artistName: 'Taylor%20Swift' }
      };

      mockDatabaseStorage.getProfilePicturesWithCache.mockRejectedValue(new Error('Database connection failed'));

      const result = await GET(mockRequest, mockContext);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        artist: 'Taylor Swift',
        available: false
      }, { status: 500 });
    });
  });

  describe('POST /api/artist-profile-pictures-batch', () => {
    it('should return profile pictures for multiple artists', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: ['Taylor Swift', 'Ed Sheeran'],
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://example.com/taylor.jpg',
          spotifyId: 'spotify123',
          fromCache: true
        }],
        ['Ed Sheeran', {
          imageUrl: 'https://example.com/ed.jpg',
          spotifyId: 'spotify456',
          fromCache: false
        }]
      ]));

      const result = await POST(mockRequest);

      expect(mockDatabaseStorage.getProfilePicturesWithCache).toHaveBeenCalledWith(['Taylor Swift', 'Ed Sheeran'], false);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        profilePictures: {
          'Taylor Swift': {
            imageUrl: 'https://example.com/taylor.jpg',
            spotifyId: 'spotify123',
            fromCache: true,
            available: true
          },
          'Ed Sheeran': {
            imageUrl: 'https://example.com/ed.jpg',
            spotifyId: 'spotify456',
            fromCache: false,
            available: true
          }
        },
        totalRequested: 2,
        totalFound: 2,
        fromCache: 1,
        size: 'medium'
      });
    });

    it('should handle partial results correctly', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: ['Taylor Swift', 'Unknown Artist'],
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://example.com/taylor.jpg',
          spotifyId: 'spotify123',
          fromCache: true
        }]
      ]));

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        profilePictures: {
          'Taylor Swift': {
            imageUrl: 'https://example.com/taylor.jpg',
            spotifyId: 'spotify123',
            fromCache: true,
            available: true
          },
          'Unknown Artist': {
            imageUrl: '',
            spotifyId: '',
            fromCache: false,
            available: false
          }
        },
        totalRequested: 2,
        totalFound: 1,
        fromCache: 1,
        size: 'medium'
      });
    });

    it('should handle empty artist list', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: [],
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        profilePictures: {},
        totalRequested: 0,
        totalFound: 0,
        fromCache: 0
      });
      expect(mockDatabaseStorage.getProfilePicturesWithCache).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid request body', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          // Missing artistNames
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'artistNames array is required'
      }, { status: 400 });
    });

    it('should return 400 for non-array artistNames', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: 'Taylor Swift', // Should be array
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'artistNames array is required'
      }, { status: 400 });
    });

    it('should return 400 for too many artists', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: new Array(51).fill('Artist'), // Exceeds limit of 50
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Maximum 50 artists allowed per batch request'
      }, { status: 400 });
    });

    it('should handle force refresh correctly', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: ['Taylor Swift'],
          forceRefresh: true,
          size: 'large'
        })
      } as any;

      mockDatabaseStorage.getProfilePicturesWithCache.mockResolvedValue(new Map([
        ['Taylor Swift', {
          imageUrl: 'https://example.com/taylor-refreshed.jpg',
          spotifyId: 'spotify123',
          fromCache: false
        }]
      ]));

      const result = await POST(mockRequest);

      expect(mockDatabaseStorage.getProfilePicturesWithCache).toHaveBeenCalledWith(['Taylor Swift'], true);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        profilePictures: {
          'Taylor Swift': {
            imageUrl: 'https://example.com/taylor-refreshed.jpg',
            spotifyId: 'spotify123',
            fromCache: false,
            available: true
          }
        },
        totalRequested: 1,
        totalFound: 1,
        fromCache: 0,
        size: 'large'
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          artistNames: ['Taylor Swift'],
          forceRefresh: false,
          size: 'medium'
        })
      } as any;

      mockDatabaseStorage.getProfilePicturesWithCache.mockRejectedValue(new Error('Database connection failed'));

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        profilePictures: {},
        totalRequested: 0,
        totalFound: 0,
        fromCache: 0
      }, { status: 500 });
    });

    it('should handle JSON parsing errors', async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any;

      const result = await POST(mockRequest);

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        profilePictures: {},
        totalRequested: 0,
        totalFound: 0,
        fromCache: 0
      }, { status: 500 });
    });
  });
});
