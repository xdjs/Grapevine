import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { useConfig } from './use-config';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const consoleMocks = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('useConfig Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Configuration Fetch', () => {
    it('should initialize with loading state and fetch config on mount', async () => {
      const mockConfig = { musicNerdBaseUrl: 'https://musicnerd.test' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockConfig,
      });

      const { result } = renderHook(() => useConfig());

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.musicNerdBaseUrl).toBe('');
      expect(result.current.error).toBe(null);

      // Wait for config to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.musicNerdBaseUrl).toBe('https://musicnerd.test');
      expect(result.current.error).toBe(null);
      expect(mockFetch).toHaveBeenCalledWith('/api/config');
      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] Fetching config from /api/config');
    });

    it('should handle successful config fetch with proper logging', async () => {
      const mockConfig = { musicNerdBaseUrl: 'https://example.com' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockConfig,
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] Response status:', 200);
      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] Response ok:', true);
      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] Received config:', mockConfig);
      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] MusicNerd base URL set to: https://example.com');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors properly', async () => {
      const networkError = new Error('Network failure');
      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error fetching config: Network failure');
      expect(result.current.musicNerdBaseUrl).toBe('');
      expect(consoleMocks.error).toHaveBeenCalledWith('🔧 [Config] Error fetching config:', networkError);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Config API error: 500 - Internal Server Error');
      expect(result.current.musicNerdBaseUrl).toBe('');
      expect(consoleMocks.error).toHaveBeenCalledWith('🔧 [Config] Error response:', 'Internal Server Error');
    });

    it('should handle missing musicNerdBaseUrl in response', async () => {
      const invalidConfig = { someOtherField: 'value' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => invalidConfig,
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('No musicNerdBaseUrl in config response');
      expect(result.current.musicNerdBaseUrl).toBe('');
      expect(consoleMocks.error).toHaveBeenCalledWith('🔧 [Config]', 'No musicNerdBaseUrl in config response');
    });

    it('should handle empty config response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('No musicNerdBaseUrl in config response');
      expect(result.current.musicNerdBaseUrl).toBe('');
    });

    it('should handle unknown error types', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error fetching config: Unknown error');
    });
  });

  describe('Manual Refresh Functionality', () => {
    it('should allow manual config refresh', async () => {
      // Initial fetch
      const initialConfig = { musicNerdBaseUrl: 'https://initial.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialConfig,
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.musicNerdBaseUrl).toBe('https://initial.com');

      // Manual refresh with new config
      const updatedConfig = { musicNerdBaseUrl: 'https://updated.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedConfig,
      });

      // Trigger refresh
      await result.current.refreshConfig();

      expect(result.current.musicNerdBaseUrl).toBe('https://updated.com');
      expect(result.current.error).toBe(null);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle loading state during manual refresh', async () => {
      // Initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://test.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock slow refresh
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      mockFetch.mockReturnValueOnce(
        refreshPromise.then(() => ({
          ok: true,
          json: async () => ({ musicNerdBaseUrl: 'https://refreshed.com' }),
        }))
      );

      // Start refresh
      const refreshPromiseResult = result.current.refreshConfig();

      // Check loading state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Complete refresh
      resolveRefresh!({});
      await refreshPromiseResult;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.musicNerdBaseUrl).toBe('https://refreshed.com');
    });

    it('should clear error state when manual refresh succeeds', async () => {
      // Initial fetch fails
      mockFetch.mockRejectedValueOnce(new Error('Initial error'));

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://success.com' }),
      });

      await result.current.refreshConfig();

      expect(result.current.error).toBe(null);
      expect(result.current.musicNerdBaseUrl).toBe('https://success.com');
    });
  });

  describe('Fresh Config Retrieval', () => {
    it('should fetch fresh config without affecting loading state', async () => {
      // Initial setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://initial.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fresh config fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://fresh.com' }),
      });

      const freshConfig = await result.current.getFreshConfig();

      expect(freshConfig).toEqual({ musicNerdBaseUrl: 'https://fresh.com' });
      expect(result.current.isLoading).toBe(false); // Should not affect loading state
      expect(result.current.musicNerdBaseUrl).toBe('https://fresh.com'); // Should update if different
    });

    it('should update cached URL when fresh config differs', async () => {
      // Initial setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://original.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.musicNerdBaseUrl).toBe('https://original.com');
      });

      // Fresh config with different URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://different.com' }),
      });

      await result.current.getFreshConfig();

      expect(result.current.musicNerdBaseUrl).toBe('https://different.com');
      expect(consoleMocks.log).toHaveBeenCalledWith('🔧 [Config] Updated cached base URL to: https://different.com');
    });

    it('should not update state when fresh config is same', async () => {
      const sameUrl = 'https://same.com';
      
      // Initial setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: sameUrl }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.musicNerdBaseUrl).toBe(sameUrl);
      });

      // Fresh config with same URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: sameUrl }),
      });

      await result.current.getFreshConfig();

      expect(result.current.musicNerdBaseUrl).toBe(sameUrl);
      // Should not log update message
      expect(consoleMocks.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated cached base URL'));
    });

    it('should handle fresh config fetch errors gracefully', async () => {
      // Initial setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://working.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fresh config fetch fails
      mockFetch.mockRejectedValueOnce(new Error('Fresh fetch failed'));

      const freshConfig = await result.current.getFreshConfig();

      expect(freshConfig).toBe(null);
      expect(result.current.musicNerdBaseUrl).toBe('https://working.com'); // Should preserve existing
      expect(consoleMocks.error).toHaveBeenCalledWith('🔧 [Config] Error fetching fresh config:', expect.any(Error));
    });

    it('should handle fresh config HTTP errors', async () => {
      // Initial setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://working.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fresh config returns error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const freshConfig = await result.current.getFreshConfig();

      expect(freshConfig).toBe(null);
      expect(consoleMocks.error).toHaveBeenCalledWith('🔧 [Config] Failed to fetch fresh config, status:', 404);
    });
  });

  describe('TypeScript Interface Compliance', () => {
    it('should return correctly typed interface', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://typed.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify all required properties exist with correct types
      expect(typeof result.current.musicNerdBaseUrl).toBe('string');
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
      expect(typeof result.current.refreshConfig).toBe('function');
      expect(typeof result.current.getFreshConfig).toBe('function');
    });

    it('should handle async function return types correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://async.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test refreshConfig returns Promise<void>
      const refreshPromise = result.current.refreshConfig();
      expect(refreshPromise).toBeInstanceOf(Promise);
      await refreshPromise;

      // Test getFreshConfig returns Promise<Config | null>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://fresh-typed.com' }),
      });

      const getFreshPromise = result.current.getFreshConfig();
      expect(getFreshPromise).toBeInstanceOf(Promise);
      const freshResult = await getFreshPromise;
      expect(freshResult).toEqual({ musicNerdBaseUrl: 'https://fresh-typed.com' });
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should not cause memory leaks on unmount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://cleanup.com' }),
      });

      const { result, unmount } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid successive calls gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ musicNerdBaseUrl: 'https://rapid.com' }),
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rapid successive calls
      const promises = [
        result.current.refreshConfig(),
        result.current.getFreshConfig(),
        result.current.refreshConfig(),
        result.current.getFreshConfig(),
      ];

      await Promise.all(promises);

      expect(result.current.musicNerdBaseUrl).toBe('https://rapid.com');
      expect(result.current.error).toBe(null);
    });
  });
}); 