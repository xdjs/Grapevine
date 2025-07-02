import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import musicNerdLogo from "@assets/musicNerdLogo_1751389084069.png";
import musicNerdLogoSmall from "@assets/musicNerdLogo_1751389498769.png";
import { NetworkData } from "@/types/network";

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData) => void;
  showNetworkView: boolean;
  clearSearch?: boolean;
  onLoadingChange: (loading: boolean) => void;
  onSearchFunction?: (searchFn: (artistName: string) => void) => void;
  onClearAll?: () => void;
}

interface ArtistOption {
  id: string;
  name: string;
  bio?: string;
}

// Custom hook for viewport height
const useViewportHeight = () => {
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewportHeight;
};

export default function SearchInterface({ 
  onNetworkData, 
  showNetworkView, 
  clearSearch, 
  onLoadingChange, 
  onSearchFunction, 
  onClearAll 
}: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();
  const viewportHeight = useViewportHeight();

  const fetchOptions = async (query: string): Promise<ArtistOption[]> => {
    if (query.length < 1) return [];
    
    console.log(`[Frontend] Fetching instant options for: "${query}"`);
    const response = await fetch(`/api/artist-options/${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch artist options');
    }
    const data = await response.json();
    console.log(`[Frontend] Received ${data.options.length} instant options for "${query}"`);
    return data.options;
  };

  const debouncedFetchOptions = useCallback((query: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(async () => {
      if (query.length >= 1) {
        setIsLoadingOptions(true);
        try {
          const options = await fetchOptions(query);
          setArtistOptions(options);
          setShowDropdown(true);
        } catch (error) {
          console.error('Error fetching artist options:', error);
          setArtistOptions([]);
        } finally {
          setIsLoadingOptions(false);
        }
      } else {
        setArtistOptions([]);
        setShowDropdown(false);
      }
    }, 150);
  }, []);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    debouncedFetchOptions(value);
  };

  const handleArtistSelect = (artist: ArtistOption) => {
    setSearchQuery(artist.name);
    setShowDropdown(false);
    setArtistOptions([]);
    handleSearch(artist.name);
  };

  const handleSearch = async (artistName?: string) => {
    const query = artistName || searchQuery.trim();
    if (!query) return;

    console.log(`🔍 [Frontend] Fetching network data for: "${query}"`);
    console.log(`🔍 [Frontend] Request URL: /api/network/${encodeURIComponent(query)}`);

    setIsLoading(true);
    onLoadingChange(true);
    setShowDropdown(false);
    setArtistOptions([]);

    try {
      const response = await fetch(`/api/network/${encodeURIComponent(query)}`);
      console.log(`🔍 [Frontend] Response status: ${response.status}`);
      console.log(`🔍 [Frontend] Response ok: ${response.ok}`);

      if (response.ok) {
        const networkData = await response.json();
        console.log(`✅ [Frontend] Received network data with ${networkData.nodes.length} nodes`);
        onNetworkData(networkData);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error(`❌ [Frontend] Error response:`, errorData);
        toast({
          title: "Artist not found",
          description: errorData.message || "This artist is not currently in our database. Please try searching for a different artist.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ [Frontend] Network request failed:", error);
      toast({
        title: "Connection Error",
        description: "Unable to search for artist. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  // Expose search function to parent
  useEffect(() => {
    if (onSearchFunction) {
      onSearchFunction((artistName: string) => {
        setSearchQuery(artistName);
        handleSearch(artistName);
      });
    }
  }, [onSearchFunction]);

  // Clear search when clearSearch prop changes
  useEffect(() => {
    if (clearSearch) {
      setSearchQuery("");
      setArtistOptions([]);
      setShowDropdown(false);
    }
  }, [clearSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowDropdown(false);
      setArtistOptions([]);
      handleSearch();
    }
  };

  return (
    <>
      {/* Centered Search - Initial View */}
      <div
        className={`absolute inset-0 flex items-start justify-center z-20 transition-all duration-700 px-4 pt-8 sm:pt-16 ${
          showNetworkView
            ? "opacity-0 pointer-events-none -translate-y-12"
            : "opacity-100"
        }`}
      >
        <div className="text-center w-full max-w-md">
          <div className="mb-4 sm:mb-6 flex justify-center">
            <a 
              href="https://musicnerd.xyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img 
                src={musicNerdLogo} 
                alt="MusicNerd Logo" 
                className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 object-contain"
              />
            </a>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold mb-2 text-white">
            Music Collaboration Network
          </h1>
          <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base md:text-lg px-2">
            Discover how artists connect through producers and songwriters
          </p>
          
          <div className="relative search-dropdown-container">
            <Input
              type="text"
              placeholder="Search for an artist..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                setIsSearchFocused(true);
                if (searchQuery.length >= 1) {
                  setShowDropdown(true);
                }
              }}
              className="w-full pr-12 text-base sm:text-lg py-2 sm:py-3 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
            <Button
              onClick={() => handleSearch()}
              disabled={isLoading || !searchQuery.trim()}
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-pink-600 hover:bg-pink-700"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
            
            {/* Artist Options Dropdown - Instant Search Results */}
            {(showDropdown || isLoadingOptions) && (!showNetworkView || isSearchFocused) && (
              <div 
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                style={{ maxHeight: '160px' }}
              >
                <div className="p-2">
                  {isLoadingOptions && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-xs text-gray-400">Finding artists...</span>
                    </div>
                  )}
                  
                  {!isLoadingOptions && artistOptions.length > 0 && (
                    <>
                      <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-2">
                        {artistOptions.length} artist{artistOptions.length !== 1 ? 's' : ''} found
                      </div>
                      {artistOptions.map((artist, index) => (
                        <Card
                          key={artist.id}
                          className="mb-2 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                          style={{ borderLeftColor: '#FF69B4' }}
                          onClick={() => handleArtistSelect(artist)}
                        >
                          <CardHeader className="p-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm text-white font-medium truncate">
                                {artist.name}
                                {artist.name.toLowerCase() === searchQuery.toLowerCase() && (
                                  <span className="ml-2 text-xs bg-pink-600 text-white px-2 py-1 rounded">
                                    Exact Match
                                  </span>
                                )}
                              </CardTitle>
                            </div>
                            {artist.bio && (
                              <CardDescription className="text-xs text-gray-400 line-clamp-2">
                                {artist.bio}
                              </CardDescription>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </>
                  )}
                  
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
            
            <div className="flex-1 relative search-dropdown-container">
              <Input
                type="text"
                placeholder="Search for a new artist..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchQuery.length >= 1) {
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 200);
                }}
                className="w-full pr-10 text-sm bg-gray-800 border-gray-700 text-white placeholder-gray-400"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={isLoading || !searchQuery.trim()}
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-pink-600 hover:bg-pink-700 p-1.5"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>

              {/* Artist Options Dropdown - Network View */}
              {(showDropdown || isLoadingOptions) && isSearchFocused && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                  style={{ maxHeight: '130px' }}
                >
                  <div className="p-2">
                    {isLoadingOptions && (
                      <div className="flex items-center justify-center py-2">
                        <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="text-xs text-gray-400">Finding artists...</span>
                      </div>
                    )}
                    
                    {!isLoadingOptions && artistOptions.length > 0 && (
                      <>
                        <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-2">
                          {artistOptions.length} artist{artistOptions.length !== 1 ? 's' : ''} found
                        </div>
                        {artistOptions.map((artist, index) => (
                          <Card
                            key={artist.id}
                            className="mb-1 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                            style={{ borderLeftColor: '#FF69B4' }}
                            onClick={() => handleArtistSelect(artist)}
                          >
                            <CardHeader className="p-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-xs text-white font-medium truncate">
                                  {artist.name}
                                  {artist.name.toLowerCase() === searchQuery.toLowerCase() && (
                                    <span className="ml-2 text-xs bg-pink-600 text-white px-1 py-0.5 rounded text-xs">
                                      Exact Match
                                    </span>
                                  )}
                                </CardTitle>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </>
                    )}
                    
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