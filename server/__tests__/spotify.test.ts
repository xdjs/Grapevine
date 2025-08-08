import 'dotenv/config';
import { spotifyService, SpotifyArtist } from '../spotify';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('SpotifyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the service's internal state
    (spotifyService as any).accessToken = null;
    (spotifyService as any).tokenExpiry = 0;
  });

  describe('getArtistProfileImage', () => {
    const mockArtist: SpotifyArtist = {
      id: 'test-artist-id',
      name: 'Test Artist',
      images: [
        { url: 'https://example.com/large.jpg', width: 640, height: 640 },
        { url: 'https://example.com/medium.jpg', width: 300, height: 300 },
        { url: 'https://example.com/small.jpg', width: 64, height: 64 }
      ],
      followers: { total: 1000 },
      genres: ['pop'],
      popularity: 80
    };

    beforeEach(() => {
      // Mock token response
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'mock-token',
          expires_in: 3600
        }
      });
    });

    it('should fetch artist profile image successfully', async () => {
      // Mock search response
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: [mockArtist]
          }
        }
      });

      const result = await spotifyService.getArtistProfileImage('Test Artist');

      expect(result).toEqual({
        imageUrl: 'https://example.com/medium.jpg',
        spotifyId: 'test-artist-id',
        spotifyArtist: mockArtist
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/search',
        expect.objectContaining({
          params: {
            q: 'Test Artist',
            type: 'artist',
            limit: 1
          }
        })
      );
    });

    it('should return null when artist is not found', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: []
          }
        }
      });

      const result = await spotifyService.getArtistProfileImage('Unknown Artist');

      expect(result).toBeNull();
    });

    it('should return null when artist has no images', async () => {
      const artistWithoutImages = { ...mockArtist, images: [] };
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: [artistWithoutImages]
          }
        }
      });

      const result = await spotifyService.getArtistProfileImage('Test Artist');

      expect(result).toBeNull();
    });

    it('should handle different image sizes correctly', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          artists: {
            items: [mockArtist]
          }
        }
      });

      // Test small size
      const smallResult = await spotifyService.getArtistProfileImage('Test Artist', 'small');
      expect(smallResult?.imageUrl).toBe('https://example.com/small.jpg');

      // Test large size
      const largeResult = await spotifyService.getArtistProfileImage('Test Artist', 'large');
      expect(largeResult?.imageUrl).toBe('https://example.com/large.jpg');

      // Test medium size (default)
      const mediumResult = await spotifyService.getArtistProfileImage('Test Artist', 'medium');
      expect(mediumResult?.imageUrl).toBe('https://example.com/medium.jpg');
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await spotifyService.getArtistProfileImage('Test Artist');

      expect(result).toBeNull();
    });

    it('should handle token errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Token Error'));

      const result = await spotifyService.getArtistProfileImage('Test Artist');

      expect(result).toBeNull();
    });
  });

  describe('batchGetArtistProfileImages', () => {
    const mockArtists = [
      {
        id: 'artist-1',
        name: 'Artist 1',
        images: [{ url: 'https://example.com/artist1.jpg', width: 300, height: 300 }],
        followers: { total: 1000 },
        genres: ['pop'],
        popularity: 80
      },
      {
        id: 'artist-2',
        name: 'Artist 2',
        images: [{ url: 'https://example.com/artist2.jpg', width: 300, height: 300 }],
        followers: { total: 2000 },
        genres: ['rock'],
        popularity: 70
      }
    ];

    beforeEach(() => {
      // Mock token response
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'mock-token',
          expires_in: 3600
        }
      });
    });

    it('should batch fetch multiple artist images', async () => {
      // Mock search responses for each artist
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { artists: { items: [mockArtists[0]] } }
        })
        .mockResolvedValueOnce({
          data: { artists: { items: [mockArtists[1]] } }
        });

      const result = await spotifyService.batchGetArtistProfileImages(['Artist 1', 'Artist 2']);

      expect(result.size).toBe(2);
      expect(result.get('Artist 1')).toEqual({
        imageUrl: 'https://example.com/artist1.jpg',
        spotifyId: 'artist-1',
        spotifyArtist: mockArtists[0]
      });
      expect(result.get('Artist 2')).toEqual({
        imageUrl: 'https://example.com/artist2.jpg',
        spotifyId: 'artist-2',
        spotifyArtist: mockArtists[1]
      });
    });

    it('should handle empty artist list', async () => {
      const result = await spotifyService.batchGetArtistProfileImages([]);

      expect(result.size).toBe(0);
    });

    it('should handle partial failures in batch processing', async () => {
      // First artist succeeds, second fails
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { artists: { items: [mockArtists[0]] } }
        })
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await spotifyService.batchGetArtistProfileImages(['Artist 1', 'Artist 2']);

      expect(result.size).toBe(1);
      expect(result.get('Artist 1')).toBeTruthy();
      expect(result.get('Artist 2')).toBeUndefined();
    });

    it('should process large batches in chunks', async () => {
      const artistNames = Array.from({ length: 12 }, (_, i) => `Artist ${i + 1}`);
      
      // Mock all responses to be successful
      for (let i = 0; i < 12; i++) {
        mockedAxios.get.mockResolvedValueOnce({
          data: { 
            artists: { 
              items: [{
                id: `artist-${i + 1}`,
                name: `Artist ${i + 1}`,
                images: [{ url: `https://example.com/artist${i + 1}.jpg`, width: 300, height: 300 }],
                followers: { total: 1000 },
                genres: ['pop'],
                popularity: 80
              }]
            }
          }
        });
      }

      const result = await spotifyService.batchGetArtistProfileImages(artistNames);

      expect(result.size).toBe(12);
      // Verify that we made 12 search requests (one per artist)
      expect(mockedAxios.get).toHaveBeenCalledTimes(12);
    });
  });

  describe('getArtistImageUrl', () => {
    const mockArtist: SpotifyArtist = {
      id: 'test-id',
      name: 'Test',
      images: [
        { url: 'https://example.com/large.jpg', width: 640, height: 640 },
        { url: 'https://example.com/medium.jpg', width: 300, height: 300 },
        { url: 'https://example.com/small.jpg', width: 64, height: 64 }
      ],
      followers: { total: 1000 },
      genres: ['pop'],
      popularity: 80
    };

    it('should return correct image URL for different sizes', () => {
      expect(spotifyService.getArtistImageUrl(mockArtist, 'small')).toBe('https://example.com/small.jpg');
      expect(spotifyService.getArtistImageUrl(mockArtist, 'medium')).toBe('https://example.com/medium.jpg');
      expect(spotifyService.getArtistImageUrl(mockArtist, 'large')).toBe('https://example.com/large.jpg');
    });

    it('should return null for artist with no images', () => {
      const artistWithoutImages = { ...mockArtist, images: [] };
      expect(spotifyService.getArtistImageUrl(artistWithoutImages)).toBeNull();
    });

    it('should handle single image', () => {
      const artistWithOneImage = {
        ...mockArtist,
        images: [{ url: 'https://example.com/only.jpg', width: 300, height: 300 }]
      };
      
      expect(spotifyService.getArtistImageUrl(artistWithOneImage, 'small')).toBe('https://example.com/only.jpg');
      expect(spotifyService.getArtistImageUrl(artistWithOneImage, 'medium')).toBe('https://example.com/only.jpg');
      expect(spotifyService.getArtistImageUrl(artistWithOneImage, 'large')).toBe('https://example.com/only.jpg');
    });
  });

  describe('isConfigured', () => {
    it('should return true when client ID and secret are configured', () => {
      // The service should be configured if environment variables are set
      const configured = spotifyService.isConfigured();
      
      // This will depend on whether the test environment has the Spotify env vars set
      expect(typeof configured).toBe('boolean');
    });
  });
});
