import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { NetworkData, SearchHistoryEntry, NetworkResponse, NoCollaboratorsResponse } from "@/types/network";
import NoCollaboratorsPopup from "@/components/no-collaborators-popup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, Clock } from "lucide-react";
import grapevineLogoLarge from "@assets/Grapevine Logo_1752103516040.png";
import grapevineLogoSmall from "@assets/Grapevine Logo_1752103516040.png";

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData, artistId?: string) => void;
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
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showNoCollaboratorsPopup, setShowNoCollaboratorsPopup] = useState(false);
  const [pendingArtistInfo, setPendingArtistInfo] = useState<{ name: string; id: string; singleNodeNetwork: NetworkData } | null>(null);
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

  // Search history utility functions
  const loadSearchHistory = useCallback(() => {
    try {
      const saved = sessionStorage.getItem('grapevine-search-history');
      if (saved) {
        const parsed = JSON.parse(saved) as SearchHistoryEntry[];
        // Sort by timestamp, most recent first
        const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp);
        // Keep only the last 10 entries
        setSearchHistory(sorted.slice(0, 10));
      } else {
        setSearchHistory([]);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      setSearchHistory([]);
    }
  }, []);

  const saveToSearchHistory = useCallback((artistName: string, artistId: string | null) => {
    try {
      const newEntry: SearchHistoryEntry = {
        artistName,
        artistId,
        timestamp: Date.now(),
        url: artistId ? `/${artistId}` : '/'
      };

      setSearchHistory(prev => {
        // Remove any existing entry for this artist to avoid duplicates
        const filtered = prev.filter(entry => entry.artistName.toLowerCase() !== artistName.toLowerCase());
        // Add new entry at the beginning
        const updated = [newEntry, ...filtered].slice(0, 10); // Keep max 10 entries
        
        // Save to sessionStorage
        try {
          sessionStorage.setItem('grapevine-search-history', JSON.stringify(updated));
        } catch (storageError) {
          console.error('Error saving to sessionStorage:', storageError);
        }
        
        return updated;
      });
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, []);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  // Helper function to check if response indicates no collaborators
  const isNoCollaboratorsResponse = (response: NetworkResponse): response is NoCollaboratorsResponse => {
    return 'noCollaborators' in response && response.noCollaborators === true;
  };

  // Helper function to handle network response
  const handleNetworkResponse = useCallback((response: NetworkResponse, artistName: string) => {
    if (isNoCollaboratorsResponse(response)) {
      // Show popup for no collaborators
      setPendingArtistInfo({
        name: response.artistName,
        id: response.artistId,
        singleNodeNetwork: response.singleNodeNetwork
      });
      setShowNoCollaboratorsPopup(true);
    } else {
      // Normal network data - pass to parent
      const mainArtist = response.nodes.find(node => node.size === 30 && node.type === 'artist');
      const artistId = mainArtist?.artistId || mainArtist?.id;
      onNetworkData(response, artistId);
      
      toast({
        title: "Network Generated",
        description: `Found collaboration network for ${artistName}`,
        duration: 1000,
      });
    }
  }, [onNetworkData, toast]);

  // Handle user choice from popup
  const handleShowHallucinations = useCallback(async () => {
    if (!pendingArtistInfo) return;
    
    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      
      const data = await fetchNetworkData(pendingArtistInfo.name, true); // Request hallucinated data
      
      if (isNoCollaboratorsResponse(data)) {
        // Even with hallucinations, no data found - show single node
        onNetworkData(data.singleNodeNetwork, pendingArtistInfo.id);
      } else {
        // Got hallucinated network
        const mainArtist = data.nodes.find(node => node.size === 30 && node.type === 'artist');
        const artistId = mainArtist?.artistId || pendingArtistInfo.id;
        onNetworkData(data, artistId);
      }
      
      // Save to search history
      saveToSearchHistory(pendingArtistInfo.name, pendingArtistInfo.id);
      
      setShowNoCollaboratorsPopup(false);
      setPendingArtistInfo(null);
      
      toast({
        title: "Network Generated",
        description: `Generated creative network for ${pendingArtistInfo.name}`,
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate hallucinated network",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  }, [pendingArtistInfo, onNetworkData, onLoadingChange, toast, saveToSearchHistory]);

  const handleClosePopup = useCallback(() => {
    if (!pendingArtistInfo) return;
    
    // Default to single node when popup is closed/cancelled
    onNetworkData(pendingArtistInfo.singleNodeNetwork, pendingArtistInfo.id);
    saveToSearchHistory(pendingArtistInfo.name, pendingArtistInfo.id);
    
    setShowNoCollaboratorsPopup(false);
    setPendingArtistInfo(null);
    
    toast({
      title: "Network Generated",
      description: `Showing ${pendingArtistInfo.name} as single node`,
      duration: 1000,
    });
  }, [pendingArtistInfo, onNetworkData, toast, saveToSearchHistory]);

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

  // Load search history on component mount and when dropdown is shown
  useEffect(() => {
    loadSearchHistory();
  }, [loadSearchHistory]);

  // Also reload search history when dropdown is shown to ensure it's up to date
  useEffect(() => {
    if (showDropdown && searchQuery.trim().length === 0) {
      loadSearchHistory();
    }
  }, [showDropdown, searchQuery, loadSearchHistory]);

  const handleArtistSelect = async (artist: ArtistOption) => {
    setSearchQuery(artist.name);
    setShowDropdown(false);
    setArtistOptions([]);
    
    // Use artist ID if available, otherwise fall back to name
    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      
      // Use artist ID if available, otherwise fall back to name
      const data = artist.artistId 
        ? await fetchNetworkDataById(artist.artistId)
        : await fetchNetworkData(artist.name.trim());
      
      // Handle the response (might be network data or no-collaborators response)
      handleNetworkResponse(data, artist.name);
      
      // Save to search history if it's not a popup case (will be handled in popup callbacks)
      if (!isNoCollaboratorsResponse(data)) {
        const finalArtistId = artist.artistId || artist.id;
        saveToSearchHistory(artist.name, finalArtistId);
      }
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
      
      // Handle the response (might be network data or no-collaborators response)
      handleNetworkResponse(data, searchQuery.trim());
      
      // Save to search history if it's not a popup case (will be handled in popup callbacks)
      if (!isNoCollaboratorsResponse(data)) {
        const mainArtist = data.nodes.find(node => node.size === 30 && node.type === 'artist');
        const artistId = mainArtist?.artistId || mainArtist?.id;
        saveToSearchHistory(searchQuery.trim(), artistId || null);
      }
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
  }, [searchQuery, onNetworkData, onLoadingChange, toast, saveToSearchHistory]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowDropdown(false);
      setArtistOptions([]);
      handleSearch();
    }
  };

  const handleHistoryItemClick = async (historyEntry: SearchHistoryEntry) => {
    setSearchQuery(historyEntry.artistName);
    setShowDropdown(false);
    setArtistOptions([]);
    
    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      
      // Use artist ID if available, otherwise fall back to name
      const data = historyEntry.artistId 
        ? await fetchNetworkDataById(historyEntry.artistId)
        : await fetchNetworkData(historyEntry.artistName);
      
      // Handle the response (might be network data or no-collaborators response)
      handleNetworkResponse(data, historyEntry.artistName);
      
      // Update timestamp for this history entry if it's not a popup case
      if (!isNoCollaboratorsResponse(data)) {
        saveToSearchHistory(historyEntry.artistName, historyEntry.artistId);
      }
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
      onSearchFunction(async (artistIdentifier: string) => {
        console.log(`🔍 [Search Interface] Triggered search for: ${artistIdentifier}`);
        setSearchQuery(artistIdentifier);

        // Helper: rudimentary UUID v4 check (MusicBrainz IDs are UUIDs)
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        try {
          setIsLoading(true);
          onLoadingChange?.(true);

          const trimmed = artistIdentifier.trim();
          const data = isUUID(trimmed)
            ? await fetchNetworkDataById(trimmed)
            : await fetchNetworkData(trimmed);

          // Try to get artist ID for URL (from the main artist in the network)
          const mainArtist = data.nodes.find(node => node.size === 30 && node.type === 'artist');
          const artistId = mainArtist?.artistId || mainArtist?.id;

          onNetworkData(data, artistId);

          // Save to search history using resolved name if available
          const historyName = mainArtist?.name || trimmed;
          saveToSearchHistory(historyName, artistId || null);

          toast({
            title: "Network Generated",
            description: `Found collaboration network for ${historyName}`,
          });

        } catch (error) {
          console.error(`❌ [Search Interface] Error searching for ${artistIdentifier}:`, error);
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
  }, [onSearchFunction, onNetworkData, onLoadingChange, toast, saveToSearchHistory]);

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
          <div className="mb-6 sm:mb-8 flex justify-center">
            <img 
              src={grapevineLogoLarge} 
              alt="Grapevine Logo" 
              className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 object-contain"
            />
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 text-white">
            Grapevine
          </h1>

          {/* Tip Section */}
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-300">
              <span className="font-medium">Tip:</span> Try searching for Taylor Swift, Drake, or Ariana Grande.
            </p>
          </div>
          
          <div className="relative mb-4 sm:mb-6 search-dropdown-container">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search any artist to explore their network..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                setIsSearchFocused(true);
                // Always reload search history on focus to ensure it's current
                loadSearchHistory();
                if (searchQuery.trim().length >= 1 && artistOptions.length === 0) {
                  debouncedFetchOptions(searchQuery.trim());
                } else if (artistOptions.length > 0) {
                  setShowDropdown(true);
                } else if (searchQuery.trim().length === 0) {
                  // Show dropdown if we have history or to show it will load
                  setShowDropdown(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsSearchFocused(false);
                  setShowDropdown(false);
                }, 150);
              }}
              className="w-full pl-2 pr-10 py-3 sm:pl-3 sm:pr-12 sm:py-4 bg-gray-800 text-white placeholder-gray-400 text-base sm:text-lg rounded-xl flex items-center"
              style={{ 
                border: '2px solid #b427b4',
                boxShadow: '0 0 10px rgba(180, 39, 180, 0.3)',
                display: 'flex',
                alignItems: 'center'
              }}
              disabled={isLoading}
            />
            <Button
              onClick={() => {
                setShowDropdown(false);
                setArtistOptions([]);
                handleSearch();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 p-0 rounded-lg"
              style={{
                backgroundColor: '#ffa2e3',
                color: '#1f2937'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff8adb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffa2e3';
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
            </Button>

            {/* Artist Options Dropdown - Home View */}
            {(showDropdown || isLoadingOptions) && !showNetworkView && (
              <div 
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll dropdown-height-constraint"
                style={{ 
                  maxHeight: '95px !important', // Height to align with red line position - forced
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
                  
                  {/* Search History - Show when no query and no artist options */}
                  {!isLoadingOptions && artistOptions.length === 0 && searchQuery.trim().length === 0 && searchHistory.length > 0 && (
                    <>
                      <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-2">
                        Recent searches ({searchHistory.length})
                      </div>
                      {searchHistory.map((entry, index) => (
                        <Card
                          key={`${entry.artistName}-${entry.timestamp}`}
                          className="mb-2 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                          style={{
                            borderLeftColor: '#FF69B4'
                          }}
                          onClick={() => handleHistoryItemClick(entry)}
                        >
                          <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm text-white flex items-center">
                                <Clock className="w-3 h-3 mr-2 text-gray-400" />
                                {entry.artistName}
                              </CardTitle>
                              <span className="text-xs text-gray-400">
                                {formatTimeAgo(entry.timestamp)}
                              </span>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </>
                  )}
                  
                  {/* Empty search history state */}
                  {!isLoadingOptions && artistOptions.length === 0 && searchQuery.trim().length === 0 && searchHistory.length === 0 && (
                    <div className="py-4 text-center text-xs text-gray-400">
                      <Clock className="w-4 h-4 mx-auto mb-2 text-gray-500" />
                      No recent searches yet
                      <br />
                      <span className="text-gray-500">Your search history will appear here</span>
                    </div>
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
                  src={grapevineLogoSmall} 
                  alt="Grapevine Logo - Click to Clear" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
                />
              </button>
              <h2 className="text-sm sm:text-xl font-semibold text-white truncate">
                <span className="hidden sm:inline">Grapevine</span>
                <span className="sm:hidden">Grapevine</span>
              </h2>
            </div>
            
            <div className="flex-1 relative search-dropdown-container">
              <Input
                ref={networkSearchInputRef}
                type="text"
                placeholder="Search any artist to explore their network..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  setIsSearchFocused(true);
                  // Always reload search history on focus to ensure it's current
                  loadSearchHistory();
                  if (searchQuery.trim().length >= 1 && artistOptions.length === 0) {
                    debouncedFetchOptions(searchQuery.trim());
                  } else if (artistOptions.length > 0) {
                    setShowDropdown(true);
                  } else if (searchQuery.trim().length === 0) {
                    // Show dropdown if we have history or to show it will load
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsSearchFocused(false);
                    setShowDropdown(false);
                  }, 150);
                }}
                className="w-full pl-2 pr-10 py-2 sm:pl-3 sm:pr-12 sm:py-2 bg-gray-800 text-white placeholder-gray-400 text-sm sm:text-base rounded-xl flex items-center"
                style={{ 
                  border: '2px solid #b427b4',
                  boxShadow: '0 0 10px rgba(180, 39, 180, 0.3)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                disabled={isLoading}
              />
              <Button
                onClick={() => {
                  setShowDropdown(false);
                  setArtistOptions([]);
                  handleSearch();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-lg"
                style={{
                  backgroundColor: '#ffa2e3',
                  color: '#1f2937'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff8adb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffa2e3';
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>

              {/* Artist Options Dropdown - Network View */}
              {(showDropdown || isLoadingOptions) && showNetworkView && isSearchFocused && (
                <div 
                  className="absolute top-full left-0 right-14 sm:right-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-y-auto artist-dropdown-scroll dropdown-height-constraint"
                  style={{ 
                    maxHeight: '85px', // Height to align with similar position in network view
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
                    
                                         {/* Search History - Network View */}
                     {!isLoadingOptions && artistOptions.length === 0 && searchQuery.trim().length === 0 && searchHistory.length > 0 && (
                       <>
                         <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-1">
                           Recent searches ({searchHistory.length})
                         </div>
                        {searchHistory.map((entry, index) => (
                                                     <Card
                             key={`${entry.artistName}-${entry.timestamp}`}
                             className="mb-1 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-l-4"
                             style={{
                               borderLeftColor: '#FF69B4'
                             }}
                             onClick={() => handleHistoryItemClick(entry)}
                           >
                            <CardHeader className="pb-1 pt-2 px-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-xs text-white flex items-center">
                                  <Clock className="w-3 h-3 mr-2 text-gray-400" />
                                  {entry.artistName}
                                </CardTitle>
                                <span className="text-xs text-gray-400">
                                  {formatTimeAgo(entry.timestamp)}
                                </span>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </>
                                         )}
                     
                     {/* Empty search history state - Network View */}
                     {!isLoadingOptions && artistOptions.length === 0 && searchQuery.trim().length === 0 && searchHistory.length === 0 && (
                       <div className="py-2 text-center text-xs text-gray-400">
                         <Clock className="w-3 h-3 mx-auto mb-1 text-gray-500" />
                         No recent searches yet
                         <br />
                         <span className="text-gray-500">History will appear here</span>
                       </div>
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

      
      {/* Music Nerd Button - Fixed at bottom of screen */}
      {!showNetworkView && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Button
            onClick={() => window.open('https://www.musicnerd.xyz', '_blank', 'noopener,noreferrer')}
            className="font-medium py-0.5 px-2 rounded transition-colors text-white"
            style={{
              backgroundColor: '#b427b4',
              fontSize: '10px',
              height: '24px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#8f1c8f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#b427b4';
            }}
          >
            Visit Music Nerd
          </Button>
        </div>
      )}

      {/* No Collaborators Popup */}
      <NoCollaboratorsPopup
        isOpen={showNoCollaboratorsPopup}
        artistName={pendingArtistInfo?.name || ""}
        onClose={handleClosePopup}
        onShowHallucinations={handleShowHallucinations}
      />

    </>
  );
}

export default SearchInterface;