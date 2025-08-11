import { useState, useEffect, useCallback } from 'react';

/**
 * Configuration data structure returned from the API
 */
interface Config {
  musicNerdBaseUrl: string;
}

/**
 * Configuration hook state and methods
 */
interface UseConfigReturn {
  /** The MusicNerd base URL for external links */
  musicNerdBaseUrl: string;
  /** Whether the config is currently being loaded */
  isLoading: boolean;
  /** Any error that occurred while fetching config */
  error: string | null;
  /** Manually refresh the configuration */
  refreshConfig: () => Promise<void>;
  /** Get fresh config data (useful for ensuring up-to-date URLs) */
  getFreshConfig: () => Promise<Config | null>;
}

/**
 * Custom hook for managing application configuration
 * 
 * Handles:
 * - Fetching configuration on mount
 * - Error handling and logging
 * - Retry functionality
 * - Loading states
 * - Manual refresh capabilities
 */
export function useConfig(): UseConfigReturn {
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false); // Start as false to prevent loading screen
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches configuration from the API endpoint
   */
  const fetchConfig = useCallback(async (): Promise<Config | null> => {
    try {
      console.log('🔧 [Config] Fetching config from /api/config');
      const response = await fetch('/api/config');
      console.log('🔧 [Config] Response status:', response.status);
      console.log('🔧 [Config] Response ok:', response.ok);
      
      if (response.ok) {
        const config = await response.json();
        console.log('🔧 [Config] Received config:', config);
        
        if (config.musicNerdBaseUrl) {
          setMusicNerdBaseUrl(config.musicNerdBaseUrl);
          setError(null);
          console.log(`🔧 [Config] MusicNerd base URL set to: ${config.musicNerdBaseUrl}`);
          return config;
        } else {
          const errorMsg = 'No musicNerdBaseUrl in config response';
          console.error('🔧 [Config]', errorMsg);
          setError(errorMsg);
          return null;
        }
      } else {
        const errorText = await response.text();
        const errorMsg = `Config API error: ${response.status} - ${errorText}`;
        console.error('🔧 [Config] Error response:', errorText);
        setError(errorMsg);
        return null;
      }
    } catch (error) {
      const errorMsg = `Network error fetching config: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('🔧 [Config] Error:', errorMsg);
      setError(errorMsg);
      return null;
    }
  }, []);

  /**
   * Manual refresh function for updating configuration
   */
  const refreshConfig = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    await fetchConfig();
    setIsLoading(false);
  }, [fetchConfig]);

  /**
   * Get fresh config data without updating state (useful for one-time checks)
   */
  const getFreshConfig = useCallback(async (): Promise<Config | null> => {
    try {
      console.log('🔧 [Config] Fetching fresh config data...');
      const response = await fetch('/api/config');
      
      if (response.ok) {
        const config = await response.json();
        console.log(`🔧 [Config] Retrieved fresh config: ${config.musicNerdBaseUrl}`);
        
        // Update state if the URL has changed
        if (config.musicNerdBaseUrl && config.musicNerdBaseUrl !== musicNerdBaseUrl) {
          setMusicNerdBaseUrl(config.musicNerdBaseUrl);
          console.log(`🔧 [Config] Updated cached base URL to: ${config.musicNerdBaseUrl}`);
        }
        
        return config;
      } else {
        console.error('🔧 [Config] Failed to fetch fresh config, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('🔧 [Config] Error fetching fresh config:', error);
      return null;
    }
  }, [musicNerdBaseUrl]);

  // Fetch configuration on component mount
  useEffect(() => {
    let mounted = true;
    
    const initConfig = async () => {
      // Only show loading if we don't have a URL yet and this is a real fetch
      if (!musicNerdBaseUrl) {
        setIsLoading(true);
      }
      
      const config = await fetchConfig();
      
      if (mounted) {
        setIsLoading(false);
      }
    };
    
    // Only initialize on first mount, don't re-fetch on visibility changes
    initConfig();

    // Add event listeners to prevent re-initialization on tab switching
    const handleVisibilityChange = () => {
      // Don't re-fetch config when tab becomes visible again
      console.log('🔧 [Config] Visibility change detected, preserving current config state');
    };

    const handlePageShow = () => {
      // Don't re-fetch config when page shows again
      console.log('🔧 [Config] Page show detected, preserving current config state');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []); // Remove fetchConfig dependency to prevent re-running

  return {
    musicNerdBaseUrl,
    isLoading,
    error,
    refreshConfig,
    getFreshConfig,
  };
} 