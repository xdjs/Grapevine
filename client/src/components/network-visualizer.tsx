import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import ArtistSelectionModal from "./artist-selection-modal";
import CollaborationDetailsPopup from "./collaboration-details-popup";
import ExpandNetworkLoading from "./expand-network-loading";

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
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState("");
  
  // Collaboration details popup state
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(false);
  const [collaborationArtist, setCollaborationArtist] = useState("");
  const [collaborationCollaborator, setCollaborationCollaborator] = useState("");
  const [mainArtistName, setMainArtistName] = useState("");

  // SIMPLIFIED: Remove complex state management
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [fullNetworkData, setFullNetworkData] = useState<NetworkData | null>(null);
  
  // SIMPLIFIED: Remove persistence logic
  
  // Loading state for expand network functionality
  const [isExpandingNetwork, setIsExpandingNetwork] = useState(false);
  const [expandingArtistName, setExpandingArtistName] = useState("");

  // Find the main artist node
  const mainArtistNode = (fullNetworkData ? fullNetworkData.nodes : data.nodes).find(node => 
    node.size === 30 && (node.type === 'artist' || (node.types && node.types.includes('artist')))
  ) || data.nodes.find(node => 
    node.size === 30 && (node.type === 'artist' || (node.types && node.types.includes('artist')))
  );

  // Get first-degree collaborators (nodes directly connected to main artist)
  const getFirstDegreeCollaborators = () => {
    if (!mainArtistNode) return new Set<string>();
    
    const links = fullNetworkData ? fullNetworkData.links : data.links;
    const firstDegreeIds = new Set<string>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === mainArtistNode.name) {
        firstDegreeIds.add(targetId);
      } else if (targetId === mainArtistNode.name) {
        firstDegreeIds.add(sourceId);
      }
    });
    
    return firstDegreeIds;
  };

  // Get visible nodes based on expansion state
  const getVisibleNodes = () => {
    // Use fullNetworkData if available, otherwise use data
    const nodes = fullNetworkData ? fullNetworkData.nodes : data.nodes;
    const links = fullNetworkData ? fullNetworkData.links : data.links;
    
    // If no data, return empty array
    if (!nodes || nodes.length === 0) {
      return [];
    }
    
    // If no main artist node found, return all nodes
    if (!mainArtistNode) {
      return nodes;
    }
    
    const firstDegreeIds = getFirstDegreeCollaborators();
    const visibleIds = new Set<string>();
    
    // Always include main artist
    visibleIds.add(mainArtistNode.id);
    
    // Include first-degree collaborators
    firstDegreeIds.forEach(id => visibleIds.add(id));
    
    // Include expanded nodes and their connections
    expandedNodes.forEach(expandedNodeId => {
      visibleIds.add(expandedNodeId);
      
      // Add all nodes connected to this expanded node
      links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        if (sourceId === expandedNodeId) {
          visibleIds.add(targetId);
        } else if (targetId === expandedNodeId) {
          visibleIds.add(sourceId);
        }
      });
    });
    
    return nodes.filter(node => visibleIds.has(node.id));
  };

  // Get visible links based on visible nodes
  const getVisibleLinks = () => {
    const visibleNodeIds = new Set(getVisibleNodes().map(node => node.id));
    const links = fullNetworkData ? fullNetworkData.links : data.links;
    
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  };

  // Function to expand a node's network
  const expandNodeNetwork = async (nodeName: string, nodeId?: string) => {
    console.log(`🔗 [Expand] Starting expansion for: ${nodeName}`);
    console.log(`🔗 [Expand] Current expandedNodes:`, Array.from(expandedNodes));
    console.log(`🔗 [Expand] Current fullNetworkData exists:`, !!fullNetworkData);
    
    // Set loading state
    setIsExpandingNetwork(true);
    setExpandingArtistName(nodeName);
    
    console.log(`🔗 [Expand] Loading state set to true for: ${nodeName}`);
    
    try {
      // Fetch the full network for this collaborator
      console.log(`🔗 [Expand] Fetching network from: /api/network/${encodeURIComponent(nodeName)}`);
      const response = await fetch(`/api/network/${encodeURIComponent(nodeName)}`);
      console.log(`🔗 [Expand] Response status:`, response.status);
      console.log(`🔗 [Expand] Response ok:`, response.ok);
      
      if (response.ok) {
        const collaboratorNetwork = await response.json();
        console.log(`🔗 [Expand] Received collaborator network:`, {
          nodesCount: collaboratorNetwork.nodes?.length || 0,
          linksCount: collaboratorNetwork.links?.length || 0,
          hasNodes: !!collaboratorNetwork.nodes,
          hasLinks: !!collaboratorNetwork.links
        });
        
        // Merge the collaborator's network with the existing network
        // Use current fullNetworkData as base if available, otherwise use original data
        const baseNodes = fullNetworkData ? fullNetworkData.nodes : data.nodes;
        const baseLinks = fullNetworkData ? fullNetworkData.links : data.links;
        
        const mergedNodes = [...baseNodes];
        const mergedLinks = [...baseLinks];
        
        // Add new nodes from collaborator's network (avoiding duplicates)
        const existingNodeIds = new Set(baseNodes.map(n => n.id));
        collaboratorNetwork.nodes.forEach(collaboratorNode => {
          if (!existingNodeIds.has(collaboratorNode.id)) {
            mergedNodes.push(collaboratorNode);
            existingNodeIds.add(collaboratorNode.id);
          }
        });
        
        // Add new links from collaborator's network (avoiding duplicates)
        const existingLinkIds = new Set(baseLinks.map(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return `${sourceId}-${targetId}`;
        }));
        
        collaboratorNetwork.links.forEach(collaboratorLink => {
          const sourceId = typeof collaboratorLink.source === 'string' ? collaboratorLink.source : collaboratorLink.source.id;
          const targetId = typeof collaboratorLink.target === 'string' ? collaboratorLink.target : collaboratorLink.target.id;
          const linkId = `${sourceId}-${targetId}`;
          
          if (!existingLinkIds.has(linkId)) {
            mergedLinks.push(collaboratorLink);
            existingLinkIds.add(linkId);
          }
        });
        
        // Create merged network data
        const mergedNetworkData = {
          nodes: mergedNodes,
          links: mergedLinks
        };
        
        console.log(`🔗 [Expand] Merged network data:`, {
          totalNodes: mergedNodes.length,
          totalLinks: mergedLinks.length,
          originalNodes: data.nodes.length,
          originalLinks: data.links.length,
          addedNodes: mergedNodes.length - data.nodes.length,
          addedLinks: mergedLinks.length - data.links.length
        });
        
        setFullNetworkData(mergedNetworkData);
        
        // Add this node to expanded set
        setExpandedNodes(prev => {
          const newSet = new Set([...prev, nodeName]);
          console.log(`🔗 [Expand] Updated expandedNodes:`, Array.from(newSet));
          return newSet;
        });
        
        // Set persistence key for this expansion session
        const mainArtist = mainArtistNode?.name || 'unknown';
        setPersistenceKey(`${mainArtist}-expansion-${Date.now()}`);
        
        // Persist the expanded networks
        setTimeout(() => persistExpandedNetworks(), 100);
        
        console.log(`✅ [Expand] Successfully expanded network for ${nodeName} - added ${collaboratorNetwork.nodes.length} nodes and ${collaboratorNetwork.links.length} links`);
      } else {
        console.error(`❌ [Expand] Failed to fetch network for ${nodeName} - status: ${response.status}`);
        const errorText = await response.text();
        console.error(`❌ [Expand] Error response:`, errorText);
      }
    } catch (error) {
      console.error(`❌ [Expand] Error expanding network for ${nodeName}:`, error);
    } finally {
      // Clear loading state
      console.log(`🔗 [Expand] Clearing loading state for: ${nodeName}`);
      setIsExpandingNetwork(false);
      setExpandingArtistName("");
    }
  };

  // Function to collapse a node's network
  const collapseNodeNetwork = (nodeName: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeName);
      
      // If no nodes are expanded, reset to first-degree view
      if (newSet.size === 0) {
        setFullNetworkData(null);
        console.log(`🔄 No more expanded nodes, resetting to first-degree view`);
        // Clear localStorage when no networks are expanded
        localStorage.removeItem('grapevine-expanded-networks');
        console.log(`💾 [Persistence] Cleared localStorage - no expanded networks`);
      } else {
        // Persist the remaining expanded networks
        setTimeout(() => persistExpandedNetworks(), 100);
      }
      
      return newSet;
    });
  };

  // Function to reset to first-degree view
  const resetToFirstDegree = () => {
    setFullNetworkData(null);
    setExpandedNodes(new Set());
    console.log(`🔄 Reset to first-degree view for ${mainArtistNode?.name || 'main artist'}`);
  };

  // SIMPLIFIED: Just use the data directly
  const finalDisplayData = {
    nodes: data?.nodes || [],
    links: data?.links || []
  };
  


  // SIMPLIFIED: Remove complex useEffect hooks

  // Fetch configuration on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('🔧 [Config] Fetching config from /api/config');
        const response = await fetch('/api/config');
        console.log('🔧 [Config] Response status:', response.status);
        console.log('🔧 [Config] Response ok:', response.ok);
        
        if (response.ok) {
          const config = await response.json();
          console.log('🔧 [Config] Received config:', config);
          if (config.musicNerdBaseUrl) {
            setMusicNerdBaseUrl(config.musicNerdBaseUrl);
            console.log(`🔧 [Config] MusicNerd base URL set to: ${config.musicNerdBaseUrl}`);
          } else {
            console.error('🔧 [Config] No musicNerdBaseUrl in config response');
          }
        } else {
          const errorText = await response.text();
          console.error('🔧 [Config] Error response:', errorText);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    };
    
    fetchConfig();
  }, []);

  useEffect(() => {
    console.log(`🎨 [D3 Render] Starting render check:`);
    console.log(`🎨 [D3 Render] svgRef.current:`, !!svgRef.current);
    console.log(`🎨 [D3 Render] finalDisplayData:`, !!finalDisplayData);
    console.log(`🎨 [D3 Render] visible:`, visible);
    console.log(`🎨 [D3 Render] finalDisplayData nodes:`, finalDisplayData?.nodes?.length || 0);
    console.log(`🎨 [D3 Render] finalDisplayData links:`, finalDisplayData?.links?.length || 0);
    
    if (!svgRef.current || !finalDisplayData || !visible) {
      console.log(`🎨 [D3 Render] Skipping render - missing required data`);
      return;
    }

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

    // Create zoom behavior for mouse/touch interaction
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .filter((event) => {
        // Block all wheel events since we handle them manually for better zoom control
        // Block touch events since we handle them manually for better pinch zoom control
        const isWheelEvent = event.type === 'wheel';
        const isProgrammaticZoom = !event.sourceEvent && event.type !== 'click' && event.type !== 'mousedown';
        
        return !isWheelEvent && (isProgrammaticZoom || event.type === 'mousedown' || event.type === 'mousemove');
      })
      .on("zoom", (event) => {
        // Respond to user scroll wheel and programmatic zoom only
        const { transform } = event;
        networkGroup.attr("transform", transform);
        setCurrentZoom(transform.k);
        onZoomChange({ k: transform.k, x: transform.x, y: transform.y });
      });

    // Apply zoom behavior but prevent background dragging and clicking
    svg.call(zoom);
    zoomRef.current = zoom;

    // Completely disable D3's touch handling - we'll handle it manually
    svg.on("mousedown.drag", null)
       .on("click.zoom", null)
       .on("dblclick.zoom", null)
       .on("touchstart.zoom", null)
       .on("touchmove.zoom", null)
       .on("touchend.zoom", null);

    // Add background click handler to hide tooltip and reset highlighting
    svg.on("click", function(event) {
      // Only trigger if clicking on the background (not on a node)
      if (event.target === this || event.target.tagName === 'svg') {
        hideTooltip();
      }
    });

    // Zoom function for buttons (centered zoom)
    const applyZoom = (scale: number) => {
      if (!svgRef.current) return;
      
      const container = svgRef.current.parentElement;
      const width = container ? container.clientWidth : window.innerWidth;
      const height = container ? container.clientHeight : window.innerHeight;
      
      // Calculate new viewBox dimensions centered
      const newWidth = width / scale;
      const newHeight = height / scale;
      const offsetX = (width - newWidth) / 2;
      const offsetY = (height - newHeight) / 2;
      
      // Apply smooth transition
      const svg = d3.select(svgRef.current);
      svg.transition()
        .duration(200)
        .attrTween('viewBox', () => {
          const currentViewBox = svgRef.current?.getAttribute('viewBox') || `0 0 ${width} ${height}`;
          const [cx, cy, cw, ch] = currentViewBox.split(' ').map(Number);
          const interpolator = d3.interpolate([cx, cy, cw, ch], [offsetX, offsetY, newWidth, newHeight]);
          return (t: number) => {
            const [x, y, w, h] = interpolator(t);
            return `${x} ${y} ${w} ${h}`;
          };
        });
    };

    // Zoom function for pinch gestures (zoom around focal point)
    const applyPinchZoom = (scale: number, focalX: number, focalY: number) => {
      if (!svgRef.current) return;
      
      const container = svgRef.current.parentElement;
      const width = container ? container.clientWidth : window.innerWidth;
      const height = container ? container.clientHeight : window.innerHeight;
      
      // Get current viewBox
      const currentViewBox = svgRef.current.getAttribute('viewBox') || `0 0 ${width} ${height}`;
      const [currentX, currentY, currentWidth, currentHeight] = currentViewBox.split(' ').map(Number);
      
      // Calculate new dimensions
      const newWidth = width / scale;
      const newHeight = height / scale;
      
      // Calculate focal point in viewBox coordinates
      const focalXInViewBox = currentX + (focalX / width) * currentWidth;
      const focalYInViewBox = currentY + (focalY / height) * currentHeight;
      
      // Calculate new viewBox position to keep focal point in same screen position
      const newX = focalXInViewBox - (focalX / width) * newWidth;
      const newY = focalYInViewBox - (focalY / height) * newHeight;
      
      // Apply transition
      const svg = d3.select(svgRef.current);
      svg.transition()
        .duration(100) // Shorter duration for more responsive pinch zoom
        .attrTween('viewBox', () => {
          const interpolator = d3.interpolate([currentX, currentY, currentWidth, currentHeight], [newX, newY, newWidth, newHeight]);
          return (t: number) => {
            const [x, y, w, h] = interpolator(t);
            return `${x} ${y} ${w} ${h}`;
          };
        });
    };

    const handlePinchZoomIn = (focalX: number, focalY: number) => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.min(5, prevZoom * 1.2); // Cap at 5x
        console.log(`🤏 Pinch zoom in: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyPinchZoom(newZoom, focalX, focalY);
        return newZoom;
      });
    };

    const handlePinchZoomOut = (focalX: number, focalY: number) => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.max(0.2, prevZoom / 1.2); // Min 0.2x
        console.log(`🤏 Pinch zoom out: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyPinchZoom(newZoom, focalX, focalY);
        return newZoom;
      });
    };

    // Pinch zoom variables
    let initialDistance = 0;
    let lastScale = 1;
    let isPinching = false;
    const pinchThreshold = 0.2; // Increased from 0.1 to 0.2 for less sensitivity
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    // Custom touch event handlers using existing zoom functions
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        console.log("🤏 Starting pinch gesture");
        isPinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate initial distance and center point
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Store the center point of the pinch gesture
        pinchCenterX = (touch1.clientX + touch2.clientX) / 2;
        pinchCenterY = (touch1.clientY + touch2.clientY) / 2;
        
        lastScale = 1;
        event.preventDefault();
        event.stopPropagation();
      } else if (event.touches.length === 1) {
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isPinching && event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Update the center point of the pinch gesture
        const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
        const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
        
        if (initialDistance > 0) {
          const scaleChange = currentDistance / initialDistance;
          
          // Use threshold to prevent too frequent updates
          if (Math.abs(scaleChange - lastScale) > pinchThreshold) {
            if (scaleChange > lastScale) {
              // Pinch out - zoom in using focal point
              handlePinchZoomIn(currentCenterX, currentCenterY);
            } else {
              // Pinch in - zoom out using focal point
              handlePinchZoomOut(currentCenterX, currentCenterY);
            }
            lastScale = scaleChange;
          }
        }
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (isPinching) {
        console.log("🤏 Ending pinch gesture");
        isPinching = false;
        initialDistance = 0;
        lastScale = 1;
      }
    };



    // Universal wheel event handler for mouse scroll and trackpad pinch
    let lastWheelTime = 0;
    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      
      // Reduced sensitivity with longer throttling
      const now = Date.now();
      if (now - lastWheelTime < 50) { // Increased from 8ms to 50ms for less sensitivity
        return;
      }
      lastWheelTime = now;
      
      // Use mouse position as focal point for wheel zoom
      const focalX = event.clientX;
      const focalY = event.clientY;
      
      // Determine zoom direction based on deltaY
      const zoomIn = event.deltaY < 0;
      
      // Immediate zoom for smooth response
      if (zoomIn) {
        handlePinchZoomIn(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom in' : '🖱️ Mouse wheel zoom in');
      } else {
        handlePinchZoomOut(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom out' : '🖱️ Mouse wheel zoom out');
      }
    };

    // Add touch and wheel event listeners directly to the SVG element
    const svgElement = svg.node() as SVGSVGElement;
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    svgElement.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Cleanup function for all event listeners
    const cleanup = () => {
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
      svgElement.removeEventListener('wheel', handleWheelZoom);
    };

    // Variable to track currently highlighted node
    let currentlyHighlightedNode: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

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
    console.log(`🎨 [D3 Render] Creating simulation with ${finalDisplayData.nodes.length} nodes and ${validLinks.length} links`);
    console.log(`🎨 [D3 Render] Main artist node:`, mainArtistNode?.name || 'not found');
    console.log(`🎨 [D3 Render] Container dimensions: ${width}x${height}`);
    
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
    console.log(`🎨 [D3 Render] Simulation created successfully`);

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
    console.log(`🎨 [D3 Render] Creating ${validLinks.length} link elements`);
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke-width", 2);

    // Create nodes with multi-role support
    console.log(`🎨 [D3 Render] Creating ${finalDisplayData.nodes.length} node elements`);
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
          
        // Add expansion indicator for expanded nodes
        if (expandedNodes.has(d.name)) {
          group.append("circle")
            .attr("r", 3)
            .attr("fill", "#FF6B6B")
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("cx", d.size + 2)
            .attr("cy", -d.size + 2);
        }
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
      
      // Add expansion indicator for expanded nodes
      if (expandedNodes.has(d.name)) {
        group.append("circle")
          .attr("r", 3)
          .attr("fill", "#FF6B6B")
          .attr("stroke", "white")
          .attr("stroke-width", 1)
          .attr("cx", d.size + 2)
          .attr("cy", -d.size + 2);
      }
    })
      .on("click", function(event, d) {
        event.stopPropagation();

        // Reset previous node highlighting
        resetNodeHighlight();

        // Highlight the current node group
        const currentNode = d3.select(this);
        currentNode.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);
        
        // Track this node as highlighted
        currentlyHighlightedNode = currentNode;

        // Check if this is the main artist or a collaborator
        const mainArtistNode = data.nodes.find(node => node.size === 30 && node.type === 'artist');
        const isMainArtist = d === mainArtistNode;
        
        // For all nodes, show the comprehensive tooltip with all options
        showTooltip(event, d);
        moveTooltip(event as unknown as MouseEvent);
        
        // Store collaboration data for the popup (for non-main artists)
        if (!isMainArtist) {
          const mainArtistName = mainArtistNode?.name || "";
          setMainArtistName(mainArtistName);
          
          // Check if the clicked node is directly connected to main artist (first layer)
          const isFirstLayer = finalDisplayData.links.some(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return (sourceId === mainArtistName && targetId === d.name) || 
                   (sourceId === d.name && targetId === mainArtistName);
          });
          
          if (isFirstLayer) {
            // First layer: clicked node is directly connected to main artist
            // Show collaboration between clicked node and main artist
            setCollaborationArtist(mainArtistName);
            setCollaborationCollaborator(d.name);
          } else {
            // Second layer: clicked node is not directly connected to main artist
            // Find the first layer node that this second layer node is connected to
            const directLink = finalDisplayData.links.find(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === d.name && targetId !== mainArtistName) || 
                     (targetId === d.name && sourceId !== mainArtistName);
            });
            
            if (directLink) {
              const connectedNodeId = directLink.source === d.name ? 
                (typeof directLink.target === 'string' ? directLink.target : directLink.target.id) :
                (typeof directLink.source === 'string' ? directLink.source : directLink.source.id);
              
              // Show collaboration between clicked node and their direct connection
              setCollaborationArtist(connectedNodeId);
              setCollaborationCollaborator(d.name);
            } else {
              // Fallback: direct connection to main artist
              setCollaborationArtist(mainArtistName);
              setCollaborationCollaborator(d.name);
            }
          }
        }
      })
      .call(
        d3
          .drag<SVGGElement, NetworkNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

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

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "network-tooltip")
      .style("position", "absolute")
      .style("opacity", 0);

    function showTooltip(event: MouseEvent, d: NetworkNode) {
      const roles = d.types || [d.type];
      const roleDisplay = roles.length > 1 ? roles.join(", ") : roles[0];


      // Update these paths if the assets live elsewhere
      const networkIconPath = "/grapevine-logo.png"; // grape + clef icon
      const artistIconPath = "/music_nerd_logo.png";   // Music Nerd logo PNG served from public

      // Detect mobile and adjust sizes accordingly
      const isMobile = window.innerWidth <= 768;
      const maxWidth = isMobile ? "320px" : "380px";
      const iconSize = isMobile ? 24 : 32;
      
      // Pink Users icon SVG for collaboration details
      const collaborationIconSvg = '<svg width="' + iconSize + '" height="' + iconSize + '" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;"><path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke="#ff69b4" stroke-width="2"/><path d="M22 21V19C21.9993 18.1137 21.7044 17.2528 21.1614 16.5523C20.6184 15.8519 19.8581 15.3516 19 15.13" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="#ff69b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const titleFontSize = isMobile ? "14px" : "16px";
      const roleFontSize = isMobile ? "11px" : "12px";
      const linkFontSize = isMobile ? "11px" : "12px";
              const closeButtonSize = isMobile ? "20px" : "24px";
        const paddingRight = isMobile ? "25px" : "30px";
        const gap = isMobile ? "6px" : "8px";
        // Check if this is the main artist
        const mainArtistNode = finalDisplayData.nodes.find(node => node.size === 30 && node.type === 'artist');
        const isMainArtist = d === mainArtistNode;
        
        // Check if this node is an artist (has artist role)
        const isArtist = roles.includes('artist');
        
        // Check if this is a first-degree collaborator (directly connected to main artist)
        const firstDegreeIds = getFirstDegreeCollaborators();
        const isFirstDegreeCollaborator = firstDegreeIds.has(d.name);
        
        // Check if this node has been expanded
        const isExpanded = expandedNodes.has(d.name);
        
        // Build expand/shrink network section for ALL nodes (except main artist)
        const expandShrinkSection = !isMainArtist ? 
          (isExpanded ? 
            // Shrink button for expanded nodes
            '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="shrink-action">' +
              '<div class="shrink-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer; pointer-events: auto; display:flex; align-items:center; justify-content:center; background:#FF6B6B;">' +
                '<span style="color:white; font-size:16px; font-weight:bold;">−</span>' +
              '</div>' +
              '<a href="#" class="popup-action shrink-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">Shrink ' + d.name + '\'s network</a>' +
            '</div>' :
            // Expand button for non-expanded nodes
            '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="expand-action">' +
              '<div class="expand-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer; pointer-events: auto; display:flex; align-items:center; justify-content:center; background:#4CAF50;">' +
                '<span style="color:white; font-size:16px; font-weight:bold;">+</span>' +
              '</div>' +
              '<a href="#" class="popup-action expand-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">Expand ' + d.name + '\'s network</a>' +
            '</div>'
          ) : '';
        
        // Build collaboration details section conditionally
        const collaborationSection = isMainArtist ? '' : 
          '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="collaboration-action">' +
            '<div class="collaboration-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer; pointer-events: auto;">' + collaborationIconSvg + '</div>' +
            '<a href="#" class="popup-action collaboration-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">Collaboration details</a>' +
          '</div>';
        
        // Build Music Nerd profile section conditionally (only for artists)
        const musicNerdSection = isArtist ? 
          '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="artist-action">' +
            '<img src="' + artistIconPath + '" alt="Artist Page" class="artist-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer;" />' +
            '<a href="#" class="popup-action artist-page-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">' + d.name + '\'s Music Nerd profile</a>' +
          '</div>' : '';
        
        const content =  
        '<div style="position:relative; max-width:' + maxWidth + '; padding-right:' + paddingRight + ';">' +
          '<span class="tooltip-close" style="position:absolute; top:4px; right:6px; cursor:pointer; font-size:' + closeButtonSize + '; color:white;">&times;</span>' +
          '<div style="font-weight:bold; font-size:' + titleFontSize + '; line-height:1.2; text-align:left;">' + d.name + '</div>' +
          '<div style="margin-top:2px; font-size:' + roleFontSize + '; text-align:left;">Roles: ' + roleDisplay + '</div>' +
          '<div style="display:flex; flex-direction:column; gap:' + gap + '; margin-top:' + gap + ';">' +
            '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="network-action">' +
              '<img src="' + networkIconPath + '" alt="Network" class="network-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer;" />' +
              '<a href="#" class="popup-action network-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">' + d.name + '\'s network</a>' +
            '</div>' +
            expandShrinkSection +
            musicNerdSection +
            collaborationSection +
          '</div>' +
        '</div>';

      tooltip.html(content).style("opacity", 1).style("pointer-events", "auto");
      
      // Network handler
      const networkHandler = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        let artistId = d.artistId;
        
        // If no artist ID, try to look it up via the artist options API
        if (!artistId) {
          console.log(`🔗 No artistId for ${d.name}, attempting lookup...`);
          try {
            const response = await fetch(`/api/artist-options/${encodeURIComponent(d.name)}`);
            const data = await response.json();
            
            if (data.options && data.options.length > 0) {
              // Use the first matching artist's ID
              artistId = data.options[0].artistId || data.options[0].id;
              console.log(`🔗 Found artistId for ${d.name}: ${artistId}`);
            }
          } catch (error) {
            console.error(`🔗 Error looking up artist ID for ${d.name}:`, error);
          }
        }
        
        // Call the callback to load the artist's network within the app
        if (onArtistNodeClick) {
          console.log(`🔗 Loading ${d.name}'s network within the app`);
          onArtistNodeClick(d.name, artistId);
        } else {
          console.warn(`🔗 No onArtistNodeClick callback provided for ${d.name}`);
          alert(`Sorry, ${d.name} is not available in the network yet. They may be added in future updates!`);
        }
        
        // Hide the tooltip after clicking
        hideTooltip();
      };

      // Profile handler
      const profileHandler = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        openMusicNerdProfile(d.name, d.artistId);
      };

      // Collaboration details handler
      const collaborationHandler = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if this is the main artist or a collaborator
        const mainArtistNode = data.nodes.find(node => node.size === 30 && node.type === 'artist');
        const isMainArtist = d === mainArtistNode;
        
        if (isMainArtist) {
          // For main artist, show collaboration details with themselves (empty)
          setMainArtistName(d.name);
          setCollaborationArtist(d.name);
          setCollaborationCollaborator(d.name);
        } else {
          // For collaborators, find the direct connection to determine the relationship
          const mainArtistName = mainArtistNode?.name || "";
          
          // Check if the clicked node is directly connected to main artist (first layer)
          const isFirstLayer = finalDisplayData.links.some(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return (sourceId === mainArtistName && targetId === d.name) || 
                   (sourceId === d.name && targetId === mainArtistName);
          });
          
          if (isFirstLayer) {
            // First layer: clicked node is directly connected to main artist
            // Show collaboration between clicked node and main artist
            setCollaborationArtist(mainArtistName);
            setCollaborationCollaborator(d.name);
          } else {
            // Second layer: clicked node is not directly connected to main artist
            // Find the first layer node that this second layer node is connected to
            const directLink = finalDisplayData.links.find(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === d.name && targetId !== mainArtistName) || 
                     (targetId === d.name && sourceId !== mainArtistName);
            });
            
            if (directLink) {
              const connectedNodeId = directLink.source === d.name ? 
                (typeof directLink.target === 'string' ? directLink.target : directLink.target.id) :
                (typeof directLink.source === 'string' ? directLink.source : directLink.source.id);
              
              // Show collaboration between clicked node and their direct connection
              setCollaborationArtist(connectedNodeId);
              setCollaborationCollaborator(d.name);
            } else {
              // Fallback: direct connection to main artist
              setCollaborationArtist(mainArtistName);
              setCollaborationCollaborator(d.name);
            }
          }
        }
        
        setShowCollaborationPopup(true);
        hideTooltip();
      };

      // Expand network handler
      const expandHandler = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`🔗 [Handler] Expand button clicked for ${d.name}`);
        console.log(`🔗 [Handler] Artist ID:`, d.artistId);
        console.log(`🔗 [Handler] Is main artist:`, isMainArtist);
        
        await expandNodeNetwork(d.name, d.artistId);
        hideTooltip();
      };

      // Shrink network handler
      const shrinkHandler = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`🔗 Shrinking network for ${d.name}`);
        collapseNodeNetwork(d.name);
        hideTooltip();
      };

      // Attach event handlers
      tooltip.selectAll(".network-link, .network-icon, .network-action").on("click", networkHandler);
      
      // Only attach expand/shrink handlers if section exists (all nodes except main artist)
      console.log(`🔗 [Tooltip] Setting up handlers - isMainArtist: ${isMainArtist}, isExpanded: ${isExpanded}`);
      
      if (!isMainArtist) {
        if (isExpanded) {
          // Attach shrink handler for expanded nodes
          console.log(`🔗 [Tooltip] Attaching shrink handler for ${d.name}`);
          tooltip.selectAll(".shrink-link, .shrink-icon, .shrink-action").on("click", shrinkHandler);
        } else {
          // Attach expand handler for non-expanded nodes
          console.log(`🔗 [Tooltip] Attaching expand handler for ${d.name}`);
          tooltip.selectAll(".expand-link, .expand-icon, .expand-action").on("click", expandHandler);
        }
      } else {
        console.log(`🔗 [Tooltip] Not attaching expand/shrink handlers - is main artist`);
      }
      
      // Only attach Music Nerd profile handler if profile section exists (only for artists)
      if (isArtist) {
        tooltip.selectAll(".artist-page-link, .artist-icon, .artist-action").on("click", profileHandler);
      }
      
      // Only attach collaboration handler if collaboration section exists (not for main artist)
      if (!isMainArtist) {
        tooltip.selectAll(".collaboration-link, .collaboration-icon, .collaboration-action").on("click", collaborationHandler);
      }

      // Close button handler
      tooltip.select(".tooltip-close").on("click", () => {
        hideTooltip();
      });
    }

    // Helper to position tooltip next to a node element
    function positionTooltipNearNode(nodeEl: SVGGElement) {
      const rect = nodeEl.getBoundingClientRect();
      const pageX = rect.right + 12; // 12px to the right of node
      const pageY = rect.top + window.scrollY - 10; // align vertically

      tooltip
        .style("left", pageX + "px")
        .style("top", pageY + "px");
    }

    function moveTooltip(event: MouseEvent) {
      const isMobile = window.innerWidth <= 768;
      const tooltipNode = tooltip.node() as HTMLElement;
      
      if (!tooltipNode) return;
      
      // Get tooltip dimensions (need to be visible first to measure)
      const rect = tooltipNode.getBoundingClientRect();
      const tooltipWidth = rect.width || 280; // fallback width
      const tooltipHeight = rect.height || 150; // fallback height
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let left = event.pageX + 10;
      let top = event.pageY - 10;
      
      // Adjust for mobile - center the tooltip more and avoid edges
      if (isMobile) {
        // On mobile, try to center the tooltip horizontally
        left = Math.max(10, Math.min(viewportWidth - tooltipWidth - 10, event.pageX - tooltipWidth / 2));
        
        // On mobile, position tooltip above the click point if there's space, otherwise below
        if (event.pageY - tooltipHeight - 20 > 0) {
          top = event.pageY - tooltipHeight - 20; // Above the click point
        } else {
          top = event.pageY + 20; // Below the click point
        }
      } else {
        // Desktop positioning with boundary checks
        if (left + tooltipWidth > viewportWidth - 10) {
          left = event.pageX - tooltipWidth - 10; // Position to the left instead
        }
        
        if (top + tooltipHeight > viewportHeight - 10) {
          top = event.pageY - tooltipHeight - 10; // Position above instead
        }
      }
      
      // Final boundary checks
      left = Math.max(10, Math.min(viewportWidth - tooltipWidth - 10, left));
      top = Math.max(10, Math.min(viewportHeight - tooltipHeight - 10, top));
      
      tooltip
        .style("left", left + "px")
        .style("top", top + "px");
    }

    function resetNodeHighlight() {
      if (currentlyHighlightedNode) {
        const nodeData = currentlyHighlightedNode.datum() as NetworkNode;
        const roles = nodeData.types || [nodeData.type];
        
        // Reset to original styling
        if (roles.length === 1) {
          // Single role - reset to original stroke color and width
          currentlyHighlightedNode.selectAll("circle")
            .attr("stroke", () => {
              if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
              if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
              if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
              return '#355367';  // Police Blue
            })
            .attr("stroke-width", 4);
        } else {
          // Multiple roles - reset path strokes and inner circle
          currentlyHighlightedNode.selectAll("path")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
          
          currentlyHighlightedNode.selectAll("circle")
            .attr("stroke", "white")
            .attr("stroke-width", 2);
        }
        
        currentlyHighlightedNode = null;
      }
    }

    function hideTooltip() {
      tooltip.style("opacity", 0).style("pointer-events", "none");
      resetNodeHighlight();
    }

      async function openMusicNerdProfile(artistName: string, artistId?: string | null) {
      console.log(`🎵 [Frontend] openMusicNerdProfile called for "${artistName}" with artistId: ${artistId}`);
      
      // If no specific artist ID provided, check for multiple options
      if (!artistId) {
        console.log(`🎵 [Frontend] No artistId provided, checking for multiple options`);
        
        try {
          const response = await fetch(`/api/artist-options/${encodeURIComponent(artistName)}`);
          const data = await response.json();
          
          if (data.options && data.options.length > 1) {
            // Multiple artists found - show selection modal
            console.log(`🎵 Multiple artists found for "${artistName}", showing selection modal`);
            setSelectedArtistName(artistName);
            setShowArtistModal(true);
            return;
          } else if (data.options && data.options.length === 1) {
            // Single artist found - use its ID
            artistId = data.options[0].artistId || data.options[0].id;
            console.log(`🎵 Single artist found for "${artistName}": ${artistId}`);
          }
        } catch (error) {
          console.error(`Error fetching artist options for "${artistName}":`, error);
        }
      } else {
        console.log(`🎵 [Frontend] artistId provided (${artistId}), skipping lookup and going directly to page`);
      }
      
      // Always fetch the current base URL to ensure we have the latest configuration
      let baseUrl;
      try {
        console.log('🔧 [Config] Fetching current base URL from /api/config...');
        const configResponse = await fetch('/api/config');
        if (configResponse.ok) {
          const config = await configResponse.json();
          baseUrl = config.musicNerdBaseUrl;
          console.log(`🔧 [Config] Retrieved base URL: ${baseUrl}`);
          
          // Update state for consistency
          if (baseUrl !== musicNerdBaseUrl) {
            setMusicNerdBaseUrl(baseUrl);
          }
        } else {
          console.error('🔧 [Config] Failed to fetch config, status:', configResponse.status);
        }
      } catch (error) {
        console.error('🔧 [Config] Error fetching config:', error);
      }
      
      if (!baseUrl) {
        console.error(`🎵 Cannot open MusicNerd profile for "${artistName}": Base URL not configured`);
        return;
      }
      
      // Use artist ID if available, otherwise go to main page
      let musicNerdUrl = baseUrl;
      
      if (artistId) {
        musicNerdUrl = `${baseUrl}/artist/${artistId}`;
        console.log(`🎵 Opening MusicNerd artist page for "${artistName}": ${musicNerdUrl}`);
      } else {
        console.log(`🎵 No artist ID found for "${artistName}", opening main MusicNerd page`);
      }
      
      // Try multiple approaches to open the link
      try {
        // Method 1: window.open (most reliable for user-initiated actions)
        const newWindow = window.open(musicNerdUrl, '_blank', 'noopener,noreferrer');
        
        // Method 2: Fallback to link click if window.open fails
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          console.log('🎵 Window.open blocked, trying link click method...');
          const link = document.createElement('a');
          link.href = musicNerdUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          
          // Append to body, click, and remove
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          console.log('🎵 Successfully opened new window');
        }
      } catch (error) {
        console.error('🎵 Error opening MusicNerd page:', error);
        // Final fallback: copy URL to clipboard and notify user
        if (navigator.clipboard) {
          navigator.clipboard.writeText(musicNerdUrl).then(() => {
            alert(`Unable to open page automatically. URL copied to clipboard: ${musicNerdUrl}`);
          }).catch(() => {
            alert(`Please visit: ${musicNerdUrl}`);
          });
        } else {
          alert(`Please visit: ${musicNerdUrl}`);
        }
      }
    }
    function dragstarted(event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

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
      tooltip.remove();
      simulation.stop();
      cleanup();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
      }, [finalDisplayData, visible, onZoomChange, expandedNodes, fullNetworkData]);

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

  // SVG viewBox zoom function (working implementation)
  const applyZoom = (scale: number) => {
    if (!svgRef.current) return;
    
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    // Calculate new viewBox dimensions
    const newWidth = width / scale;
    const newHeight = height / scale;
    const offsetX = (width - newWidth) / 2;
    const offsetY = (height - newHeight) / 2;
    
    // Apply smooth transition
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(200)
      .attrTween('viewBox', () => {
        const currentViewBox = svgRef.current?.getAttribute('viewBox') || `0 0 ${width} ${height}`;
        const [cx, cy, cw, ch] = currentViewBox.split(' ').map(Number);
        const interpolator = d3.interpolate([cx, cy, cw, ch], [offsetX, offsetY, newWidth, newHeight]);
        return (t: number) => {
          const [x, y, w, h] = interpolator(t);
          return `${x} ${y} ${w} ${h}`;
        };
      });
  };

  // Handle zoom button clicks
  const handleZoomIn = () => {
    const newZoom = Math.min(5, currentZoom * 1.2); // Cap at 5x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.2, currentZoom / 1.2); // Min 0.2x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  };

  const handleZoomReset = () => {
    if (!svgRef.current) return;
    
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    // Reset to default viewBox (centered, 1x zoom)
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .attr('viewBox', `0 0 ${width} ${height}`);
    
    setCurrentZoom(1);
    console.log('Zoom and position reset to center');
  };

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
      {fullNetworkData && (
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
      
      {/* Loading screen for expand network functionality */}
      <ExpandNetworkLoading 
        isVisible={isExpandingNetwork} 
        artistName={expandingArtistName}
      />
    </div>
  );
}

