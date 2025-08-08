import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';
import handler from '../artist-profile-pictures-batch';

// Mock dependencies
vi.mock('pg', () => ({
  Client: vi.fn(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn()
  }))
}));

vi.mock('../server/spotify', () => ({
  spotifyService: {
    isConfigured: vi.fn(() => true),
    batchGetArtistProfileImages: vi.fn()
  }
}));

describe('Artist Profile Pictures Batch API', () => {
  let mockClient: any;
  let mockSpotifyService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup environment variables
    process.env.CONNECTION_STRING = 'postgresql://test';
    process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';

    // Setup mock client
    const { Client } = require('pg');
    mockClient = {
      connect: vi.fn(),
      query: vi.fn(),
      end: vi.fn()
    };
    Client.mockImplementation(() => mockClient);

    // Setup mock Spotify service
    const { spotifyService } = require('../server/spotify');
    mockSpotifyService = spotifyService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CONNECTION_STRING;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  describe('Request Validation', () => {
    test('should reject non-POST requests', async () => {
      const req = createRequest({
        method: 'GET',
        url: '/api/artist-profile-pictures-batch'
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Method not allowed. Use POST.'
      });
    });

    test('should handle OPTIONS requests for CORS', async () => {
      const req = createRequest({
        method: 'OPTIONS',
        url: '/api/artist-profile-pictures-batch'
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    });

    test('should validate required artistNames array', async () => {
      const req = createRequest({
        method: 'POST',
        body: {}
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.message).toContain('artistNames array is required');
      expect(responseData.example).toBeDefined();
    });

    test('should validate artistNames is not empty', async () => {
      const req = createRequest({
        method: 'POST',
        body: { artistNames: [] }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).message).toContain('must not be empty');
    });

    test('should validate batch size limit', async () => {
      const req = createRequest({
        method: 'POST',
        body: { 
          artistNames: Array.from({ length: 51 }, (_, i) => `Artist ${i}`)
        }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.message).toBe('Maximum 50 artists per batch request');
      expect(responseData.received).toBe(51);
    });
  });

  describe('Environment Configuration', () => {
    test('should handle missing database connection', async () => {
      delete process.env.CONNECTION_STRING;

      const req = createRequest({
        method: 'POST',
        body: { artistNames: ['Taylor Swift'] }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Database connection not configured'
      });
    });

    test('should handle missing Spotify credentials', async () => {
      delete process.env.SPOTIFY_CLIENT_ID;

      const req = createRequest({
        method: 'POST',
        body: { artistNames: ['Taylor Swift'] }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Spotify API credentials not configured'
      });
    });
  });

  describe('Cache Functionality', () => {
    test('should return cached images when available', async () => {
      const artistNames = ['Taylor Swift', 'Drake'];
      
      // Mock database responses with cached data
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ node_pfp: 'https://cached-image-1.jpg', spotify_id: 'spotify1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ node_pfp: 'https://cached-image-2.jpg', spotify_id: 'spotify2' }]
        });

      const req = createRequest({
        method: 'POST',
        body: { artistNames, useCache: true }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.totalRequested).toBe(2);
      expect(responseData.totalFound).toBe(2);
      expect(responseData.totalCached).toBe(2);
      expect(responseData.results).toHaveLength(2);
      
      expect(responseData.results[0]).toEqual({
        artistName: 'Taylor Swift',
        imageUrl: 'https://cached-image-1.jpg',
        spotifyId: 'spotify1',
        cached: true
      });
    });

    test('should skip cache when useCache is false', async () => {
      const artistNames = ['Taylor Swift'];
      
      // Mock Spotify API response
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify-image.jpg',
            spotifyId: 'spotify123',
            spotifyArtist: {}
          }]
        ])
      );

      const req = createRequest({
        method: 'POST',
        body: { artistNames, useCache: false }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.totalCached).toBe(0);
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(artistNames, 'medium');
    });

    test('should handle cache lookup failures gracefully', async () => {
      const artistNames = ['Taylor Swift'];
      
      // Mock database error
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Mock Spotify fallback
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify-image.jpg',
            spotifyId: 'spotify123',
            spotifyArtist: {}
          }]
        ])
      );

      const req = createRequest({
        method: 'POST',
        body: { artistNames, useCache: true }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.totalFound).toBe(1);
      expect(responseData.results[0].cached).toBe(false);
    });
  });

  describe('Spotify Integration', () => {
    test('should fetch images from Spotify API for uncached artists', async () => {
      const artistNames = ['New Artist', 'Another Artist'];
      
      // Mock empty cache
      mockClient.query.mockResolvedValue({ rows: [] });
      
      // Mock Spotify API response
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['New Artist', {
            imageUrl: 'https://spotify-image-1.jpg',
            spotifyId: 'spotify1',
            spotifyArtist: {}
          }],
          ['Another Artist', {
            imageUrl: 'https://spotify-image-2.jpg',
            spotifyId: 'spotify2',
            spotifyArtist: {}
          }]
        ])
      );

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.totalFound).toBe(2);
      expect(responseData.totalCached).toBe(0);
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(artistNames, 'medium');
      
      // Should cache the results in database
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE artists'),
        ['https://spotify-image-1.jpg', 'spotify1', 'New Artist']
      );
    });

    test('should handle Spotify API errors gracefully', async () => {
      const artistNames = ['Unknown Artist'];
      
      // Mock empty cache
      mockClient.query.mockResolvedValue({ rows: [] });
      
      // Mock Spotify API error
      mockSpotifyService.batchGetArtistProfileImages.mockRejectedValueOnce(
        new Error('Spotify API error')
      );

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.totalFound).toBe(0);
      expect(responseData.results[0]).toEqual({
        artistName: 'Unknown Artist',
        imageUrl: null,
        spotifyId: null,
        cached: false,
        error: 'Spotify API error'
      });
    });

    test('should handle unconfigured Spotify service', async () => {
      const artistNames = ['Artist Name'];
      
      // Mock empty cache
      mockClient.query.mockResolvedValue({ rows: [] });
      
      // Mock unconfigured Spotify
      mockSpotifyService.isConfigured.mockReturnValueOnce(false);

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.results[0]).toEqual({
        artistName: 'Artist Name',
        imageUrl: null,
        spotifyId: null,
        cached: false,
        error: 'Spotify API not configured'
      });
    });
  });

  describe('Batch Processing', () => {
    test('should process large batches in smaller chunks', async () => {
      const artistNames = Array.from({ length: 15 }, (_, i) => `Artist ${i}`);
      
      // Mock empty cache for all
      mockClient.query.mockResolvedValue({ rows: [] });
      
      // Mock Spotify responses for different batches
      mockSpotifyService.batchGetArtistProfileImages
        .mockResolvedValueOnce(new Map()) // First batch (0-4)
        .mockResolvedValueOnce(new Map()) // Second batch (5-9)
        .mockResolvedValueOnce(new Map()); // Third batch (10-14)

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // Should call Spotify API 3 times with batches of 5
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledTimes(3);
    });

    test('should include delays between batches', async () => {
      const artistNames = Array.from({ length: 10 }, (_, i) => `Artist ${i}`);
      
      // Mock empty cache
      mockClient.query.mockResolvedValue({ rows: [] });
      
      // Mock Spotify responses
      mockSpotifyService.batchGetArtistProfileImages
        .mockResolvedValueOnce(new Map())
        .mockResolvedValueOnce(new Map());

      const startTime = Date.now();
      
      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(res.statusCode).toBe(200);
      // Should include delay between batches (at least 200ms)
      expect(totalTime).toBeGreaterThan(150);
    });
  });

  describe('Performance Metrics', () => {
    test('should include accurate processing time', async () => {
      const artistNames = ['Taylor Swift'];
      
      // Mock cached response
      mockClient.query.mockResolvedValueOnce({
        rows: [{ node_pfp: 'https://cached.jpg', spotify_id: 'spotify1' }]
      });

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.processingTimeMs).toBeGreaterThan(0);
      expect(typeof responseData.processingTimeMs).toBe('number');
    });

    test('should provide comprehensive response statistics', async () => {
      const artistNames = ['Cached Artist', 'New Artist', 'Not Found'];
      
      // Mock mixed cache results
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ node_pfp: 'cached.jpg', spotify_id: 'cached1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      
      // Mock Spotify with partial results
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['New Artist', { imageUrl: 'new.jpg', spotifyId: 'new1', spotifyArtist: {} }]
          // 'Not Found' deliberately missing
        ])
      );

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData).toMatchObject({
        totalRequested: 3,
        totalFound: 2,
        totalCached: 1,
        processingTimeMs: expect.any(Number)
      });
      
      expect(responseData.results).toHaveLength(3);
      expect(responseData.results[0].cached).toBe(true);
      expect(responseData.results[1].cached).toBe(false);
      expect(responseData.results[2].imageUrl).toBe(null);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      const artistNames = ['Artist Name'];
      
      // Mock database connection error
      mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.message).toBe('Failed to fetch profile pictures');
      expect(responseData.error).toContain('Connection failed');
      expect(responseData.processingTimeMs).toBeGreaterThan(0);
    });

    test('should handle unexpected errors gracefully', async () => {
      const artistNames = ['Artist Name'];
      
      // Mock unexpected error
      mockClient.connect.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.message).toBe('Failed to fetch profile pictures');
      expect(responseData.timestamp).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    test('should successfully cache new Spotify results', async () => {
      const artistNames = ['New Artist'];
      
      // Mock empty cache
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock successful Spotify fetch
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['New Artist', {
            imageUrl: 'https://new-image.jpg',
            spotifyId: 'new-spotify-id',
            spotifyArtist: {}
          }]
        ])
      );
      
      // Mock successful cache update
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      
      // Verify cache update was attempted
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE artists'),
        ['https://new-image.jpg', 'new-spotify-id', 'New Artist']
      );
    });

    test('should handle cache update failures gracefully', async () => {
      const artistNames = ['Artist Name'];
      
      // Mock empty cache
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock Spotify success
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValueOnce(
        new Map([
          ['Artist Name', {
            imageUrl: 'https://image.jpg',
            spotifyId: 'spotify-id',
            spotifyArtist: {}
          }]
        ])
      );
      
      // Mock cache update failure
      mockClient.query.mockRejectedValueOnce(new Error('Cache update failed'));

      const req = createRequest({
        method: 'POST',
        body: { artistNames }
      });
      const res = createResponse();

      await handler(req, res);

      // Should still return success even if cache update fails
      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.totalFound).toBe(1);
      expect(responseData.results[0].imageUrl).toBe('https://image.jpg');
    });
  });
});
