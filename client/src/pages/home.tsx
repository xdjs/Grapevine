import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import HelpButton from "@/components/help-button";
import ShareButton from "@/components/share-button";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";

import { NetworkData, FilterState } from "@/types/network";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { useIsMobile } from "@/hooks/use-mobile.tsx";

export default function Home() {
  const params = useParams<{ artistId?: string }>();
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [showNetworkView, setShowNetworkView] = useState(false);
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

  const handleLoadingChange = useCallback((loading: boolean, artistName?: string) => {
    setIsLoading(loading);
    if (loading) {
      setShowNetworkView(true); // Show network view when loading starts
      if (artistName) {
        setCurrentArtistName(artistName);
      }
    } else {
      setCurrentArtistName("");
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

  const handleArtistNodeClick = useCallback(async (artistName: string, artistId?: string) => {
    console.log(`🔗 [Home] Artist node clicked: ${artistName} (ID: ${artistId})`);
    
    // Immediately show loading state and network view
    setIsLoading(true);
    setShowNetworkView(true);
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

  return (
    <div className={`relative w-full min-h-screen bg-black text-white main-container ${!showNetworkView ? 'overflow-x-hidden' : ''}`} style={{ pointerEvents: 'auto' }}>
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
        <div className="footer-content fixed bottom-0 left-0 right-0 text-center z-10 bg-gradient-to-t from-black/80 to-transparent" style={{ pointerEvents: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 200px)' }}>
          <div className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-10 space-y-3 sm:space-y-4">
            <div className="text-gray-500 text-xs sm:text-sm">
              <p className="mb-1 sm:mb-2">Data sourced from MusicBrainz, OpenAI, and Spotify APIs</p>
              <p className="mb-1 sm:mb-2">Powered by Music Nerd</p>
              <p>Click on artist nodes to visit their Music Nerd profiles</p>
            </div>
            
            {/* Empty space for button to overlap */}
            <div className="h-8"></div>
          </div>
        </div>
      )}

      {/* Music Nerd Button - Overlapping footer empty space */}
      {!showNetworkView && (
        <div className="fixed left-1/2 transform -translate-x-1/2 z-50" style={{ bottom: 'calc(env(safe-area-inset-bottom, 16px) + 40px)' }}>
          <button
            onClick={() => {
              console.log('Music Nerd button clicked!');
              window.open('https://www.musicnerd.xyz', '_blank', 'noopener,noreferrer');
            }}
            className="font-medium py-2 px-4 rounded-lg transition-colors text-white text-sm cursor-pointer"
            style={{
              backgroundColor: '#b427b4',
              border: 'none',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(180, 39, 180, 0.3)',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 100
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#8f1c8f';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(180, 39, 180, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#b427b4';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 39, 180, 0.3)';
            }}
          >
            Visit Music Nerd
          </button>
        </div>
      )}

      {/* Spacer to ensure scrollable content - adjusted for mobile */}
      <div className="h-40 sm:h-96"></div>

      {/* Network Visualization */}
      {networkData && (
        <NetworkVisualizer
          key={`network-${networkData.nodes[0]?.id || 'empty'}-${Date.now()}`}
          data={networkData}
          visible={showNetworkView}
          filterState={filterState}
          onZoomChange={handleZoomChange}
          onArtistSearch={handleArtistSearch}
          onArtistNodeClick={handleArtistNodeClick}
        />
      )}

      {/* Loading Screen */}
      <LoadingScreen isVisible={isLoading && showNetworkView} artistName={currentArtistName} />

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

      {/* Share Button - Always visible */}
      <ShareButton />
      
      {/* Help Button - Always visible */}
      <HelpButton />
    </div>
  );
}
