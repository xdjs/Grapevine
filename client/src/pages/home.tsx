import { useState, useCallback } from "react";
import SearchInterface from "@/components/search-interface";
import NetworkVisualizer from "@/components/network-visualizer";
import ZoomControls from "@/components/zoom-controls";
import FilterControls from "@/components/filter-controls";
import Legend from "@/components/legend";
import { NetworkData, FilterState } from "@/types/network";

export default function Home() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [showNetworkView, setShowNetworkView] = useState(false);
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const [clearSearchField, setClearSearchField] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });

  const handleNetworkData = useCallback((data: NetworkData) => {
    // Replace existing network with new data
    setNetworkData(data);
    setShowNetworkView(true);
  }, []);

  const handleReset = () => {
    setNetworkData(null);
    setShowNetworkView(false);
    setClearSearchField(true);
    // Reset the clear flag after a brief delay
    setTimeout(() => setClearSearchField(false), 100);
  };

  const handleZoomChange = (transform: { k: number; x: number; y: number }) => {
    setZoomTransform(transform);
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden">
      {/* Search Interface */}
      <SearchInterface
        onNetworkData={handleNetworkData}
        showNetworkView={showNetworkView}
        clearSearch={clearSearchField}
      />

      {/* Network Visualization */}
      {networkData && (
        <NetworkVisualizer
          key={`network-${networkData.nodes[0]?.id || 'empty'}-${Date.now()}`}
          data={networkData}
          visible={showNetworkView}
          filterState={filterState}
          onZoomChange={handleZoomChange}
        />
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
          <Legend />
        </>
      )}
    </div>
  );
}
