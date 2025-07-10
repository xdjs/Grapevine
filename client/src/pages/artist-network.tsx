import { useState, useCallback, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

import { NetworkData, FilterState } from "@/types/network";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchNetworkDataById } from "@/lib/network-data";

export default function ArtistNetwork() {
  const [match, params] = useRoute("/artist/:artistId");
  const artistId = params?.artistId;
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });
  const triggerSearchRef = useRef<((artistName: string) => void) | null>(null);
  const isMobile = useIsMobile();

  // Fetch network data for the artist ID
  const { data: networkData, isLoading, error } = useQuery({
    queryKey: [`/api/network/${artistId}`],
    queryFn: () => fetchNetworkDataById(artistId!),
    enabled: !!artistId,
  });

  // Navigate back to home
  const handleGoHome = () => {
    window.location.href = "/";
  };

  const handleZoomChange = (transform: { k: number; x: number; y: number }) => {
    setZoomTransform(transform);
  };

  const handleArtistSearch = (artistName: string) => {
    if (triggerSearchRef.current) {
      triggerSearchRef.current(artistName);
    }
  };

  const handleZoomIn = () => {
    const event = new CustomEvent('network-zoom', { detail: { action: 'in' } });
    window.dispatchEvent(event);
  };

  const handleZoomOut = () => {
    const event = new CustomEvent('network-zoom', { detail: { action: 'out' } });
    window.dispatchEvent(event);
  };

  const handleZoomReset = () => {
    const event = new CustomEvent('network-zoom', { detail: { action: 'reset' } });
    window.dispatchEvent(event);
  };

  const handleClearNetwork = () => {
    setClearSearchField(true);
    setTimeout(() => setClearSearchField(false), 100);
  };

  const handleNetworkData = useCallback((data: NetworkData) => {
    // When search interface generates new data, we could navigate to that artist's page
    // For now, we'll just update the current view
    console.log("New network data received:", data);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    console.log("Loading state changed:", loading);
  }, []);

  if (!artistId) {
    return <div>Artist ID not found</div>;
  }

  return (
    <div className="relative w-full min-h-screen bg-black text-white">
      {/* Header with navigation */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          onClick={handleGoHome}
          variant="ghost"
          className="text-white hover:bg-white/10 p-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Button>
      </div>

      {/* Search Interface */}
      <SearchInterface
        onNetworkData={handleNetworkData}
        showNetworkView={true}
        clearSearch={clearSearchField}
        onLoadingChange={handleLoadingChange}
        onSearchFunction={(searchFn) => {
          triggerSearchRef.current = searchFn;
        }}
        onClearAll={handleClearNetwork}
      />

      {/* Network Visualization */}
      {networkData && (
        <NetworkVisualizer
          key={`network-${artistId}-${Date.now()}`}
          data={networkData}
          visible={true}
          filterState={filterState}
          onZoomChange={handleZoomChange}
          onArtistSearch={handleArtistSearch}
        />
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30 p-4">
          <div className="bg-black/80 rounded-lg p-4 sm:p-8 flex flex-col items-center space-y-3 sm:space-y-4 max-w-sm sm:max-w-md">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-pink-500" />
            <p className="text-base sm:text-lg font-medium text-white text-center">Loading collaboration network...</p>
            <p className="text-xs sm:text-sm text-gray-400 text-center">
              Retrieving authentic collaboration data for artist ID: {artistId}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30 p-4">
          <div className="bg-black/80 rounded-lg p-4 sm:p-8 flex flex-col items-center space-y-3 sm:space-y-4 max-w-sm sm:max-w-md">
            <p className="text-base sm:text-lg font-medium text-red-400 text-center">Error loading network</p>
            <p className="text-xs sm:text-sm text-gray-400 text-center">
              {error instanceof Error ? error.message : "Failed to load collaboration network"}
            </p>
            <Button onClick={handleGoHome} variant="outline" className="mt-4">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      )}

      {/* Controls - Only show when network is loaded */}
      {networkData && (
        <>
          {/* Desktop Controls */}
          {!isMobile && (
            <>
              <ZoomControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                onClearAll={handleClearNetwork}
              />
              <FilterControls
                filterState={filterState}
                onFilterChange={setFilterState}
              />
            </>
          )}
          
          {/* Mobile Controls */}
          <MobileControls
            filterState={filterState}
            onFilterChange={setFilterState}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onClearAll={handleClearNetwork}
          />
        </>
      )}
    </div>
  );
}