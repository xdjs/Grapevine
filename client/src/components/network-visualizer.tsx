import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import { useNetworkData } from "@/hooks/use-network-data";
import { useConfig } from "@/hooks/use-config";
import { useZoom } from "@/hooks/use-zoom";
import { useTouchGestures } from "@/hooks/use-touch-gestures";
import { useTooltip } from "@/hooks/use-tooltip";
import { useNodeInteractions } from "@/hooks/use-node-interactions";
import { useModals } from "@/hooks/use-modals";
import { useFilterVisibility } from "@/hooks/use-filter-visibility";
import { useProfilePictures } from "@/hooks/use-profile-pictures";
import D3NetworkRenderer from "./d3-network-renderer";
import ExpandLoading from "./expand-loading";
import ArtistSelectionModal from "./artist-selection-modal";
import CollaborationDetailsPopup from "./collaboration-details-popup";
import NetworkTooltip from "./network-tooltip";
import ZoomControlsEnhanced from "./zoom-controls-enhanced";
import NetworkResetButton from "./network-reset-button";
import { useIsMobile } from "@/hooks/use-mobile";

interface NetworkVisualizerProps {
  data: NetworkData;
  visible: boolean;
  filterState: FilterState;
  onZoomChange: (transform: { k: number; x: number; y: number }) => void;
  onArtistSearch?: (artistName: string) => void;
  onArtistNodeClick?: (artistName: string, artistId?: string) => void;
  onClearAll?: () => void;
  onError?: (error: Error) => void;
}

export interface NetworkVisualizerRef {
  resetToFirstDegree: () => void;
}

interface ComponentError {
  message: string;
  details?: string;
  retryable: boolean;
}

const NetworkVisualizer = forwardRef<NetworkVisualizerRef, NetworkVisualizerProps>(({
  data,
  visible,
  filterState,
  onZoomChange,
  onArtistSearch,
  onArtistNodeClick,
  onError,
  onClearAll,
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const isMobile = useIsMobile();
  
  // Component error and loading state
  const [componentError, setComponentError] = useState<ComponentError | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Configuration management hook
  const { 
    musicNerdBaseUrl, 
    getFreshConfig, 
    isLoading: configLoading, 
    error: configError,
    refreshConfig 
  } = useConfig();
  
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
      const newZoom = Math.min(100, currentZoom * 1.5);
      console.log(`🤏 Pinch zoom in: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      applyPinchZoom(newZoom, focalX, focalY);
    },
    onPinchZoomOut: (focalX: number, focalY: number) => {
      const newZoom = Math.max(0.01, currentZoom / 1.2);
      console.log(`🤏 Pinch zoom out: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      applyPinchZoom(newZoom, focalX, focalY);
    }
  });

  // Use network data management hook
  const {
    expandedNodes,
    fullNetworkData, 
    isExpandedMode,
    rehydrateReady,
    isNodeExpanded,
    mainArtistNode,
    visibleNodes,
    visibleLinks,
    displayData: finalDisplayData,
    expandNodeNetwork,
    collapseNodeNetwork,
    resetToFirstDegree
  } = useNetworkData({ data });

  // Profile picture management hook
  const profilePictures = useProfilePictures({
    autoFetch: true,
    useCache: true,
    batchSize: 20
  });

  // Immediately trigger image fetch and apply results in place to avoid D3 re-simulation
  useEffect(() => {
    (async () => {
      try {
        if (!finalDisplayData?.nodes || finalDisplayData.nodes.length === 0) return;
        const updatedNodes = await profilePictures.updateNodesWithImages(finalDisplayData.nodes);
        // Apply image URLs to existing node objects to keep simulation object identity intact
        let changed = false;
        const byIdOrName = new Map<string, NetworkNode>();
        for (const n of finalDisplayData.nodes) {
          byIdOrName.set(n.id || n.name, n);
        }
        for (const n of updatedNodes) {
          const key = (n.id || n.name);
          const target = byIdOrName.get(key);
          if (target && n.imageUrl && target.imageUrl !== n.imageUrl) {
            (target as any).imageUrl = n.imageUrl;
            changed = true;
          }
        }
        // Trigger the D3 viewport image loader effect without rebuilding the whole graph
        if (changed) {
          (finalDisplayData as any).nodes = [...finalDisplayData.nodes];
        }
      } catch (error) {
        handleError(error as Error, 'initial profile picture fetch');
      }
    })();
  }, [finalDisplayData?.nodes, finalDisplayData?.links]);

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

  // Filter visibility management hook
  const { isNodeVisible } = useFilterVisibility({
    svgRef,
    visible,
    filterState,
  });

  // Error handling and retry logic
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`❌ [NetworkVisualizer] Error in ${context}:`, error);
    
    const componentError: ComponentError = {
      message: `Error in ${context}: ${error.message}`,
      details: error.stack,
      retryable: retryCount < maxRetries
    };
    
    setComponentError(componentError);
    onError?.(error);
  }, [retryCount, onError]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      console.warn(`⚠️ [NetworkVisualizer] Maximum retry attempts (${maxRetries}) reached`);
      return;
    }
    
    setRetryCount(prev => prev + 1);
    setComponentError(null);
    setIsInitializing(true);
    
    try {
      // Retry config if there was a config error
      if (configError) {
        await refreshConfig();
      }
      setIsInitializing(false);
    } catch (error) {
      handleError(error as Error, 'retry process');
    }
  }, [retryCount, configError, refreshConfig, handleError]);

  const clearError = useCallback(() => {
    setComponentError(null);
    setRetryCount(0);
  }, []);

  // Component initialization and error handling
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setIsInitializing(true);
        
        // Validate required data
        if (!data || !data.nodes || data.nodes.length === 0) {
          throw new Error('Invalid or empty network data provided');
        }
        
        // Don't wait for config to load - the network can render without it
        // Config is only needed for artist modal functionality
        if (configLoading) {
          console.log('⏳ [NetworkVisualizer] Config still loading, but proceeding with visualization...');
        }
        
        // Only throw error if config explicitly failed, not if it's still loading
        if (configError && !configLoading) {
          console.warn('⚠️ [NetworkVisualizer] Config error detected, but proceeding without artist links:', configError);
        }
        
        console.log('✅ [NetworkVisualizer] Component initialized successfully');
        setComponentError(null);
        setIsInitializing(false);
        
      } catch (error) {
        handleError(error as Error, 'component initialization');
        setIsInitializing(false);
      }
    };

    initializeComponent();
  }, [data, configError, handleError]); // Remove configLoading dependency

  // Toast event listener for messages from hooks
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type: 'success' | 'error' | 'info' };
      setToast(detail);
      // Auto-hide after 2.5s
      setTimeout(() => setToast(null), 2500);
    };
    window.addEventListener('network-toast', handler as EventListener);
    return () => window.removeEventListener('network-toast', handler as EventListener);
  }, []);

  // Log the current state for debugging
  useEffect(() => {
    try {
      if (fullNetworkData) {
        console.log(`📊 Displaying expanded network with ${fullNetworkData.nodes.length} nodes and ${fullNetworkData.links.length} links`);
      } else {
        console.log(`📊 Displaying first-degree network with ${visibleNodes.length} nodes and ${visibleLinks.length} links`);
      }
    } catch (error) {
      handleError(error as Error, 'data logging');
    }
  }, [fullNetworkData, visibleNodes, visibleLinks, handleError]);

  // Handle zoom controls with direct function calls
  useEffect(() => {
    const handleZoomEvent = (event: CustomEvent) => {
      try {
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
          default:
            console.warn(`⚠️ [NetworkVisualizer] Unknown zoom action: ${action}`);
        }
      } catch (error) {
        handleError(error as Error, 'zoom event handling');
      }
    };

    if (visible && !componentError) {
      window.addEventListener("network-zoom", handleZoomEvent as EventListener);
    }
    
    return () => {
      window.removeEventListener("network-zoom", handleZoomEvent as EventListener);
    };
  }, [visible, currentZoom, componentError, handleZoomIn, handleZoomOut, handleZoomReset, handleError]);

  // Expose resetToFirstDegree to parent component
  useImperativeHandle(ref, () => ({
    resetToFirstDegree: () => {
      resetToFirstDegree();
    },
  }));


  // Loading state component
  const LoadingState = () => (
    <div 
      className="flex items-center justify-center w-full h-full"
      data-testid="loading-state"
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Initializing network visualization...
        </p>
      </div>
    </div>
  );

  // Error state component  
  const ErrorState = ({ error }: { error: ComponentError }) => (
    <div 
      className="flex items-center justify-center w-full h-full"
      data-testid="error-state"
    >
      <div className="text-center max-w-md mx-auto p-6">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Network Visualization Error
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {error.retryable && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              data-testid="retry-button"
            >
              Retry ({maxRetries - retryCount} attempts left)
            </button>
          )}
          <button
            onClick={clearError}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
            data-testid="dismiss-error-button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`network-container transition-opacity duration-700 w-full h-full ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      data-testid="network-container"
    >
      {/* Show loading state during initialization */}
      {isInitializing && <LoadingState />}
      
      {/* Show error state if there's a component error */}
      {componentError && <ErrorState error={componentError} />}
      
      {/* Main visualization - only render when not loading, no errors, and rehydration check ran */}
      {!isInitializing && !componentError && rehydrateReady && (
        <>
          <svg 
            ref={svgRef} 
            className="w-full h-full" 
            role="img" 
            aria-label="Music collaboration network visualization"
          />

          {toast && (
            <div
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow text-white z-20 ${
                toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-700'
              }`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          )}

          {/* Expand Loading Overlay */}
          <ExpandLoading isVisible={Boolean((tooltip as any).isExpandLoading)} artistName={(tooltip as any).expandTargetName || (tooltip as any).currentNode?.name} />

          {/* Enhanced Zoom Controls - Hidden on mobile */}
          {!isMobile && (
            <ZoomControlsEnhanced
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomReset={handleZoomReset}
              onBackToFirstDegree={isExpandedMode ? resetToFirstDegree : undefined}
              onClearAll={onClearAll}
              showClearButton={true}
              showBackToFirstDegree={isExpandedMode}
              position="top-right"
              orientation="vertical"
              theme="dark"
              ariaLabel="Zoom controls"
            />
          )}

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
          
          {/* Top-right shrink button removed: shrinking is available via tooltip per-node action */}
          
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
                try {
                  const mainArtistNode = finalDisplayData.nodes.find(node => node.size === 30 && node.type === 'artist');
                  return tooltip.currentNode === mainArtistNode;
                } catch (error) {
                  handleError(error as Error, 'tooltip main artist calculation');
                  return false;
                }
              })()}
              isExpanded={isNodeExpanded(tooltip.currentNode?.id, tooltip.currentNode?.name)}
              isFirstDegreeCollaborator={(() => {
                try {
                  const mainArtistNode = finalDisplayData.nodes.find(node => node.size === 30 && node.type === 'artist');
                  return mainArtistNode && finalDisplayData.links.some(link => {
                    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                    return (sourceId === mainArtistNode.name && targetId === tooltip.currentNode?.name) || 
                           (sourceId === tooltip.currentNode?.name && targetId === mainArtistNode.name);
                  }) || false;
                } catch (error) {
                  handleError(error as Error, 'tooltip collaborator calculation');
                  return false;
                }
              })()}
              onNetworkAction={tooltip.handleNetworkAction}
              onExpandAction={(node) => {
                // Always perform an expand when pressing the expand button
                return tooltip.handleExpandAction(node);
              }}
              onShrinkAction={(node) => {
                try {
                  // Use node.id for precise match with contributions keys; name fallback handled inside
                  collapseNodeNetwork(node.name, node.id || undefined);
                  tooltip.hideTooltip();
                } catch (error) {
                  handleError(error as Error, 'shrink network');
                }
              }}
              onProfileAction={tooltip.handleProfileAction}
              onCollaborationAction={tooltip.handleCollaborationAction}
              onClose={tooltip.hideTooltip}
            />
          )}
        </>
      )}
    </div>
  );
});

export default NetworkVisualizer;