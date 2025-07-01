import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchNetworkData } from "@/lib/network-data";
import { NetworkData } from "@/types/network";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import musicNerdLogo from "@assets/musicNerdLogo_1751389187695.png";
import musicNerdLogoSmall from "@assets/musicNerdLogo_1751389498769.png";

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData) => void;
  showNetworkView: boolean;
  clearSearch?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onSearchFunction?: (searchFn: (artistName: string) => void) => void;
}

interface ArtistOption {
  id: string;
  name: string;
  bio?: string;
}

export default function SearchInterface({ onNetworkData, showNetworkView, clearSearch, onLoadingChange, onSearchFunction }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();

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

  // Fetch artist options when user types
  useEffect(() => {
    const fetchArtistOptions = async () => {
      if (searchQuery.trim().length > 2) {
        try {
          const apiUrl = `/api/artist-options/${encodeURIComponent(searchQuery.trim())}`;
          console.log('Fetching artist options for:', searchQuery.trim());
          console.log('API URL:', apiUrl);
          console.log('Current origin:', window.location.origin);
          
          const response = await fetch(apiUrl);
          console.log('Response status:', response.status);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const data = await response.json();
          console.log('Received artist options:', data.options);
          setArtistOptions(data.options || []);
          setShowDropdown((data.options || []).length > 0);
          console.log('Dropdown should show:', (data.options || []).length > 0);
        } catch (error) {
          console.error('Error fetching artist options:', error);
          setArtistOptions([]);
          setShowDropdown(false);
        }
      } else {
        setArtistOptions([]);
        setShowDropdown(false);
      }
    };

    const debounceTimer = setTimeout(fetchArtistOptions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

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
    handleSearch(artist.name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <>
      {/* Centered Search - Initial View */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-20 transition-all duration-700 ${
          showNetworkView
            ? "opacity-0 pointer-events-none -translate-y-12"
            : "opacity-100"
        }`}
      >
        <div className="text-center">
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
                className="w-32 h-32 object-contain"
              />
            </a>
          </div>
          <h1 className="text-4xl font-bold mb-2 text-white">
            Music Collaboration Network
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            Discover how artists connect through producers and songwriters
          </p>

          <div className="relative w-full max-w-4xl">
            <Input
              type="text"
              placeholder="Enter an artist name (e.g., Taylor Swift, Drake, Billie Eilish, etc....)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-6 py-4 bg-gray-900 border-gray-700 text-white placeholder-gray-500 text-lg h-14 pr-16"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSearch()}
              className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
            
            {/* Artist Options Dropdown */}
            {showDropdown && artistOptions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">
                <ScrollArea className="max-h-80">
                  <div className="p-2">
                    {artistOptions.map((artist) => (
                      <Card
                        key={artist.id}
                        className="mb-2 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-gray-600"
                        onClick={() => handleArtistSelect(artist)}
                      >
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm text-white">{artist.name}</CardTitle>
                          {artist.bio && (
                            <CardDescription className="text-xs text-gray-400 line-clamp-2">
                              {artist.bio}
                            </CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
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
        <div className="bg-black/90 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <a 
                href="https://musicnerd.xyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img 
                  src={musicNerdLogoSmall} 
                  alt="MusicNerd Logo" 
                  className="w-8 h-8 object-contain"
                />
              </a>
              <h2 className="text-xl font-semibold text-white">Music Collaboration Network</h2>
            </div>
            
            <div className="flex-1 max-w-2xl relative">
              <Input
                type="text"
                placeholder="Search for a new artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-2 bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-12"
                disabled={isLoading}
              />
              <Button
                onClick={() => handleSearch()}
                className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>
              
              {/* Artist Options Dropdown */}
              {showDropdown && artistOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
                  <ScrollArea className="max-h-60">
                    <div className="p-1">
                      {artistOptions.map((artist) => (
                        <Card
                          key={artist.id}
                          className="mb-1 cursor-pointer hover:bg-gray-700 transition-colors bg-gray-900 border-gray-600"
                          onClick={() => handleArtistSelect(artist)}
                        >
                          <CardHeader className="pb-1 pt-2 px-3">
                            <CardTitle className="text-xs text-white">{artist.name}</CardTitle>
                            {artist.bio && (
                              <CardDescription className="text-xs text-gray-400 line-clamp-1">
                                {artist.bio}
                              </CardDescription>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}