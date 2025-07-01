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

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData) => void;
  showNetworkView: boolean;
  clearSearch?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

interface ArtistOption {
  id: string;
  name: string;
  bio?: string;
}

export default function SearchInterface({ onNetworkData, showNetworkView, clearSearch, onLoadingChange }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();

  // Clear search field when clearSearch prop changes to true
  useEffect(() => {
    if (clearSearch) {
      setSearchQuery("");
      setCurrentSearch("");
      setArtistOptions([]);
      setShowDropdown(false);
    }
  }, [clearSearch]);

  // Fetch artist options when user types
  useEffect(() => {
    const fetchArtistOptions = async () => {
      if (searchQuery.trim().length > 2) {
        try {
          const response = await fetch(`/api/artist-options/${encodeURIComponent(searchQuery.trim())}`);
          const data = await response.json();
          setArtistOptions(data.options || []);
          setShowDropdown((data.options || []).length > 0);
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
      const shouldShowLoading = isFetching && !data?.cached;
      onLoadingChange(shouldShowLoading);
    }
  }, [isFetching, data?.cached, onLoadingChange]);

  // Show error toast when query fails
  useEffect(() => {
    if (error) {
      toast({
        title: "Artist not found",
        description: "Try any artist name - we'll create a network with their collaborators",
        variant: "destructive",
      });
    }
  }, [error, toast]);

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

  const handleArtistSelect = (artist: ArtistOption) => {
    setSearchQuery(artist.name);
    handleSearch(artist.name);
  };;

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
            <img 
              src={musicNerdLogo} 
              alt="MusicNerd Logo" 
              className="w-24 h-24 object-contain"
            />
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

      {/* Top Search Bar - Network View */}
      <div
        className={`absolute top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 z-30 ${
          showNetworkView ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="relative w-full max-w-4xl">
          <Input
            type="text"
            placeholder="Enter artist name (e.g., Taylor Swift, Drake, Billie Eilish, etc....)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full pl-4 pr-12 py-3 bg-gray-900/90 backdrop-blur border-gray-700 text-white placeholder-gray-500"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSearch()}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-sm"
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
          
          {/* Artist Options Dropdown for Top Search */}
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
    </>
  );
}
