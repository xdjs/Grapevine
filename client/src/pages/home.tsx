import { useState, useCallback, useRef, useEffect } from "react";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";

import { NetworkData, FilterState } from "@/types/network";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Home() {
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

  const handleNetworkData = useCallback((data: NetworkData) => {
    // Replace existing network with new data
    setNetworkData(data);
    setShowNetworkView(true);
    setIsLoading(false);
  }, []);

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

      {/* How it works Content - Only visible when not showing network */}
      {!showNetworkView && (
        <div className="absolute bottom-16 left-0 right-0 px-4 text-center z-10" style={{ pointerEvents: 'auto' }}>
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            <div className="text-gray-400 text-sm">
              {/* Node-style How it Works */}
              <div className="relative flex items-center justify-center max-w-4xl mx-auto">
                <svg className="w-full h-40 sm:h-48" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
                  {/* Connecting lines */}
                  <line x1="140" y1="100" x2="260" y2="100" stroke="#374151" strokeWidth="2" />
                  <line x1="340" y1="100" x2="460" y2="100" stroke="#374151" strokeWidth="2" />
                  
                  {/* Search Circle */}
                  <circle cx="140" cy="100" r="70" fill="#ec4899" />
                  <text x="140" y="88" textAnchor="middle" className="fill-white text-sm font-medium">1. Search</text>
                  <text x="140" y="105" textAnchor="middle" className="fill-white text-xs">Enter any artist name</text>
                  <text x="140" y="120" textAnchor="middle" className="fill-white text-xs">to start exploring their</text>
                  <text x="140" y="135" textAnchor="middle" className="fill-white text-xs">collaboration network</text>
                  
                  {/* Discover Circle */}
                  <circle cx="400" cy="100" r="70" fill="#8a2be2" />
                  <text x="400" y="88" textAnchor="middle" className="fill-white text-sm font-medium">2. Discover</text>
                  <text x="400" y="105" textAnchor="middle" className="fill-white text-xs">See producers,</text>
                  <text x="400" y="120" textAnchor="middle" className="fill-white text-xs">songwriters, and other</text>
                  <text x="400" y="135" textAnchor="middle" className="fill-white text-xs">artists they've worked with</text>
                  
                  {/* Explore Circle */}
                  <circle cx="660" cy="100" r="70" fill="#00ced1" />
                  <text x="660" y="88" textAnchor="middle" className="fill-white text-sm font-medium">3. Explore</text>
                  <text x="660" y="105" textAnchor="middle" className="fill-white text-xs">Click any node to</text>
                  <text x="660" y="120" textAnchor="middle" className="fill-white text-xs">search for that artist's</text>
                  <text x="660" y="135" textAnchor="middle" className="fill-white text-xs">connections</text>
                </svg>
              </div>
            </div>
            
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
