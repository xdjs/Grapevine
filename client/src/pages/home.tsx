import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import HelpButton from "@/components/help-button";

import { NetworkData, FilterState } from "@/types/network";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile.tsx";

export default function Home() {
  const params = useParams<{ artistId?: string }>();
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [showNetworkView, setShowNetworkView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });
  const triggerSearchRef = useRef<((artistName: string) => void) | null>(null);
  const isMobile = useIsMobile();

  // Manage body overflow classes based on network view state
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    
    // Remove all existing classes first
    body.classList.remove('network-visible', 'network-hidden');
    
    if (showNetworkView) {
      body.classList.add('network-visible');
      // Allow scrolling when network is visible and may need it
      body.style.overflow = 'hidden';
    } else {
      body.classList.add('network-hidden');
      // No scrolling on home page
      body.style.overflow = 'hidden';
    }
    
    // Cleanup on unmount
    return () => {
      body.classList.remove('network-visible', 'network-hidden');
      body.style.overflow = 'hidden';
    };
  }, [showNetworkView]);

  // Load artist network if artistId is in URL
  useEffect(() => {
    const loadArtistFromUrl = async () => {
      if (params.artistId && !networkData && !isLoading) {
        try {
          setIsLoading(true);
          console.log(`🔗 Loading artist network from URL: ${params.artistId}`);
          
          // Try to fetch network data by ID
          const response = await fetch(`/api/network-by-id/${params.artistId}`);
          if (response.ok) {
            const data = await response.json();
            setNetworkData(data);
            setShowNetworkView(true);
          } else {
            console.error(`Failed to load artist ${params.artistId}:`, response.status);
            // Redirect to home if artist not found
            setLocation('/');
          }
        } catch (error) {
          console.error(`Error loading artist ${params.artistId}:`, error);
          setLocation('/');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadArtistFromUrl();
  }, [params.artistId, networkData, isLoading, setLocation]);

  const handleNetworkData = useCallback((data: NetworkData, artistId?: string) => {
    // Replace existing network with new data
    setNetworkData(data);
    setShowNetworkView(true);
    setIsLoading(false);
    
    // Update URL to reflect the artist being displayed
    if (artistId) {
      setLocation(`/${artistId}`);
    }
  }, [setLocation]);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      setShowNetworkView(true); // Show network view when loading starts
    }
  }, []);

  const handleReset = () => {
    setNetworkData(null);
    setShowNetworkView(false);
    setIsLoading(false);
    setClearSearchField(true);
    
    // Reset URL to home
    setLocation('/');
    
    // Reset the clear flag after a brief delay
    setTimeout(() => setClearSearchField(false), 100);
  };

  const handleClearNetwork = () => {
    setNetworkData(null);
    setIsLoading(false);
    setClearSearchField(true);
    // Keep showNetworkView as true to stay on the network page
    // Reset the clear flag after a brief delay
    setTimeout(() => setClearSearchField(false), 100);
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

  return (
    <div className={`relative w-full min-h-screen bg-black text-white ${!showNetworkView ? 'overflow-x-hidden' : ''}`} style={{ pointerEvents: 'auto' }}>
      {/* Search Interface */}
      <SearchInterface
        onNetworkData={handleNetworkData}
        showNetworkView={showNetworkView}
        clearSearch={clearSearchField}
        onLoadingChange={handleLoadingChange}
        onSearchFunction={(searchFn) => {
          triggerSearchRef.current = searchFn;
        }}
        onClearAll={handleReset}
      />

      {/* Attribution Content - Only visible when not showing network */}
      {!showNetworkView && (
        <div className="absolute bottom-16 left-0 right-0 px-4 text-center z-10" style={{ pointerEvents: 'auto' }}>
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            <div className="text-gray-500 text-xs mb-2">
              <p className="mb-1 sm:mb-2">Data sourced from MusicBrainz, OpenAI, and Spotify APIs</p>
              <p className="mb-1 sm:mb-2">Powered by Music Nerd</p>
              <p>Click on artist nodes to visit their Music Nerd profiles</p>
            </div>
          </div>
        </div>
      )}

      {/* Spacer to ensure scrollable content */}
      <div className="h-96"></div>

      {/* Network Visualization */}
      {networkData && (
        <NetworkVisualizer
          key={`network-${networkData.nodes[0]?.id || 'empty'}-${Date.now()}`}
          data={networkData}
          visible={showNetworkView}
          filterState={filterState}
          onZoomChange={handleZoomChange}
          onArtistSearch={handleArtistSearch}
        />
      )}

      {/* Loading Spinner */}
      {isLoading && showNetworkView && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30 p-4">
          <div className="bg-black/80 rounded-lg p-4 sm:p-8 flex flex-col items-center space-y-3 sm:space-y-4 max-w-sm sm:max-w-md">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-pink-500" />
            <p className="text-base sm:text-lg font-medium text-white text-center">Creating collaboration network...</p>
            <p className="text-xs sm:text-sm text-gray-400 text-center">
              Analyzing authentic collaboration data from MusicBrainz, OpenAI, and Spotify
            </p>
          </div>
        </div>
      )}

      {/* Controls - Only show when network is visible */}
      {showNetworkView && (
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
            </>
          )}
          
          {/* Mobile Controls */}
          <MobileControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onClearAll={handleClearNetwork}
          />
        </>
      )}

      {/* Help Button - Always visible */}
      <HelpButton />
    </div>
  );
}
