import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";

import FilterControls from "@/components/filter-controls";
import MobileControls from "@/components/mobile-controls";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

import { NetworkData, NetworkNode, FilterState } from "@/types/network";
import { fetchNetworkData, fetchNetworkDataById, fetchNetworkSkeleton, fetchRoles } from "@/lib/network-data";
import { useProfilePictures } from "@/hooks/use-profile-pictures";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ArtistNetwork() {
  const [, setLocation] = useLocation();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState<string>("");
  const [currentArtistId, setCurrentArtistId] = useState<string | null>(null);
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

  // Smooth enrichment helper: apply roles and pictures to current network
  const applyEnrichmentSmoothly = useCallback(async (baseData: NetworkData) => {
    try {
      const names = baseData.nodes.map(n => n.name);
      const [rolesMap] = await Promise.all([
        fetchRoles(names).catch(() => ({} as Record<string, string[]>)),
      ]);

      // Apply roles
      const withRoles: NetworkData = {
        ...baseData,
        nodes: baseData.nodes.map(n => {
          const roles = rolesMap[n.name];
          if (!roles || roles.length === 0) return n;
          const unique = Array.from(new Set([...(n.types || [n.type]), ...roles]));
          return {
            ...n,
            type: (unique[0] as any) || n.type,
            types: unique as any,
          };
        })
      };

      // Fetch pictures in batches and update nodes
      const updatedNodes = await profilePictures.updateNodesWithImages(withRoles.nodes as any);
      setNetworkData({ ...withRoles, nodes: updatedNodes });
    } catch (e) {
      console.warn('Enrichment failed, showing skeleton only:', e);
    }
  }, []);

  const profilePictures = useProfilePictures({ autoFetch: true, useCache: true, batchSize: 20 });

  // Handle node click to load new artist network (skeleton-first)
  const handleArtistNodeClick = useCallback(async (artistName: string, artistId?: string) => {
    console.log(`🔗 [Artist Network] Artist node clicked: ${artistName} (ID: ${artistId})`);
    
    // Immediately show loading state
    setIsLoading(true);
    setCurrentArtistName(artistName);
    
    try {
      // Try skeleton first for faster initial render
      const skeleton = await fetchNetworkSkeleton(artistName.trim());
      const mainArtist = skeleton.nodes.find((node: NetworkNode) => node.size === 30 && node.type === 'artist');
      const finalArtistId = mainArtist?.artistId || mainArtist?.id || artistId || null;

      handleNetworkData(skeleton, finalArtistId || undefined);
      // Save to search history
      if (saveToHistoryRef.current) {
        saveToHistoryRef.current(artistName, finalArtistId || null);
      }
      // Enrich in background (roles + pictures)
      void applyEnrichmentSmoothly(skeleton);
      // Hide loading overlay once skeleton is shown
      setIsLoading(false);
      setCurrentArtistName("");
      
    } catch (error) {
      console.warn('Skeleton failed, falling back to full network fetch...', error);
      try {
        const data = artistId 
          ? await fetchNetworkDataById(artistId)
          : await fetchNetworkData(artistName.trim());
        if (data && 'nodes' in data) {
          const mainArtist = data.nodes.find((node: NetworkNode) => node.size === 30 && node.type === 'artist');
          const finalArtistId = mainArtist?.artistId || mainArtist?.id || artistId;
          handleNetworkData(data, finalArtistId);
          if (saveToHistoryRef.current) saveToHistoryRef.current(artistName, finalArtistId || null);
        } else {
          console.warn(`No network data found for ${artistName}`);
        }
      } finally {
        setIsLoading(false);
        setCurrentArtistName("");
      }
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
        
        {/* Mobile Controls */}
        <MobileControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onClearAll={handleClearNetwork}
          artistId={currentArtistId}
        />
      </>
    </div>
  );
}