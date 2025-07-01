import { useState, useCallback, useRef } from "react";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";

import { NetworkData, FilterState } from "@/types/network";
import { Loader2 } from "lucide-react";

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

  const handleZoomChange = (transform: { k: number; x: number; y: number }) => {
    setZoomTransform(transform);
  };

  const handleArtistSearch = (artistName: string) => {
    if (triggerSearchRef.current) {
      triggerSearchRef.current(artistName);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden">
      {/* Search Interface */}
      <SearchInterface
        onNetworkData={handleNetworkData}
        showNetworkView={showNetworkView}
        clearSearch={clearSearchField}
        onLoadingChange={handleLoadingChange}
        onSearchFunction={(searchFn) => {
          triggerSearchRef.current = searchFn;
        }}
      />

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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30">
          <div className="bg-black/80 rounded-lg p-8 flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-pink-500" />
            <p className="text-lg font-medium text-white">Creating collaboration network...</p>
            <p className="text-sm text-gray-400 text-center max-w-md">
              Analyzing authentic collaboration data from MusicBrainz, OpenAI, and Spotify
            </p>
          </div>
        </div>
      )}

      {/* Controls - Only show when network is visible */}
      {showNetworkView && (
        <>
          <ZoomControls
            onZoomIn={() => {
              const event = new CustomEvent('network-zoom', { detail: { action: 'in' } });
              window.dispatchEvent(event);
            }}
            onZoomOut={() => {
              const event = new CustomEvent('network-zoom', { detail: { action: 'out' } });
              window.dispatchEvent(event);
            }}
            onZoomReset={() => {
              const event = new CustomEvent('network-zoom', { detail: { action: 'reset' } });
              window.dispatchEvent(event);
            }}
            onClearAll={handleReset}
          />
          <FilterControls
            filterState={filterState}
            onFilterChange={setFilterState}
          />

        </>
      )}
    </div>
  );
}
