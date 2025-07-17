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
    if (!data || !visible) {
      console.log(`⏸️ [Frontend] Skipping visualization - data: ${!!data}, visible: ${visible}`);
      return;
    }

    console.log(`🚀 [Frontend] ===== STARTING NETWORK VISUALIZATION =====`);
    console.log(`📊 [Frontend] Data nodes: ${data.nodes.length}, links: ${data.links.length}`);
    console.log(`🔗 [Frontend] Link data sample:`, data.links.slice(0, 2));

    const svg = d3.select(svgRef.current);
    if (svg.empty()) {
      console.error(`❌ [Frontend] SVG ref is empty!`);
      return;
    }
    
    console.log(`✅ [Frontend] SVG selected successfully`);

    // Clear previous content
    svg.selectAll("*").remove();

    const width = window.innerWidth;
    const height = window.innerHeight;

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

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "network-tooltip")
      .style("position", "absolute")
      .style("opacity", 0);

    // Function to show collaboration tooltip
    function showCollaborationTooltip(event: MouseEvent, link: NetworkLink) {
      const sourceName = typeof link.source === 'string' ? link.source : link.source.name;
      const targetName = typeof link.target === 'string' ? link.target : link.target.name;
      
      if (!link.collaborationDetails) {
        // Show loading state
        const content = `<strong>${sourceName} ↔ ${targetName}</strong><br/><em>Loading collaboration details...</em><br/><small>Click on this link to fetch data</small>`;
        tooltip.html(content).style("opacity", 1);
        return;
      }

      const details = link.collaborationDetails;
      
      if (!details.hasData) {
        // Show no data state with more helpful information
        const content = `<strong>${sourceName} ↔ ${targetName}</strong><br/><em>No specific collaboration data found</em><br/><small>This may indicate limited database coverage or they haven't worked together on recorded music</small>`;
        tooltip.html(content).style("opacity", 1);
        return;
      }

      // Build content with collaboration details
      let content = `<strong>${sourceName} ↔ ${targetName}</strong><br/>`;
      
      if (details.collaborationType && details.collaborationType !== 'unknown') {
        content += `<em>Collaboration Type: ${details.collaborationType}</em><br/><br/>`;
      }

      if (details.songs.length > 0) {
        content += `<strong>Songs:</strong><br/>`;
        content += details.songs.slice(0, 5).map(song => `• ${song}`).join('<br/>');
        if (details.songs.length > 5) {
          content += `<br/>• ... and ${details.songs.length - 5} more`;
        }
        content += '<br/><br/>';
      }

      if (details.albums.length > 0) {
        content += `<strong>Albums:</strong><br/>`;
        content += details.albums.slice(0, 3).map(album => `• ${album}`).join('<br/>');
        if (details.albums.length > 3) {
          content += `<br/>• ... and ${details.albums.length - 3} more`;
        }
        content += '<br/><br/>';
      }

      if (details.details.length > 0) {
        content += `<strong>Details:</strong><br/>`;
        content += details.details.slice(0, 3).join('<br/>');
        if (details.details.length > 3) {
          content += `<br/>... and ${details.details.length - 3} more`;
        }
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

    // Function to fetch collaboration details
    const fetchCollaborationDetails = async (link: NetworkLink, linkElement: any): Promise<void> => {
      const sourceName = typeof link.source === 'string' ? link.source : link.source.name;
      const targetName = typeof link.target === 'string' ? link.target : link.target.name;
      
      console.log(`🤝 [Frontend] STARTING fetchCollaborationDetails for "${sourceName}" and "${targetName}"`);
      
      try {
        console.log(`🌐 [Frontend] Making fetch request to: /api/collaboration/${encodeURIComponent(sourceName)}/${encodeURIComponent(targetName)}`);
        const response = await fetch(`/api/collaboration/${encodeURIComponent(sourceName)}/${encodeURIComponent(targetName)}`);
        console.log(`📡 [Frontend] Response status: ${response.status}, ok: ${response.ok}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const collaborationData = await response.json();
        console.log(`📄 [Frontend] Collaboration data received:`, collaborationData);
        
        // Store the collaboration details in the link data
        link.collaborationDetails = collaborationData;
        console.log(`✅ [Frontend] Collaboration details stored:`, collaborationData.hasData ? 'Data found' : 'No data');
        
        // Update link appearance based on data availability
        if (collaborationData.hasData) {
          console.log(`🎨 [Frontend] Updating link to blue (data found)`);
          linkElement
            .attr("stroke", "#67D1F8") // Light blue for links with data
            .style("cursor", "pointer")
            .style("opacity", 1)
            .attr("stroke-dasharray", null) // Solid line
            .attr("stroke-width", 5); // Consistent with new thicker default
        } else {
          console.log(`🎨 [Frontend] Updating link to gray (no data)`);
          linkElement
            .attr("stroke", "#888888") // Keep gray but still interactive
            .style("cursor", "pointer") // Keep clickable for small artists too
            .style("opacity", 0.6)
            .attr("stroke-dasharray", "3,3") // Subtle dashed line
            .attr("stroke-width", 5); // Consistent with new thicker default
        }
        
        console.log(`✅ [Frontend] fetchCollaborationDetails completed successfully`);
      } catch (error) {
        console.error(`❌ [Frontend] Error in fetchCollaborationDetails:`, error);
        console.error(`❌ [Frontend] Error details:`, {
          sourceName,
          targetName,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : 'No stack trace'
        });
        
        link.collaborationDetails = {
          songs: [],
          albums: [],
          collaborationType: 'unknown',
          details: [],
          hasData: false
        };
        
        // Style as no-data link but keep interactive
        linkElement
          .attr("stroke", "#888888")
          .style("cursor", "pointer") // Keep clickable for all artists
          .style("opacity", 0.6)
          .attr("stroke-dasharray", "3,3");
      }
    };

    // Create links with enhanced debugging
    console.log(`🔗 [Frontend] Creating ${validLinks.length} links`);
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke", "#888888") // Default gray for all links initially
      .attr("stroke-width", 5) // Increased from 2 to 5 for easier interaction
      .style("cursor", "pointer")
      .style("opacity", 0.8); // Slightly transparent to indicate interactivity
    
    // Add event handlers separately for better debugging
    console.log(`🎯 [Frontend] Adding event handlers to ${linkElements.size()} link elements`);
    
    linkElements
      .on("mouseenter", async function(event, d) {
        console.log(`🖱️ [Frontend] Link mouseenter triggered`, {
          source: typeof d.source === 'string' ? d.source : d.source.name,
          target: typeof d.target === 'string' ? d.target : d.target.name,
          hasCollaborationDetails: !!d.collaborationDetails
        });
        
        // Highlight the link - make it even thicker on hover
        d3.select(this)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 8); // Increased from 4 to 8 for better visibility
        
        // Fetch collaboration details if not already fetched
        if (!d.collaborationDetails) {
          console.log(`📡 [Frontend] No collaboration details found, fetching...`);
          await fetchCollaborationDetails(d, d3.select(this));
        } else {
          console.log(`💾 [Frontend] Using cached collaboration details`);
        }
        
        // Show collaboration tooltip
        showCollaborationTooltip(event, d);
      })
      .on("mousemove", function(event, d) {
        moveTooltip(event);
      })
      .on("mouseleave", function(event, d) {
        console.log(`🖱️ [Frontend] Link mouseleave`);
        // Reset link appearance - back to thicker default
        d3.select(this)
          .attr("stroke", d.collaborationDetails?.hasData ? "#67D1F8" : "#555555")
          .attr("stroke-width", 5); // Increased from 2 to 5
        
        hideTooltip();
      })
      .on("click", async function(event, d) {
        console.log(`🔗 [Frontend] Link clicked!`, {
          source: typeof d.source === 'string' ? d.source : d.source.name,
          target: typeof d.target === 'string' ? d.target : d.target.name,
          hasCollaborationDetails: !!d.collaborationDetails
        });
        
        // Prevent event bubbling
        event.stopPropagation();
        
        // Fetch collaboration details if not already fetched
        if (!d.collaborationDetails) {
          console.log(`📡 [Frontend] Fetching collaboration details on click...`);
          await fetchCollaborationDetails(d, d3.select(this));
        } else {
          console.log(`💾 [Frontend] Already have collaboration details`);
        }
        
        // Now check if there's collaboration data
        if (d.collaborationDetails?.hasData) {
          console.log(`✅ [Frontend] Link clicked with collaboration data - showing tooltip`);
          showCollaborationTooltip(event, d);
          setTimeout(() => hideTooltip(), 5000); // Show tooltip for 5 seconds
        } else {
          console.log(`❌ [Frontend] Link clicked but no collaboration data available after fetching`);
          showCollaborationTooltip(event, d);
          setTimeout(() => hideTooltip(), 3000); // Show tooltip for 3 seconds
        }
      });
    
    // Log final link creation status
    console.log(`✅ [Frontend] Link creation complete. Total links: ${linkElements.size()}`);
    console.log(`🔍 [Frontend] Sample link data:`, validLinks.slice(0, 2));

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
          
          // Create proper arc data object
          const arcData = {
            innerRadius: d.size - 4,
            outerRadius: d.size,
            startAngle: startAngle,
            endAngle: endAngle
          };
          
          group.append("path")
            .attr("d", arcPath(arcData)) // Fix: Call with proper arc data object
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
        console.log(`