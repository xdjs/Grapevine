import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import ArtistSelectionModal from "./artist-selection-modal";
import { ensureArtistProfilePictures } from "@/lib/profile-pictures";
import CollaborationDetailsPopup from "./collaboration-details-popup";
import { fetchNetworkData, fetchNetworkDataById } from "@/lib/network-data";
import { Loader2, Network, Brain, Users } from "lucide-react";

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
  
  // Track if we have expanded data to prevent unwanted resets
  const hasExpandedDataRef = useRef<boolean>(false);
  
  const [currentZoom, setCurrentZoom] = useState(1);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState("");
  const [dataWithPictures, setDataWithPictures] = useState<NetworkData | null>(null);

  // Add missing state variables for expand network functionality
  const [isExpandedMode, setIsExpandedMode] = useState(false);
  const [originalNetworkData, setOriginalNetworkData] = useState<NetworkData | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Track specific additions per node expansion for shrinking
  const [nodeExpansions, setNodeExpansions] = useState<Map<string, {
    addedNodes: NetworkNode[];
    addedLinks: NetworkLink[];
  }>>(new Map());
  
  // Add missing state variables for collaboration popup
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(false);
  const [collaborationArtist, setCollaborationArtist] = useState("");
  const [collaborationCollaborator, setCollaborationCollaborator] = useState("");
  const [mainArtistName, setMainArtistName] = useState("");
  
  // Loading state for network expansion
  const [isExpandingNetwork, setIsExpandingNetwork] = useState(false);
  const [expandingNodeName, setExpandingNodeName] = useState("");

  // Store the main artist node for easy access
  const mainArtistNode = dataWithPictures?.nodes.find(node => node.size === 30 && node.type === 'artist') || null;

  // Function to filter network data to only show first-degree collaborators
  const filterToFirstDegreeOnly = (networkData: NetworkData): NetworkData => {
    if (!networkData.nodes.length) return networkData;
    
    // Find the main artist (largest artist node)
    const mainArtist = networkData.nodes
      .filter(node => node.type === 'artist' || (node.types && node.types.includes('artist')))
      .reduce((largest, current) => 
        !largest || current.size > largest.size ? current : largest, 
        null as NetworkNode | null
      );
    
    if (!mainArtist) return networkData;
    
    console.log(`🔗 Filtering network to show only first-degree collaborators of ${mainArtist.name}`);
    
    // Get all nodes directly connected to the main artist
    const firstDegreeNodeIds = new Set<string>();
    firstDegreeNodeIds.add(mainArtist.id); // Always include the main artist
    
    networkData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === mainArtist.id) {
        firstDegreeNodeIds.add(targetId);
      } else if (targetId === mainArtist.id) {
        firstDegreeNodeIds.add(sourceId);
      }
    });
    
    // Filter nodes to only include first-degree collaborators
    const filteredNodes = networkData.nodes.filter(node => firstDegreeNodeIds.has(node.id));
    
    // Filter links to only include those between first-degree nodes
    const filteredLinks = networkData.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return firstDegreeNodeIds.has(sourceId) && firstDegreeNodeIds.has(targetId);
    });
    
    const originalNodeCount = networkData.nodes.length;
    const filteredNodeCount = filteredNodes.length;
    const originalLinkCount = networkData.links.length;
    const filteredLinkCount = filteredLinks.length;
    
    console.log(`🔗 Filtered network: ${originalNodeCount} → ${filteredNodeCount} nodes, ${originalLinkCount} → ${filteredLinkCount} links`);
    
    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  };

  // Store original data when first loaded (filtered to first-degree only)
  useEffect(() => {
    if (data && !originalNetworkData && !isExpandedMode) {
      // Store the filtered first-degree data as the "original" state
      const firstDegreeData = filterToFirstDegreeOnly(data);
      setOriginalNetworkData(firstDegreeData);
      console.log(`🔗 Stored original first-degree network with ${firstDegreeData.nodes.length} nodes`);
    }
  }, [data, originalNetworkData, isExpandedMode]);

  // Function to get first-degree collaborators (directly connected to main artist)
  const getFirstDegreeCollaborators = (): Set<string> => {
    if (!dataWithPictures || !mainArtistNode) return new Set();
    
    const firstDegreeIds = new Set<string>();
    dataWithPictures.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      // Compare with mainArtistNode.id instead of mainArtistNode.name
      if (sourceId === mainArtistNode.id) {
        firstDegreeIds.add(targetId);
      } else if (targetId === mainArtistNode.id) {
        firstDegreeIds.add(sourceId);
      }
    });
    
    return firstDegreeIds;
  };

  // Function to generate AI-powered network for any collaborator (not just main artists)
  const generateCollaboratorNetwork = async (collaboratorName: string, collaboratorRoles: string[]): Promise<NetworkData | null> => {
    console.log(`🤖 Generating AI network for ${collaboratorName} with roles: [${collaboratorRoles.join(', ')}]`);
    
    try {
      // Create a direct OpenAI request to generate the collaborator's network
      const response = await fetch('/api/network/generate-collaborator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collaboratorName,
          collaboratorRoles,
        }),
      });

      if (!response.ok) {
        console.error(`🤖 Failed to generate network for ${collaboratorName}: ${response.status}`);
        return null;
      }

      const networkData = await response.json();
      console.log(`🤖✅ Successfully generated AI network for ${collaboratorName} with ${networkData.nodes?.length || 0} nodes`);
      
      return networkData;
    } catch (error) {
      console.error(`🤖❌ Error generating AI network for ${collaboratorName}:`, error);
      return null;
    }
  };

  // Function to expand a specific node's network
  const expandNodeNetwork = async (nodeId: string, nodeName: string, nodeArtistId?: string): Promise<void> => {
    console.log(`🔗 Starting expand network for ${nodeName} (ID: ${nodeId}, Artist ID: ${nodeArtistId})`);
    
    // Set loading state
    setIsExpandingNetwork(true);
    setExpandingNodeName(nodeName);
    

    
    try {
      // Check if this node is already expanded
      if (expandedNodes.has(nodeId)) {
        console.log(`🔗 ${nodeName} is already expanded, skipping`);
        setIsExpandingNetwork(false);
        setExpandingNodeName("");
        return;
      }

      // Get the clicked node to determine its role
      const clickedNode = dataWithPictures?.nodes.find(n => n.id === nodeId);
      if (!clickedNode || !dataWithPictures) {
        console.warn(`🔗 Could not find clicked node ${nodeName}`);
        return;
      }

      // For any collaborator, try to generate their network using OpenAI
      let nodeNetworkData: NetworkData | null = null;
      
      try {
        if (nodeArtistId) {
          // If we have an artist ID, use the by-ID endpoint
          console.log(`🔍 Fetching network for ${nodeName} using artist ID: ${nodeArtistId}`);
          nodeNetworkData = await fetchNetworkDataById(nodeArtistId);
        } else {
          // For any collaborator (artist, producer, songwriter), try to generate their network
          console.log(`🔍 Generating AI-powered network for ${nodeName}...`);
          
          try {
            // First check if they exist as a main artist (preferred method)
            const response = await fetch(`/api/artist-options/${encodeURIComponent(nodeName)}`);
            const data = await response.json();
            
            if (data.options && data.options.length > 0) {
              // Found as main artist - use official network endpoint
              console.log(`✅ ${nodeName} found as main artist, fetching official network...`);
              nodeNetworkData = await fetchNetworkData(nodeName);
            } else {
              // Not a main artist - generate network using direct OpenAI call
              console.log(`🤖 ${nodeName} not in main database, generating collaborator network using AI...`);
              nodeNetworkData = await generateCollaboratorNetwork(nodeName, clickedNodeRoles);
            }
          } catch (checkError) {
            console.warn(`🔍 Error during ${nodeName} network generation:`, checkError);
            // Fallback: try direct network fetch
            try {
              nodeNetworkData = await fetchNetworkData(nodeName);
            } catch (fallbackError) {
              console.log(`🤖 Fallback failed, generating AI network for ${nodeName}...`);
              nodeNetworkData = await generateCollaboratorNetwork(nodeName, clickedNodeRoles);
            }
          }
        }
      } catch (fetchError) {
        console.error(`🔗 Error generating network data for ${nodeName}:`, fetchError);
        alert(`Failed to generate ${nodeName}'s network. Please try again later.`);
        return;
      }

      if (!nodeNetworkData) {
        console.warn(`🔗 No network data could be generated for ${nodeName}`);
        alert(`Unable to generate ${nodeName}'s network at this time.`);
        return;
      }

      // Determine target roles based on clicked node's role
      const clickedNodeRoles = clickedNode.types || [clickedNode.type];
      const isClickedArtist = clickedNodeRoles.includes('artist');
      
      let targetRoles: string[];
      if (isClickedArtist) {
        // If clicked node is an artist, get their songwriters/producers
        targetRoles = ['songwriter', 'producer'];
      } else {
        // If clicked node is songwriter/producer, get their artist collaborators
        targetRoles = ['artist'];
      }

      console.log(`🔗 Clicked node roles: [${clickedNodeRoles.join(', ')}], targeting: [${targetRoles.join(', ')}]`);

      // Filter existing nodes and links to prevent duplicates
      const existingNodeIds = new Set(dataWithPictures.nodes.map(n => n.id));
      const existingLinkIds = new Set(dataWithPictures.links.map(l => `${typeof l.source === 'string' ? l.source : l.source.id}-${typeof l.target === 'string' ? l.target : l.target.id}`));

      // Filter new nodes by target roles and exclude duplicates
      const candidateNodes = nodeNetworkData.nodes.filter(node => {
        // Skip if node already exists in our current network
        if (existingNodeIds.has(node.id)) return false;
        
        // Skip the clicked node itself (it might be included in fetched data)
        if (node.id === nodeId) return false;
        
        // Check if node has any of the target roles
        const nodeRoles = node.types || [node.type];
        return nodeRoles.some(role => targetRoles.includes(role));
      });

      // Further filter to only include nodes that are directly connected to the clicked node
      // This prevents adding nodes that might appear to expand other existing nodes
      const directlyConnectedCandidates = candidateNodes.filter(candidate => {
        return nodeNetworkData.links.some(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          // Check if this candidate is directly connected to the clicked node
          return (sourceId === nodeId && targetId === candidate.id) || 
                 (targetId === nodeId && sourceId === candidate.id);
        });
      });

      console.log(`🔗 Filtered ${candidateNodes.length} candidates to ${directlyConnectedCandidates.length} directly connected to ${nodeName}`);

      // Limit to 3 nodes, prioritizing by size (larger nodes first, likely more important collaborators)
      const selectedNodes = directlyConnectedCandidates
        .sort((a, b) => b.size - a.size)
        .slice(0, 3);

      console.log(`🔗 Found ${candidateNodes.length} role-filtered candidates, ${directlyConnectedCandidates.length} directly connected, selected ${selectedNodes.length} for ${nodeName}`);

      if (selectedNodes.length === 0) {
        console.log(`🔗 No new ${targetRoles.join('/')} collaborators found for ${nodeName}`);
        return;
      }

      // Log which specific nodes are being added
      const selectedNodeNames = selectedNodes.map(n => n.name).join(', ');
      console.log(`🔗 Adding collaborators to ${nodeName}: ${selectedNodeNames}`);

      // Get the IDs of selected nodes for link filtering
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));

      // Filter links to ONLY include direct connections between the clicked node and newly selected nodes
      const newLinks = nodeNetworkData.links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        // Only include links that directly connect the clicked node to one of the selected nodes
        const isDirectConnectionToClicked = (sourceId === nodeId && selectedNodeIds.has(targetId)) || 
                                           (targetId === nodeId && selectedNodeIds.has(sourceId));
        
        // Skip if link already exists
        const linkId = `${sourceId}-${targetId}`;
        const reverseLinkId = `${targetId}-${sourceId}`;
        const linkExists = existingLinkIds.has(linkId) || existingLinkIds.has(reverseLinkId);
        
        return isDirectConnectionToClicked && !linkExists;
      });

      console.log(`🔗 Adding ${newLinks.length} direct connections between ${nodeName} and selected collaborators`);

      // Mark this node as expanded
      setExpandedNodes(prev => new Set([...prev, nodeId]));
      setIsExpandedMode(true);
      hasExpandedDataRef.current = true;

      // Track what was added for this specific node expansion (use nodeId for tracking)
      setNodeExpansions(prev => {
        const newMap = new Map(prev);
        newMap.set(nodeId, {
          addedNodes: selectedNodes,
          addedLinks: newLinks
        });
        return newMap;
      });

      // Create the expanded network data
      const expandedData: NetworkData = {
        nodes: [...dataWithPictures.nodes, ...selectedNodes],
        links: [...dataWithPictures.links, ...newLinks]
      };

      // Update the data with profile pictures
      const updatedData = await ensureArtistProfilePictures(expandedData);
      setDataWithPictures(updatedData);

      const roleDescription = isClickedArtist ? 'songwriter/producer' : 'artist';
      console.log(`🔗 Successfully expanded ${nodeName}'s network with ${selectedNodes.length} ${roleDescription} collaborators and ${newLinks.length} links`);
    } catch (error) {
      console.error(`🔗 Error expanding network for ${nodeName}:`, error);
    } finally {
      // Clear loading state
      setIsExpandingNetwork(false);
      setExpandingNodeName("");
    }
  };

  // Function to shrink a specific node's network
  const shrinkNodeNetwork = (nodeId: string): void => {
    // Find the node to get its name for logging
    const node = dataWithPictures?.nodes.find(n => n.id === nodeId);
    const nodeName = node?.name || nodeId;
    
    console.log(`🔗 Starting shrink network for ${nodeName} (ID: ${nodeId})`);
    
    try {
      // Get the expansion data for this node
      const expansion = nodeExpansions.get(nodeId);
      if (!expansion || !dataWithPictures) {
        console.warn(`🔗 No expansion data found for ${nodeName}`);
        return;
      }

      // Get IDs of nodes and links to remove
      const nodeIdsToRemove = new Set(expansion.addedNodes.map(n => n.id));
      const linkIdsToRemove = new Set(expansion.addedLinks.map(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
        const targetId = typeof l.target === 'string' ? l.target : l.target.id;
        return `${sourceId}-${targetId}`;
      }));

      // Filter out the nodes and links that were added by this expansion
      const filteredNodes = dataWithPictures.nodes.filter(node => !nodeIdsToRemove.has(node.id));
      const filteredLinks = dataWithPictures.links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const linkId = `${sourceId}-${targetId}`;
        const reverseLinkId = `${targetId}-${sourceId}`;
        return !linkIdsToRemove.has(linkId) && !linkIdsToRemove.has(reverseLinkId);
      });

      // Update the network data
      const shrunkData: NetworkData = {
        nodes: filteredNodes,
        links: filteredLinks
      };

      setDataWithPictures(shrunkData);

      // Remove this node from expanded tracking
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });

      // Remove the expansion tracking data
      setNodeExpansions(prev => {
        const newMap = new Map(prev);
        newMap.delete(nodeId);
        return newMap;
      });

      // Check if any nodes are still expanded
      const stillExpanded = expandedNodes.size > 1; // Will be > 1 because we haven't updated expandedNodes yet
      if (!stillExpanded) {
        setIsExpandedMode(false);
        hasExpandedDataRef.current = false;
      }

      console.log(`🔗 Successfully shrunk ${nodeName}'s network. Removed ${expansion.addedNodes.length} nodes and ${expansion.addedLinks.length} links`);
    } catch (error) {
      console.error(`🔗 Error shrinking network for ${nodeName}:`, error);
    }
  };

  // Function to reset to first degree collaborators only
  const resetToFirstDegree = async (): Promise<void> => {
    console.log(`🔗 Resetting to first degree network`);
    
    if (originalNetworkData) {
      try {
        // Ensure profile pictures are available for the reset data
        const updatedOriginalData = await ensureArtistProfilePictures(originalNetworkData);
        setDataWithPictures(updatedOriginalData);
        setIsExpandedMode(false);
        setExpandedNodes(new Set());
        setNodeExpansions(new Map());
        hasExpandedDataRef.current = false;
        console.log(`🔗 Reset to original first-degree network with ${originalNetworkData.nodes.length} nodes`);
      } catch (error) {
        console.error(`🔗 Error resetting network:`, error);
        // Fallback to original data without profile pictures
        setDataWithPictures(originalNetworkData);
        setIsExpandedMode(false);
        setExpandedNodes(new Set());
        setNodeExpansions(new Map());
        hasExpandedDataRef.current = false;
      }
    }
  };

  // Only process initial data when the original data prop changes (not on visibility changes)
  useEffect(() => {
    if (!data) {
      setDataWithPictures(null);
      return;
    }

    // Only process if we don't already have expanded data or if this is genuinely new data
    if ((isExpandedMode || hasExpandedDataRef.current) && dataWithPictures) {
      console.log(`🖼️ [NetworkVisualizer] Skipping data processing - expanded mode active with existing data`);
      return;
    }

    console.log(`🖼️ [NetworkVisualizer] Processing initial network data...`);
    
    const processData = async () => {
      try {
        // Only filter to first-degree on initial load, not when expanding
        const processedData = filterToFirstDegreeOnly(data);
        
        // Then ensure profile pictures are available
        const updatedData = await ensureArtistProfilePictures(processedData);
        setDataWithPictures(updatedData);
        console.log(`🖼️ [NetworkVisualizer] Initial network data processed and profile pictures ensured`);
      } catch (error) {
        console.error(`🖼️ [NetworkVisualizer] Error processing network data:`, error);
        // Use filtered data without profile pictures if profile picture fetching fails
        const fallbackData = filterToFirstDegreeOnly(data);
        setDataWithPictures(fallbackData);
      }
    };

    processData();
  }, [data]); // Only depend on data, not visibility

  // Separate effect to handle visibility without affecting data
  useEffect(() => {
    if (!visible) {
      // Don't clear data when becoming invisible - just hide the visualization
      console.log(`🖼️ [NetworkVisualizer] Component hidden, preserving expanded network data`);
    } else if (dataWithPictures) {
      console.log(`🖼️ [NetworkVisualizer] Component visible, using preserved network data with ${dataWithPictures.nodes.length} nodes`);
    }
  }, [visible, dataWithPictures]);

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
    // Use dataWithPictures instead of data to ensure profile pictures are included
    const networkData = dataWithPictures;
    if (!svgRef.current || !networkData || !visible) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    
    // Use container dimensions instead of window dimensions to avoid browser UI areas
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;

    // Clear existing content
    svg.selectAll("*").remove();

    // Filter out links where either node doesn't exist or is isolated
    const nodeSet = new Set(networkData.nodes.map(n => n.id));
    const validLinks = networkData.links.filter(link => {
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
      
      for (const node of networkData.nodes) {
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
              const target = networkData.nodes.find(n => n.id === targetId);
              if (target && !visited.has(target.id)) queue.push(target);
            } else if (targetId === current.id) {
              const source = networkData.nodes.find(n => n.id === sourceId);
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
    const mainArtistNode = networkData.nodes
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
      
      for (const node of networkData.nodes) {
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
      .forceSimulation<NetworkNode>(networkData.nodes)
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
      .data(networkData.nodes)
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
        const circle = group.append("circle")
          .attr("r", d.size)
          .attr("fill", "transparent")
          .attr("stroke", () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr("stroke-width", 4);

        // Add profile picture if available (for any artist node)
        if (d.imageUrl) {
          console.log(`🖼️ [D3] Rendering profile image for ${d.name} (size: ${d.size}): ${d.imageUrl}`);
          
          // Create a circular clipping path using D3
          const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9]/g, '')}`;
          const svg = d3.select(svgRef.current);
          
          // Ensure defs exists
          if (svg.select("defs").empty()) {
            svg.insert("defs", ":first-child");
          }
          
          // Remove existing clipPath if it exists
          svg.select("defs").select(`#${clipId}`).remove();
          
          // Create new clipPath with properly centered circle
          // Adjust clipping radius based on node size for better visual balance
          const clipRadius = d.size >= 25 ? d.size - 4 : d.size - 3;
          svg.select("defs").append("clipPath")
            .attr("id", clipId)
            .append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", clipRadius);

          // Add the profile image with error handling
          const imageSize = d.size >= 25 ? d.size - 4 : d.size - 3;
          group.append("image")
            .attr("href", d.imageUrl)
            .attr("x", -imageSize)
            .attr("y", -imageSize)
            .attr("width", imageSize * 2)
            .attr("height", imageSize * 2)
            .attr("clip-path", `url(#${clipId})`)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .style("pointer-events", "none") // Prevent image from interfering with node events
            .on("load", function() {
              console.log(`🖼️✅ [D3] Image loaded successfully for ${d.name} (size: ${d.size})`);
            })
            .on("error", function() {
              console.warn(`🖼️❌ [D3] Image failed to load for ${d.name}: ${d.imageUrl}`);
              // Remove the failed image
              d3.select(this).remove();
            });
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

        // Add profile picture if available (for main artist with multiple roles)
        if (d.imageUrl) {
          console.log(`🖼️ [D3] Rendering multi-role profile image for ${d.name} (size: ${d.size}): ${d.imageUrl}`);
          
          // Create a circular clipping path using D3
          const clipId = `clip-multi-${d.id.replace(/[^a-zA-Z0-9]/g, '')}`;
          const svg = d3.select(svgRef.current);
          
          // Ensure defs exists
          if (svg.select("defs").empty()) {
            svg.insert("defs", ":first-child");
          }
          
          // Remove existing clipPath if it exists
          svg.select("defs").select(`#${clipId}`).remove();
          
          // Create new clipPath with properly centered circle (smaller for multi-role)
          // Adjust clipping radius based on node size, accounting for the outer role rings
          const clipRadius = d.size >= 25 ? d.size - 8 : d.size - 6;
          svg.select("defs").append("clipPath")
            .attr("id", clipId)
            .append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", clipRadius);

          // Add the profile image with error handling
          const imageSize = d.size >= 25 ? d.size - 8 : d.size - 6;
          group.append("image")
            .attr("href", d.imageUrl)
            .attr("x", -imageSize)
            .attr("y", -imageSize)
            .attr("width", imageSize * 2)
            .attr("height", imageSize * 2)
            .attr("clip-path", `url(#${clipId})`)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .style("pointer-events", "none") // Prevent image from interfering with node events
            .on("load", function() {
              console.log(`🖼️✅ [D3] Multi-role image loaded successfully for ${d.name} (size: ${d.size})`);
            })
            .on("error", function() {
              console.warn(`🖼️❌ [D3] Multi-role image failed to load for ${d.name}: ${d.imageUrl}`);
              // Remove the failed image
              d3.select(this).remove();
            });
        }
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
          const currentMainArtistName = mainArtistNode?.name || "";
          setMainArtistName(currentMainArtistName);
          
          // Check if the clicked node is directly connected to main artist (first layer)
          const isFirstLayer = dataWithPictures?.links.some(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return (sourceId === currentMainArtistName && targetId === d.name) || 
                   (sourceId === d.name && targetId === currentMainArtistName);
          });
          
          if (isFirstLayer) {
            // First layer: clicked node is directly connected to main artist
            // Show collaboration between clicked node and main artist
            setCollaborationArtist(currentMainArtistName);
            setCollaborationCollaborator(d.name);
          } else {
            // Second layer: clicked node is not directly connected to main artist
            // Find the first layer node that this second layer node is connected to
            const directLink = dataWithPictures?.links.find(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === d.name && targetId !== currentMainArtistName) || 
                     (targetId === d.name && sourceId !== currentMainArtistName);
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
              setCollaborationArtist(currentMainArtistName);
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
      .data(networkData.nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => {
        // If node has a profile picture, position text below the border
        if (d.imageUrl) {
          // Adjust spacing based on node size for better visual balance
          const spacing = d.size >= 25 ? 15 : d.size >= 20 ? 12 : 10;
          return `${d.size + spacing}px`; // Position below the node border
        }
        return "0.35em"; // Default center positioning
      })
      .attr("font-size", (d) => {
        // Scale font size based on node type and size
        if (d.type === 'artist' || (d.types && d.types.includes('artist'))) {
          // Artist nodes: larger font for larger nodes
          if (d.size >= 25) return "14px";      // Main artists
          if (d.size >= 20) return "12px";      // Medium artists  
          return "11px";                        // Smaller artists
        }
        return "10px"; // Non-artist nodes
      })
      .attr("font-weight", (d) => {
        // Bold for artists, normal for others
        if (d.type === 'artist' || (d.types && d.types.includes('artist'))) {
          return d.size >= 25 ? "600" : "500";  // Extra bold for main artists
        }
        return "400"; // Normal weight for non-artists
      })
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
        const currentMainArtistNode = dataWithPictures?.nodes.find(node => node.size === 30 && node.type === 'artist');
        const isMainArtist = d === currentMainArtistNode;
        
        // Check if this node is an artist (has artist role)
        const isArtist = roles.includes('artist');
        
        // Check if this is a first-degree collaborator (directly connected to main artist)
        // Note: This is now only used for display purposes, not for expansion restrictions
        const firstDegreeIds = getFirstDegreeCollaborators();
        const isFirstDegreeCollaborator = firstDegreeIds.has(d.id);
        
        // Check if this node has been expanded
        const isNodeExpanded = expandedNodes.has(d.id);
        
        // Build expand/shrink network section for ANY collaborator (not just first-degree)
        const expandShrinkSection = !isMainArtist ? 
          (isNodeExpanded ? 
            // Show shrink button if node is expanded
            '<div style="display:flex; align-items:center; gap:' + gap + '; cursor:pointer;" class="shrink-action">' +
              '<div class="shrink-icon" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:50%; cursor:pointer; pointer-events: auto; display:flex; align-items:center; justify-content:center; background:#f44336;">' +
                '<span style="color:white; font-size:16px; font-weight:bold;">−</span>' +
              '</div>' +
              '<a href="#" class="popup-action shrink-link" style="font-size:' + linkFontSize + '; font-style:italic; text-decoration:underline; cursor:pointer; white-space:nowrap;">Shrink ' + d.name + '\'s network</a>' +
            '</div>' :
            // Show expand button if node is not expanded
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
        const collaborationMainArtistNode = dataWithPictures?.nodes.find(node => node.size === 30 && node.type === 'artist');
        const isMainArtist = d === collaborationMainArtistNode;
        
        if (isMainArtist) {
          // For main artist, show collaboration details with themselves (empty)
          setMainArtistName(d.name);
          setCollaborationArtist(d.name);
          setCollaborationCollaborator(d.name);
        } else {
          // For collaborators, find the direct connection to determine the relationship
          const collaborationMainArtistName = collaborationMainArtistNode?.name || "";
          
          // Check if the clicked node is directly connected to main artist (first layer)
          const isFirstLayer = dataWithPictures?.links.some(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return (sourceId === collaborationMainArtistName && targetId === d.name) || 
                   (sourceId === d.name && targetId === collaborationMainArtistName);
          });
          
          if (isFirstLayer) {
            // First layer: clicked node is directly connected to main artist
            // Show collaboration between clicked node and main artist
            setCollaborationArtist(collaborationMainArtistName);
            setCollaborationCollaborator(d.name);
          } else {
            // Second layer: clicked node is not directly connected to main artist
            // Find the first layer node that this second layer node is connected to
            const directLink = dataWithPictures?.links.find(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === d.name && targetId !== collaborationMainArtistName) || 
                     (targetId === d.name && sourceId !== collaborationMainArtistName);
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
              setCollaborationArtist(collaborationMainArtistName);
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
        
        // Close tooltip immediately when expansion starts
        hideTooltip();
        
        console.log(`🔗 Expanding network for ${d.name} (ID: ${d.id})`);
        await expandNodeNetwork(d.id, d.name, d.artistId);
      };

      // Shrink network handler
      const shrinkHandler = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`🔗 Shrinking network for ${d.name} (ID: ${d.id})`);
        shrinkNodeNetwork(d.id);
        hideTooltip();
      };

      // Attach event handlers
      tooltip.selectAll(".network-link, .network-icon, .network-action").on("click", networkHandler);
      
      // Attach expand/shrink handlers for ANY collaborator (not just first-degree)
      if (!isMainArtist) {
        if (isNodeExpanded) {
          // Attach shrink handler if node is expanded
          tooltip.selectAll(".shrink-link, .shrink-icon, .shrink-action").on("click", shrinkHandler);
        } else {
          // Attach expand handler if node is not expanded
        tooltip.selectAll(".expand-link, .expand-icon, .expand-action").on("click", expandHandler);
        }
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
  }, [dataWithPictures, visible, onZoomChange]);

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
    if (!svgRef.current || !visible || !dataWithPictures) return;

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
  }, [filterState, visible, dataWithPictures]);

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
      {isExpandedMode && (
        <button
          onClick={() => resetToFirstDegree()}
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

      {/* Loading screen for network expansion */}
      {isExpandingNetwork && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="bg-black/90 rounded-xl p-6 sm:p-8 flex flex-col items-center space-y-4 sm:space-y-6 max-w-sm sm:max-w-md border border-pink-500/20 shadow-2xl">
            {/* Main Loading Spinner */}
            <div className="relative">
              <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-pink-500" />
              <div className="absolute inset-0 rounded-full border-2 border-pink-500/30 animate-pulse"></div>
            </div>

            {/* Loading Text */}
            <div className="text-center space-y-2">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Expanding Network
              </h3>
              <p className="text-sm sm:text-base text-gray-300">
                Discovering collaborators for <span className="font-medium text-pink-400">{expandingNodeName}</span>...
              </p>
            </div>

            {/* Progress Indicators */}
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <Brain className="h-3 w-3 text-pink-500" />
                <span>AI Analysis</span>
              </div>
              <div className="flex items-center space-x-1">
                <Network className="h-3 w-3 text-pink-500" />
                <span>Connections</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3 text-pink-500" />
                <span>Collaborators</span>
              </div>
            </div>

            {/* Animated Dots */}
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>

            {/* Additional Info */}
            <div className="text-xs text-gray-500 text-center max-w-xs">
              Using AI to generate authentic music industry connections
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

