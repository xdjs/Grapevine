import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default function SearchInterface({
  onNetworkData,
  showNetworkView,
  clearSearch,
  onLoadingChange,
  onSearchFunction,
  onClearAll,
}: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);



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
          if (options.length > 0) {
            setShowDropdown(true);
          }
        } catch (error) {
          console.error('Failed to fetch artist options:', error);
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

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    
    if (value.trim().length >= 1) {
      debouncedFetchOptions(value.trim());
    } else {
      setArtistOptions([]);
      setShowDropdown(false);
      setIsLoadingOptions(false);
    }
  };

  const handleSearch = async (artist?: string) => {
    const searchTerm = artist || searchQuery.trim();
    if (!searchTerm) return;

    setIsLoading(true);
    onLoadingChange(true);
    
    // Hide dropdown immediately when search starts
    setShowDropdown(false);
    setArtistOptions([]);

    try {
      console.log(`🔍 [Frontend] Fetching network data for: "${searchTerm}"`);
      const encodedArtist = encodeURIComponent(searchTerm);
      const url = `/api/network/${encodedArtist}`;
      console.log(`🔍 [Frontend] Request URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`🔍 [Frontend] Response status: ${response.status}`);
      console.log(`🔍 [Frontend] Response ok: ${response.ok}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Frontend] Network request failed: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch network data: ${response.status}`);
      }

      const networkData = await response.json();
      console.log(`✅ [Frontend] Received network data with ${networkData.nodes.length} nodes`);
      
      onNetworkData(networkData);
      setSearchQuery(searchTerm);
    } catch (error) {
      console.error("❌ [Frontend] Error fetching network data:", error);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  useEffect(() => {
    if (onSearchFunction) {
      onSearchFunction(handleSearch);
    }
  }, [onSearchFunction]);

  useEffect(() => {
    if (clearSearch) {
      setSearchQuery("");
      setArtistOptions([]);
      setShowDropdown(false);
    }
  }, [clearSearch]);

  const handleArtistSelect = (artist: ArtistOption) => {
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
        className={`absolute inset-0 flex items-start justify-center z-20 transition-all duration-700 px-4 pt-16 ${
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

          <div className="relative w-full search-dropdown-container">
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
              <div 
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                style={{ maxHeight: 'calc(100vh - 450px)' }}
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
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700 rounded-md"
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
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-14 sm:right-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                  style={{ maxHeight: 'calc(100vh - 180px)' }}
                >
                  <div className="p-1">
                    {isLoadingOptions && (
                      <div className="flex items-center justify-center py-2">
                        <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="text-xs text-gray-400">Finding artists...</span>
                      </div>
                    )}
                    
                    {!isLoadingOptions && artistOptions.length > 0 && (
                      <>
                        <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-1">
                          {artistOptions.length} artist{artistOptions.length !== 1 ? 's' : ''} found
                        </div>
                        {artistOptions.map((artist, index) => (
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