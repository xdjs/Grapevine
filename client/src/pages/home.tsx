import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import LoadingScreen from "@/components/loading-screen";
import ShareButton from "@/components/share-button";
import HelpButton from "@/components/help-button";
import NoCollaboratorsPopup from "@/components/no-collaborators-popup";

import { NetworkData, FilterState, NoCollaboratorsResponse, NetworkResponse } from "@/types/network";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

// Hook for dynamic spacing based on actual visible space
const useDynamicSpacing = () => {
  const [spacing, setSpacing] = useState({
    topPadding: '24px',
    bottomPadding: '24px',
    buttonBottom: '20px',
    searchBottomPadding: '120px'
  });

  useEffect(() => {
    const updateSpacing = () => {
      const height = window.innerHeight;
      const width = window.innerWidth;
      
      // Use visualViewport if available for more accurate measurements
      const viewportHeight = window.visualViewport ? window.visualViewport.height : height;
      const viewportWidth = window.visualViewport ? window.visualViewport.width : width;
      
      // Calculate the actual visible area
      const visibleHeight = Math.min(viewportHeight, height);
      
      // Very aggressive spacing to ensure footer is always visible
      if (visibleHeight < 600) {
        setSpacing({
          topPadding: '0px',
          bottomPadding: '0px',
          buttonBottom: '0px',
          searchBottomPadding: '30px'
        });
      } else if (visibleHeight < 650) {
        setSpacing({
          topPadding: '2px',
          bottomPadding: '2px',
          buttonBottom: '2px',
          searchBottomPadding: '40px'
        });
      } else if (visibleHeight < 700) {
        setSpacing({
          topPadding: '4px',
          bottomPadding: '4px',
          buttonBottom: '4px',
          searchBottomPadding: '50px'
        });
      } else if (visibleHeight < 750) {
        setSpacing({
          topPadding: '8px',
          bottomPadding: '8px',
          buttonBottom: '8px',
          searchBottomPadding: '60px'
        });
      } else {
        setSpacing({
          topPadding: '12px',
          bottomPadding: '12px',
          buttonBottom: '12px',
          searchBottomPadding: '80px'
        });
      }
    };

    updateSpacing();
    window.addEventListener('resize', updateSpacing);
    window.addEventListener('orientationchange', updateSpacing);
    
    // Also update on focus/blur to catch browser UI changes
    window.addEventListener('focus', updateSpacing);
    window.addEventListener('blur', updateSpacing);
    
    // Use visualViewport events if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateSpacing);
      window.visualViewport.addEventListener('scroll', updateSpacing);
    }
    
    return () => {
      window.removeEventListener('resize', updateSpacing);
      window.removeEventListener('orientationchange', updateSpacing);
      window.removeEventListener('focus', updateSpacing);
      window.removeEventListener('blur', updateSpacing);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateSpacing);
        window.visualViewport.removeEventListener('scroll', updateSpacing);
      }
    };
  }, []);

  return spacing;
};

export default function Home() {
  const params = useParams<{ artistId?: string }>();
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [showNetworkView, setShowNetworkView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState<string>("");
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });
  
  // Add state for hallucination popup handling
  const [showNoCollaboratorsPopup, setShowNoCollaboratorsPopup] = useState(false);
  const [pendingArtistInfo, setPendingArtistInfo] = useState<{
    name: string;
    id: string;
    singleNodeNetwork: NetworkData;
  } | null>(null);
  
  const triggerSearchRef = useRef<((artistName: string) => void) | null>(null);
  const isMobile = useIsMobile();
  const spacing = useDynamicSpacing();
  const { toast } = useToast();

  // Helper function to check if response indicates no collaborators
  const isNoCollaboratorsResponse = (response: NetworkResponse): response is NoCollaboratorsResponse => {
    return 'noCollaborators' in response && response.noCollaborators === true;
  };

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
      if (params.artistId && !networkData && !isLoading && !isClearing) {
        try {
          setIsLoading(true);
          console.log(`🔗 Loading artist network from URL: ${params.artistId}`);
          
          // Use fetchNetworkDataById to properly handle NoCollaboratorsResponse
          const data = await fetchNetworkDataById(params.artistId);
          
          // Handle the response (might be network data or no-collaborators response)
          if (isNoCollaboratorsResponse(data)) {
            // Show popup for no collaborators - this is what was missing!
            setPendingArtistInfo({
              name: data.artistName,
              id: data.artistId,
              singleNodeNetwork: data.singleNodeNetwork
            });
            setShowNoCollaboratorsPopup(true);
            setShowNetworkView(true); // Still show the network view for the popup
          } else {
            // Normal network data
            setNetworkData(data);
            setShowNetworkView(true);
          }
        } catch (error) {
          console.error(`Error loading artist ${params.artistId}:`, error);
          // Redirect to home if artist not found
          setLocation('/');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadArtistFromUrl();
  }, [params.artistId, networkData, isLoading, isClearing, setLocation]);

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
    setIsClearing(true);
    setNetworkData(null);
    setIsLoading(false);
    setCurrentArtistName("");
    setClearSearchField(true);
    // Clear the URL to remove artist ID
    setLocation('/');
    // Keep showNetworkView as true to stay on the map page
    // Reset the clear flag after a brief delay
    setTimeout(() => {
      setClearSearchField(false);
      setIsClearing(false);
    }, 100);
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

  // Handle user choice from hallucination popup
  const handleShowHallucinations = useCallback(async () => {
    if (!pendingArtistInfo) return;
    
    try {
      setIsLoading(true);
      
      const data = await fetchNetworkDataById(pendingArtistInfo.id, true); // Request hallucinated data
      
      if (isNoCollaboratorsResponse(data)) {
        // Even with hallucinations, no data found - show single node
        setNetworkData(data.singleNodeNetwork);
      } else {
        // Got hallucinated network
        setNetworkData(data);
      }
      
      setShowNoCollaboratorsPopup(false);
      setPendingArtistInfo(null);
      
      toast({
        title: "Network Generated",
        description: `Generated creative network for ${pendingArtistInfo.name}`,
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate hallucinated network",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [pendingArtistInfo, toast]);

  const handleClosePopup = useCallback(() => {
    if (!pendingArtistInfo) return;
    
    // Reset everything and navigate back to homepage when popup is closed/cancelled
    setShowNoCollaboratorsPopup(false);
    setPendingArtistInfo(null);
    setShowNetworkView(false);
    setNetworkData(null);
    
    // Navigate back to home
    setLocation('/');
    
    toast({
      title: "Search Cancelled",
      description: "Returned to homepage",
      duration: 1000,
    });
  }, [pendingArtistInfo, setLocation, toast]);

  return (
    <div className={`relative w-full h-screen bg-black text-white main-container ${showNetworkView ? 'network-visible' : ''}`} style={{ pointerEvents: 'auto' }}>
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
        <div 
          className="footer-content absolute bottom-0 left-0 right-0 text-center z-10 bg-gradient-to-t from-black/80 to-transparent" 
          style={{ 
            pointerEvents: 'auto', 
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${spacing.bottomPadding})`,
            paddingTop: spacing.topPadding,
            // Force footer to be above browser UI
            bottom: 'env(safe-area-inset-bottom, 0px)',
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'hidden',
            zIndex: 60
          }}
        >
          <div className="w-full max-w-2xl mx-auto px-4 py-1 sm:py-2 md:py-3 space-y-1 sm:space-y-2">
            <div className="text-gray-500 text-xs sm:text-sm">
              <p className="mb-1">Data sourced from MusicBrainz, OpenAI, and Spotify APIs</p>
              <p className="mb-1">Powered by Music Nerd</p>
              <p>Click on artist nodes to visit their Music Nerd profiles</p>
            </div>

            {/* Spacer to make room for overlay button */}
            <div className="h-20"></div>
          </div>
        </div>
      )}

      {/* Visit Music Nerd Button - fixed overlay below footer text */}
      {!showNetworkView && (
        <div
          className="fixed left-1/2 transform -translate-x-1/2 z-70"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <button
            onClick={() => {
              window.open('https://www.musicnerd.xyz', '_blank', 'noopener,noreferrer');
            }}
            className="font-medium py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors text-white text-xs sm:text-sm"
            style={{
              backgroundColor: '#b427b4',
              border: 'none',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(180, 39, 180, 0.3)',
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

      {/* Network Visualization - Only show when network data exists */}
      {networkData && showNetworkView && (
        <div className="mobile-network-container network-visible">
          <NetworkVisualizer
            key={`network-${networkData.nodes[0]?.id || 'empty'}-${Date.now()}`}
            data={networkData}
            visible={true}
            filterState={filterState}
            onZoomChange={handleZoomChange}
            onArtistSearch={handleArtistSearch}
            onArtistNodeClick={handleArtistNodeClick}
          />
        </div>
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
            disableShare={!networkData || showNoCollaboratorsPopup}
          />
        </>
      )}


      {/* Share Button - Only visible when network is shown and not on mobile */}
      {showNetworkView && !isMobile && networkData && !showNoCollaboratorsPopup && <ShareButton />}

      {/* Help Button - Hide on mobile when network view is shown */}
      {(!showNetworkView || !isMobile) && <HelpButton />}

      {/* No Collaborators Popup for shared links */}
      <NoCollaboratorsPopup
        isOpen={showNoCollaboratorsPopup}
        artistName={pendingArtistInfo?.name || ""}
        onClose={handleClosePopup}
        onShowHallucinations={handleShowHallucinations}
      />
    </div>
  );
}
