import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer, { NetworkVisualizerRef } from "@/components/network-visualizer";

import FilterControls from "@/components/filter-controls";
import MobileDraggableZoomControls from "@/components/mobile-draggable-zoom-controls";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

import { NetworkData, NetworkNode, FilterState } from "@/types/network";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ArtistNetwork() {
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState<string>("");
  const [currentArtistId, setCurrentArtistId] = useState<string | null>(null);
  const networkVisualizerRef = useRef<NetworkVisualizerRef>(null);

  // Function to access resetToFirstDegree from NetworkVisualizer
  const handleResetToFirstDegree = useCallback(() => {
    networkVisualizerRef.current?.resetToFirstDegree();
  }, []);
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });
  const triggerSearchRef = useRef<((artistName: string) => void) | null>(null);
  const saveToHistoryRef = useRef<((artistName: string, artistId: string | null) => void) | null>(null);
  const isMobile = useIsMobile();

  const handleNetworkData = useCallback((data: NetworkData, artistId?: string) => {
    setNetworkData(data);
    // Extract the artist ID from the network data
    const finalArtistId = artistId || data.nodes.find(node => node.size === 30)?.artistId || null;
    setCurrentArtistId(finalArtistId);
  }, []);

  // Navigate back to home
  const handleGoHome = () => {
    setLocation("/");
  };

  // Navigate back to search with different artist
  const handleGoToSearch = () => {
    setLocation("/");
    setTimeout(() => setClearSearchField(false), 100);
  };

  const handleLoadingChange = useCallback((loading: boolean, artistName?: string) => {
    setIsLoading(loading);
    if (loading && artistName) {
      setCurrentArtistName(artistName);
    } else if (!loading) {
      setCurrentArtistName("");
    }
  }, []);

  const handleZoomChange = (transform: { k: number; x: number; y: number }) => {
    setZoomTransform(transform);
  };

  const handleArtistSearch = (artistName: string) => {
    if (triggerSearchRef.current) {
      triggerSearchRef.current(artistName);
    }
  };

  const handleHistorySave = (saveHistoryFn: (artistName: string, artistId: string | null) => void) => {
    saveToHistoryRef.current = saveHistoryFn;
  };

  // Handle node click to load new artist network
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
        const mainArtist = data.nodes.find((node: NetworkNode) => node.size === 30 && node.type === 'artist');
        const finalArtistId = mainArtist?.artistId || mainArtist?.id || artistId;

        handleNetworkData(data, finalArtistId);
        // Save to search history
        if (saveToHistoryRef.current) {
          saveToHistoryRef.current(artistName, finalArtistId || null);
        }

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
    setNetworkData(null);
    setIsLoading(false);
    setCurrentArtistName("");
    setCurrentArtistId(null);
    setClearSearchField(true);
    // Clear the URL to remove artist ID
    setLocation('/');
    setTimeout(() => setClearSearchField(false), 100);
  };

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
        onHistorySave={handleHistorySave}
      />

      {/* Network Visualization - Only show when network data exists */}
      {networkData && (
        <div className="mobile-network-container network-visible">
          <NetworkVisualizer
            key={`network-${Date.now()}`}
            data={networkData}
            visible={true}
            filterState={filterState}
            onZoomChange={handleZoomChange}
            onArtistSearch={handleArtistSearch}
            onArtistNodeClick={handleArtistNodeClick}
            onClearAll={handleClearNetwork}
            ref={networkVisualizerRef}
          />
        </div>
      )}

      {/* Loading Screen */}
      <LoadingScreen isVisible={isLoading} artistName={currentArtistName} />

      {/* Controls - Always show on artist network page */}
      <>
        {/* Desktop Controls */}
        {!isMobile && (
          <>
            <FilterControls
              filterState={filterState}
              onFilterChange={setFilterState}
            />
          </>
        )}
        
        {/* Mobile Draggable Zoom Controls */}
        <MobileDraggableZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onBackToFirstDegree={handleResetToFirstDegree}
          onClearAll={handleClearNetwork}
          showClearButton={true}
          showBackToFirstDegree={true}
        />
      </>
    </div>
  );
}