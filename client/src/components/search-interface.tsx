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
  artistId?: string;
  name: string;
  bio?: string;
}

function SearchInterface({ onNetworkData, showNetworkView, clearSearch, onLoadingChange, onSearchFunction, onClearAll }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      handleSearch();
    }
  };

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
          
          <div className="relative mb-4 sm:mb-6">
            <Input
              type="text"
              placeholder="Enter artist name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-12 sm:pr-16 text-base sm:text-lg rounded-xl"
              disabled={isLoading}
            />
            <Button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 p-0 bg-blue-600 hover:bg-blue-700 rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 sm:px-4 sm:py-2 bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-10 sm:pr-12 text-sm sm:text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700 rounded-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SearchInterface;