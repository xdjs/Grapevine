import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import HelpButton from "@/components/help-button";
import ShareButton from "@/components/share-button";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

import { NetworkData, FilterState } from "@/types/network";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ArtistNetwork() {
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState<string>("");
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });
  const triggerSearchRef = useRef<((artistName: string) => void) | null>(null);
  const isMobile = useIsMobile();

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

  const handleArtistNodeClick = useCallback(async (artistName: string, artistId?: string) => {
    console.log(`🔗 [Artist Network] Artist node clicked: ${artistName} (ID: ${artistId})`);
    
    // Immediately show loading state
    setIsLoading(true);
    setCurrentArtistName(artistName);
    
    try {
      // Use artist ID if available, otherwise fall back to name
      const data = artistId 
        ? await fetchNetworkDataById(artistId)
        : await fetchNetworkData(artistName.trim());
      
      // Handle the response (might be network data or no-collaborators response)
      if (data && 'nodes' in data) {
        // Normal network data - pass to parent
        const mainArtist = data.nodes.find(node => node.size === 30 && node.type === 'artist');
        const finalArtistId = mainArtist?.artistId || mainArtist?.id || artistId;
        handleNetworkData(data, finalArtistId);
      } else {
        // Handle no collaborators response
        console.warn(`No network data found for ${artistName}`);
        // You might want to show a message or handle this case differently
      }
    } catch (error) {
      console.error(`Error loading network for ${artistName}:`, error);
      // Handle error - maybe show a toast or reset state
      setIsLoading(false);
      setCurrentArtistName("");
    }
  }, [handleNetworkData]);

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
    setNetworkData(data);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean, artistName?: string) => {
    setIsLoading(loading);
    if (loading && artistName) {
      setCurrentArtistName(artistName);
    } else if (!loading) {
      setCurrentArtistName("");
    }
  }, []);

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
          key={`network-${Date.now()}`}
          data={networkData}
          visible={true}
          filterState={filterState}
          onZoomChange={handleZoomChange}
          onArtistSearch={handleArtistSearch}
          onArtistNodeClick={handleArtistNodeClick}
        />
      )}

      {/* Loading Screen */}
      <LoadingScreen isVisible={isLoading} artistName={currentArtistName} />

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

      {/* Share Button - Always visible */}
      <ShareButton />
      
      {/* Help Button - Always visible */}
      <HelpButton />
    </div>
  );
}