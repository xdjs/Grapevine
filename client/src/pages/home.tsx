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

      {/* Connected Circles - Only visible when not showing network */}
      {!showNetworkView && (
        <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ pointerEvents: 'auto' }}>
          <div className="relative w-[600px] h-[300px]">
            {/* SVG for connecting lines */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
              {/* Line from Search to Discover */}
              <line 
                x1="100" y1="120" 
                x2="300" y2="80" 
                stroke="#666" 
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              {/* Line from Discover to Explore */}
              <line 
                x1="300" y1="80" 
                x2="500" y2="120" 
                stroke="#666" 
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            </svg>
            
            {/* Search Circle */}
            <div className="absolute" style={{ left: '20px', top: '50px', zIndex: 2 }}>
              <div className="w-32 h-32 rounded-full bg-pink-500/20 border-2 border-pink-500 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-pink-400 font-medium text-sm mb-2">Search</div>
                <div className="text-xs text-white leading-tight">Enter any artist name to start exploring their collaboration network</div>
              </div>
            </div>
            
            {/* Discover Circle */}
            <div className="absolute" style={{ left: '220px', top: '10px', zIndex: 2 }}>
              <div className="w-32 h-32 rounded-full bg-purple-500/20 border-2 border-purple-500 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-purple-400 font-medium text-sm mb-2">Discover</div>
                <div className="text-xs text-white leading-tight">See producers, songwriters, and other artists they've worked with</div>
              </div>
            </div>
            
            {/* Explore Circle */}
            <div className="absolute" style={{ left: '420px', top: '50px', zIndex: 2 }}>
              <div className="w-32 h-32 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-cyan-400 font-medium text-sm mb-2">Explore</div>
                <div className="text-xs text-white leading-tight">Click any node to search for that artist's connections</div>
              </div>
            </div>
            
            {/* Attribution text below circles */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
              <div className="text-gray-500 text-xs space-y-1">
                <p>Data sourced from MusicBrainz, OpenAI, and Spotify APIs</p>
                <p>Powered by Music Nerd</p>
                <p>Click on artist nodes to visit their Music Nerd profiles</p>
              </div>
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
