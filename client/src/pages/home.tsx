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

      {/* Info Circles - Only visible when not showing network */}
      {!showNetworkView && (
        <div className="absolute left-1/2 transform -translate-x-1/2 z-10 px-4 w-full max-w-4xl" style={{ 
          pointerEvents: 'auto',
          top: 'calc(50vh + 20px)',
          bottom: '220px',
          transform: 'translateX(-50%)'
        }}>
          {/* Desktop: Horizontal layout */}
          <div className="hidden sm:flex sm:flex-row justify-center items-center gap-3 h-full">
            {/* Search Circle */}
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-pink-500/20 border-2 border-pink-500 flex flex-col text-center" style={{
                width: 'min(20vh, 150px)',
                height: 'min(20vh, 150px)',
                padding: 'min(1.5vh, 12px)'
              }}>
                <div className="text-pink-400 font-medium" style={{
                  fontSize: 'min(2.5vh, 16px)',
                  paddingTop: 'min(3vh, 24px)',
                  height: 'min(4vh, 32px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>Search</div>
                <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                  fontSize: 'min(1.8vh, 12px)',
                  paddingTop: 'min(1vh, 8px)'
                }}>Enter any artist name to start exploring their collaboration network</div>
              </div>
            </div>
            
            {/* Discover Circle */}
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-purple-500/20 border-2 border-purple-500 flex flex-col text-center" style={{
                width: 'min(20vh, 150px)',
                height: 'min(20vh, 150px)',
                padding: 'min(1.5vh, 12px)'
              }}>
                <div className="text-purple-400 font-medium" style={{
                  fontSize: 'min(2.5vh, 16px)',
                  paddingTop: 'min(3vh, 24px)',
                  height: 'min(4vh, 32px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>Discover</div>
                <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                  fontSize: 'min(1.8vh, 12px)',
                  paddingTop: 'min(1vh, 8px)'
                }}>See producers, songwriters, and other artists they've worked with</div>
              </div>
            </div>
            
            {/* Explore Circle */}
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex flex-col text-center" style={{
                width: 'min(20vh, 150px)',
                height: 'min(20vh, 150px)',
                padding: 'min(1.5vh, 12px)'
              }}>
                <div className="text-cyan-400 font-medium" style={{
                  fontSize: 'min(2.5vh, 16px)',
                  paddingTop: 'min(3vh, 24px)',
                  height: 'min(4vh, 32px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>Explore</div>
                <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                  fontSize: 'min(1.8vh, 12px)',
                  paddingTop: 'min(1vh, 8px)'
                }}>Click any node to search for that artist's connections</div>
              </div>
            </div>
          </div>

          {/* Mobile: Triangle formation */}
          <div className="flex sm:hidden flex-col items-center gap-1 h-full justify-center">
            {/* Top Row - Two circles side by side */}
            <div className="flex justify-center items-center gap-1">
              {/* Search Circle */}
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-pink-500/20 border-2 border-pink-500 flex flex-col text-center" style={{
                  width: 'min(16vh, 120px)',
                  height: 'min(16vh, 120px)',
                  padding: 'min(1.2vh, 8px)'
                }}>
                  <div className="text-pink-400 font-medium" style={{
                    fontSize: 'min(2vh, 14px)',
                    paddingTop: 'min(2vh, 16px)',
                    height: 'min(3vh, 24px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>Search</div>
                  <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                    fontSize: 'min(1.5vh, 10px)',
                    paddingTop: 'min(0.5vh, 4px)'
                  }}>Enter any artist name to start exploring their collaboration network</div>
                </div>
              </div>
              
              {/* Discover Circle */}
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-purple-500/20 border-2 border-purple-500 flex flex-col text-center" style={{
                  width: 'min(16vh, 120px)',
                  height: 'min(16vh, 120px)',
                  padding: 'min(1.2vh, 8px)'
                }}>
                  <div className="text-purple-400 font-medium" style={{
                    fontSize: 'min(2vh, 14px)',
                    paddingTop: 'min(2vh, 16px)',
                    height: 'min(3vh, 24px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>Discover</div>
                  <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                    fontSize: 'min(1.5vh, 10px)',
                    paddingTop: 'min(0.5vh, 4px)'
                  }}>See producers, songwriters, and other artists they've worked with</div>
                </div>
              </div>
            </div>
            
            {/* Bottom Row - One circle centered, closer to top row */}
            <div className="flex justify-center -mt-1">
              {/* Explore Circle */}
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex flex-col text-center" style={{
                  width: 'min(16vh, 120px)',
                  height: 'min(16vh, 120px)',
                  padding: 'min(1.2vh, 8px)'
                }}>
                  <div className="text-cyan-400 font-medium" style={{
                    fontSize: 'min(2vh, 14px)',
                    paddingTop: 'min(2vh, 16px)',
                    height: 'min(3vh, 24px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>Explore</div>
                  <div className="text-white leading-tight flex-1 flex items-start justify-center" style={{
                    fontSize: 'min(1.5vh, 10px)',
                    paddingTop: 'min(0.5vh, 4px)'
                  }}>Click any node to search for that artist's connections</div>
                </div>
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
