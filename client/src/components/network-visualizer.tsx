import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import ArtistSelectionModal from "./artist-selection-modal";

interface NetworkVisualizerProps {
  data: NetworkData;
  visible: boolean;
  filterState: FilterState;
  onZoomChange: (transform: { k: number; x: number; y: number }) => void;
  onArtistSearch?: (artistName: string) => void;
}

export default function NetworkVisualizer({
  data,
  visible,
  filterState,
  onZoomChange,
  onArtistSearch,
}: NetworkVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState("");

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
    if (!svgRef.current || !data || !visible) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Clear existing content
    svg.selectAll("*").remove();

    // Filter out links where either node doesn't exist or is isolated
    const nodeSet = new Set(data.nodes.map(n => n.id));
    const validLinks = data.links.filter(link => {
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

    // EXACT COPY of the working zoom button functions
    const applyZoom = (scale: number) => {
      if (!svgRef.current) return;
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      
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

    const handlePinchZoomIn = () => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.min(5, prevZoom * 1.2); // Cap at 5x
        console.log(`🤏 Pinch zoom in: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyZoom(newZoom);
        return newZoom;
      });
    };

    const handlePinchZoomOut = () => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.max(0.2, prevZoom / 1.2); // Min 0.2x
        console.log(`🤏 Pinch zoom out: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyZoom(newZoom);
        return newZoom;
      });
    };

    // Pinch zoom variables
    let initialDistance = 0;
    let lastScale = 1;
    let isPinching = false;
    let pinchThreshold = 0.2; // Increased from 0.1 to 0.2 for less sensitivity

    // Custom touch event handlers using existing zoom functions
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        console.log("🤏 Starting pinch gesture");
        isPinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
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
        
        if (initialDistance > 0) {
          const scaleChange = currentDistance / initialDistance;
          
          // Use threshold to prevent too frequent updates
          if (Math.abs(scaleChange - lastScale) > pinchThreshold) {
            if (scaleChange > lastScale) {
              // Pinch out - zoom in using EXACT same code as zoom buttons
              handlePinchZoomIn();
            } else {
              // Pinch in - zoom out using EXACT same code as zoom buttons
              handlePinchZoomOut();
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
      
      // Determine zoom direction based on deltaY
      const zoomIn = event.deltaY < 0;
      
      // Immediate zoom for smooth response
      if (zoomIn) {
        handlePinchZoomIn();
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom in' : '🖱️ Mouse wheel zoom in');
      } else {
        handlePinchZoomOut();
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

    // Find connected components for cluster positioning
    const findConnectedComponents = () => {
      const visited = new Set<string>();
      const components: NetworkNode[][] = [];
      
      for (const node of data.nodes) {
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
              const target = data.nodes.find(n => n.id === targetId);
              if (target && !visited.has(target.id)) queue.push(target);
            } else if (targetId === current.id) {
              const source = data.nodes.find(n => n.id === sourceId);
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
    const mainArtistNode = data.nodes
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
      const margin = 50;
      for (const node of data.nodes) {
        if (node.x! < margin) node.x = margin;
        if (node.x! > width - margin) node.x = width - margin;
        if (node.y! < margin) node.y = margin;
        if (node.y! > height - margin) node.y = height - margin;
      }
    };

    // Create simulation with centering force for main artist
    const simulation = d3
      .forceSimulation<NetworkNode>(data.nodes)
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
      .data(data.nodes)
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
            .attr("stroke-width", 1);
        });
        
        // Add inner circle for better visibility
        group.append("circle")
          .attr("r", d.size - 4)
          .attr("fill", "transparent")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }
    })
      .on("mouseover", function(event, d) {
        // Highlight the entire node group
        d3.select(this).selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3);
        showTooltip(event, d);
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", function(event, d) {
        // Reset the stroke colors for the entire node group
        const group = d3.select(this);
        const roles = d.types || [d.type];
        
        if (roles.length === 1) {
          group.select("circle")
            .attr("stroke", () => {
              if (roles[0] === 'artist') return '#FF0ACF';
              if (roles[0] === 'producer') return '#AE53FF';
              if (roles[0] === 'songwriter') return '#67D1F8';
              return '#355367';
            })
            .attr("stroke-width", 4);
        } else {
          group.selectAll("path")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
          group.select("circle")
            .attr("stroke", "white")
            .attr("stroke-width", 2);
        }
        hideTooltip();
      })
      .on("click", function(event, d) {
        event.stopPropagation();
        console.log(`🎯 [CLICK DEBUG] ===== LEFT CLICK EVENT =====`);
        console.log(`🎯 [CLICK DEBUG] Node: "${d.name}"`);
        console.log(`🎯 [CLICK DEBUG] Type: ${d.type}`);
        console.log(`🎯 [CLICK DEBUG] Types: ${JSON.stringify(d.types)}`);
        console.log(`🎯 [CLICK DEBUG] ArtistId: ${d.artistId}`);
        
        // Left-click to expand artist's network (only for artist nodes that aren't the main artist)
        if ((d.type === 'artist' || (d.types && d.types.includes('artist'))) && onArtistSearch) {
          const mainArtistNode = data.nodes.find(node => node.size === 30 && node.type === 'artist');
          if (d !== mainArtistNode) {
            console.log(`🎯 [CLICK DEBUG] Expanding network for artist: ${d.name}`);
            onArtistSearch(d.name);
          } else {
            console.log(`🎯 [CLICK DEBUG] Skipping network expansion for main artist`);
          }
        } else {
          console.log(`🎯 [CLICK DEBUG] Not an artist node or no onArtistSearch callback, skipping action`);
        }
        console.log(`🎯 [CLICK DEBUG] ===== END LEFT CLICK EVENT =====`);
      })
      .on("contextmenu", function(event, d) {
        event.preventDefault();
        event.stopPropagation();
        console.log(`🎯 [CLICK DEBUG] ===== RIGHT CLICK EVENT =====`);
        console.log(`🎯 [CLICK DEBUG] Node: "${d.name}"`);
        console.log(`🎯 [CLICK DEBUG] Type: ${d.type}`);
        console.log(`🎯 [CLICK DEBUG] Types: ${JSON.stringify(d.types)}`);
        console.log(`🎯 [CLICK DEBUG] ArtistId: ${d.artistId}`);
        
        // Check if this is an artist node
        const isArtistNode = d.type === 'artist' || (d.types && d.types.includes('artist'));
        console.log(`🎯 [CLICK DEBUG] Is artist node: ${isArtistNode}`);
        
        if (isArtistNode) {
          console.log(`🎯 [CLICK DEBUG] Calling openMusicNerdProfile...`);
          
          // Check if this is the main artist (largest artist node)
          const isMainArtist = d === mainArtistNode;
          console.log(`🎯 [CLICK DEBUG] Is main artist: ${isMainArtist}`);
          
          try {
            // Always pass the artistId if available, let openMusicNerdProfile handle the logic
            console.log(`🎯 [CLICK DEBUG] Calling openMusicNerdProfile with artistId: ${d.artistId}`);
            openMusicNerdProfile(d.name, d.artistId);
          } catch (error) {
            console.error(`🎯 [CLICK DEBUG] Error calling openMusicNerdProfile:`, error);
          }
        } else {
          console.log(`🎯 [CLICK DEBUG] Not an artist node, skipping action`);
        }
        console.log(`🎯 [CLICK DEBUG] ===== END RIGHT CLICK EVENT =====`);
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
      .data(data.nodes)
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
      const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
      
      let content = `<strong>${d.name}</strong><br/>Role${roles.length > 1 ? 's' : ''}: ${roleDisplay}`;

      // Show collaboration information for producers and songwriters
      const hasProducerRole = roles.includes('producer') || roles.includes('songwriter');
      // Check both 'collaborations' and 'topCollaborators' fields for compatibility
      const collaborationData = d.collaborations || (d as any).topCollaborators;
      if (hasProducerRole && collaborationData && collaborationData.length > 0) {
        content += `<br/><br/><strong>Top Collaborations:</strong><br/>`;
        content += collaborationData.join("<br/>");
      }

      // Show general collaboration info for artists if available
      if (roles.includes('artist') && d.collaborations && d.collaborations.length > 0) {
        content += `<br/><br/><strong>Recent Collaborations:</strong><br/>`;
        content += d.collaborations.slice(0, 3).join("<br/>");
      }

      if (roles.includes('artist')) {
        content += `<br/><br/><em>Click to expand ${d.name}'s network</em>`;
        content += `<br/><em>Right-Click to view their Music Nerd profile</em>`;
      }

      tooltip.html(content).style("opacity", 1);
    }

    function moveTooltip(event: MouseEvent) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    }

    function hideTooltip() {
      tooltip.style("opacity", 0);
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
    };
  }, [data, visible, onZoomChange]);

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
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
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
    setCurrentZoom(1);
    applyZoom(1);
    console.log('Zoom reset to 1.00');
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
      className={`network-container transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <svg ref={svgRef} className="w-full h-full" />
      
      <ArtistSelectionModal
        isOpen={showArtistModal}
        onClose={() => setShowArtistModal(false)}
        artistName={selectedArtistName}
        onSelectArtist={handleArtistSelection}
      />
    </div>
  );
}
