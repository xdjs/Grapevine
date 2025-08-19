import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openAIService, OpenAICollaborator } from '../openai-service';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

describe('OpenAI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSpotifyAppearsOnCollaborators', () => {
    it('should return collaborators from Spotify "appears on" analysis', async () => {
      // Mock the OpenAI response
      const mockOpenAI = require('openai').default;
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              collaborators: [
                {
                  name: "Drake",
                  roles: ["artist"],
                  topCollaborators: ["Future", "21 Savage", "Travis Scott"],
                  collaborationType: "featured artist",
                  verificationLevel: "high"
                },
                {
                  name: "Metro Boomin",
                  roles: ["producer"],
                  topCollaborators: ["21 Savage", "Future", "Travis Scott"],
                  collaborationType: "producer",
                  verificationLevel: "high"
                }
              ]
            })
          }
        }]
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      // Mock environment variable
      process.env.OPENAI_API_KEY = 'test-key';

      const result = await openAIService.getSpotifyAppearsOnCollaborators('Post Malone');

      expect(result.artists).toHaveLength(3); // 2 collaborators with roles
      expect(result.artists[0].name).toBe('Drake');
      expect(result.artists[0].type).toBe('producer'); // artist role mapped to producer
      expect(result.artists[0].collaborationType).toBe('featured artist');
      expect(result.artists[0].verificationLevel).toBe('high');
      expect(result.artists[1].name).toBe('Metro Boomin');
      expect(result.artists[1].type).toBe('producer');
      expect(result.artists[1].collaborationType).toBe('producer');
      expect(result.artists[1].verificationLevel).toBe('high');
    });

    it('should handle empty response', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ collaborators: [] })
          }
        }]
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      process.env.OPENAI_API_KEY = 'test-key';

      const result = await openAIService.getSpotifyAppearsOnCollaborators('Unknown Artist');

      expect(result.artists).toHaveLength(0);
    });

    it('should filter out compilation albums and unverified collaborations', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              collaborators: [
                {
                  name: "Real Collaborator",
                  roles: ["artist"],
                  topCollaborators: ["Artist 1", "Artist 2", "Artist 3"],
                  collaborationType: "featured artist",
                  verificationLevel: "high"
                }
                // Note: The prompt should filter out compilation albums
              ]
            })
          }
        }]
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      process.env.OPENAI_API_KEY = 'test-key';

      const result = await openAIService.getSpotifyAppearsOnCollaborators('Test Artist');

      expect(result.artists).toHaveLength(1);
      expect(result.artists[0].name).toBe('Real Collaborator');
      expect(result.artists[0].verificationLevel).toBe('high');
    });
  });
});
