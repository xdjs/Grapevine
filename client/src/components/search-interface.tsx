import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchNetworkData } from "@/lib/network-data";
import { NetworkData } from "@/types/network";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import musicNerdLogo from "@assets/musicNerdLogo_1751389187695.png";
import musicNerdLogoSmall from "@assets/musicNerdLogo_1751389498769.png";

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData) => void;
  showNetworkView: boolean;
  clearSearch?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onSearchFunction?: (searchFn: (artistName: string) => void) => void;
  onClearAll?: () => void;
}

interface ArtistOption {
  id: string;
  name: string;
  bio?: string;
}

export default function SearchInterface({ onNetworkData, showNetworkView, clearSearch, onLoadingChange, onSearchFunction, onClearAll }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Debounced function to fetch artist options
  const debouncedFetchOptions = useCallback(async (query: string) => {
    if (query.length === 0) {
      setArtistOptions([]);
      setShowDropdown(false);
      return;
    }

    // Show suggestions after just 1 character
    if (query.length >= 1) {
      setIsLoadingOptions(true);
      
      try {
        console.log(`[Frontend] Fetching instant options for: "${query}"`);
        const response = await fetch(`/api/artist-options/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.options && Array.isArray(data.options)) {
          console.log(`[Frontend] Received ${data.options.length} instant options for "${query}"`);
          setArtistOptions(data.options);
          setShowDropdown(data.options.length > 0);
        } else {
          setArtistOptions([]);
          setShowDropdown(false);
        }
      } catch (error) {
        console.error('Error fetching artist options:', error);
        setArtistOptions([]);
        setShowDropdown(false);
      } finally {
        setIsLoadingOptions(false);
      }
    }
  }, []);

  // Handle input changes with debouncing
  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedFetchOptions(value);
    }, 150); // 150ms debounce for very responsive feel
  }, [debouncedFetchOptions]);

  const handleSearch = (artistName?: string) => {
    const query = artistName || searchQuery.trim();
    if (!query) {
      toast({
        title: "Please enter an artist name",
        variant: "destructive",
      });
      return;
    }
    setCurrentSearch(query);
    // Immediately hide dropdown and clear options when search starts
    setShowDropdown(false);
    setArtistOptions([]);
  };

  // Clear search field when clearSearch prop changes to true
  useEffect(() => {
    if (clearSearch) {
      setSearchQuery("");
      setCurrentSearch("");
      setArtistOptions([]);
      setShowDropdown(false);
    }
  }, [clearSearch]);

  // Expose search function to parent component
  useEffect(() => {
    if (onSearchFunction) {
      onSearchFunction((artistName: string) => {
        setSearchQuery(artistName);
        handleSearch(artistName);
      });
    }
  }, [onSearchFunction, handleSearch]);

  // Hide dropdown when network view changes
  useEffect(() => {
    if (showNetworkView) {
      setShowDropdown(false);
      setArtistOptions([]);
    }
  }, [showNetworkView]);

  // Clear currentSearch when user starts editing a different query
  useEffect(() => {
    if (currentSearch && searchQuery.trim() !== currentSearch) {
      setCurrentSearch("");
    }
  }, [searchQuery, currentSearch]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["/api/network", currentSearch],
    queryFn: () => fetchNetworkData(currentSearch),
    enabled: !!currentSearch,
    staleTime: 5 * 60 * 1000, // 5 minutes - cached data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
  });

  // Update network data when query succeeds
  useEffect(() => {
    if (data && data !== undefined) {
      onNetworkData(data);
      // Hide dropdown and clear artist options when network loads
      setShowDropdown(false);
      setArtistOptions([]);
    }
  }, [data, onNetworkData]);

  // Handle loading state changes - only show loading for actual network requests, not cached data
  useEffect(() => {
    if (onLoadingChange) {
      // Show loading only when fetching and we don't have existing data for this search
      const shouldShowLoading = isFetching && !(data as any)?.cached;
      onLoadingChange(shouldShowLoading);
    }
  }, [isFetching, data, onLoadingChange]);

  // Show error toast when query fails
  useEffect(() => {
    if (error) {
      // Check if it's a "not found in database" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNotFoundError = errorMessage.includes('not found in database');
      
      console.error('🚨 [Search Interface] Network query error:', error);
      console.error('🚨 [Search Interface] Error message:', errorMessage);
      console.error('🚨 [Search Interface] Current search:', currentSearch);
      
      toast({
        title: isNotFoundError ? "Artist not in database" : "Error loading network",
        description: isNotFoundError 
          ? "This artist isn't in our database yet. Try searching for another artist from the dropdown suggestions."
          : `Please try again or search for another artist. Error: ${errorMessage.substring(0, 100)}`,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleArtistSelect = (artist: ArtistOption) => {
    setSearchQuery(artist.name);
    // Immediately hide dropdown and clear options when artist is selected
    setShowDropdown(false);
    setArtistOptions([]);
    handleSearch(artist.name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Immediately hide dropdown when Enter is pressed
      setShowDropdown(false);
      setArtistOptions([]);
      handleSearch();
    }
  };

  return (
    <>
      {/* Centered Search - Initial View */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-20 transition-all duration-700 px-4 ${
          showNetworkView
            ? "opacity-0 pointer-events-none -translate-y-12"
            : "opacity-100"
        }`}
      >
        <div className="text-center w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <a 
              href="https://musicnerd.xyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img 
                src={musicNerdLogo} 
                alt="MusicNerd Logo" 
                className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
              />
            </a>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 text-white">
            Music Collaboration Network
          </h1>
          <p className="text-gray-400 mb-8 text-base sm:text-lg px-2">
            Discover how artists connect through producers and songwriters
          </p>

          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Enter an artist name..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <Button
              onClick={() => {
                // Immediately hide dropdown when search button is clicked
                setShowDropdown(false);
                setArtistOptions([]);
                handleSearch();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 rounded-md"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
            
            {/* Artist Options Dropdown - Instant Search Results */}
            {(showDropdown || isLoadingOptions) && (!showNetworkView || isSearchFocused) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto artist-dropdown-scroll">
                <div className="p-2">
                  {isLoadingOptions && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-xs text-gray-400">Finding artists...</span>
                    </div>
                  )}
                  
                  {!isLoadingOptions && artistOptions.length > 0 && artistOptions.map((artist, index) => (
                    <Card
                      key={artist.id}
                      className="mb-2 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                      style={{
                        borderLeftColor: '#FF69B4'
                      }}
                      onClick={() => handleArtistSelect(artist)}
                    >
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm text-white">{artist.name}</CardTitle>
                          {artist.name.toLowerCase() === searchQuery.toLowerCase() && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                              Exact Match
                            </span>
                          )}
                        </div>
                        {artist.bio && (
                          <CardDescription className="text-xs text-gray-400 line-clamp-2">
                            {artist.bio}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                  
                  {!isLoadingOptions && artistOptions.length === 0 && searchQuery.length >= 1 && (
                    <div className="py-4 text-center text-xs text-gray-400">
                      No artists found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Bar Search - Network View */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-all duration-700 ${
          showNetworkView
            ? "opacity-100 pointer-events-auto translate-y-0"
            : "opacity-0 pointer-events-none -translate-y-12"
        }`}
      >
        <div className="bg-black/90 backdrop-blur-sm border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={onClearAll}
                className="hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
                title="Clear All"
              >
                <img 
                  src={musicNerdLogoSmall} 
                  alt="MusicNerd Logo - Click to Clear" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
                />
              </button>
              <h2 className="text-sm sm:text-xl font-semibold text-white truncate">
                <span className="hidden sm:inline">Music Collaboration Network</span>
                <span className="sm:hidden">MusicNerd</span>
              </h2>
            </div>
            
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Search for a new artist..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  setIsSearchFocused(true);
                  // Trigger search if we have content but no current options
                  if (searchQuery.trim().length >= 1 && artistOptions.length === 0) {
                    debouncedFetchOptions(searchQuery.trim());
                  } else if (artistOptions.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding focus to allow dropdown clicks
                  setTimeout(() => {
                    setIsSearchFocused(false);
                    setShowDropdown(false);
                  }, 150);
                }}
                className="w-full px-3 py-2 sm:px-4 sm:py-2 bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-10 sm:pr-12 text-sm sm:text-base"
                disabled={isLoading}
              />

              <Button
                onClick={() => {
                  // Immediately hide dropdown when search button is clicked
                  setShowDropdown(false);
                  setArtistOptions([]);
                  handleSearch();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 p-0 bg-blue-600 hover:bg-blue-700 rounded-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>
              
              {/* Artist Options Dropdown - Network View Instant Search */}
              {(showDropdown || isLoadingOptions) && (!showNetworkView || isSearchFocused) && (
                <div className="absolute top-full left-0 right-14 sm:right-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto artist-dropdown-scroll">
                  <div className="p-1">
                    {isLoadingOptions && (
                      <div className="flex items-center justify-center py-2">
                        <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="text-xs text-gray-400">Finding artists...</span>
                      </div>
                    )}
                    
                    {!isLoadingOptions && artistOptions.length > 0 && artistOptions.map((artist, index) => (
                      <Card
                        key={artist.id}
                        className="mb-1 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                        style={{
                          borderLeftColor: '#FF69B4'
                        }}
                        onClick={() => handleArtistSelect(artist)}
                      >
                        <CardHeader className="pb-1 pt-2 px-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs text-white">{artist.name}</CardTitle>
                            {artist.name.toLowerCase() === searchQuery.toLowerCase() && (
                              <span className="text-xs px-1 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                Exact Match
                              </span>
                            )}
                          </div>
                          {artist.bio && (
                            <CardDescription className="text-xs text-gray-400 line-clamp-1">
                              {artist.bio}
                            </CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                    
                    {!isLoadingOptions && artistOptions.length === 0 && searchQuery.length >= 1 && (
                      <div className="py-2 text-center text-xs text-gray-400">
                        No artists found for "{searchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}