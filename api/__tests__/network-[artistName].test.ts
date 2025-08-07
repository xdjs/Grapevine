import 'dotenv/config';
import handler from '../network/[artistName]';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { spotifyService } from '../../server/spotify';

// Mock dependencies
vi.mock('../../server/spotify');
vi.mock('pg');
vi.mock('openai');

const mockSpotifyService = spotifyService as any;

// Mock database client
const mockClient = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn()
};

// Mock PostgreSQL Client
vi.doMock('pg', () => ({
  Client: vi.fn(() => mockClient)
}));

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.doMock('openai', () => ({
  default: vi.fn(() => mockOpenAI)
}));

describe('/api/network/[artistName] with Spotify Integration', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    req = {
      method: 'GET',
      query: { artistName: 'Taylor Swift' },
      headers: {}
    };
    
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis()
    };

    // Set up environment variables
    process.env.CONNECTION_STRING = 'postgresql://test';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.SPOTIFY_CLIENT_ID = 'test-spotify-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-secret';

    // Mock database responses
    mockClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Taylor Swift' }]
      })
      .mockResolvedValue({ rows: [] });

    // Mock OpenAI responses
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              collaborators: [
                {
                  name: 'Jack Antonoff',
                  roles: ['producer', 'songwriter'],
                  topCollaborators: ['Lorde', 'Bleachers']
                },
                {
                  name: 'Max Martin',
                  roles: ['producer'],
                  topCollaborators: ['The Weeknd', 'Ariana Grande']
                }
              ]
            })
          }
        }]
      })
      .mockResolvedValue({
        choices: [{
          message: { content: '["artist", "songwriter"]' }
        }]
      });
  });

  afterEach(() => {
    delete process.env.CONNECTION_STRING;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  describe('Spotify Profile Picture Integration', () => {
    it('should fetch and include Spotify profile pictures for artist nodes', async () => {
      // Mock Spotify service configuration and responses
      mockSpotifyService.isConfigured.mockReturnValue(true);
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify.com/taylor-swift.jpg',
            spotifyId: 'spotify-taylor-swift-id',
            spotifyArtist: {
              id: 'spotify-taylor-swift-id',
              name: 'Taylor Swift',
              images: [{ url: 'https://spotify.com/taylor-swift.jpg', width: 300, height: 300 }],
              followers: { total: 50000000 },
              genres: ['pop', 'country'],
              popularity: 100
            }
          }],
          ['Jack Antonoff', {
            imageUrl: 'https://spotify.com/jack-antonoff.jpg',
            spotifyId: 'spotify-jack-antonoff-id',
            spotifyArtist: {
              id: 'spotify-jack-antonoff-id',
              name: 'Jack Antonoff',
              images: [{ url: 'https://spotify.com/jack-antonoff.jpg', width: 300, height: 300 }],
              followers: { total: 1000000 },
              genres: ['indie', 'rock'],
              popularity: 80
            }
          }]
        ])
      );

      await handler(req as VercelRequest, res as VercelResponse);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              name: 'Taylor Swift',
              imageUrl: 'https://spotify.com/taylor-swift.jpg',
              spotifyId: 'spotify-taylor-swift-id'
            }),
            expect.objectContaining({
              name: 'Jack Antonoff',
              imageUrl: 'https://spotify.com/jack-antonoff.jpg',
              spotifyId: 'spotify-jack-antonoff-id'
            })
          ])
        })
      );

      // Verify Spotify service was called with correct artist names
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(
        expect.arrayContaining(['Taylor Swift', 'Jack Antonoff'])
      );
    });

    it('should only fetch images for artist nodes, not producer-only nodes', async () => {
      // Mock collaboration data with mixed roles
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                collaborators: [
                  {
                    name: 'Max Martin',
                    roles: ['producer'], // Producer only, no artist role
                    topCollaborators: ['The Weeknd', 'Ariana Grande']
                  },
                  {
                    name: 'Ed Sheeran',
                    roles: ['artist', 'songwriter'], // Has artist role
                    topCollaborators: ['Justin Bieber', 'Eminem']
                  }
                ]
              })
            }
          }]
        })
        .mockResolvedValue({
          choices: [{
            message: { content: '["artist", "songwriter"]' }
          }]
        });

      mockSpotifyService.isConfigured.mockReturnValue(true);
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify.com/taylor-swift.jpg',
            spotifyId: 'spotify-taylor-swift-id',
            spotifyArtist: {} as any
          }],
          ['Ed Sheeran', {
            imageUrl: 'https://spotify.com/ed-sheeran.jpg',
            spotifyId: 'spotify-ed-sheeran-id',
            spotifyArtist: {} as any
          }]
        ])
      );

      await handler(req as VercelRequest, res as VercelResponse);

      // Should only call Spotify for Taylor Swift and Ed Sheeran (artist nodes), not Max Martin (producer only)
      expect(mockSpotifyService.batchGetArtistProfileImages).toHaveBeenCalledWith(
        expect.arrayContaining(['Taylor Swift', 'Ed Sheeran'])
      );

      // Verify the call doesn't include Max Martin
      const callArgs = mockSpotifyService.batchGetArtistProfileImages.mock.calls[0][0];
      expect(callArgs).not.toContain('Max Martin');
    });

    it('should store Spotify data in database for nodes with artistId', async () => {
      // Mock database responses to include artistId for main artist
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Taylor Swift' }]
        })
        .mockResolvedValueOnce({ rows: [] }) // For collaborator lookup
        .mockResolvedValueOnce({ rows: [] }) // For other lookups
        .mockResolvedValue({ rows: [] });

      mockSpotifyService.isConfigured.mockReturnValue(true);
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify.com/taylor-swift.jpg',
            spotifyId: 'spotify-taylor-swift-id',
            spotifyArtist: {} as any
          }]
        ])
      );

      await handler(req as VercelRequest, res as VercelResponse);

      // Verify database update for Spotify data
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE artists SET image_url = $1, spotify_id = $2 WHERE id = $3',
        ['https://spotify.com/taylor-swift.jpg', 'spotify-taylor-swift-id', '1']
      );
    });

    it('should continue gracefully when Spotify is not configured', async () => {
      mockSpotifyService.isConfigured.mockReturnValue(false);

      await handler(req as VercelRequest, res as VercelResponse);

      expect(mockSpotifyService.batchGetArtistProfileImages).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              name: 'Taylor Swift',
              imageUrl: undefined, // No Spotify data
              spotifyId: undefined
            })
          ])
        })
      );
    });

    it('should continue gracefully when Spotify API fails', async () => {
      mockSpotifyService.isConfigured.mockReturnValue(true);
      mockSpotifyService.batchGetArtistProfileImages.mockRejectedValue(new Error('Spotify API Error'));

      await handler(req as VercelRequest, res as VercelResponse);

      // Should still return network data without Spotify images
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              name: 'Taylor Swift'
              // imageUrl and spotifyId should be undefined/null
            })
          ])
        })
      );
    });

    it('should handle partial Spotify results gracefully', async () => {
      mockSpotifyService.isConfigured.mockReturnValue(true);
      
      // Return image for only one artist
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify.com/taylor-swift.jpg',
            spotifyId: 'spotify-taylor-swift-id',
            spotifyArtist: {} as any
          }]
          // Jack Antonoff missing from results
        ])
      );

      await handler(req as VercelRequest, res as VercelResponse);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              name: 'Taylor Swift',
              imageUrl: 'https://spotify.com/taylor-swift.jpg',
              spotifyId: 'spotify-taylor-swift-id'
            }),
            expect.objectContaining({
              name: 'Jack Antonoff'
              // Should not have imageUrl or spotifyId
            })
          ])
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during Spotify data storage', async () => {
      mockSpotifyService.isConfigured.mockReturnValue(true);
      mockSpotifyService.batchGetArtistProfileImages.mockResolvedValue(
        new Map([
          ['Taylor Swift', {
            imageUrl: 'https://spotify.com/taylor-swift.jpg',
            spotifyId: 'spotify-taylor-swift-id',
            spotifyArtist: {} as any
          }]
        ])
      );

      // Make the Spotify data update query fail
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Database error during Spotify update'));

      await handler(req as VercelRequest, res as VercelResponse);

      // Should still return successful response despite database error
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              name: 'Taylor Swift',
              imageUrl: 'https://spotify.com/taylor-swift.jpg',
              spotifyId: 'spotify-taylor-swift-id'
            })
          ])
        })
      );
    });
  });
});
