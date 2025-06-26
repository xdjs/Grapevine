import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchNetworkData } from "@/lib/network-data";
import { NetworkData } from "@/types/network";
import { Search } from "lucide-react";

interface SearchInterfaceProps {
  onNetworkData: (data: NetworkData) => void;
  showNetworkView: boolean;
}

export default function SearchInterface({ onNetworkData, showNetworkView }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/network", currentSearch],
    queryFn: () => fetchNetworkData(currentSearch),
    enabled: !!currentSearch,
  });

  // Update network data when query succeeds
  useEffect(() => {
    if (data && data !== undefined) {
      onNetworkData(data);
    }
  }, [data]);

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (!query) {
      toast({
        title: "Please enter an artist name",
        variant: "destructive",
      });
      return;
    }
    setCurrentSearch(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Show error toast when query fails
  if (error) {
    toast({
      title: "Artist not found",
      description: "Try searching for Taylor Swift, Drake, or Billie Eilish",
      variant: "destructive",
    });
  }

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
          <h1 className="text-4xl font-bold mb-2 text-white">
            Music Collaboration Network
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            Discover how artists connect through producers and songwriters
          </p>

          <div className="relative w-96">
            <Input
              type="text"
              placeholder="Enter an artist name (e.g., Taylor Swift, Drake, Billie Eilish)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-6 py-4 bg-gray-900 border-gray-700 text-white placeholder-gray-500 text-lg h-14 pr-16"
              disabled={isLoading}
            />
            <Button
              onClick={handleSearch}
              className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Top Search Bar - Network View */}
      <div
        className={`absolute top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 z-30 ${
          showNetworkView ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="relative">
          <Input
            type="text"
            placeholder="Search artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-80 px-4 py-3 bg-gray-900/90 backdrop-blur border-gray-700 text-white placeholder-gray-500 pr-14"
            disabled={isLoading}
          />
          <Button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-sm rounded-md"
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
