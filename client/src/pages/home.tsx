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
  const [filterState, setFilterState] = useState<FilterState>({
    showProducers: true,
    showSongwriters: true,
    showArtists: true,
  });

  const handleNetworkData = useCallback((data: NetworkData) => {
    setNetworkData(prevData => {
      if (!prevData) {
        // First artist - set data directly
        return data;
      } else {
        // Merge with existing data
        const existingNodeIds = new Set(prevData.nodes.map(n => n.id));
        const existingLinks = new Set(prevData.links.map(l => `${typeof l.source === 'string' ? l.source : l.source.id}-${typeof l.target === 'string' ? l.target : l.target.id}`));
        
        const newNodes = data.nodes.filter(node => !existingNodeIds.has(node.id));
        const newLinks = data.links.filter(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return !existingLinks.has(`${sourceId}-${targetId}`) && !existingLinks.has(`${targetId}-${sourceId}`);
        });
        
        return {
          nodes: [...prevData.nodes, ...newNodes],
          links: [...prevData.links, ...newLinks]
        };
      }
    });
    
    setShowNetworkView(true);
  }, []);

  const handleReset = () => {
    setNetworkData(null);
    setShowNetworkView(false);
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
      />

      {/* Network Visualization */}
      {networkData && (
        <NetworkVisualizer
          key={`network-${networkData.nodes.length}-${networkData.links.length}`}
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
              console.log("Zoom in button clicked");
              const event = new CustomEvent('network-zoom', { detail: { action: 'in' } });
              window.dispatchEvent(event);
            }}
            onZoomOut={() => {
              console.log("Zoom out button clicked");
              const event = new CustomEvent('network-zoom', { detail: { action: 'out' } });
              window.dispatchEvent(event);
            }}
            onZoomReset={() => {
              console.log("Zoom reset button clicked");
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
