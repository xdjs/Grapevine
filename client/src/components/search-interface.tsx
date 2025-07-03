import { useState, useEffect, useCallback, useRef } from "react";
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
  artistId?: string;
  name: string;
  bio?: string;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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

function SearchInterface({ onNetworkData, showNetworkView, clearSearch, onLoadingChange, onSearchFunction, onClearAll }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const networkSearchInputRef = useRef<HTMLInputElement>(null);
  const viewportHeight = useViewportHeight();
  
  // Calculate dynamic dropdown height based on available space
  const calculateDropdownHeight = useCallback((baseHeight: number, isNetworkView: boolean = false) => {
    const inputRef = isNetworkView ? networkSearchInputRef.current : searchInputRef.current;
    if (!inputRef) return `${baseHeight}px`;
    
    const inputRect = inputRef.getBoundingClientRect();
    const availableSpace = window.innerHeight - inputRect.bottom - 80; // 80px buffer for taskbar
    const maxHeight = Math.min(baseHeight, Math.max(120, availableSpace)); // Minimum 120px
    
    return `${maxHeight}px`;
  }, []);

  // Fetch artist options for instant search
  const fetchArtistOptions = useCallback(async (query: string) => {
    if (query.trim().length < 1) {
      setArtistOptions([]);
      setShowDropdown(false);
      return;
    }

    try {
      setIsLoadingOptions(true);
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (response.ok) {
        const options = await response.json();
        setArtistOptions(Array.isArray(options) ? options : []);
        setShowDropdown(Array.isArray(options) && options.length > 0);
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
  }, []);

  // Debounced version for instant search
  const debouncedFetchOptions = useCallback(
    debounce((query: string) => fetchArtistOptions(query), 150),
    [fetchArtistOptions]
  );

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length >= 1) {
      debouncedFetchOptions(value.trim());
    } else {
      setArtistOptions([]);
      setShowDropdown(false);
    }
  };

  const handleArtistSelect = async (artist: ArtistOption) => {
    setSearchQuery(artist.name);
    setShowDropdown(false);
    setArtistOptions([]);
    
    // Trigger search immediately
    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      
      const data = await fetchNetworkData(artist.name.trim());
      onNetworkData(data);
      
      toast({
        title: "Network Generated",
        description: `Found collaboration network for ${artist.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch network data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      
      const data = await fetchNetworkData(searchQuery.trim());
      onNetworkData(data);
      
      toast({
        title: "Network Generated",
        description: `Found collaboration network for ${searchQuery}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch network data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  }, [searchQuery, onNetworkData, onLoadingChange, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowDropdown(false);
      setArtistOptions([]);
      handleSearch();
    }
  };

  // Clear search functionality
  useEffect(() => {
    if (clearSearch) {
      setSearchQuery("");
      setCurrentSearch("");
      setArtistOptions([]);
      setShowDropdown(false);
    }
  }, [clearSearch]);

  // Register search function with parent
  useEffect(() => {
    if (onSearchFunction) {
      onSearchFunction(async (artistName: string) => {
        console.log(`🔍 [Search Interface] Triggered search for: ${artistName}`);
        setSearchQuery(artistName);
        
        // Trigger search immediately with the new artist name
        try {
          setIsLoading(true);
          onLoadingChange?.(true);
          
          const data = await fetchNetworkData(artistName.trim());
          onNetworkData(data);
          
          toast({
            title: "Network Generated",
            description: `Found collaboration network for ${artistName}`,
          });
        } catch (error) {
          console.error(`❌ [Search Interface] Error searching for ${artistName}:`, error);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to fetch network data",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
          onLoadingChange?.(false);
        }
      });
    }
  }, [onSearchFunction, onNetworkData, onLoadingChange, toast]);

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
            <img 
              src={musicNerdLogo} 
              alt="MusicNerd Logo" 
              className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
            />
          </div>
          
          <h1 className="text-xl sm:text-4xl font-bold mb-2 sm:mb-4 text-white">
            Music Collaboration Network
          </h1>
          <p className="text-sm sm:text-lg text-gray-300 mb-6 sm:mb-8">
            Discover connections between artists, producers, and songwriters
          </p>
          
          <div className="relative mb-4 sm:mb-6 search-dropdown-container">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Enter artist name..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                setIsSearchFocused(true);
                if (searchQuery.trim().length >= 1 && artistOptions.length === 0) {
                  debouncedFetchOptions(searchQuery.trim());
                } else if (artistOptions.length > 0) {
                  setShowDropdown(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsSearchFocused(false);
                  setShowDropdown(false);
                }, 150);
              }}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-12 sm:pr-16 text-base sm:text-lg rounded-xl"
              disabled={isLoading}
            />
            <Button
              onClick={() => {
                setShowDropdown(false);
                setArtistOptions([]);
                handleSearch();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 p-0 bg-blue-600 hover:bg-blue-700 rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>

            {/* Artist Options Dropdown - Home View */}
            {(showDropdown || isLoadingOptions) && !showNetworkView && (
              <div 
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                style={{ 
                  maxHeight: '180px', // Exact height for 3 cards only
                  bottom: 'auto'
                }}
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
                ref={networkSearchInputRef}
                type="text"
                placeholder="Search for a new artist..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchQuery.trim().length >= 1 && artistOptions.length === 0) {
                    debouncedFetchOptions(searchQuery.trim());
                  } else if (artistOptions.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => {
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

              {/* Artist Options Dropdown - Network View */}
              {(showDropdown || isLoadingOptions) && showNetworkView && isSearchFocused && (
                <div 
                  className="absolute top-full left-0 right-14 sm:right-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll"
                  style={{ 
                    maxHeight: '160px', // Exact height for 3 cards in network view
                    bottom: 'auto'
                  }}
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

export default SearchInterface;