import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as d3 from "d3";
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
import GrapePopup from "./grape-popup";
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
  
  // Grape popup state
  const [showGrapePopup, setShowGrapePopup] = useState(false);
  const [grapeData, setGrapeData] = useState<{
    linkIndex: number;
    clusterIndex: number;
    grapeIndex: number;
    sourceArtist: string;
    targetArtist: string;
  } | null>(null);
  const [grapeContent, setGrapeContent] = useState<string>('');
  const [isGrapeContentLoading, setIsGrapeContentLoading] = useState(false);
  const [grapesVisible, setGrapesVisible] = useState(false);
  
  // Store content for each collaboration link
  const [linkContents, setLinkContents] = useState<Map<string, string>>(new Map());
  const [linkLoadingStates, setLinkLoadingStates] = useState<Map<string, boolean>>(new Map());
  
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
    setCurrentZoom,
    handleZoomIn, 
    handleZoomOut, 
    handleZoomReset, 
    applyZoom, 
    applyPinchZoom
  } = zoom;
  
  // Grape click handler
  const handleGrapeClick = useCallback((data: {
    linkIndex: number;
    clusterIndex: number;
    grapeIndex: number;
    sourceArtist: string;
    targetArtist: string;
  }) => {
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape clicked:`, {
      linkIndex: data.linkIndex,
      clusterIndex: data.clusterIndex,
      grapeIndex: data.grapeIndex,
      sourceArtist: data.sourceArtist,
      targetArtist: data.targetArtist
    });
    
    const linkKey = `${data.sourceArtist}→${data.targetArtist}`;
    const content = linkContents.get(linkKey);
    const isLoading = linkLoadingStates.get(linkKey) || false;
    
    setGrapeData(data);
    setGrapeContent(content || '');
    setIsGrapeContentLoading(isLoading);
    setShowGrapePopup(true);
    
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape popup opened for ${linkKey} with content:`, {
      hasContent: !!content,
      contentLength: content?.length || 0,
      isLoading
    });
  }, [linkContents, linkLoadingStates]);

  // Generate grape content for a specific collaboration
  const generateGrapeContent = useCallback(async (sourceArtist: string, targetArtist: string) => {
    if (!sourceArtist || !targetArtist) {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] generateGrapeContent called with empty artist names, skipping`);
      return;
    }
    
    const linkKey = `${sourceArtist}→${targetArtist}`;
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Starting grape content generation for collaboration: ${linkKey}`);
    
    // Set loading state for this specific link
    setLinkLoadingStates(prev => new Map(prev).set(linkKey, true));
    
    try {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Making API call to /api/grape-content/${encodeURIComponent(sourceArtist)}/${encodeURIComponent(targetArtist)}`);
      const response = await fetch(`/api/grape-content/${encodeURIComponent(sourceArtist)}/${encodeURIComponent(targetArtist)}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] API call successful for ${linkKey}, received content:`, data.content);
        setLinkContents(prev => new Map(prev).set(linkKey, data.content));
      } else {
        console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] API call failed for ${linkKey} with status ${response.status}: ${response.statusText}`);
        setLinkContents(prev => new Map(prev).set(linkKey, '')); // Don't set error content, leave empty to prevent grapes from showing
      }
    } catch (error) {
      console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] Error generating grape content for ${linkKey}:`, error);
      setLinkContents(prev => new Map(prev).set(linkKey, '')); // Don't set error content, leave empty to prevent grapes from showing
    } finally {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape content generation completed for ${linkKey}, setting loading to false`);
      setLinkLoadingStates(prev => new Map(prev).set(linkKey, false));
    }
  }, []);

  // Show grapes after content is generated
  const showGrapes = useCallback(() => {
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] showGrapes called, setting grapesVisible to true`);
    setGrapesVisible(true);
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grapes will now be visible in the network visualization`);
  }, []);
  
  // Touch gestures hook
  useTouchGestures({
    svgRef,
    visible,
    onPinchZoomIn: (focalX: number, focalY: number) => {
      const newZoom = Math.min(1000, currentZoom * 1.15); // Cap at 1000x (more responsive zoom - 15% increase)
      console.log(`🤏 Pinch zoom in: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      setCurrentZoom(newZoom); // Update the zoom state
      applyPinchZoom(newZoom, focalX, focalY);
    },
    onPinchZoomOut: (focalX: number, focalY: number) => {
      const newZoom = Math.max(0.001, currentZoom / 1.15); // Min 0.001x (more responsive zoom - 15% decrease)
      console.log(`🤏 Pinch zoom out: ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      setCurrentZoom(newZoom); // Update the zoom state
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

  // Generate grape content for all collaboration links after network data is loaded
  useEffect(() => {
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape content generation effect triggered:`, {
      hasNodes: !!finalDisplayData?.nodes?.length,
      hasLinks: !!finalDisplayData?.links?.length,
      grapesVisible,
      nodeCount: finalDisplayData?.nodes?.length || 0,
      linkCount: finalDisplayData?.links?.length || 0,
      shouldRun: finalDisplayData?.nodes?.length > 0 && finalDisplayData?.links?.length > 0 && !grapesVisible,
      finalDisplayDataExists: !!finalDisplayData,
      finalDisplayDataType: typeof finalDisplayData,
      finalDisplayDataKeys: finalDisplayData ? Object.keys(finalDisplayData) : []
    });
    
    if (finalDisplayData?.nodes?.length > 0 && finalDisplayData?.links?.length > 0 && !grapesVisible) {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Network data loaded, generating content for ${finalDisplayData.links.length} collaboration links`);
      
      // Wait a bit for profile pictures to load, then generate content for each link
      const timer = setTimeout(async () => {
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Timer expired, generating content for all collaboration links`);
        
        finalDisplayData.links.forEach(async (link, linkIndex) => {
          const sourceArtist = typeof link.source === 'string' ? link.source : link.source.name;
          const targetArtist = typeof link.target === 'string' ? link.target : link.target.name;
          
          console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Generating content for link ${linkIndex}: ${sourceArtist} → ${targetArtist}`);
          
          // Call generateGrapeContent directly without dependency issues
          if (sourceArtist && targetArtist) {
            const linkKey = `${sourceArtist}→${targetArtist}`;
            console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Starting grape content generation for collaboration: ${linkKey}`);
            
            // Set loading state for this specific link
            setLinkLoadingStates(prev => new Map(prev).set(linkKey, true));
            
            try {
              console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Making API call to /api/grape-content/${encodeURIComponent(sourceArtist)}/${encodeURIComponent(targetArtist)}`);
              const response = await fetch(`/api/grape-content/${encodeURIComponent(sourceArtist)}/${encodeURIComponent(targetArtist)}`);
              
              if (response.ok) {
                const data = await response.json();
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] API call successful for ${linkKey}, received content:`, data.content);
                setLinkContents(prev => new Map(prev).set(linkKey, data.content));
              } else {
                console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] API call failed for ${linkKey} with status ${response.status}: ${response.statusText}`);
                setLinkContents(prev => new Map(prev).set(linkKey, '')); // Don't set error content, leave empty to prevent grapes from showing
              }
            } catch (error) {
              console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] Error generating grape content for ${linkKey}:`, error);
              setLinkContents(prev => new Map(prev).set(linkKey, '')); // Don't set error content, leave empty to prevent grapes from showing
            } finally {
              console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape content generation completed for ${linkKey}, setting loading to false`);
              setLinkLoadingStates(prev => new Map(prev).set(linkKey, false));
            }
          }
        });
      }, 2000); // 2 second delay to allow profile pictures to load
      
      return () => {
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Clearing grape content generation timer`);
        clearTimeout(timer);
      };
    } else {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape content generation effect skipped:`, {
        hasNodes: !!finalDisplayData?.nodes?.length,
        hasLinks: !!finalDisplayData?.links?.length,
        grapesVisible,
        nodeCount: finalDisplayData?.nodes?.length || 0,
        linkCount: finalDisplayData?.links?.length || 0
      });
    }
  }, [finalDisplayData?.nodes?.length, finalDisplayData?.links?.length, grapesVisible]);

  // Show grapes only after at least one collaboration has content
  useEffect(() => {
    const hasAnyContent = Array.from(linkContents.values()).some(content => content && content.trim() !== '');
    const anyLoading = Array.from(linkLoadingStates.values()).some(loading => loading);
    
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grape visibility effect triggered:`, {
      linkContentsSize: linkContents.size,
      hasAnyContent,
      anyLoading,
      grapesVisible,
      shouldShow: hasAnyContent && !grapesVisible
    });
    
    if (hasAnyContent && !grapesVisible) {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] At least one collaboration has content and grapes not visible, calling showGrapes`);
      showGrapes();
    } else {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Grapes will not be shown:`, {
        reason: !hasAnyContent ? 'no content for any collaboration' : grapesVisible ? 'already visible' : 'unknown'
      });
    }
  }, [linkContents, linkLoadingStates, grapesVisible, showGrapes]);

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
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Component mounting/updating with data:`, {
      hasData: !!data,
      nodeCount: data?.nodes?.length || 0,
      linkCount: data?.links?.length || 0
    });
    
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
            style={{ 
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
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
          {(() => {
            console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Rendering D3NetworkRenderer with:`, {
              hasData: !!finalDisplayData,
              nodeCount: finalDisplayData?.nodes?.length || 0,
              linkCount: finalDisplayData?.links?.length || 0,
              grapesVisible,
              visible
            });
            return (
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
                onGrapeClick={handleGrapeClick}
                grapesVisible={grapesVisible}
              />
            );
          })()}
          
          {/* Temporary debug buttons to force grape visibility */}
          {(() => {
            console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Rendering debug buttons`);
            return (
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
              onClick={() => {
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Debug: Force showing grapes via state`);
                setGrapesVisible(true);
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'purple',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Force Show Grapes (State)
            </button>
            <button
              onClick={() => {
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Debug: Manually setting grape opacity to 1`);
                if (svgRef.current) {
                  const svg = d3.select(svgRef.current);
                  const grapeClusters = svg.selectAll('.grape-cluster');
                  console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Found ${grapeClusters.size()} grape clusters, setting opacity to 1`);
                  grapeClusters.style('opacity', 1);
                }
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'orange',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Manual Grape Opacity
            </button>
            <button
              onClick={() => {
                alert('Green button clicked!'); // Simple test to see if button works
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Debug: Green button clicked!`);
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] finalDisplayData:`, finalDisplayData);
                console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Debug: Manually triggering content generation`);
                if (finalDisplayData?.links?.length > 0) {
                  console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Found ${finalDisplayData.links.length} links, generating content for each`);
                  finalDisplayData.links.forEach(async (link, linkIndex) => {
                    const sourceArtist = typeof link.source === 'string' ? link.source : link.source.name;
                    const targetArtist = typeof link.target === 'string' ? link.target : link.target.name;
                    console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Manual content generation for link ${linkIndex}: ${sourceArtist} → ${targetArtist}`);
                    if (sourceArtist && targetArtist) {
                      const linkKey = `${sourceArtist}→${targetArtist}`;
                      setLinkLoadingStates(prev => new Map(prev).set(linkKey, true));
                      try {
                        const response = await fetch(`/api/grape-content/${encodeURIComponent(sourceArtist)}/${encodeURIComponent(targetArtist)}`);
                        if (response.ok) {
                          const data = await response.json();
                          console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] Manual API call successful for ${linkKey}:`, data.content);
                          setLinkContents(prev => new Map(prev).set(linkKey, data.content));
                        } else {
                          console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] Manual API call failed for ${linkKey}: ${response.status}`);
                          setLinkContents(prev => new Map(prev).set(linkKey, ''));
                        }
                      } catch (error) {
                        console.error(`🕐 [${new Date().toISOString()}] ❌ [NetworkVisualizer] Manual API call error for ${linkKey}:`, error);
                        setLinkContents(prev => new Map(prev).set(linkKey, ''));
                      } finally {
                        setLinkLoadingStates(prev => new Map(prev).set(linkKey, false));
                      }
                    }
                  });
                } else {
                  console.log(`🕐 [${new Date().toISOString()}] 🍇 [NetworkVisualizer] No links found in finalDisplayData`);
                }
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'green',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Manual Content Generation
                </button>
              </div>
            );
          })()}
          
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
          
          <GrapePopup
            isOpen={showGrapePopup}
            onClose={() => setShowGrapePopup(false)}
            grapeData={grapeData || undefined}
            content={grapeContent}
            isLoading={isGrapeContentLoading}
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