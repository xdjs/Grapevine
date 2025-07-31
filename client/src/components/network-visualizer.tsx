import { useEffect, useRef, useState } from "react";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import { useNetworkData } from "@/hooks/use-network-data";
import { useConfig } from "@/hooks/use-config";
import { useZoom } from "@/hooks/use-zoom";
import { useTouchGestures } from "@/hooks/use-touch-gestures";
import { useTooltip } from "@/hooks/use-tooltip";
import { useNodeInteractions } from "@/hooks/use-node-interactions";
import { useModals } from "@/hooks/use-modals";
import D3NetworkRenderer from "./d3-network-renderer";
import ArtistSelectionModal from "./artist-selection-modal";
import CollaborationDetailsPopup from "./collaboration-details-popup";
import NetworkTooltip from "./network-tooltip";

interface NetworkVisualizerProps {
  data: NetworkData;
  visible: boolean;
  filterState: FilterState;
  onZoomChange: (transform: { k: number; x: number; y: number }) => void;
  onArtistSearch?: (artistName: string) => void;
  onArtistNodeClick?: (artistName: string, artistId?: string) => void;
}

export default function NetworkVisualizer({
  data,
  visible,
  filterState,
  onZoomChange,
  onArtistSearch,
  onArtistNodeClick,
}: NetworkVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  
  // Configuration management hook
  const { musicNerdBaseUrl, getFreshConfig } = useConfig();
  
  // Modal management hook
  const modals = useModals({
    musicNerdBaseUrl,
    onArtistSelection: onArtistNodeClick,
  });
  
  // Zoom management hook
  const zoom = useZoom({ svgRef, visible, onZoomChange });
  const { 
    currentZoom, 
    handleZoomIn, 
    handleZoomOut, 
    handleZoomReset, 
    applyZoom, 
    applyPinchZoom
  } = zoom;
  
  // Touch gestures hook
  useTouchGestures({
    svgRef,
    visible,
    onPinchZoomIn: (focalX: number, focalY: number) => {
      const newZoom = Math.min(5, currentZoom * 1.2);
      console.log(`🤏 Pinch zoom in: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      applyPinchZoom(newZoom, focalX, focalY);
    },
    onPinchZoomOut: (focalX: number, focalY: number) => {
      const newZoom = Math.max(0.2, currentZoom / 1.2);
      console.log(`🤏 Pinch zoom out: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      applyPinchZoom(newZoom, focalX, focalY);
    }
  });

  // Use network data management hook
  const {
    expandedNodes,
    fullNetworkData, 
    isExpandedMode,
    mainArtistNode,
    visibleNodes,
    visibleLinks,
    displayData: finalDisplayData,
    expandNodeNetwork,
    collapseNodeNetwork,
    resetToFirstDegree
  } = useNetworkData({ data });

  // Tooltip management hook
  const tooltip = useTooltip({
    networkData: data,
    config: { musicNerdBaseUrl, getFreshConfig },
    networkDataHook: { finalDisplayData, expandNodeNetwork },
    callbacks: {
      onArtistNodeClick,
      onShowArtistModal: modals.openArtistModal,
      onShowCollaborationPopup: modals.openCollaborationPopup,
    },
  });

  // Node interactions management hook
  const nodeInteractions = useNodeInteractions({
    simulationRef,
    tooltip,
    visible,
  });

  // Log the current state for debugging
  useEffect(() => {
    if (fullNetworkData) {
      console.log(`📊 Displaying expanded network with ${fullNetworkData.nodes.length} nodes and ${fullNetworkData.links.length} links`);
    } else {
      console.log(`📊 Displaying first-degree network with ${visibleNodes.length} nodes and ${visibleLinks.length} links`);
    }
  }, [fullNetworkData, visibleNodes, visibleLinks]);

  // Handle zoom controls with direct function calls
  useEffect(() => {
    const handleZoomEvent = (event: CustomEvent) => {
      const { action } = event.detail;

      switch (action) {
        case "in":
          handleZoomIn();
          break;
        case "out":
          handleZoomOut();
          break;
        case "reset":
          handleZoomReset();
          break;
      }
    };

    if (visible) {
      window.addEventListener("network-zoom", handleZoomEvent as EventListener);
    }
    
    return () => {
      window.removeEventListener("network-zoom", handleZoomEvent as EventListener);
    };
  }, [visible, currentZoom]);

  function getNodeVisibility(node: NetworkNode, filterState: FilterState): boolean {
    if (node.type === "producer") return filterState.showProducers;
    if (node.type === "songwriter") return filterState.showSongwriters;
    if (node.type === "artist") return filterState.showArtists;
    return true;
  }

  return (
    <div
      className={`network-container transition-opacity duration-700 w-full h-full ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* D3 Network Renderer Component */}
      <D3NetworkRenderer
        data={finalDisplayData}
        visible={visible}
        filterState={filterState}
        svgRef={svgRef}
        simulationRef={simulationRef}
        zoom={zoom}
        nodeInteractions={nodeInteractions}
        tooltip={tooltip}
        mainArtistNode={mainArtistNode}
      />
      
      {/* Reset button for expanded mode */}
      {isExpandedMode && (
        <button
          onClick={resetToFirstDegree}
          className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 z-10"
          style={{ fontSize: '14px', fontWeight: '500' }}
        >
          ← Back to {mainArtistNode?.name || 'Main Artist'}
        </button>
      )}
      
      <ArtistSelectionModal
        isOpen={modals.showArtistModal}
        onClose={modals.closeArtistModal}
        artistName={modals.selectedArtistName}
        onSelectArtist={modals.handleArtistSelection}
      />
      
      <CollaborationDetailsPopup
        isOpen={modals.showCollaborationPopup}
        onClose={modals.closeCollaborationPopup}
        artistName={modals.collaborationArtist}
        collaboratorName={modals.collaborationCollaborator}
        mainArtistName={modals.mainArtistName}
      />
      
      {/* Network Tooltip - rendered outside D3 SVG but positioned absolutely */}
      {tooltip.isTooltipVisible && tooltip.currentNode && (
        <NetworkTooltip
          node={tooltip.currentNode}
          position={tooltip.tooltipPosition}
          visible={tooltip.isTooltipVisible}
          isMainArtist={(() => {
            const mainArtistNode = finalDisplayData.nodes.find(node => node.size === 30 && node.type === 'artist');
            return tooltip.currentNode === mainArtistNode;
          })()}
          isFirstDegreeCollaborator={(() => {
            const mainArtistNode = finalDisplayData.nodes.find(node => node.size === 30 && node.type === 'artist');
            return mainArtistNode && finalDisplayData.links.some(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === mainArtistNode.name && targetId === tooltip.currentNode?.name) || 
                     (sourceId === tooltip.currentNode?.name && targetId === mainArtistNode.name);
            }) || false;
          })()}
          onNetworkAction={tooltip.handleNetworkAction}
          onExpandAction={tooltip.handleExpandAction}
          onProfileAction={tooltip.handleProfileAction}
          onCollaborationAction={tooltip.handleCollaborationAction}
          onClose={tooltip.hideTooltip}
        />
      )}
    </div>
  );
}