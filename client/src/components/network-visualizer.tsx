import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import { useNetworkData } from "@/hooks/use-network-data";
import { useConfig } from "@/hooks/use-config";
import { useZoom } from "@/hooks/use-zoom";
import { useTouchGestures } from "@/hooks/use-touch-gestures";
import { useTooltip } from "@/hooks/use-tooltip";
import { useNodeInteractions } from "@/hooks/use-node-interactions";
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
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");
  
  // Configuration management hook
  const { musicNerdBaseUrl, getFreshConfig } = useConfig();
  
  // Zoom management hook
  const { 
    currentZoom, 
    handleZoomIn, 
    handleZoomOut, 
    handleZoomReset, 
    applyZoom, 
    applyPinchZoom, 
    setupZoomBehavior 
  } = useZoom({ svgRef, visible, onZoomChange });
  
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
  
  // Collaboration details popup state
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(false);
  const [collaborationArtist, setCollaborationArtist] = useState("");
  const [collaborationCollaborator, setCollaborationCollaborator] = useState("");
  const [mainArtistName, setMainArtistName] = useState("");

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
      onShowArtistModal: (artistName: string) => {
        setSelectedArtistName(artistName);
        setShowArtistModal(true);
      },
      onShowCollaborationPopup: (data: { artist: string; collaborator: string; mainArtistName: string }) => {
        setCollaborationArtist(data.artist);
        setCollaborationCollaborator(data.collaborator);
        setMainArtistName(data.mainArtistName);
        setShowCollaborationPopup(true);
      },
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

  useEffect(() => {
    if (!svgRef.current || !finalDisplayData || !visible) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    
    // Use container dimensions instead of window dimensions to avoid browser UI areas
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;

    // Clear existing content
    svg.selectAll("*").remove();

    // Filter out links where either node doesn't exist or is isolated
    const nodeSet = new Set(finalDisplayData.nodes.map(n => n.id));
    const validLinks = finalDisplayData.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeSet.has(sourceId) && nodeSet.has(targetId);
    });

    // Create network group
    const networkGroup = svg.append("g").attr("class", "network-group");

    // Setup zoom behavior using the zoom hook
    setupZoomBehavior(networkGroup);

    // Add background click handler to hide tooltip and reset highlighting
    svg.on("click", function(event) {
      // Only trigger if clicking on the background (not on a node)
      if (event.target === this || event.target.tagName === 'svg') {
        tooltip.hideTooltip();
      }
    });

    // Touch and zoom handling is now managed by hooks

    // Currently highlighted node is now managed by the tooltip hook

    // Find connected components for cluster positioning
    const findConnectedComponents = () => {
      const visited = new Set<string>();
      const components: NetworkNode[][] = [];
      
      for (const node of finalDisplayData.nodes) {
        if (visited.has(node.id)) continue;
        
        const component: NetworkNode[] = [];
        const queue = [node];
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current.id)) continue;
          
          visited.add(current.id);
          component.push(current);
          
          // Find connected nodes
          for (const link of validLinks) {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            if (sourceId === current.id) {
              const target = finalDisplayData.nodes.find(n => n.id === targetId);
              if (target && !visited.has(target.id)) queue.push(target);
            } else if (targetId === current.id) {
              const source = finalDisplayData.nodes.find(n => n.id === sourceId);
              if (source && !visited.has(source.id)) queue.push(source);
            }
          }
        }
        
        if (component.length > 0) components.push(component);
      }
      
      return components;
    };

    const components = findConnectedComponents();
    
    // Position components in a grid layout to prevent overlap
    const componentsPerRow = Math.ceil(Math.sqrt(components.length));
    const componentWidth = width / componentsPerRow;
    const componentHeight = height / Math.ceil(components.length / componentsPerRow);
    
    // Find the main artist node - it's the largest artist node (size can be 20, 25, or 30)
    const mainArtistNode = finalDisplayData.nodes
      .filter(node => node.type === 'artist' || (node.types && node.types.includes('artist')))
      .reduce((largest, current) => 
        !largest || current.size > largest.size ? current : largest, 
        null as NetworkNode | null
      );
    
    components.forEach((component, index) => {
      const row = Math.floor(index / componentsPerRow);
      const col = index % componentsPerRow;
      const centerX = col * componentWidth + componentWidth / 2;
      const centerY = row * componentHeight + componentHeight / 2;
      
      component.forEach(node => {
        if (!node.x && !node.y) {
          // If this is the main artist node, center it in the viewport
          if (node === mainArtistNode) {
            node.x = width / 2;
            node.y = height / 2;
          } else {
            node.x = centerX + (Math.random() - 0.5) * 100;
            node.y = centerY + (Math.random() - 0.5) * 100;
          }
        }
      });
    });

    // Create boundary force to keep nodes within viewport
    const boundaryForce = () => {
      const margin = 30; // Reduced margin for tighter bounds
      const container = svgRef.current?.parentElement;
      const currentWidth = container ? container.clientWidth : width;
      const currentHeight = container ? container.clientHeight : height;
      
      for (const node of finalDisplayData.nodes) {
        // Ensure nodes stay well within bounds
        if (node.x! < margin) node.x = margin;
        if (node.x! > currentWidth - margin) node.x = currentWidth - margin;
        if (node.y! < margin) node.y = margin;
        if (node.y! > currentHeight - margin) node.y = currentHeight - margin;
        
        // Additional safety check - if somehow a node is outside, bring it back
        if (node.x! < 0 || node.x! > currentWidth || node.y! < 0 || node.y! > currentHeight) {
          node.x = Math.max(margin, Math.min(currentWidth - margin, node.x!));
          node.y = Math.max(margin, Math.min(currentHeight - margin, node.y!));
        }
      }
    };

    // Create simulation with centering force for main artist
    const simulation = d3
              .forceSimulation<NetworkNode>(finalDisplayData.nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(validLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => d.size + 10))
      .force("boundary", boundaryForce)
      .force("centerX", d3.forceX(width / 2).strength((d) => d === mainArtistNode ? 0.1 : 0))
      .force("centerY", d3.forceY(height / 2).strength((d) => d === mainArtistNode ? 0.1 : 0));

    simulationRef.current = simulation;

    // Add resize listener to handle orientation changes
    const handleResize = () => {
      if (svgRef.current && simulationRef.current) {
        const container = svgRef.current.parentElement;
        const newWidth = container ? container.clientWidth : window.innerWidth;
        const newHeight = container ? container.clientHeight : window.innerHeight;
        
        // Update simulation forces with new dimensions
        simulationRef.current
          .force("centerX", d3.forceX(newWidth / 2).strength((d) => d === mainArtistNode ? 0.1 : 0))
          .force("centerY", d3.forceY(newHeight / 2).strength((d) => d === mainArtistNode ? 0.1 : 0))
          .alpha(0.3) // Restart simulation
          .restart();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Create links
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke-width", 2);

    // Create nodes with multi-role support
    const nodeElements = networkGroup
      .selectAll(".node")
      .data(finalDisplayData.nodes)
      .enter()
      .append("g")
      .attr("class", (d) => `node-group network-node node-${d.type}`)
      .style("cursor", "pointer");

    // Add circles for each node - single color for single role, multi-colored for multiple roles
    nodeElements.each(function(d) {
      const group = d3.select(this);
      const roles = d.types || [d.type];
      
      // Debug multi-role nodes
      if (roles.length > 1) {
        console.log(`🎭 [Frontend] Multi-role node "${d.name}": roles = [${roles.join(', ')}]`);
      }
      
      if (roles.length === 1) {
        // Single role - simple circle
        group.append("circle")
          .attr("r", d.size)
          .attr("fill", "transparent")
          .attr("stroke", () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr("stroke-width", 4);
      } else {
        // Multiple roles - create segmented circle
        const angleStep = (2 * Math.PI) / roles.length;
        
        roles.forEach((role, index) => {
          const startAngle = index * angleStep;
          const endAngle = (index + 1) * angleStep;
          
          // Create arc path for each role
          const arcPath = d3.arc()
            .innerRadius(d.size - 4)
            .outerRadius(d.size)
            .startAngle(startAngle)
            .endAngle(endAngle);
          
          group.append("path")
            .attr("d", arcPath)
            .attr("fill", () => {
              if (role === 'artist') return '#FF0ACF';       // Magenta Pink
              if (role === 'producer') return '#AE53FF';     // Bright Purple  
              if (role === 'songwriter') return '#67D1F8';   // Light Blue
              return '#355367';  // Police Blue
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .style("pointer-events", "all"); // Ensure click events work on arcs
        });
        
        // Add inner circle for better visibility
        group.append("circle")
          .attr("r", d.size - 4)
          .attr("fill", "transparent")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }
    })
      .on("click", function(event, d) {
        // Use the node interactions hook for click handling
        nodeInteractions.handleNodeClick(event as MouseEvent, d, this);
      });

    // Setup drag behavior using the node interactions hook
    nodeInteractions.setupDragBehavior(nodeElements);

    // Add labels for all nodes
    const labelElements = networkGroup
      .selectAll(".label")
      .data(finalDisplayData.nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => d.type === 'artist' ? "14px" : "11px")
      .attr("font-weight", (d) => d.type === 'artist' ? "600" : "500")
      .attr("fill", "white")
      .attr("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)")
      .text((d) => d.name);

    // Drag functions are now handled by the node interactions hook

    // Update positions on tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x!)
        .attr("y1", (d) => (d.source as NetworkNode).y!)
        .attr("x2", (d) => (d.target as NetworkNode).x!)
        .attr("y2", (d) => (d.target as NetworkNode).y!);

      nodeElements.attr("transform", (d) => `translate(${d.x!}, ${d.y!})`);

      labelElements.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    // Cleanup function
    return () => {
      simulation.stop();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
      }, [finalDisplayData, visible, onZoomChange, expandedNodes, fullNetworkData, isExpandedMode]);

  // Helper function to check if a node should be visible based on filter state
  // For multi-role nodes, they are visible if ANY of their roles should be shown
  const isNodeVisible = (node: NetworkNode, filterState: FilterState): boolean => {
    if (!node.types || node.types.length === 0) {
      // Fallback to single type if types array is not available
      if (node.type === "producer" && !filterState.showProducers) return false;
      if (node.type === "songwriter" && !filterState.showSongwriters) return false;
      if (node.type === "artist" && !filterState.showArtists) return false;
      return true;
    }
    
    // Check if any of the node's roles should be visible
    for (const role of node.types) {
      if (role === "producer" && filterState.showProducers) return true;
      if (role === "songwriter" && filterState.showSongwriters) return true;
      if (role === "artist" && filterState.showArtists) return true;
    }
    
    return false;
  };

  // Update visibility based on filter state
  useEffect(() => {
    if (!svgRef.current || !visible) return;

    const svg = d3.select(svgRef.current);

    // Helper function to check if a node should be visible based on filter state
    // For multi-role nodes, they are visible if ANY of their roles should be shown
    const isNodeVisible = (node: NetworkNode): boolean => {
      if (node.types && node.types.length > 0) {
        // Check if any of the node's roles should be visible
        for (const role of node.types) {
          if (role === "producer" && filterState.showProducers) return true;
          if (role === "songwriter" && filterState.showSongwriters) return true;
          if (role === "artist" && filterState.showArtists) return true;
        }
        return false;
      } else {
        // Fallback to single type if types array is not available
        if (node.type === "producer" && !filterState.showProducers) return false;
        if (node.type === "songwriter" && !filterState.showSongwriters) return false;
        if (node.type === "artist" && !filterState.showArtists) return false;
        return true;
      }
    };

    // Hide/show nodes based on filter state
    svg.selectAll(".node-group").style("display", function () {
      const d = d3.select(this).datum() as NetworkNode;
      return isNodeVisible(d) ? null : "none";
    });

    // Hide/show labels based on filter state
    svg.selectAll(".label").style("display", function () {
      const d = d3.select(this).datum() as NetworkNode;
      return isNodeVisible(d) ? null : "none";
    });

    // Hide/show links based on whether both connected nodes are visible
    svg.selectAll(".link").style("display", function () {
      const d = d3.select(this).datum() as NetworkLink;
      const source = d.source as NetworkNode;
      const target = d.target as NetworkNode;
      
      const sourceVisible = isNodeVisible(source);
      const targetVisible = isNodeVisible(target);
      
      return sourceVisible && targetVisible ? null : "none";
    });
  }, [filterState, visible]);

  // Zoom functions are now handled by the useZoom hook

  const handleArtistSelection = (artistId: string) => {
    // Open the specific artist page with the selected ID
    if (!musicNerdBaseUrl) {
      console.error('🔧 [Config] MusicNerd base URL not available');
      return;
    }

    const musicNerdUrl = `${musicNerdBaseUrl}/artist/${artistId}`;

    console.log(`🎵 Opening selected artist page: ${musicNerdUrl}`);
    
    const link = document.createElement('a');
    link.href = musicNerdUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        isOpen={showArtistModal}
        onClose={() => setShowArtistModal(false)}
        artistName={selectedArtistName}
        onSelectArtist={handleArtistSelection}
      />
      
      <CollaborationDetailsPopup
        isOpen={showCollaborationPopup}
        onClose={() => setShowCollaborationPopup(false)}
        artistName={collaborationArtist}
        collaboratorName={collaborationCollaborator}
        mainArtistName={mainArtistName}
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

