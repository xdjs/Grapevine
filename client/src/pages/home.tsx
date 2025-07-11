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
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Interactive Node Visualization */}
            <div className="relative flex items-center justify-center mb-8">
              <svg 
                className="w-full h-32 sm:h-40" 
                viewBox="0 0 600 160" 
                style={{ maxWidth: '600px' }}
              >
                {/* Connection lines */}
                <defs>
                  <linearGradient id="connectionGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#FF69B4', stopOpacity: 0.6 }} />
                    <stop offset="100%" style={{ stopColor: '#8A2BE2', stopOpacity: 0.6 }} />
                  </linearGradient>
                  <linearGradient id="connectionGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#8A2BE2', stopOpacity: 0.6 }} />
                    <stop offset="100%" style={{ stopColor: '#00CED1', stopOpacity: 0.6 }} />
                  </linearGradient>
                </defs>
                
                {/* Connection line 1 */}
                <line 
                  x1="100" y1="80" 
                  x2="300" y2="80" 
                  stroke="url(#connectionGradient1)" 
                  strokeWidth="3"
                  className="animate-pulse"
                />
                
                {/* Connection line 2 */}
                <line 
                  x1="300" y1="80" 
                  x2="500" y2="80" 
                  stroke="url(#connectionGradient2)" 
                  strokeWidth="3"
                  className="animate-pulse"
                  style={{ animationDelay: '0.5s' }}
                />
                
                {/* Node 1 - Search */}
                <circle 
                  cx="100" cy="80" r="35" 
                  fill="#FF69B4" 
                  stroke="#FF69B4" 
                  strokeWidth="2"
                  className="hover:scale-110 transition-transform duration-300 cursor-pointer"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255, 105, 180, 0.5))' }}
                />
                <text x="100" y="85" textAnchor="middle" className="fill-white text-sm font-bold">1</text>
                
                {/* Node 2 - Discover */}
                <circle 
                  cx="300" cy="80" r="35" 
                  fill="#8A2BE2" 
                  stroke="#8A2BE2" 
                  strokeWidth="2"
                  className="hover:scale-110 transition-transform duration-300 cursor-pointer"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(138, 43, 226, 0.5))' }}
                />
                <text x="300" y="85" textAnchor="middle" className="fill-white text-sm font-bold">2</text>
                
                {/* Node 3 - Explore */}
                <circle 
                  cx="500" cy="80" r="35" 
                  fill="#00CED1" 
                  stroke="#00CED1" 
                  strokeWidth="2"
                  className="hover:scale-110 transition-transform duration-300 cursor-pointer"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(0, 206, 209, 0.5))' }}
                />
                <text x="500" y="85" textAnchor="middle" className="fill-white text-sm font-bold">3</text>
              </svg>
            </div>
            
            {/* Node descriptions */}
            <div className="text-gray-400 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div className="bg-gray-900/50 p-2 sm:p-4 rounded-lg border-l-4 border-pink-400">
                  <div className="text-pink-400 font-medium mb-1 sm:mb-2">Search</div>
                  <div className="text-xs sm:text-sm">Enter any artist name to start exploring their collaboration network</div>
                </div>
                <div className="bg-gray-900/50 p-2 sm:p-4 rounded-lg border-l-4 border-purple-400">
                  <div className="text-purple-400 font-medium mb-1 sm:mb-2">Discover</div>
                  <div className="text-xs sm:text-sm">See producers, songwriters, and other artists they've worked with</div>
                </div>
                <div className="bg-gray-900/50 p-2 sm:p-4 rounded-lg border-l-4 border-cyan-400">
                  <div className="text-cyan-400 font-medium mb-1 sm:mb-2">Explore</div>
                  <div className="text-xs sm:text-sm">Click any node to search for that artist's connections</div>
                </div>
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
